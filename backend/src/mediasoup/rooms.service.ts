import { Injectable, Logger } from '@nestjs/common';
import type { RtpCapabilities } from 'mediasoup/types';
import { MediasoupService } from './mediasoup.service.js';
import type { Room, TransportOptions, ConsumerData } from './mediasoup.types.js';

/**
 * RoomsService manages the lifecycle of SFU rooms.
 */
@Injectable()
export class RoomsService {
    private readonly logger = new Logger(RoomsService.name);

    /** In-memory store: PIN → Room */
    private readonly rooms = new Map<string, Room>();

    constructor(private readonly mediasoupService: MediasoupService) { }

    /**
     * Create a new SFU room for a host.
     */
    async createRoom(
        pin: string,
        hostSocketId: string,
    ): Promise<{ rtpCapabilities: RtpCapabilities }> {
        // Prevent duplicate rooms for the same pin
        if (this.rooms.has(pin)) {
            const existingRoom = this.rooms.get(pin);
            // If the same host is trying to create the room again (e.g. page reload or React double-effect)
            // we just return the existing capabilities.
            if (existingRoom && existingRoom.hostSocketId === hostSocketId) {
                this.logger.log(`♻️ Room for PIN ${pin} already exists and host matches. Reusing.`);
                return {
                    rtpCapabilities: this.mediasoupService.getRouterRtpCapabilities(existingRoom.router),
                };
            }

            this.logger.warn(`⚠️ Room already exists for PIN: ${pin}. Overwriting.`);
            this.closeRoom(pin);
        }

        const router = await this.mediasoupService.createRouter();

        const room: Room = {
            router,
            hostSocketId,
            transports: new Map(),
            producers: new Map(),
            consumers: new Map(),
            createdAt: new Date(),
        };

        this.rooms.set(pin, room);

        this.logger.log(
            `🏠 Room created — PIN: ${pin}, host: ${hostSocketId}, router: ${router.id}`,
        );

        return {
            rtpCapabilities: this.mediasoupService.getRouterRtpCapabilities(router),
        };
    }

    /**
     * Get the RTP capabilities for an existing room.
     */
    getRtpCapabilities(pin: string): RtpCapabilities | null {
        const room = this.rooms.get(pin);
        if (!room) return null;
        return this.mediasoupService.getRouterRtpCapabilities(room.router);
    }

    hasRoom(pin: string): boolean {
        return this.rooms.has(pin);
    }

    getHostSocketId(pin: string): string | null {
        return this.rooms.get(pin)?.hostSocketId ?? null;
    }

    /**
     * Create a WebRtcTransport for a participant.
     */
    async createTransport(pin: string): Promise<TransportOptions | null> {
        const room = this.rooms.get(pin);
        if (!room) {
            this.logger.warn(`⚠️ createTransport: Room not found for PIN: ${pin}`);
            return null;
        }

        const { transport, params } =
            await this.mediasoupService.createWebRtcTransport(room.router);

        room.transports.set(transport.id, transport);

        this.logger.log(
            `🔌 Transport added to room ${pin}: ${transport.id}`,
        );

        return params;
    }

    /**
     * Connect a transport.
     */
    async connectTransport(
        pin: string,
        transportId: string,
        dtlsParameters: any,
    ): Promise<boolean> {
        const room = this.rooms.get(pin);
        if (!room) return false;

        const transport = room.transports.get(transportId);
        if (!transport) return false;

        await this.mediasoupService.connectTransport(transport, dtlsParameters);
        return true;
    }

    /**
     * Create a Producer.
     */
    async produce(
        pin: string,
        transportId: string,
        kind: 'video' | 'audio',
        rtpParameters: any,
    ): Promise<{ producerId: string } | null> {
        const room = this.rooms.get(pin);
        if (!room) return null;

        const transport = room.transports.get(transportId);
        if (!transport) return null;

        const producer = await this.mediasoupService.createProducer(
            transport,
            kind,
            rtpParameters,
        );

        room.producers.set(producer.id, producer);

        producer.on('transportclose', () => {
            room.producers.delete(producer.id);
        });

        this.logger.log(
            `🎬 Producer added to room ${pin}: ${producer.id} (${kind})`,
        );

        return { producerId: producer.id };
    }

    getProducerIds(pin: string): string[] {
        const room = this.rooms.get(pin);
        if (!room) return [];
        return Array.from(room.producers.keys());
    }

    /**
     * Create a Consumer for a viewer.
     */
    async consume(
        pin: string,
        transportId: string,
        producerId: string,
        rtpCapabilities: RtpCapabilities,
    ): Promise<ConsumerData | null> {
        const room = this.rooms.get(pin);
        if (!room) return null;

        const transport = room.transports.get(transportId);
        if (!transport) return null;

        const result = await this.mediasoupService.createConsumer(
            room.router,
            transport,
            producerId,
            rtpCapabilities,
        );

        if (!result) return null;

        const { consumer, params } = result;
        room.consumers.set(consumer.id, consumer);

        consumer.on('transportclose', () => {
            room.consumers.delete(consumer.id);
        });

        consumer.on('producerclose', () => {
            room.consumers.delete(consumer.id);
        });

        this.logger.log(
            `📺 Consumer added to room ${pin}: ${consumer.id}`,
        );

        return params;
    }

    async resumeConsumer(pin: string, consumerId: string): Promise<boolean> {
        const room = this.rooms.get(pin);
        if (!room) return false;

        const consumer = room.consumers.get(consumerId);
        if (!consumer) return false;

        await consumer.resume();
        this.logger.log(`▶️ Consumer resumed: ${consumerId}`);
        return true;
    }

    /**
     * Clean up a room.
     */
    closeRoom(pin: string): void {
        const room = this.rooms.get(pin);
        if (!room) return;

        this.logger.log(`🧹 Closing room: ${pin}`);

        room.consumers.forEach(c => c.close());
        room.consumers.clear();

        room.producers.forEach(p => p.close());
        room.producers.clear();

        room.transports.forEach(t => t.close());
        room.transports.clear();

        room.router.close();
        this.rooms.delete(pin);

        this.logger.log(`✅ Room ${pin} fully cleaned up`);
    }

    findRoomByHostSocket(socketId: string): string | null {
        for (const [pin, room] of this.rooms) {
            if (room.hostSocketId === socketId) {
                return pin;
            }
        }
        return null;
    }
}
