import { Maximize2, Minimize2, Volume2, VolumeX } from 'lucide-react'

/*
 * Focus Mode header: identity, session status, mode picker, ambience and fullscreen.
 *
 * The sound selector is a *volume* choice over one generated rain-ish noise bed — every
 * option is real and takes effect immediately while the ambience plays, rather than
 * offering tracks the app does not actually have. When the Web Audio API is missing the
 * controls disable themselves and say so instead of pretending a toggle worked.
 *
 * Fullscreen targets the whole Focus Mode section (owned by FocusSection), so the timer
 * gets the room without the page becoming a separate place to navigate back from.
 */
const SOUND_LEVELS = [
    { value: 0.25, label: 'Rain (25%)' },
    { value: 0.45, label: 'Rain (45%)' },
    { value: 0.7, label: 'Rain (70%)' },
]

const FocusModeHeader = ({
    modes,
    modeId,
    onSelectMode,
    isRunning,
    soundSupported,
    soundOn,
    soundLevel,
    soundError,
    onToggleSound,
    onSoundLevelChange,
    isFullscreen,
    onFullscreen,
}) => (
    <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex items-center gap-2">
                <span className="label-xs">Focus Mode</span>
                <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                        isRunning ? 'animate-pulse bg-primary' : 'bg-content-subtle'
                    }`}
                />
                {isRunning ? (
                    <span className="rounded-pill bg-primary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        Active Session
                    </span>
                ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-content-subtle">
                        Ready
                    </span>
                )}
            </div>

            {/* Mode picker — the active mode is the accent pill; the others stay quiet. */}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Focus mode">
                {modes.map((item) => {
                    const active = item.id === modeId

                    return (
                        <button
                            key={item.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onSelectMode(item.id)}
                            className={`rounded-pill px-3 py-1 text-xs font-semibold transition ${
                                active
                                    ? 'bg-primary text-primary-contrast'
                                    : 'border border-border text-content-muted hover:border-border-strong hover:text-content'
                            }`}
                        >
                            {item.label}
                            <span className={`ml-1.5 text-[10px] font-medium ${active ? 'opacity-70' : 'text-content-subtle'}`}>
                                {item.hint}
                            </span>
                        </button>
                    )
                })}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={onToggleSound}
                    disabled={!soundSupported}
                    aria-pressed={soundOn}
                    aria-label={soundOn ? 'Mute ambience' : 'Play ambience'}
                    title={soundSupported ? (soundOn ? 'Mute ambience' : 'Play ambience') : 'Ambient sound is not available in this browser'}
                    className={`flex h-7 w-7 items-center justify-center rounded-control transition ${
                        soundOn
                            ? 'bg-primary-soft text-primary'
                            : 'text-content-muted hover:bg-surface-overlay hover:text-content'
                    } disabled:pointer-events-none disabled:opacity-40`}
                >
                    {soundOn ? (
                        <Volume2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                    ) : (
                        <VolumeX className="h-3.5 w-3.5" strokeWidth={1.9} />
                    )}
                </button>

                <select
                    aria-label="Ambient rain volume"
                    value={soundLevel}
                    onChange={(event) => onSoundLevelChange(Number(event.target.value))}
                    disabled={!soundSupported}
                    className="h-7 rounded-control border border-border bg-surface-input px-2 text-xs text-content outline-none transition hover:border-border-strong focus:border-primary disabled:pointer-events-none disabled:opacity-40"
                >
                    {SOUND_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                            {level.label}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={onFullscreen}
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    className="flex h-7 w-7 items-center justify-center rounded-control text-content-muted transition hover:bg-surface-overlay hover:text-content"
                >
                    {isFullscreen ? (
                        <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                    ) : (
                        <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                    )}
                </button>
            </div>
        </div>

        {/* Honest availability notes — shown in place of a control that would otherwise lie. */}
        {!soundSupported && (
            <p className="mt-2 text-[11px] text-content-subtle">
                Ambient sound isn&rsquo;t available in this browser — the timer works regardless.
            </p>
        )}
        {soundSupported && soundError && (
            <p className="mt-2 text-[11px] text-danger">{soundError}</p>
        )}
    </div>
)

export default FocusModeHeader
