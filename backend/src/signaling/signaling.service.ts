import { Injectable } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';

/**
 * SignalingService provides the business logic for WebRTC signaling.
 * It bridges the WebSocket gateway with the session store.
 */
@Injectable()
export class SignalingService {
    constructor(private readonly sessionsService: SessionsService) { }

    /**
     * Register the host's socket ID with a session.
     * Called when the host first connects, before any viewers join.
     */
    registerHost(sessionId: string, hostSocketId: string): boolean {
        return this.sessionsService.setHostSocket(sessionId, hostSocketId);
    }

    /**
     * Get the host socket ID for a session so we can forward messages to them.
     */
    getHostSocketId(sessionId: string): string | null {
        const session = this.sessionsService.getSession(sessionId);
        return session?.hostSocketId ?? null;
    }

    /**
     * Register a viewer joining a session.
     * (Offers are now created per-viewer by the host, not stored centrally.)
     */
    handleViewerJoin(sessionId: string, viewerSocketId: string): void {
        this.sessionsService.addViewer(sessionId, viewerSocketId);
    }

    /**
     * Handle cleanup when a socket disconnects (host or viewer).
     */
    handleDisconnect(socketId: string): void {
        // Check if the disconnected socket was a host
        const hostSession =
            this.sessionsService.findSessionByHostSocket(socketId);
        if (hostSession) {
            console.log(
                `🔌 Host disconnected, removing session: ${hostSession.sessionId}`,
            );
            this.sessionsService.deleteSession(hostSession.sessionId);
            return;
        }

        // Otherwise, remove the socket from any viewer lists
        const viewerSessions =
            this.sessionsService.findSessionsByViewer(socketId);
        for (const session of viewerSessions) {
            this.sessionsService.removeViewer(session.sessionId, socketId);
        }
    }
}
