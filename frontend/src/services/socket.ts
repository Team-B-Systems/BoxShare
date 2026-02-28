import { io, Socket } from 'socket.io-client';

/**
 * Determine the backend URL dynamically.
 * In a LAN environment, the backend runs on the same host but on port 3000.
 * This ensures the frontend can connect to the backend regardless of
 * which machine's IP is used to access the app.
 */
const getBackendUrl = (): string => {
    const hostname = '192.168.1.204'
    return `http://${hostname}:3000`;
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
