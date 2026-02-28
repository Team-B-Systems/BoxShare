interface SessionCardProps {
    sessionId: string;
    machineName: string;
    pin: string;
    viewerCount: number;
    onJoin: (sessionId: string) => void;
}

/**
 * SessionCard displays a single active screen-sharing session.
 * Shows the machine name, PIN, viewer count, and a Join button.
 */
export default function SessionCard({
    sessionId,
    machineName,
    pin,
    viewerCount,
    onJoin,
}: SessionCardProps) {
    return (
        <div
            className="
        group relative overflow-hidden
        border border-border rounded-xl p-5
        bg-surface-raised
        transition-all duration-300 ease-out
        hover:border-border-hover hover:bg-surface-overlay
        hover:shadow-[0_0_30px_rgba(255,255,255,0.03)]
        animate-fade-in
      "
        >
            {/* Subtle top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-border-hover to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="flex items-start justify-between gap-4">
                {/* Session info */}
                <div className="flex-1 min-w-0">
                    {/* Machine name */}
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse-subtle" />
                        <h3 className="text-text-primary font-medium text-base truncate">
                            {machineName}
                        </h3>
                    </div>

                    {/* PIN display */}
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-text-muted text-xs uppercase tracking-wider">
                            PIN
                        </span>
                        <span className="font-mono text-sm text-text-secondary bg-surface px-2 py-0.5 rounded border border-border">
                            {pin}
                        </span>
                    </div>

                    {/* Viewer count */}
                    <div className="flex items-center gap-1.5 text-text-muted text-xs">
                        <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                            />
                        </svg>
                        <span>
                            {viewerCount} viewer{viewerCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                {/* Join button */}
                <button
                    id={`join-session-${sessionId}`}
                    onClick={() => onJoin(sessionId)}
                    className="
            px-4 py-2 rounded-lg text-sm font-medium
            border border-border text-text-primary
            bg-surface
            transition-all duration-200 ease-out
            hover:bg-accent-subtle hover:border-border-hover hover:text-accent-hover
            active:scale-95
            cursor-pointer
            whitespace-nowrap
          "
                >
                    Join
                </button>
            </div>
        </div>
    );
}
