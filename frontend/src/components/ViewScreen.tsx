import { useEffect, useRef, useState, useCallback } from 'react';
import { joinSfuSession, cleanupSfu } from '../services/webrtc';
import { disconnectSocket } from '../services/socket';

interface ViewScreenProps {
    sessionId: string;
    pin: string;
    onLeave: () => void;
}

/**
 * ViewScreen component using SFU architecture.
 */
export default function ViewScreen({ sessionId, pin, onLeave }: ViewScreenProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [connectionState, setConnectionState] = useState<string>('connecting');
    const [isFullscreen, setIsFullscreen] = useState(false);

    /** Leave the session and clean up */
    const handleLeave = useCallback(() => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        cleanupSfu();
        disconnectSocket();
        onLeave();
    }, [onLeave]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        const startViewing = async () => {
            try {
                await joinSfuSession(
                    sessionId,
                    pin,
                    // onTrack: when we receive the remote stream, show it in the video
                    (stream: MediaStream) => {
                        console.log('🎬 [Viewer] Received SFU stream');
                        if (videoRef.current) {
                            videoRef.current.srcObject = stream;
                        }
                    },
                    // onDisconnect
                    () => {
                        setConnectionState('disconnected');
                    }
                );
                setConnectionState('connected');
            } catch (err) {
                console.error('❌ [Viewer] SFU join error:', err);
                setConnectionState('failed');
            }
        };

        startViewing();

        return () => {
            cleanupSfu();
        };
    }, [sessionId, pin]);

    return (
        <div ref={containerRef} className="min-h-screen flex flex-col bg-black">
            {/* Header */}
            <header className="border-b border-border bg-surface/90 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-2 h-2 rounded-full ${connectionState === 'connected'
                                ? 'bg-success animate-pulse-subtle'
                                : connectionState === 'connecting'
                                    ? 'bg-yellow-400 animate-pulse'
                                    : 'bg-danger'
                                }`}
                        />
                        <span className="text-text-secondary text-sm">
                            {connectionState === 'connected'
                                ? 'Visualizando (SFU)'
                                : connectionState === 'connecting'
                                    ? 'Conectando ao SFU...'
                                    : 'Desconectado'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            id="fullscreen-btn"
                            onClick={toggleFullscreen}
                            className="
                  px-4 py-1.5 rounded-lg text-xs font-medium
                  border border-border text-text-secondary
                  hover:bg-surface-raised hover:text-text-primary
                  transition-all duration-200
                  active:scale-95
                  cursor-pointer
                  flex items-center gap-1.5
                "
                        >
                            {isFullscreen ? (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4.5 4.5M9 9H4.5M9 9V4.5M15 9l4.5-4.5M15 9h4.5M15 9V4.5M15 15l4.5 4.5M15 15h4.5M15 15v4.5M9 15l-4.5 4.5M9 15H4.5M9 15v4.5" />
                                    </svg>
                                    Normal
                                </>
                            ) : (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9M20.25 20.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                                    </svg>
                                    Fullscreen
                                </>
                            )}
                        </button>
                        <button
                            id="leave-session-btn"
                            onClick={handleLeave}
                            className="
                  px-4 py-1.5 rounded-lg text-xs font-medium
                  border border-border text-text-secondary
                  hover:bg-surface-raised hover:text-text-primary
                  transition-all duration-200
                  active:scale-95
                  cursor-pointer
                "
                        >
                            Sair
                        </button>
                    </div>
                </div>
            </header>

            {/* Video container */}
            <main className="flex-1 flex items-center justify-center relative">
                {connectionState === 'connecting' && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 animate-fade-in">
                        <div className="text-center">
                            <div className="w-10 h-10 border-2 border-border border-t-text-secondary rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-text-muted text-sm">
                                Entrando na sessão SFU...
                            </p>
                        </div>
                    </div>
                )}

                {(connectionState === 'disconnected' || connectionState === 'failed') && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 animate-fade-in">
                        <div className="text-center">
                            <div className="w-12 h-12 rounded-full bg-surface-raised border border-border flex items-center justify-center mx-auto mb-4">
                                <svg
                                    className="w-6 h-6 text-text-muted"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </div>
                            <p className="text-text-secondary text-sm mb-1">
                                Conexão SFU Perdida
                            </p>
                            <button
                                onClick={handleLeave}
                                className="
                  px-5 py-2 rounded-lg text-sm
                  border border-border text-text-primary
                  hover:bg-surface-raised transition-all duration-200
                  cursor-pointer
                "
                            >
                                Voltar ao Início
                            </button>
                        </div>
                    </div>
                )}

                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    onLoadedMetadata={(e) => {
                        (e.target as HTMLVideoElement).play().catch(console.error);
                    }}
                    className="w-full h-full max-h-[calc(100vh-52px)] object-contain bg-black"
                />
            </main>
        </div>
    );
}
