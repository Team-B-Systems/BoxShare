import { Device } from 'mediasoup-client';
import type {
    Transport,
    Producer,
    Consumer,
    RtpCapabilities,
} from 'mediasoup-client/types';
import { getSocket } from './socket';

/**
 * WebRTC Service using mediasoup SFU.
 * Robust against React StrictMode and concurrent mounting.
 */

// Shared Device state
let device: Device | null = null;
let loadDevicePromise: Promise<void> | null = null;

// Initialization Locks (survive between renders)
const hostInitPromises = new Map<string, Promise<void>>();
const joinInitPromises = new Map<string, Promise<void>>();

// Active resources
const activeSendTransports = new Map<string, Transport>();
const activeRecvTransports = new Map<string, Transport>();
const producers = new Map<string, Producer>();
const consumers = new Map<string, Consumer>();
const consumedProducerIds = new Set<string>();

/**
 * Initialize the mediasoup Device.
 */
const initDevice = async (rtpCapabilities: RtpCapabilities) => {
    if (loadDevicePromise) return loadDevicePromise;
    if (device?.loaded) return;

    loadDevicePromise = (async () => {
        try {
            if (!device) device = new Device();
            if (!device.loaded) {
                await device.load({ routerRtpCapabilities: rtpCapabilities });
                console.log('✅ [Mediasoup] Device loaded');
            }
        } catch (error) {
            console.error('❌ [Mediasoup] Failed to load device:', error);
            loadDevicePromise = null;
            throw error;
        }
    })();

    return loadDevicePromise;
};

/**
 * HOSTER: Start sharing screen.
 */
export const startSfuHost = async (
    _sessionId: string,
    pin: string,
    stream: MediaStream,
    onDisconnect?: () => void
): Promise<void> => {
    // If already sharing, ignore
    if (activeSendTransports.has(pin)) return;

    // If already starting, wait for that promise
    if (hostInitPromises.has(pin)) return hostInitPromises.get(pin);

    const initPromise = (async () => {
        const socket = getSocket();
        console.log(`🚀 [Host] Initiating SFU for PIN ${pin}...`);

        try {
            const { rtpCapabilities, error: createError } = await socket.timeout(10000).emitWithAck('create-room', { pin });
            if (createError) throw new Error(createError);

            await initDevice(rtpCapabilities);

            const { params, error: transportError } = await socket.timeout(10000).emitWithAck('create-transport', { pin });
            if (transportError) throw new Error(transportError);

            const transport = device!.createSendTransport(params);
            activeSendTransports.set(pin, transport);

            transport.on('connect', async ({ dtlsParameters }: { dtlsParameters: any }, callback: () => void, errback: (error: Error) => void) => {
                try {
                    await socket.timeout(10000).emitWithAck('connect-transport', { pin, transportId: transport.id, dtlsParameters });
                    callback();
                } catch (error: any) {
                    errback(error);
                }
            });

            transport.on('produce', async ({ kind, rtpParameters }: { kind: any, rtpParameters: any }, callback: ({ id }: { id: string }) => void, errback: (error: Error) => void) => {
                try {
                    const { producerId, error: produceError } = await socket.timeout(10000).emitWithAck('produce', {
                        pin,
                        transportId: transport.id,
                        kind,
                        rtpParameters,
                    });
                    if (produceError) throw new Error(produceError);
                    callback({ id: producerId });
                } catch (error: any) {
                    errback(error);
                }
            });

            transport.on('connectionstatechange', (state) => {
                console.log(`🔗 [Host] Transport state: ${state}`);
                if (state === 'failed' || state === 'disconnected') {
                    console.error('❌ [Host] ICE Connection failed. This usually means port 4443 (UDP/TCP) is blocked or IP is unreachable.');
                    onDisconnect?.();
                }
            });

            console.log('📡 [Host] Send Transport created with ICE candidates:', params.iceCandidates);

            const videoTrack = stream.getVideoTracks()[0];
            const producer = await transport.produce({ track: videoTrack });
            producers.set(producer.id, producer);

            console.log('🎬 [Host] Video production started:', producer.id);
        } catch (error) {
            console.error('❌ [Host] SFU Start Failed:', error);
            activeSendTransports.delete(pin);
            throw error;
        } finally {
            hostInitPromises.delete(pin);
        }
    })();

    hostInitPromises.set(pin, initPromise);
    return initPromise;
};

