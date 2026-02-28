import { useEffect, useState, useCallback } from 'react';
import SessionCard from './SessionCard';
import { API_URL, getSocket } from '../services/socket';

interface SessionInfo {
    sessionId: string;
    machineName: string;
    pin: string;
    viewers: string[];
}

interface HomeProps {
    onStartSharing: () => void;
    onJoinSession: (sessionId: string) => void;
}

/**
 * Home screen component.
 * Displays the list of active screen-sharing sessions and a "Start Sharing" button.
 * Polls for sessions and also listens for real-time updates via WebSocket.
 */
export default function Home({ onStartSharing, onJoinSession }: HomeProps) {
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /** Fetch all active sessions from the REST API */
    const fetchSessions = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/sessions`);
            if (!res.ok) throw new Error('Failed to fetch sessions');
            const data = await res.json();
            setSessions(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching sessions:', err);
            setError('Unable to connect to server');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial fetch
        fetchSessions();

        // Poll every 3 seconds for updates
        const interval = setInterval(fetchSessions, 3000);

        // Also listen for real-time session updates via WebSocket
        const socket = getSocket();
        socket.on('sessions-updated', fetchSessions);

        return () => {
            clearInterval(interval);
            socket.off('sessions-updated', fetchSessions);
        };
    }, [fetchSessions]);

    /** Prompt user for PIN before joining */
    const handleJoin = (sessionId: string) => {
        const session = sessions.find((s) => s.sessionId === sessionId);
        if (!session) return;

        const enteredPin = window.prompt(
            `Enter the 6-digit PIN for "${session.machineName}":`,
        );
        if (!enteredPin) return;

        // Validate PIN via backend
        fetch(`${API_URL}/sessions/${sessionId}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: enteredPin }),
        })
            .then((res) => {
                if (!res.ok) throw new Error('Invalid PIN');
                return res.json();
            })
            .then(() => {
                onJoinSession(sessionId);
            })
            .catch(() => {
                alert('Invalid PIN. Please try again.');
            });
    };

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="border-b border-border">
                <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Logo icon */}
                        <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center">
                            <svg
                                className="w-4 h-4 text-text-primary"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
                                />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-text-primary tracking-tight">
                                BoxShare
                            </h1>
                            <p className="text-xs text-text-muted">LAN Screen Sharing</p>
                        </div>
                    </div>

                    <button
                        id="start-sharing-btn"
                        onClick={onStartSharing}
                        className="
              px-5 py-2.5 rounded-lg text-sm font-medium
              bg-text-primary text-surface
              transition-all duration-200 ease-out
              hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]
              active:scale-95
              cursor-pointer
            "
                    >
                        Start Sharing
                    </button>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
                {/* Section heading */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
                            Active Sessions
                        </h2>
                        <p className="text-xs text-text-muted mt-1">
                            {sessions.length === 0
                                ? 'No active sessions on the network'
                                : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} available`}
                        </p>
                    </div>

                    {/* Refresh indicator */}
                    {loading && (
                        <div className="w-4 h-4 border-2 border-border border-t-text-secondary rounded-full animate-spin" />
                    )}
                </div>

                {/* Error state */}
                {error && (
                    <div className="border border-border rounded-xl p-6 text-center animate-fade-in">
                        <p className="text-text-muted text-sm">{error}</p>
                        <button
                            onClick={fetchSessions}
                            className="mt-3 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Empty state */}
                {!error && !loading && sessions.length === 0 && (
                    <div className="border border-border border-dashed rounded-xl p-12 text-center animate-fade-in">
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
                                    d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z"
                                />
                            </svg>
                        </div>
                        <p className="text-text-secondary text-sm mb-1">
                            No one is sharing yet
                        </p>
                        <p className="text-text-muted text-xs">
                            Click "Start Sharing" to share your screen on the network
                        </p>
                    </div>
                )}

                {/* Session list */}
                {!error && sessions.length > 0 && (
                    <div className="grid gap-3">
                        {sessions.map((session) => (
                            <SessionCard
                                key={session.sessionId}
                                sessionId={session.sessionId}
                                machineName={session.machineName}
                                pin={session.pin}
                                viewerCount={session.viewers.length}
                                onJoin={handleJoin}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-border">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-text-muted">
                    <span>BoxShare v1.0</span>
                    <span>LAN · No internet required</span>
                </div>
            </footer>
        </div>
    );
}
