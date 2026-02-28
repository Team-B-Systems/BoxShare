import { useEffect, useRef, useState, useCallback } from 'react';
import { createViewerConnection } from '../services/webrtc';
import { disconnectSocket } from '../services/socket';

interface ViewScreenProps {
    sessionId: string;
    onLeave: () => void;
}

/**
 * ViewScreen component.
 *
 * Handles:
 * 1. Joining the session via WebRTC
 * 2. Receiving the remote video stream
 * 3. Displaying the stream in a full-width video element
 */
export default function ViewScreen({ sessionId, onLeave }: ViewScreenProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [connectionState, setConnectionState] =
        useState<string>('connecting');
    const cleanupRef = useRef<(() => void) | null>(null);

    /** Leave the session and clean up */
    const handleLeave = useCallback(() => {
        cleanupRef.current?.();
        disconnectSocket();
        onLeave();
    }, [onLeave]);

    useEffect(() => {
        // Create viewer WebRTC connection
        const cleanup = createViewerConnection(
            sessionId,
            // onTrack: when we receive the remote stream, show it in the video
            (stream: MediaStream) => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            },
            // onConnectionStateChange
            (state: RTCPeerConnectionState) => {
                setConnectionState(state);
                if (state === 'failed' || state === 'disconnected') {
                    setConnectionState('disconnected');
                }
            },
        );

        cleanupRef.current = cleanup;

        return () => {
            cleanup();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    return (
        <div className="min-h-screen flex flex-col bg-black">
            {/* Header */}
            <header className="border-b border-border bg-surface/90 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Connection status indicator */}
                        <div
                            className={`w-2 h-2 rounded-full ${['connected', 'completed'].includes(connectionState)
                                ? 'bg-success animate-pulse-subtle'
                                : ['connecting', 'new', 'checking'].includes(connectionState)
                                    ? 'bg-yellow-400 animate-pulse'
                                    : 'bg-danger'
                                }`}
                        />
                        <span className="text-text-secondary text-sm">
                            {['connected', 'completed'].includes(connectionState)
                                ? 'Viewing'
                                : ['connecting', 'new', 'checking'].includes(connectionState)
                                    ? 'Connecting...'
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
                {/* Connecting overlay */}
                {(connectionState === 'connecting' || connectionState === 'new') && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 animate-fade-in">
                        <div className="text-center">
                            <div className="w-10 h-10 border-2 border-border border-t-text-secondary rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-text-muted text-sm">
                                Connecting to screen share...
                            </p>
                        </div>
                    </div>
                )}

                {/* Disconnected overlay */}
                {(connectionState === 'disconnected' ||
                    connectionState === 'failed') && (
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
                                    Connection Lost
                                </p>
                                <p className="text-text-muted text-xs mb-4">
                                    The host may have stopped sharing
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
