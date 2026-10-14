import { CheckCircle2 } from 'lucide-react'

/*
 * Today's progress: completed habits against everything scheduled for today.
 *
 * "Scheduled" counts the active habits — a daily habit can be done any day, and a
 * weekly/monthly one can be done any day inside its period, so every active habit is
 * something today could satisfy. The figures arrive counted by the page from the same
 * analytics data the tracker and heatmap read, so this card cannot drift from them.
 */
const messageFor = (completed, total) => {
    if (total === 0) return 'Create a habit to start building consistency.'
    if (completed >= total) return 'Perfect day — every habit is done.'
    if (completed > 0) return 'Good start. Keep the momentum going.'

    return 'Fresh canvas. Tick one habit to begin.'
}

const HabitProgressCard = ({ completed, total, isLoading }) => {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0

    return (
        <section
            aria-label="Today's habit progress"
            className="rounded-card border border-border bg-surface px-4 py-3.5"
        >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-secondary-soft text-secondary"
                >
                    <CheckCircle2 className="h-4.5 w-4.5" strokeWidth={2} />
                </span>

                <div>
                    <p className="label-xs text-content-subtle">Today&rsquo;s Progress</p>
                    <div className="mt-0.5 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tabular-nums tracking-tight text-content">
                            {isLoading ? '—' : `${completed} / ${total}`}
                        </span>
                        <span className="text-xs text-content-muted">Habits completed</span>
                    </div>
                </div>

                <span className="ml-auto inline-flex items-center rounded-pill bg-secondary-soft px-2 py-0.5 text-xs font-bold tabular-nums text-secondary">
                    {isLoading ? '—' : `${percent}%`}
                </span>
            </div>

            {/* Progress line — width tracks the ratio exactly, never faked. */}
            <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Habits completed today"
                className="mt-3.5 h-2 overflow-hidden rounded-pill bg-surface-overlay"
            >
                <div
                    className="h-full rounded-pill bg-secondary transition-[width] duration-500"
                    style={{ width: `${percent}%` }}
                />
            </div>

            <p className="mt-2.5 text-xs text-content-muted">
                {isLoading ? 'Loading today…' : messageFor(completed, total)}
            </p>
        </section>
    )
}

export default HabitProgressCard
