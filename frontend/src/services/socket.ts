import { io, Socket } from 'socket.io-client';

/**
 * Determine the backend URL dynamically.
 * Resolves to the correct wss:// WebSocket connection URL to avoid mixed-content errors.
 */
const getBackendUrl = (): string => {
    // Use configurable environment variable if available
    const envWsUrl = import.meta.env.VITE_WS_URL;
    if (envWsUrl) return envWsUrl;

    // Use current window location to support LAN IPs directly
    const hostname = window.location.hostname || '192.168.1.100';
    return `https://${hostname}:3000`; // Socket.io will automatically upgrade https to secure wss://
};

/** Backend base URL for REST API calls */
export const API_URL = getBackendUrl();

/** Singleton Socket.IO client instance */
let socket: Socket | null = null;

/**
 * Get or create the Socket.IO connection to the backend.
 * Reuses the same connection across the entire app.
 */
export const getSocket = (): Socket => {
    if (!socket) {
        socket = io(API_URL, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
            // Force fully secure connection and ignore self-signed cert blocks on LAN
            secure: true,
            rejectUnauthorized: false, // Node.js environments only, in browser we rely on the user accepting the cert
        });

        socket.on('connect', () => {
            console.log('🔗 Connected to signaling server:', socket?.id);
        });

        socket.on('disconnect', (reason) => {
            console.log('🔌 Disconnected from signaling server:', reason);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error.message);
        });
    }

    return socket;
};

/**
 * Disconnect and destroy the socket instance.
 * Useful when navigating away from sharing/viewing.
 */
export const disconnectSocket = (): void => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
