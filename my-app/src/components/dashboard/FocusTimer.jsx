import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import Button from '../ui/Button'
import { Play, Pause, RotateCcw, Timer } from 'lucide-react'
import { formatDateKey } from '../../utils/dates'
import { addFocusMinutes, addSession, sessionsFor } from '../../utils/focusStore'

const FOCUS_SECONDS = 25 * 60
const BREAK_SECONDS = 5 * 60

const formatClock = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/*
 * Pomodoro focus timer.
 *
 * Absolute end-time pattern: the target moment is stamped once when Start is pressed
 * (`endRef`), and the visible countdown is derived from it on every tick. This means
 * background-tab throttling never stretches a session — the timer still lands on the
 * real wall-clock end instead of counting late.
 *
 * The single interval effect re-arms only when `running` or `mode` changes; every
 * setState happens inside the interval callback, never in the effect body.
 *
 * Completing a focus interval records 25 minutes and one session into the local focus
 * log, which is what the dashboard's "Focus Time" metric reads. Exposed imperative
 * `start()` lets the header's Quick Focus arm the timer without the parent owning any
 * timer state.
 */
const FocusTimer = forwardRef(function FocusTimer({ task, onTaskChange, tasks = [], onFocusLogged }, ref) {
    const [mode, setMode] = useState('focus')
    const [remaining, setRemaining] = useState(FOCUS_SECONDS)
    const [running, setRunning] = useState(false)
    const [sessions, setSessions] = useState(() => sessionsFor(formatDateKey(new Date())))
    const endRef = useRef(0)

    useImperativeHandle(ref, () => ({
        start: () => setRunning(true),
        toggle: () => setRunning((current) => !current),
    }))

    useEffect(() => {
        if (!running) return

        endRef.current = Date.now() + remaining * 1000

        const interval = window.setInterval(() => {
            const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000))
            setRemaining(left)

            if (left > 0) return

            window.clearInterval(interval)

            if (mode === 'focus') {
                const dayKey = formatDateKey(new Date())
                addFocusMinutes(dayKey, 25)
                setSessions(addSession(dayKey))
                onFocusLogged?.()
                setMode('break')
                setRemaining(BREAK_SECONDS)
            } else {
                setMode('focus')
                setRemaining(FOCUS_SECONDS)
            }

            setRunning(false)
        }, 250)

        return () => window.clearInterval(interval)
        // Re-armed only when the run state or phase changes; `remaining` is read through
        // endRef so a countdown repaint does not restart the interval.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, mode])

    const handleReset = () => {
        setRunning(false)
        setRemaining(mode === 'focus' ? FOCUS_SECONDS : BREAK_SECONDS)
    }

    const handleModeClick = () => {
        setRunning(false)
        setMode(mode === 'focus' ? 'break' : 'focus')
        setRemaining(mode === 'focus' ? BREAK_SECONDS : FOCUS_SECONDS)
    }

    return (
        <section
            aria-label="Focus timer"
            className="rounded-card border border-border bg-surface px-4 py-4"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span
                        aria-hidden="true"
                        className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-primary-soft text-primary"
                    >
                        <Timer className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span className="label-xs text-content-subtle">Focus Session</span>
                </div>

                <button
                    type="button"
                    onClick={handleModeClick}
                    className="rounded-pill border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-content-muted transition hover:border-border-strong hover:text-content"
                >
                    {mode === 'focus' ? 'Focus' : 'Break'}
                </button>
            </div>

            <p
                aria-live="polite"
                className="mt-3 font-mono text-4xl font-bold tabular-nums tracking-tight text-content"
            >
                {formatClock(remaining)}
            </p>

            <p className="mt-1 truncate text-xs text-content-muted">
                {task ? task.title : 'Pick a task to focus on'}
            </p>

            {tasks.length > 0 && (
                <select
                    value={task?.id ?? ''}
                    onChange={(event) => onTaskChange(event.target.value || null)}
                    aria-label="Focus task"
                    className="mt-2 h-8 w-full rounded-control border border-border bg-surface-input px-2 text-xs text-content outline-none transition hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary-soft"
                >
                    <option value="">No task selected</option>
                    {tasks.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.title}
                        </option>
                    ))}
                </select>
            )}

            <div className="mt-3 flex items-center gap-2">
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setRunning((current) => !current)}
                    className="flex-1"
                >
                    {running ? (
                        <>
                            <Pause className="h-3.5 w-3.5" strokeWidth={2.4} />
                            Pause
                        </>
                    ) : (
                        <>
                            <Play className="h-3.5 w-3.5" strokeWidth={2.4} />
                            Start
                        </>
                    )}
                </Button>
                <Button size="sm" onClick={handleReset} aria-label="Reset timer">
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                </Button>
            </div>

            {/* Session dots: one per completed 25m interval today, four max on display. */}
            <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-3">
                {Array.from({ length: 4 }).map((_, index) => (
                    <span
                        key={index}
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${
                            index < sessions ? 'bg-secondary' : 'bg-surface-overlay'
                        }`}
                    />
                ))}
                <span className="ml-1 text-[10px] text-content-subtle">
                    {sessions > 0
                        ? `${sessions} session${sessions === 1 ? '' : 's'} today`
                        : 'No sessions yet'}
                </span>
                <span className="ml-auto text-[10px] text-content-subtle">25m focus · 5m break</span>
            </div>

            {/* Daily focus target ring — filled proportionally to today's logged minutes. */}
            <div className="mt-2">
                <div className="flex items-center justify-between text-[10px] text-content-subtle">
                    <span>Daily target</span>
                    <span>4h</span>
                </div>
                <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={240}
                    aria-valuenow={sessions * 25}
                    aria-label="Focus time against daily target"
                    className="mt-1 h-1 overflow-hidden rounded-pill bg-surface-overlay"
                >
                    <div
                        className="h-full rounded-pill bg-secondary transition-[width] duration-500"
                        style={{ width: `${Math.min(100, (sessions * 25 * 100) / 240)}%` }}
                    />
                </div>
            </div>
        </section>
    )
})

export default FocusTimer
