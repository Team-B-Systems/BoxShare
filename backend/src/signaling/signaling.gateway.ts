import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SignalingService } from './signaling.service';

/**
 * WebSocket gateway for WebRTC signaling.
 *
 * Signaling flow:
 * 1. Host starts sharing → emits "register-host" to associate socket with session
 * 2. Viewer joins → emits "join-session", gateway notifies host via "viewer-joined"
 * 3. Host creates per-viewer offer → emits "offer" with targetViewerId
 * 4. Gateway forwards offer to the specific viewer
 * 5. Viewer creates answer → emits "answer", gateway forwards to host
 * 6. ICE candidates are relayed between host ↔ viewer
 *
 * The gateway listens on all origins to support LAN environments.
 */
@WebSocketGateway({
    cors: {
        origin: '*', // Allow all origins (LAN environment)
    },
})
export class SignalingGateway implements OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    constructor(private readonly signalingService: SignalingService) { }

    /**
     * Register the host's socket ID with a session.
     * Called once when the host starts sharing, before any viewers join.
     */
    @SubscribeMessage('register-host')
    handleRegisterHost(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { sessionId: string },
    ) {
        console.log(
            `🏠 Host registered for session: ${data.sessionId} (socket: ${client.id})`,
        );
        this.signalingService.registerHost(data.sessionId, client.id);
    }

    /**
     * Handle a host sending a targeted WebRTC offer to a specific viewer.
     * The offer is forwarded directly to the target viewer.
     */
    @SubscribeMessage('offer')
    handleOffer(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        data: {
            sessionId: string;
            offer: RTCSessionDescriptionInit;
            targetViewerId: string;
        },
    ) {
        console.log(
            `📤 Offer from host → viewer ${data.targetViewerId} (session: ${data.sessionId})`,
        );

        // Forward the offer directly to the target viewer, including the
        // host's socket ID so the viewer knows where to send ICE candidates.
        this.server.to(data.targetViewerId).emit('offer', {
            offer: data.offer,
            sessionId: data.sessionId,
            hostSocketId: client.id,
        });
    }

    /**
     * Handle a viewer joining a session.
     * We do NOT send an offer here — instead we just notify the host,
     * who will create a per-viewer offer and send it back.
     */
    @SubscribeMessage('join-session')
    handleJoinSession(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { sessionId: string },
    ) {
        console.log(
            `👀 Viewer ${client.id} joining session: ${data.sessionId}`,
        );

        // Register the viewer in the session
        this.signalingService.handleViewerJoin(data.sessionId, client.id);

        // Notify the host so it can create a per-viewer peer connection
        const hostSocketId = this.signalingService.getHostSocketId(
            data.sessionId,
        );
        if (hostSocketId) {
            console.log(`✅ Host found: ${hostSocketId}. Notifying...`);
            this.server.to(hostSocketId).emit('viewer-joined', {
                viewerId: client.id,
                sessionId: data.sessionId,
            });
        } else {
            console.warn(`❌ No host found for session: ${data.sessionId}`);
            client.emit('error', { message: 'Host is not available' });
        }
    }

    /**
     * Handle a viewer sending their WebRTC answer.
     * The answer is forwarded to the host.
     */
    @SubscribeMessage('answer')
    handleAnswer(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        data: {
            sessionId: string;
            answer: RTCSessionDescriptionInit;
            viewerId: string;
        },
    ) {
        console.log(`📥 Answer received for session: ${data.sessionId}`);
        const hostSocketId = this.signalingService.getHostSocketId(
            data.sessionId,
        );

        if (hostSocketId) {
            // Forward the viewer's answer to the host
            this.server.to(hostSocketId).emit('answer', {
                answer: data.answer,
                viewerId: data.viewerId || client.id,
                sessionId: data.sessionId,
            });
        }
    }

    /**
     * Handle ICE candidate exchange.
     * ICE candidates are forwarded to the target peer (host ↔ viewer).
     */
    @SubscribeMessage('ice-candidate')
    handleIceCandidate(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        data: {
            sessionId: string;
            candidate: RTCIceCandidateInit;
            targetId: string;
        },
    ) {
        // Forward the ICE candidate to the target peer
        this.server.to(data.targetId).emit('ice-candidate', {
            candidate: data.candidate,
            senderId: client.id,
            sessionId: data.sessionId,
        });
    }

    /**
     * Cleanup when a socket disconnects.
     * Removes the session if the host disconnects, or removes the viewer.
     */
    handleDisconnect(client: Socket) {
        console.log(`🔌 Client disconnected: ${client.id}`);
        this.signalingService.handleDisconnect(client.id);

        // Broadcast updated session list to all remaining clients
        this.server.emit('sessions-updated');
    }
}
