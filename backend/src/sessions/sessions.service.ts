import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a single screen-sharing session stored in memory.
 */
export interface Session {
    sessionId: string;
    pin: string;
    machineName: string;
    offer: RTCSessionDescriptionInit | null;
    viewers: string[];
    hostSocketId: string | null;
}

/**
 * SessionsService manages all active screen-sharing sessions in memory.
 * No database is required — sessions live in a Map and are lost on restart.
 */
@Injectable()
export class SessionsService {
    /** In-memory store: sessionId → Session */
    private readonly sessions = new Map<string, Session>();

    /**
     * Create a new sharing session with a random 6-digit PIN.
     * @param machineName - human-readable name of the host machine
     * @returns the newly created Session object
     */
    createSession(machineName: string): Session {
        const sessionId = uuidv4();
        // Generate a random 6-digit numeric PIN (100000–999999)
        const pin = Math.floor(100000 + Math.random() * 900000).toString();

        const session: Session = {
            sessionId,
            pin,
            machineName,
            offer: null,
            viewers: [],
            hostSocketId: null,
        };

        this.sessions.set(sessionId, session);
        console.log(`📌 Session created: ${sessionId} (PIN: ${pin})`);
        return session;
    }

    /**
     * Return all active sessions (without exposing the offer or host socket).
     * Used by the home screen to list available streams.
     */
    getAllSessions(): Omit<Session, 'offer' | 'hostSocketId'>[] {
        return Array.from(this.sessions.values()).map(
            ({ sessionId, pin, machineName, viewers }) => ({
                sessionId,
                pin,
                machineName,
                viewers,
            }),
        );
    }

    /**
     * Retrieve a session by its ID.
     */
    getSession(sessionId: string): Session | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Validate a PIN against a specific session.
     * @returns true if the PIN matches, false otherwise
     */
    validatePin(sessionId: string, pin: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        return session.pin === pin;
    }

    /**
     * Store the WebRTC offer from the host for a given session.
     */
    storeOffer(
        sessionId: string,
        offer: RTCSessionDescriptionInit,
    ): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        session.offer = offer;
        return true;
    }

    /**
     * Register the host's WebSocket ID so we can forward messages to them.
     */
    setHostSocket(sessionId: string, socketId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        session.hostSocketId = socketId;
        return true;
    }

    /**
     * Add a viewer's socket ID to a session.
     */
    addViewer(sessionId: string, viewerId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        if (!session.viewers.includes(viewerId)) {
            session.viewers.push(viewerId);
        }
        return true;
    }

    /**
     * Remove a viewer from a session (e.g., on disconnect).
     */
    removeViewer(sessionId: string, viewerId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.viewers = session.viewers.filter((id) => id !== viewerId);
        }
    }

    /**
     * Delete an entire session (e.g., when the host stops sharing).
     */
    deleteSession(sessionId: string): void {
        this.sessions.delete(sessionId);
        console.log(`🗑️  Session deleted: ${sessionId}`);
    }

    /**
     * Find a session by its host socket ID (useful on disconnect).
     */
    findSessionByHostSocket(socketId: string): Session | undefined {
        return Array.from(this.sessions.values()).find(
            (s) => s.hostSocketId === socketId,
        );
    }

    /**
     * Find all sessions where a given socket is a viewer.
     */
    findSessionsByViewer(socketId: string): Session[] {
        return Array.from(this.sessions.values()).filter((s) =>
            s.viewers.includes(socketId),
        );
    }
}
