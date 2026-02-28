import { getSocket } from './socket';
import type { Socket } from 'socket.io-client';

/**
 * Configuration for WebRTC peer connections.
 * In a LAN environment we typically don't need STUN/TURN servers,
 * but we include Google's public STUN server as a fallback.
 */
const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

/**
 * Create a WebRTC host connection.
 *
 * Correct flow (per-viewer):
 * 1. Host registers socket with the backend
 * 2. When a viewer joins, the backend notifies the host via "viewer-joined"
 * 3. Host creates a dedicated RTCPeerConnection for that viewer
 * 4. Host creates an offer and sends it targeted to that specific viewer
 * 5. Viewer creates an answer and sends it back
 * 6. ICE candidates are exchanged
 *
 * There is NO initial offer. Offers are only created on-demand per viewer.
 */
export const createHostConnection = (
    sessionId: string,
    stream: MediaStream,
    onViewerConnected?: () => void,
): (() => void) => {
    const socket: Socket = getSocket();
    const peerConnections = new Map<string, RTCPeerConnection>();

    const register = () => {
        console.log(`🏠 [Host] Registrando host para sessão: ${sessionId}`);
        socket.emit('register-host', { sessionId });
    };

    if (socket.connected) {
        register();
    } else {
        socket.once('connect', register);
    }

    const handleViewerJoined = async (data: {
        viewerId: string;
        sessionId: string;
    }) => {
        if (data.sessionId !== sessionId) return;

        console.log(`👀 [Host] Novo viewer detectado: ${data.viewerId}`);
        const pc = new RTCPeerConnection(RTC_CONFIG);
        peerConnections.set(data.viewerId, pc);

        stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log(`📤 [Host] Enviando candidato ICE para viewer: ${data.viewerId}`);
                socket.emit('ice-candidate', {
                    sessionId,
                    candidate: event.candidate.toJSON(),
                    targetId: data.viewerId,
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`🧊 [Host] Estado ICE (viewer ${data.viewerId}):`, pc.iceConnectionState);
            if (['connected', 'completed'].includes(pc.iceConnectionState)) {
                onViewerConnected?.();
            }
        };

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            console.log(`📤 [Host] Enviando oferta para viewer: ${data.viewerId}`);
            socket.emit('offer', {
                sessionId,
                offer: pc.localDescription,
                targetViewerId: data.viewerId,
            });
        } catch (error) {
            console.error(`❌ [Host] Erro ao criar oferta para viewer ${data.viewerId}:`, error);
        }
    };

    const handleAnswer = async (data: {
        answer: RTCSessionDescriptionInit;
        viewerId: string;
    }) => {
        const pc = peerConnections.get(data.viewerId);
        if (pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                console.log(`✅ [Host] Resposta (answer) aceita para viewer: ${data.viewerId}`);
            } catch (error) {
                console.error(`❌ [Host] Erro ao definir descrição remota para viewer ${data.viewerId}:`, error);
            }
        }
    };

    const handleIceCandidate = async (data: {
        candidate: RTCIceCandidateInit;
        senderId: string;
    }) => {
        const pc = peerConnections.get(data.senderId);
        if (pc) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log(`🧊 [Host] Candidato ICE recebido de viewer: ${data.senderId}`);
            } catch (error) {
                console.error(`❌ [Host] Erro ao adicionar candidato ICE do viewer ${data.senderId}:`, error);
            }
        }
    };

    socket.on('viewer-joined', handleViewerJoined);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);

    return () => {
        console.log('🛑 [Host] Limpando conexões do host');
        socket.off('viewer-joined', handleViewerJoined);
        socket.off('answer', handleAnswer);
        socket.off('ice-candidate', handleIceCandidate);
        peerConnections.forEach((pc) => pc.close());
        peerConnections.clear();
    };
};

export const createViewerConnection = (
    sessionId: string,
    onTrack: (stream: MediaStream) => void,
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void,
): (() => void) => {
    if (!window.isSecureContext) {
        console.warn('⚠️ [Viewer] Contexto NÃO seguro detectado. WebRTC pode ser bloqueado em IPs de LAN pelo navegador (requer HTTPS ou Localhost).');
    }

    const socket: Socket = getSocket();
    const pc = new RTCPeerConnection(RTC_CONFIG);

    let hostSocketId = '';
    let remoteDescriptionSet = false;
    const iceCandidatesBuffer: RTCIceCandidateInit[] = [];

    pc.ontrack = (event) => {
        console.log('🎥 [Viewer] Recebeu trilha remota:', event.track.kind);
        if (event.streams && event.streams[0]) {
            onTrack(event.streams[0]);
        } else {
            // Fallback para navegadores que não passam o stream completo
            const inboundStream = new MediaStream();
            inboundStream.addTrack(event.track);
            onTrack(inboundStream);
        }
    };

    pc.onicecandidate = (event) => {
        if (event.candidate && hostSocketId) {
            console.log('📤 [Viewer] Enviando candidato ICE para o Host');
            socket.emit('ice-candidate', {
                sessionId,
                candidate: event.candidate.toJSON(),
                targetId: hostSocketId,
            });
        }
    };

    pc.onconnectionstatechange = () => {
        console.log('🔗 [Viewer] Estado da conexão:', pc.connectionState);
        onConnectionStateChange?.(pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
        console.log('🧊 [Viewer] Estado ICE:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
            onConnectionStateChange?.('failed');
        }
    };

    const handleOffer = async (data: {
        offer: RTCSessionDescriptionInit;
        sessionId: string;
        hostSocketId: string;
    }) => {
        if (data.sessionId !== sessionId) return;
        console.log('📥 [Viewer] Oferta recebida do Host:', data.hostSocketId);
        hostSocketId = data.hostSocketId;

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            remoteDescriptionSet = true;

            while (iceCandidatesBuffer.length > 0) {
                const candidate = iceCandidatesBuffer.shift();
                if (candidate) {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                }
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit('answer', {
                sessionId,
                answer: pc.localDescription,
                viewerId: socket.id,
            });
            console.log('✅ [Viewer] Resposta enviada ao Host');
        } catch (error) {
            console.error('❌ [Viewer] Erro ao processar oferta:', error);
        }
    };

    const handleIceCandidate = async (data: {
        candidate: RTCIceCandidateInit;
        senderId: string;
    }) => {
        if (data.senderId) hostSocketId = data.senderId;

        if (remoteDescriptionSet) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (error) {
                console.error('❌ [Viewer] Erro ao adicionar candidato ICE:', error);
            }
        } else {
            iceCandidatesBuffer.push(data.candidate);
        }
    };

    const handleError = (err: any) => {
        console.error('❌ [Viewer] Erro de sinalização:', err.message);
        onConnectionStateChange?.('failed');
    };

    socket.on('offer', handleOffer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('error', handleError);

    if (socket.connected) {
        console.log('🚀 [Viewer] Enviando join-session');
        socket.emit('join-session', { sessionId });
    } else {
        socket.once('connect', () => {
            console.log('🚀 [Viewer] Conectado! Enviando join-session');
            socket.emit('join-session', { sessionId });
        });
    }

    return () => {
        console.log('🛑 [Viewer] Limpando conexão');
        socket.off('offer', handleOffer);
        socket.off('ice-candidate', handleIceCandidate);
        socket.off('error', handleError);
        pc.close();
    };
};
