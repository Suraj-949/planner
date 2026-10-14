import { Link } from 'react-router-dom'
import { Target, ArrowRight } from 'lucide-react'

const formatTargetDate = (iso) => {
    if (!iso) return 'No deadline'
    const date = new Date(iso)

    return Number.isNaN(date.getTime())
        ? 'No deadline'
        : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const daysLeft = (iso) => {
    if (!iso) return null
    const due = new Date(iso)
    if (Number.isNaN(due.getTime())) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)

    return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

/*
 * Active goals strip — the goals the user is actually working right now.
 *
 * Progress bars come straight from the server's milestone-derived `goal.progress`
 * (percent, completed/total), so the card cannot drift from the goals page.
 */
const ActiveGoals = ({ goals = [] }) => {
    return (
        <section
            aria-label="Active goals"
            className="rounded-card border border-border bg-surface px-4 py-3.5"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span
                        aria-hidden="true"
                        className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-secondary-soft text-secondary"
                    >
                        <Target className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <h2 className="text-sm font-semibold text-content">Active Goals</h2>
                </div>

                <Link
                    to="/goals"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-content-muted transition hover:text-content"
                >
                    View Goals
                    <ArrowRight className="h-3 w-3" strokeWidth={2} />
                </Link>
            </div>

            {goals.length === 0 ? (
                <p className="mt-3 text-xs text-content-subtle">
                    No active goals — create one on the Goals page to track milestone progress here.
                </p>
            ) : (
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    {goals.slice(0, 4).map((goal) => {
                        const percent = Math.max(0, Math.min(100, goal.progress?.percent ?? 0))
                        const left = daysLeft(goal.targetDate)

                        return (
                            <Link
                                key={goal.id}
                                to={`/goals/${goal.id}`}
                                className="group rounded-control border border-border bg-surface-raised px-3 py-2.5 transition hover:border-border-strong"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-content group-hover:text-primary">
                                        {goal.title}
                                    </span>
                                    <span className="shrink-0 text-[10px] font-bold tabular-nums text-secondary">
                                        {percent}%
                                    </span>
                                </div>

                                <p className="mt-0.5 text-[10px] text-content-subtle">
                                    {goal.progress?.completed ?? 0} / {goal.progress?.total ?? 0} milestones completed
                                </p>

                                <div
                                    role="progressbar"
                                    aria-valuenow={percent}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-label={`Progress for ${goal.title}`}
                                    className="mt-2 h-1 overflow-hidden rounded-pill bg-surface-overlay"
                                >
                                    <div
                                        className="h-full rounded-pill bg-secondary transition-[width] duration-500"
                                        style={{ width: `${percent}%` }}
                                    />
                                </div>

                                <div className="mt-1.5 flex items-center justify-between text-[10px] text-content-subtle">
                                    <span>Target: {formatTargetDate(goal.targetDate)}</span>
                                    {left !== null && (
                                        <span className={left < 0 ? 'text-danger' : undefined}>
                                            {left < 0
                                                ? `${Math.abs(left)}d overdue`
                                                : left === 0
                                                  ? 'Due today'
                                                  : `${left}d left`}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

export default ActiveGoals
