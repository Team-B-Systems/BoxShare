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
    const [connectionState, setConnectionState] = useState<string>('connecting');

    /** Leave the session and clean up */
    const handleLeave = useCallback(() => {
        cleanupSfu();
        disconnectSocket();
        onLeave();
    }, [onLeave]);

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
        <div className="min-h-screen flex flex-col bg-black">
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
                                ? 'Viewing (SFU)'
                                : connectionState === 'connecting'
                                    ? 'Connecting to SFU...'
                                    : 'Disconnected'}
                        </span>
                    </div>
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
                        Leave
                    </button>
                </div>
            </header>

            {/* Video container */}
            <main className="flex-1 flex items-center justify-center relative">
                {connectionState === 'connecting' && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 animate-fade-in">
                        <div className="text-center">
                            <div className="w-10 h-10 border-2 border-border border-t-text-secondary rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-text-muted text-sm">
                                Joining SFU session...
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
                                SFU Connection Lost
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
                                Back to Home
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
