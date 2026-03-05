import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RoomsService } from './rooms.service.js';
import { SessionsService } from '../sessions/sessions.service.js';

/**
 * WebSocket gateway for mediasoup SFU signaling.
 */
@WebSocketGateway({
    cors: {
        origin: true,
        credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
})
export class RoomsGateway implements OnGatewayDisconnect {
    private readonly logger = new Logger(RoomsGateway.name);

    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly roomsService: RoomsService,
        private readonly sessionsService: SessionsService
    ) { }

    @SubscribeMessage('create-room')
    async handleCreateRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { pin: string },
    ) {
        this.logger.log(`🏠 [create-room] PIN: ${data.pin}, socket: ${client.id}`);
        try {
            const { rtpCapabilities } = await this.roomsService.createRoom(
                data.pin,
                client.id,
            );
            client.join(data.pin);
            return { rtpCapabilities };
        } catch (error: any) {
            this.logger.error(`❌ [create-room] Error: ${error.message}`);
            return { error: error.message };
        }
    }

    @SubscribeMessage('join-room')
    async handleJoinRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { pin: string },
    ) {
        this.logger.log(`👀 [join-room] PIN: ${data.pin}, socket: ${client.id}`);
        const rtpCapabilities = this.roomsService.getRtpCapabilities(data.pin);
        if (!rtpCapabilities) {
            this.logger.warn(`⚠️ [join-room] Room not found: ${data.pin}`);
            return { error: 'Room not found' };
        }
        client.join(data.pin);
        const producerIds = this.roomsService.getProducerIds(data.pin);
        return { rtpCapabilities, producerIds };
    }

    @SubscribeMessage('create-transport')
    async handleCreateTransport(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { pin: string },
    ) {
        try {
            const params = await this.roomsService.createTransport(data.pin);
            if (!params) return { error: 'Room not found' };
            return { params };
        } catch (error: any) {
            this.logger.error(`❌ [create-transport] Error: ${error.message}`);
            return { error: error.message };
        }
    }

    @SubscribeMessage('connect-transport')
    async handleConnectTransport(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { pin: string; transportId: string; dtlsParameters: any },
    ) {
        try {
            const success = await this.roomsService.connectTransport(
                data.pin,
                data.transportId,
                data.dtlsParameters,
            );
            if (!success) return { error: 'Transport not found' };
            return { connected: true };
        } catch (error: any) {
            this.logger.error(`❌ [connect-transport] Error: ${error.message}`);
            return { error: error.message };
        }
    }

    @SubscribeMessage('produce')
    async handleProduce(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { pin: string; transportId: string; kind: 'video' | 'audio'; rtpParameters: any },
    ) {
        try {
            const result = await this.roomsService.produce(
                data.pin,
                data.transportId,
                data.kind,
                data.rtpParameters,
            );
            if (!result) return { error: 'Failed to produce' };
            client.to(data.pin).emit('new-producer', {
                producerId: result.producerId,
                kind: data.kind,
            });
            return { producerId: result.producerId };
        } catch (error: any) {
            this.logger.error(`❌ [produce] Error: ${error.message}`);
            return { error: error.message };
        }
    }

    @SubscribeMessage('consume')
    async handleConsume(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { pin: string; transportId: string; producerId: string; rtpCapabilities: any },
    ) {
        try {
            const consumerData = await this.roomsService.consume(
                data.pin,
                data.transportId,
                data.producerId,
                data.rtpCapabilities,
            );
            if (!consumerData) return { error: 'Cannot consume' };
            return { params: consumerData };
        } catch (error: any) {
            this.logger.error(`❌ [consume] Error: ${error.message}`);
            return { error: error.message };
        }
    }

    @SubscribeMessage('consumer-resume')
    async handleConsumerResume(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { pin: string; consumerId: string },
    ) {
        try {
            const success = await this.roomsService.resumeConsumer(data.pin, data.consumerId);
            if (!success) return { error: 'Consumer not found' };
            return { resumed: true };
        } catch (error: any) {
            this.logger.error(`❌ [consumer-resume] Error: ${error.message}`);
            return { error: error.message };
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`🔌 Socket disconnected: ${client.id}`);
        // Find if this was a host
        const pin = this.roomsService.findRoomByHostSocket(client.id);
        if (pin) {
            this.logger.log(`🏠 Host disconnected — cleaning up room and session: ${pin}`);

            // 1. Notify viewers
            this.server.to(pin).emit('room-closed', { pin });

            // 2. Clean up Mediasoup room
            this.roomsService.closeRoom(pin);

            // 3. Clean up Session metadata (Home list)
            const session = this.sessionsService.findSessionByPin(pin);
            if (session) {
                this.sessionsService.deleteSession(session.sessionId);
            }

            // 4. Update UI for everyone
            this.server.emit('sessions-updated');
        }
    }
}
