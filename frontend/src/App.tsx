import { useState, useRef } from 'react';
import Home from './components/Home';
import ShareScreen from './components/ShareScreen';
import ViewScreen from './components/ViewScreen';
import { API_URL } from './services/socket';

/**
 * Possible application views.
 */
type AppView = 'home' | 'share' | 'view';

interface ViewState {
  view: AppView;
  sessionId?: string;
  pin?: string;
}

export default function App() {
  const [state, setState] = useState<ViewState>({ view: 'home' });
  const streamRef = useRef<MediaStream | null>(null);

  const goHome = () => {
    streamRef.current = null;
    setState({ view: 'home' });
  };

  const startSharing = async () => {
    try {
      // 1. Capture stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      // 2. Register session (Backend creates SFU context potential)
      const machineName = `${navigator.userAgent.includes('Mac') ? 'Mac' : 'PC'}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const res = await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineName }),
      });

      if (!res.ok) throw new Error('Falha ao criar sessão');
      const data = await res.json();

      streamRef.current = stream;
      setState({
        view: 'share',
        sessionId: data.sessionId,
        pin: data.pin
      });

    } catch (err: any) {
      console.error('Screen capture or session creation failed:', err);
    }
  };

  const joinSession = (sessionId: string, pin: string) => {
    setState({ view: 'view', sessionId, pin });
  };

  return (
    <div className="min-h-screen bg-surface font-sans">
      {state.view === 'home' && (
        <Home onStartSharing={startSharing} onJoinSession={joinSession} />
      )}
      {state.view === 'share' && streamRef.current && state.sessionId && (
        <ShareScreen
          stream={streamRef.current}
          sessionId={state.sessionId}
          pin={state.pin || ''}
          onStop={goHome}
        />
      )}
      {state.view === 'view' && state.sessionId && state.pin && (
        <ViewScreen
          sessionId={state.sessionId}
          pin={state.pin}
          onLeave={goHome}
        />
      )}
    </div>
  );
}
