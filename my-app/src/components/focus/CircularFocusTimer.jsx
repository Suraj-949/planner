import Badge from '../ui/Badge'
import { CATEGORY_LABELS, PRIORITY_LABELS, PRIORITY_VARIANTS } from '../../constants/taskMeta'

/*
 * The circular timer: SVG progress ring around a serif clock.
 *
 * The ring's arc is a real fraction — elapsed over the mode's total (extended by any "+5m"
 * grants) for countdowns, and a fixed 50-minute scale for the Flow State stopwatch, which
 * has no natural end to divide by. The track is a theme token so the arc reads on dark,
 * and the arc gains a soft accent glow only while a session is actually running.
 *
 * The clock is serif deliberately: every other number in the app is the sans/mono
 * stack, and the timer wants to feel like an instrument rather than another metric. The
 * font is set inline because the theme file's typography list stays untouched.
 */
const SIZE = 232
const STROKE = 9
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const formatClock = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const supportingLine = ({ finished, isRunning, elapsed, task }) => {
    if (finished) return 'Session complete and logged to today\u2019s focus total.'
    if (isRunning) return 'Timing against the wall clock — a background tab will not stretch it.'
    if (elapsed > 0) return 'Paused. Nothing is logged until you finish.'
    if (task) return 'Anchored to this task — the session records to it, but never changes it.'

    return 'Pick a task below to anchor this session, or focus on anything.'
}

const CircularFocusTimer = ({ mode, seconds, elapsed, progress, isRunning, finished, task, sessionCount, cycle }) => (
    <div className="flex flex-col items-center">
        <div className="relative">
            <svg aria-hidden="true" viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-52 w-52 sm:h-60 sm:w-60">
                <circle
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke="var(--color-surface-overlay)"
                    strokeWidth={STROKE}
                />
                <circle
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={finished ? 'var(--color-secondary)' : 'var(--color-primary)'}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)))}
                    transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                    style={{
                        transition: 'stroke-dashoffset 400ms linear, stroke 200ms ease',
                        filter: isRunning && !finished ? 'drop-shadow(0 0 6px var(--color-primary))' : 'none',
                    }}
                />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                <span className="label-xs">{finished ? 'Complete' : mode.label}</span>
                <p
                    role="timer"
                    aria-live="off"
                    className={`mt-1 text-[44px] leading-none font-normal tabular-nums tracking-tight sm:text-[52px] ${
                        finished ? 'text-secondary' : isRunning ? 'text-primary' : 'text-content'
                    }`}
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                    {formatClock(seconds)}
                </p>
                <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-content-subtle">
                    {mode.kind === 'countdown' ? `${Math.round(mode.seconds / 60)} min block` : 'Runs until you stop it'}
                </span>
            </div>
        </div>

        {/* Context: what is being focused on, then what the session means right now. */}
        {task && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                {task.category && (
                    <Badge variant="neutral" square>
                        {CATEGORY_LABELS[task.category] ?? task.category}
                    </Badge>
                )}
                <Badge variant={PRIORITY_VARIANTS[task.priority] ?? 'neutral'}>
                    {PRIORITY_LABELS[task.priority] ?? task.priority}
                </Badge>
            </div>
        )}

        <p className="mt-2 max-w-sm truncate text-sm font-medium text-content">
            {task ? task.title : 'No task selected'}
        </p>
        <p className="mt-1 max-w-sm text-center text-xs text-content-muted">
            {supportingLine({ finished, isRunning, elapsed, task })}
        </p>

        {/* Session dots (four per cycle) and the cycle position, both from real counts. */}
        <div className="mt-3.5 flex items-center gap-1.5 border-t border-border pt-3">
            {Array.from({ length: 4 }).map((_, index) => (
                <span
                    key={index}
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                        index < Math.min(sessionCount, 4) ? 'bg-secondary' : 'bg-surface-overlay'
                    }`}
                />
            ))}
            <span className="ml-2 text-[10px] text-content-subtle">
                Cycle {cycle} / 4 · {sessionCount} logged today
            </span>
        </div>
    </div>
)

export default CircularFocusTimer
