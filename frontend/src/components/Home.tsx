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
    onJoinSession: (sessionId: string, pin: string) => void;
}

/**
 * Home screen component.
 * Displays the list of active screen-sharing sessions and a "Start Sharing" button.
 */
export default function Home({ onStartSharing, onJoinSession }: HomeProps) {
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [loading, setLoading] = useState(true);

    /** Fetch all active sessions from the REST API */
    const fetchSessions = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/sessions`);
            if (!res.ok) throw new Error('Falha ao procurar sessões');
            const data = await res.json();
            setSessions(data);
        } catch (err) {
            console.error('Error fetching sessions:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSessions();
        const interval = setInterval(fetchSessions, 3000);
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
            `Insira o PIN de 6 dígitos para "${session.machineName}":`,
        );
        if (!enteredPin) return;

        // Validate PIN via backend
        fetch(`${API_URL}/sessions/${sessionId}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: enteredPin }),
        })
            .then((res) => {
                if (!res.ok) throw new Error('PIN inválido');
                return res.json();
            })
            .then((data) => {
                // data.pin should be returned by the updated controller
                onJoinSession(sessionId, data.pin || enteredPin);
            })
            .catch(() => {
                alert('PIN inválido. Por favor, tente novamente.');
            });
    };

    return (
        <div className="min-h-screen flex flex-col">
            <header className="border-b border-border">
                <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center">
                            <svg className="w-4 h-4 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-text-primary tracking-tight">BoxShare SFU</h1>
                            <p className="text-xs text-text-muted">Compartilhamento LAN de Alta Performance</p>
                        </div>
                    </div>
                    <button id="start-sharing-btn" onClick={onStartSharing} className="px-5 py-2.5 rounded-lg text-sm font-medium bg-text-primary text-surface hover:bg-accent-hover active:scale-95 cursor-pointer">
                        Começar a Compartilhar
                    </button>
                </div>
            </header>
            <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Sessões Ativas</h2>
                        <p className="text-xs text-text-muted mt-1">{sessions.length === 0 ? 'Nenhuma sessão ativa' : `${sessions.length} sessões disponíveis`}</p>
                    </div>
                </div>
                {!loading && sessions.length === 0 && (
                    <div className="border border-border border-dashed rounded-xl p-12 text-center animate-fade-in">
                        <p className="text-text-secondary text-sm">Ainda ninguém está a compartilhar (SFU)</p>
                    </div>
                )}
                {sessions.length > 0 && (
                    <div className="grid gap-3">
                        {sessions.map((session) => (
                            <SessionCard key={session.sessionId} sessionId={session.sessionId} machineName={session.machineName} pin={session.pin} viewerCount={session.viewers.length} onJoin={handleJoin} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
