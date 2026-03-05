import { io, Socket } from 'socket.io-client';

/**
 * Determine the backend URL dynamically.
 * Always returns https/wss URLs as HTTPS is now required for screen sharing.
 */
const getBackendUrl = (): string => {
    const envWsUrl = import.meta.env.VITE_WS_URL;
    if (envWsUrl) return envWsUrl;

    if (typeof window !== 'undefined') {
        const { hostname, port } = window.location;

        console.log("HOSTNAME: ", hostname);
        console.log("PORT: ", port);

        // Always force https for backend communication
        const targetProtocol = 'https:';

        // Nginx proxy case
        if (port === '' || port === '80' || port === '443') {
            return `${targetProtocol}//${hostname}`;
        }

        // Local dev fallback 
        return `${targetProtocol}//${hostname}:3000`;
    }

    return 'https://localhost:3000';
};

export const API_URL = getBackendUrl();
let socket: Socket | null = null;

export const getSocket = (): Socket => {
    if (!socket) {
        socket = io(API_URL, {
            transports: ['websocket'], // Use WebSocket primarily
            autoConnect: true,
            secure: true,
            rejectUnauthorized: false, // Allow self-signed certs in browser (user must accept warning)
        });

        socket.on('connect', () => {
            console.log('🔗 Connected to SECURE signaling server:', socket?.id);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Secure Connection error:', error.message);
        });
    }

    return socket;
};

export const disconnectSocket = (): void => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