/**
 * VIEWER: Join a session.
 */
export const joinSfuSession = async (
    _sessionId: string,
    pin: string,
    onTrack: (stream: MediaStream) => void,
    onDisconnect?: () => void
): Promise<void> => {
    if (activeRecvTransports.has(pin)) return;
    if (joinInitPromises.has(pin)) return joinInitPromises.get(pin);

    const initPromise = (async () => {
        const socket = getSocket();
        console.log(`👀 [Viewer] Joining SFU session ${pin}...`);

        try {
            const { rtpCapabilities, producerIds, error: joinError } = await socket.timeout(10000).emitWithAck('join-room', { pin });
            if (joinError) throw new Error(joinError);

            await initDevice(rtpCapabilities);

            const { params, error: transportError } = await socket.timeout(10000).emitWithAck('create-transport', { pin });
            if (transportError) throw new Error(transportError);

            const transport = device!.createRecvTransport(params);
            activeRecvTransports.set(pin, transport);

            transport.on('connect', async ({ dtlsParameters }: { dtlsParameters: any }, callback: () => void, errback: (error: Error) => void) => {
                try {
                    await socket.timeout(10000).emitWithAck('connect-transport', { pin, transportId: transport.id, dtlsParameters });
                    callback();
                } catch (error: any) {
                    errback(error);
                }
            });

            transport.on('connectionstatechange', (state) => {
                console.log(`🔗 [Viewer] Transport state: ${state}`);
                if (state === 'failed' || state === 'disconnected') {
                    console.error('❌ [Viewer] SFU connection timeout. Check if port 4443 (UDP/TCP) is open on Host Firewall.');
                    onDisconnect?.();
                }
            });

            console.log('📡 [Viewer] Recv Transport created with ICE candidates:', params.iceCandidates);

            socket.on('new-producer', async (data: { producerId: string }) => {
                await consumeProducer(pin, transport, data.producerId, onTrack);
            });

            for (const producerId of producerIds) {
                await consumeProducer(pin, transport, producerId, onTrack);
            }

            socket.on('room-closed', () => onDisconnect?.());
        } catch (error) {
            console.error('❌ [Viewer] SFU Join Failed:', error);
            activeRecvTransports.delete(pin);
            throw error;
        } finally {
            joinInitPromises.delete(pin);
        }
    })();

    joinInitPromises.set(pin, initPromise);
    return initPromise;
};

const consumeProducer = async (
    pin: string,
    transport: Transport,
    producerId: string,
    onTrack: (stream: MediaStream) => void
) => {
    if (consumedProducerIds.has(producerId)) return;
    consumedProducerIds.add(producerId);

    const socket = getSocket();
    try {
        const { params, error: consumeError } = await socket.timeout(10000).emitWithAck('consume', {
            pin,
            transportId: transport.id,
            producerId,
            rtpCapabilities: device!.rtpCapabilities,
        });

        if (consumeError) throw new Error(consumeError);

        const consumer = await transport.consume(params);
        consumers.set(consumer.id, consumer);

        await socket.timeout(10000).emitWithAck('consumer-resume', { pin, consumerId: consumer.id });

        consumer.on('transportclose', () => {
            consumers.delete(consumer.id);
            consumedProducerIds.delete(producerId);
        });

        onTrack(new MediaStream([consumer.track]));
        console.log('📺 [Viewer] Consuming producer:', producerId);
    } catch (error) {
        console.error('❌ [Viewer] Consume Failed:', error);
        consumedProducerIds.delete(producerId);
    }
};

export const cleanupSfu = () => {
    console.log('🛑 [Mediasoup] Cleanup');
    const socket = getSocket();
    socket.off('new-producer');
    socket.off('room-closed');

    producers.forEach(p => p.close()); producers.clear();
    consumers.forEach(c => c.close()); consumers.clear();
    consumedProducerIds.clear();

    activeSendTransports.forEach(t => t.close()); activeSendTransports.clear();
    activeRecvTransports.forEach(t => t.close()); activeRecvTransports.clear();

    loadDevicePromise = null;
    // We don't clear InitPromises here so that a racing remount can still wait for the previous one
};
