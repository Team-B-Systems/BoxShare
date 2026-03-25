import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as mediasoup from 'mediasoup';
import * as os from 'os';
import type {
    Worker,
    Router,
    WebRtcTransport,
    Producer,
    Consumer,
    RtpCapabilities,
    MediaKind,
    RtpParameters,
    DtlsParameters,
    RouterRtpCodecCapability,
    WebRtcServer,
} from 'mediasoup/types';
import type { TransportOptions, ConsumerData } from './mediasoup.types.js';

@Injectable()
export class MediasoupService implements OnModuleInit {
    private readonly logger = new Logger(MediasoupService.name);
    private worker!: Worker;
    private webRtcServer!: WebRtcServer;
    private lanIp: string = '127.0.0.1';

    // Single port for all WebRTC media (very friendly for WSL/NAT/Docker)
    private readonly WEBRTC_PORT = 4443;

    private getMediaCodecs(): RouterRtpCodecCapability[] {
        return [
            {
                kind: 'video',
                mimeType: 'video/VP8',
                clockRate: 90000,
                rtcpFeedback: [
                    { type: 'nack' },
                    { type: 'nack', parameter: 'pli' },
                    { type: 'ccm', parameter: 'fir' },
                    { type: 'goog-remb' },
                    { type: 'transport-cc' },
                ],
            },
            {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2,
            },
        ];
    }

    async onModuleInit(): Promise<void> {
        this.logger.log('🚀 Creating mediasoup Worker...');

        // Get all possible LAN IPs to announce to clients
        const publicIps = this.getAllInternalIps();
        this.logger.log(`🔍 [IP DETECTION] Found ${publicIps.length} non-internal IPs: ${publicIps.join(', ')}`);

        this.worker = await mediasoup.createWorker({
            logLevel: 'warn',
            logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        });

        // Create WebRtcServer to listen on a SINGLE port
        // We announce ALL detected IPs so clients on any sub-network can connect
        const listenInfos: any[] = [];
        for (const ip of publicIps) {
            listenInfos.push(
                {
                    protocol: 'udp',
                    ip: ip, // Bind to specific interface IP
                    announcedIp: ip,
                    port: this.WEBRTC_PORT,
                },
                {
                    protocol: 'tcp',
                    ip: ip, // Bind to specific interface IP
                    announcedIp: ip,
                    port: this.WEBRTC_PORT,
                }
            );
        }

        // Always add loopback in case someone uses it
        if (!publicIps.includes('127.0.0.1')) {
            listenInfos.push(
                { protocol: 'udp', ip: '127.0.0.1', announcedIp: '127.0.0.1', port: this.WEBRTC_PORT },
                { protocol: 'tcp', ip: '127.0.0.1', announcedIp: '127.0.0.1', port: this.WEBRTC_PORT }
            );
        }

        this.webRtcServer = await this.worker.createWebRtcServer({ listenInfos });

        this.logger.log(`✅ [Mediasoup] WebRtcServer created on port ${this.WEBRTC_PORT}`);
        this.logger.log(`📡 [Listen Config] Listening on ${listenInfos.length} entries for specific interface IPs.`);

        this.worker.on('died', (error) => {
            this.logger.error(`💀 mediasoup Worker died! Error: ${error?.message}`);
            setTimeout(() => process.exit(1), 2000);
        });
    }

    private getAllInternalIps(): string[] {
        const interfaces = os.networkInterfaces();
        const ips: string[] = [];

        // Priority IPs if set via ENV
        if (process.env.ANNOUNCED_IP) {
            return [process.env.ANNOUNCED_IP];
        }

        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]!) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    ips.push(iface.address);
                }
            }
        }
        return ips.length > 0 ? ips : ['127.0.0.1'];
    }

    async createRouter(): Promise<Router> {
        return await this.worker.createRouter({ mediaCodecs: this.getMediaCodecs() });
    }

    getRouterRtpCapabilities(router: Router): RtpCapabilities { return router.rtpCapabilities; }

    async createWebRtcTransport(
        router: Router,
    ): Promise<{ transport: WebRtcTransport; params: TransportOptions }> {
        const transport = await router.createWebRtcTransport({
            webRtcServer: this.webRtcServer, // Use the single-port server
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            initialAvailableOutgoingBitrate: 1500000,
        });

        const params: TransportOptions = {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        };

        this.logger.log(`📡 [WebRtcTransport] Transport created. ID: ${transport.id}`);
        this.logger.log(`   🔸 Candidates: ${params.iceCandidates.map((c: any) => `${c.ip}:${c.port} (${c.protocol})`).join(', ')}`);

        return { transport, params };
    }

    async connectTransport(transport: WebRtcTransport, dtlsParameters: DtlsParameters): Promise<void> {
        await transport.connect({ dtlsParameters });
    }

    async createProducer(transport: WebRtcTransport, kind: MediaKind, rtpParameters: RtpParameters): Promise<Producer> {
        return await transport.produce({ kind, rtpParameters });
    }

    async createConsumer(router: Router, transport: WebRtcTransport, producerId: string, rtpCapabilities: RtpCapabilities): Promise<{ consumer: Consumer; params: ConsumerData } | null> {
        if (!router.canConsume({ producerId, rtpCapabilities })) return null;
        const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
        return { consumer, params: { id: consumer.id, producerId: consumer.producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters } };
    }
}
