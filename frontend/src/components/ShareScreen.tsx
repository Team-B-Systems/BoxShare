import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket, disconnectSocket } from '../services/socket';
import { createHostConnection } from '../services/webrtc';

interface ShareScreenProps {
    /** The MediaStream captured from getDisplayMedia — passed from App.tsx */
    stream: MediaStream;
    sessionId: string;
    pin: string;
    onStop: () => void;
}

/**
 * ShareScreen component.
 *
 * Receives an already-captured MediaStream and session info from App.tsx.
 * This ensures session creation only happens once per user click.
 */
export default function ShareScreen({
    stream,
    sessionId,
    pin,
    onStop
}: ShareScreenProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [machineName] = useState<string>(
        () =>
            `${navigator.userAgent.includes('Mac') ? 'Mac' : 'PC'}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    );
    const [status, setStatus] = useState<'initializing' | 'sharing' | 'error'>(
        'initializing',
    );
    const [errorMsg, setErrorMsg] = useState('');
    const [viewerIds, setViewerIds] = useState<Set<string>>(new Set());
    const cleanupRef = useRef<(() => void) | null>(null);

    /** Clean up all resources and stop sharing */
    const handleStop = useCallback(() => {
        // Stop all media tracks
        stream.getTracks().forEach((track) => track.stop());
        // Close WebRTC connections
        cleanupRef.current?.();
        // Disconnect socket
        disconnectSocket();
        // Navigate back to home
        onStop();
    }, [stream, onStop]);

    useEffect(() => {
        const socket = getSocket();

        // Show the stream preview immediately
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }

        // If the user stops sharing via the browser's built-in stop button
        stream.getVideoTracks()[0].onended = () => {
            handleStop();
        };

        // Callback para atualizar IDs únicos de viewers
        const addViewer = (data: { viewerId: string }) => {
            setViewerIds((prev) => new Set(prev).add(data.viewerId));
        };

        // Set up WebRTC host connection
        try {
            const cleanup = createHostConnection(
                sessionId,
                stream,
                () => {
                    /* Conexão estabelecida */
                },
            );
            cleanupRef.current = cleanup;

            // Listen for viewer join events to update unique count
            socket.on('viewer-joined', addViewer);

            setStatus('sharing');
        } catch (err: any) {
            console.error('Error setting up WebRTC:', err);
            setErrorMsg(err.message || 'Failed to initialize P2P connection');
            setStatus('error');
        }

        return () => {
            console.log('Cleaning up ShareScreen effect');
            socket.off('viewer-joined', addViewer);
            cleanupRef.current?.();
        };
    }, [sessionId, stream, handleStop]);

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center px-6">
                <div className="text-center animate-fade-in">
                    <div className="w-16 h-16 rounded-full bg-surface-raised border border-border flex items-center justify-center mx-auto mb-5">
                        <svg
                            className="w-8 h-8 text-danger"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                            />
                        </svg>
                    </div>
                    <h2 className="text-text-primary text-lg font-medium mb-2">
                        Unable to Share
                    </h2>
                    <p className="text-text-muted text-sm mb-6">{errorMsg}</p>
                    <button
                        onClick={onStop}
                        className="
              px-5 py-2.5 rounded-lg text-sm font-medium
              border border-border text-text-primary
              hover:bg-surface-raised transition-all duration-200
              cursor-pointer
            "
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="border-b border-border">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse-subtle" />
                        <span className="text-text-primary text-sm font-medium">
                            Sharing Active
                        </span>
                        <span className="text-text-muted text-xs">·</span>
                        <span className="text-text-muted text-xs">{machineName}</span>
                    </div>
                    <button
                        id="stop-sharing-btn"
                        onClick={handleStop}
                        className="
              px-4 py-2 rounded-lg text-sm font-medium
              border border-border text-danger
              hover:bg-surface-raised hover:border-danger/30
              transition-all duration-200
              active:scale-95
              cursor-pointer
            "
                    >
                        Stop Sharing
                    </button>
                </div>
            </header>

            {/* Main */}
            <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
                {/* PIN Display */}
                <div className="text-center mb-8 animate-fade-in">
                    <p className="text-text-muted text-xs uppercase tracking-widest mb-3">
                        Share this PIN with viewers
                    </p>
                    <div className="inline-flex items-center gap-1">
                        {(pin || '------').split('').map((digit, i) => (
                            <span
                                key={i}
                                className="
                  w-12 h-14 flex items-center justify-center
                  bg-surface-raised border border-border rounded-lg
                  text-2xl font-mono font-semibold text-text-primary
                  transition-all duration-300
                "
                                style={{ animationDelay: `${i * 60}ms` }}
                            >
                                {digit}
                            </span>
                        ))}
                    </div>
                    <p className="text-text-muted text-xs mt-3">
                        {viewerIds.size} viewer{viewerIds.size !== 1 ? 's' : ''} connected
                    </p>
                </div>

                {/* Screen preview */}
                <div className="relative rounded-xl overflow-hidden border border-border bg-surface-raised animate-fade-in">
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-surface/80 backdrop-blur-sm rounded-md px-2.5 py-1 border border-border">
                        <div className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse-subtle" />
                        <span className="text-[10px] text-text-muted uppercase tracking-wider">
                            Live Preview
                        </span>
                    </div>
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full aspect-video object-contain bg-black"
                    />
                </div>
            </main>
        </div>
    );
}
