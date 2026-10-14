import { CheckCircle2 } from 'lucide-react'

/*
 * Full-width summary of today's execution: completed ÷ due, a green line bar, and the
 * status split underneath so the ratio can be read without hovering anything.
 *
 * Every figure arrives already counted by the page from the live task list — this
 * component draws numbers, it does not invent them.
 */
const TodayProgress = ({ completed, total, pending, inProgress }) => {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0

    const segments = [
        { label: 'All', value: total, className: 'text-content' },
        { label: 'Completed', value: completed, className: 'text-secondary' },
        { label: 'In Progress', value: inProgress, className: 'text-primary' },
        { label: 'Pending', value: pending, className: 'text-content-muted' },
    ]

    return (
        <section
            aria-label="Today's progress"
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
                            {completed} / {total}
                        </span>
                        <span className="text-xs text-content-muted">Tasks completed</span>
                    </div>
                </div>

                <span className="ml-auto inline-flex items-center rounded-pill bg-secondary-soft px-2 py-0.5 text-xs font-bold tabular-nums text-secondary">
                    {percent}%
                </span>
            </div>

            {/* The progress line bar — width tracks the ratio exactly, never faked. */}
            <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Tasks completed today"
                className="mt-3.5 h-2 overflow-hidden rounded-pill bg-surface-overlay"
            >
                <div
                    className="h-full rounded-pill bg-secondary transition-[width] duration-500"
                    style={{ width: `${percent}%` }}
                />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border pt-3">
                {segments.map((segment) => (
                    <span key={segment.label} className="inline-flex items-center gap-1.5">
                        <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 rounded-full ${
                                segment.label === 'Completed'
                                    ? 'bg-secondary'
                                    : segment.label === 'In Progress'
                                      ? 'bg-primary'
                                      : segment.label === 'Pending'
                                        ? 'bg-content-subtle'
                                        : 'bg-border-strong'
                            }`}
                        />
                        <span className="text-[11px] text-content-subtle">{segment.label}</span>
                        <span className={`text-[11px] font-bold tabular-nums ${segment.className}`}>
                            {segment.value}
                        </span>
                    </span>
                ))}
            </div>
        </section>
    )
}

export default TodayProgress
