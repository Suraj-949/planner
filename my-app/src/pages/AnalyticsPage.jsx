import { useMemo, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import StatCard from '../components/ui/StatCard'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Notice from '../components/ui/Notice'
import { useStats, useStreak } from '../hooks/useTasks'
import { errorMessage } from '../hooks/useResource'
import { formatDateKey, addLocalDaysKey } from '../utils/dates'
import { ListTodo, CheckCircle2, AlertTriangle, Flame, Timer, Percent } from 'lucide-react'

/*
 * Analytics, windowed.
 *
 * Every figure here is scoped to a deadline window, because a lifetime total only ever
 * goes up and reads as progress even in a week where nothing got done. The default window
 * is the last 30 days; "all time" is available but labelled as what it is.
 *
 * The series behind the bars is not shown: the backend computes per-day completion counts
 * but does not expose them on a route yet, so a chart here would have to be built from the
 * same list the dashboard already renders. The counts below are the honest summary of
 * what the server can answer today.
 */
const WINDOWS = [
    { id: '7d', label: 'Last 7 days', days: 7 },
    { id: '30d', label: 'Last 30 days', days: 30 },
    { id: '90d', label: 'Last 90 days', days: 90 },
    { id: 'all', label: 'All time', days: null },
]

const AnalyticsPage = () => {
    const [windowId, setWindowId] = useState('30d')

    const selected = WINDOWS.find((window) => window.id === windowId) ?? WINDOWS[1]

    const params = useMemo(() => {
        if (!selected.days) return {}

        const todayKey = formatDateKey(new Date())

        // from = today minus (days - 1), so a 7-day window includes today as day 7.
        return { from: addLocalDaysKey(todayKey, -(selected.days - 1)), to: todayKey }
    }, [selected])

    const { stats, isLoading, error } = useStats(params)
    const { streak, longestStreak } = useStreak()

    // Shares of the counted statuses, so the bar cannot exceed 100% and an empty window
    // renders as an empty track rather than as division by zero.
    const total = stats?.total ?? 0
    const shares = [
        { key: 'completed', label: 'Completed', value: stats?.completed ?? 0, className: 'bg-secondary' },
        { key: 'in-progress', label: 'In progress', value: stats?.['in-progress'] ?? 0, className: 'bg-primary' },
        { key: 'pending', label: 'Pending', value: stats?.pending ?? 0, className: 'bg-content-subtle' },
    ]

    return (
        <AppShell>
            {error && (
                <div className="mb-3">
                    <Notice tone="danger" title="Could not load analytics">
                        {errorMessage(error, 'The request failed.')}
                    </Notice>
                </div>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2">
                {WINDOWS.map((window) => (
                    <Button
                        key={window.id}
                        size="sm"
                        variant={windowId === window.id ? 'primary' : 'subtle'}
                        onClick={() => setWindowId(window.id)}
                    >
                        {window.label}
                    </Button>
                ))}

                <span className="ml-auto text-[11px] tabular-nums text-content-subtle">
                    {isLoading ? 'Loading…' : `Counted by deadline in ${selected.label.toLowerCase()}`}
                </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                    label="Tasks in window"
                    value={isLoading ? '—' : total}
                    hint={total ? 'With a deadline in this window' : 'Nothing due in this window'}
                    icon={ListTodo}
                />
                <StatCard
                    label="Completed"
                    value={isLoading ? '—' : stats?.completed ?? 0}
                    tone="secondary"
                    icon={CheckCircle2}
                />
                <StatCard
                    label="Completion rate"
                    value={isLoading ? '—' : `${stats?.completionRate ?? 0}%`}
                    tone="secondary"
                    hint={total ? `${stats?.completed ?? 0} of ${total} tasks` : 'No tasks to score'}
                    icon={Percent}
                />
                <StatCard
                    label="Overdue"
                    value={isLoading ? '—' : stats?.overdue ?? 0}
                    tone={(stats?.overdue ?? 0) > 0 ? 'danger' : 'default'}
                    hint="Past its deadline and not completed"
                    icon={AlertTriangle}
                />
                <StatCard
                    label="Current streak"
                    value={`${streak}d`}
                    tone={streak > 0 ? 'primary' : 'default'}
                    hint={`Best: ${longestStreak} days`}
                    icon={Flame}
                />
                <StatCard
                    label="Time estimated"
                    value={isLoading ? '—' : `${stats?.['in-progress'] ?? 0} in progress`}
                    hint={`${stats?.pending ?? 0} still pending`}
                    icon={Timer}
                />
            </div>

            {/* Status mix */}
            <section className="mt-3 rounded-card border border-border bg-surface px-4 py-4">
                <h2 className="label-xs text-content-subtle">Status mix</h2>

                {total === 0 ? (
                    <EmptyState
                        title="Nothing to break down"
                        body="No task has a deadline in this window. Widen the range or add deadlines to see the mix."
                    />
                ) : (
                    <>
                        <div
                            role="img"
                            aria-label={`${shares.map((share) => `${share.label}: ${share.value}`).join(', ')}`}
                            className="mt-3 flex h-2 w-full overflow-hidden rounded-pill bg-surface-overlay"
                        >
                            {shares.map((share) => (
                                <div
                                    key={share.key}
                                    className={`h-full ${share.className}`}
                                    style={{ width: `${(share.value / total) * 100}%` }}
                                />
                            ))}
                        </div>

                        <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                            {shares.map((share) => (
                                <div key={share.key} className="flex items-center gap-2">
                                    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${share.className}`} />
                                    <dt className="text-xs text-content-muted">{share.label}</dt>
                                    <dd className="ml-auto text-xs font-semibold tabular-nums text-content">
                                        {share.value}
                                        <span className="ml-1 font-normal text-content-subtle">
                                            {Math.round((share.value / total) * 100)}%
                                        </span>
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </>
                )}
            </section>

            <p className="mt-3 text-[11px] text-content-subtle">
                Counts are derived from the tasks themselves — nothing here reads a stored counter, so
                deleting or reopening a task changes the figures immediately.
            </p>
        </AppShell>
    )
}

export default AnalyticsPage
