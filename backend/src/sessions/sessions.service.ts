import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a single screen-sharing session stored in memory.
 * With the SFU architecture, sessions track identity and PIN only.
 * All WebRTC state is managed by the MediasoupModule (rooms).
 */
export interface Session {
    sessionId: string;
    pin: string;
    machineName: string;
    viewers: string[];
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
            viewers: [],
        };

        this.sessions.set(sessionId, session);
        console.log(`📌 Session created: ${sessionId} (PIN: ${pin})`);
        return session;
    }

    /**
     * Return all active sessions.
     * Used by the home screen to list available streams.
     */
    getAllSessions(): Pick<Session, 'sessionId' | 'pin' | 'machineName' | 'viewers'>[] {
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
     * Find a session by its PIN.
     */
    findSessionByPin(pin: string): Session | undefined {
        return Array.from(this.sessions.values()).find(
            (s) => s.pin === pin,
        );
    }
}
