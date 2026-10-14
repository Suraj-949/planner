import { Timer } from 'lucide-react'
import { focusMinutesFor } from '../../utils/focusStore'

/*
 * Today's focus against a two-hour goal.
 *
 * The minutes come from the shared local focus log — written only by finished timer
 * sessions — so this card, the dashboard's "Focus Time" metric and the Session Ledger
 * read the same number. The store lives outside React, so the value is read during
 * render rather than memoised: FocusSection re-renders whenever a session logs (the
 * hook's session count is state), which is exactly when this figure must be re-read, and
 * parsing a small JSON object per render is cheaper than maintaining a stale cache.
 */
const DAILY_GOAL_MINUTES = 120

const messageFor = (minutes, goal) => {
    if (minutes >= goal) return 'Daily goal reached. Everything else today is a bonus.'
    if (minutes > 0) return `${goal - minutes}m to go on the 2h goal.`

    return 'No focus logged yet today. Start a session above.'
}

const TodaysFocusCard = ({ todayKey }) => {
    const minutes = focusMinutesFor(todayKey)
    const percent = Math.min(100, Math.round((minutes / DAILY_GOAL_MINUTES) * 100))

    return (
        <section
            aria-label="Today's focus"
            className="rounded-card border border-border bg-surface-raised px-4 py-3.5"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span
                        aria-hidden="true"
                        className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-primary-soft text-primary"
                    >
                        <Timer className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span className="label-xs">Today&rsquo;s Focus</span>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-content-subtle">
                    2h goal
                </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums tracking-tight text-content">
                    {minutes}
                    <span className="text-sm font-semibold text-content-muted">m</span>
                </span>
                <span className="text-xs text-content-muted">focused</span>
            </div>

            <div
                role="progressbar"
                aria-valuenow={minutes}
                aria-valuemin={0}
                aria-valuemax={DAILY_GOAL_MINUTES}
                aria-label="Focus minutes against the two-hour daily goal"
                className="mt-2.5 h-1.5 overflow-hidden rounded-pill bg-surface-overlay"
            >
                <div
                    className="h-full rounded-pill bg-secondary transition-[width] duration-500"
                    style={{ width: `${percent}%` }}
                />
            </div>

            <p className="mt-2 text-xs text-content-muted">{messageFor(minutes, DAILY_GOAL_MINUTES)}</p>
        </section>
    )
}

export default TodaysFocusCard
