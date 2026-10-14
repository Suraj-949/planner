import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStats, useStreak, useTasks, useTaskActions } from '../hooks/useTasks'
import { useHabits } from '../hooks/useHabits'
import StatCard from '../components/ui/StatCard'
import LoadingRow from '../components/ui/LoadingRow'
import EmptyState from '../components/ui/EmptyState'
import Notice from '../components/ui/Notice'
import Badge from '../components/ui/Badge'
import TaskRow from '../components/tasks/TaskRow'
import { formatDateKey, daysBetween } from '../utils/dates'
import { formatTotal, toViewTasks } from '../utils/taskAdapter'
import {
    ListTodo,
    Flame,
    AlertTriangle,
    CheckCircle2,
    Timer,
    ArrowRight,
    Repeat,
} from 'lucide-react'
import AppShell from "../components/layout/AppShell";

/*
 * The dashboard answers three questions and nothing else: what is overdue, what is due
 * today, and how the streak is doing.
 *
 * It deliberately does not show lifetime totals. A number like "24 completed" is only
 * meaningful against a window, and a figure that grows forever reads as progress even in a
 * week where nothing got done — which is why the analytics page, not this one, owns the
 * longer view.
 */
const DashboardPage = () => {
    const todayKey = formatDateKey(new Date())
    const navigate = useNavigate()
    const [actionError, setActionError] = useState(null)

    const { stats, isLoading: statsLoading, error: statsError } = useStats()
    const { streak, longestStreak, isLoading: streakLoading } = useStreak()
    const { habits } = useHabits()

    /*
     * One bounded query for everything the dashboard shows: anything due on or before
     * today. Overdue and due-today are then split by a day-offset comparison, which is the
     * same arithmetic the reminder badges use — so a task cannot be overdue in one place
     * and due today in another.
     */
    const query = useMemo(() => ({ to: todayKey, limit: 50 }), [todayKey])
    const { data, isLoading: tasksLoading, refetch, setData } = useTasks(query)
    const { update } = useTaskActions()

    // Mapped through toViewTasks: the API serialises `_id`, while TaskRow and the toggle
    // below read the presentation shape (`id`, `due`, `estimate`).
    const tasks = useMemo(() => toViewTasks(data?.tasks), [data])

    const toggle = useCallback(
        async (id) => {
            const current = tasks.find((task) => String(task.id) === String(id))

            if (!current) return

            const next = current.status === 'completed' ? 'pending' : 'completed'

            // Optimistic so the checkbox responds on the same frame; the reload below
            // makes it true. Without it the row flips and then flips back.
            setData((state) => ({
                ...state,
                tasks: (state?.tasks ?? []).map((task) =>
                    String(task.id) === String(id) ? { ...task, status: next } : task
                ),
            }))

            try {
                await update(current.id, { status: next })
                await refetch()
            } catch (error) {
                // Not rolled back by hand: reloading restores whatever the server actually
                // holds, which by definition cannot disagree with reality.
                await refetch()
                setActionError(error.message)
            }
        },
        [tasks, update, refetch, setData]
    )

    const overdue = tasks.filter(
        (task) => task.status !== 'completed' && daysBetween(new Date(), task.deadline) < 0
    )
    const dueToday = tasks.filter(
        (task) => task.status !== 'completed' && daysBetween(new Date(), task.deadline) === 0
    )

    const openCount = overdue.length + dueToday.length

    return (
        <AppShell>
            <div className="space-y-3">
                {actionError && (
                    <Notice tone="danger" title="Could not save that change" onDismiss={() => setActionError(null)}>
                        {actionError}
                    </Notice>
                )}

                {statsError && (
                    <Notice tone="warn" title="Stats unavailable">
                        The dashboard figures could not be loaded. The lists below are still live.
                    </Notice>
                )}

                {/* Streak + summary */}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Current streak"
                        value={streakLoading ? '—' : `${streak}d`}
                        hint={longestStreak > 0 ? `Best: ${longestStreak} days` : 'Complete a task today to start'}
                        tone={streak > 0 ? 'primary' : 'default'}
                        icon={Flame}
                    />
                    <StatCard
                        label="Open tasks"
                        value={statsLoading ? '—' : (stats?.pending ?? 0) + (stats?.['in-progress'] ?? 0)}
                        hint={`${stats?.['in-progress'] ?? 0} in progress`}
                        icon={ListTodo}
                    />
                    <StatCard
                        label="Overdue"
                        value={statsLoading ? '—' : stats?.overdue ?? 0}
                        tone={(stats?.overdue ?? 0) > 0 ? 'danger' : 'default'}
                        hint={(stats?.overdue ?? 0) > 0 ? 'Past its deadline' : 'Nothing late'}
                        icon={AlertTriangle}
                    />
                    <StatCard
                        label="Completion rate"
                        value={statsLoading ? '—' : `${stats?.completionRate ?? 0}%`}
                        hint={`${stats?.completed ?? 0} of ${stats?.total ?? 0} tasks`}
                        tone="secondary"
                        icon={CheckCircle2}
                    />
                </div>

                {/* Today's work */}
                <section className="overflow-hidden rounded-card border border-border bg-surface">
                    <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-3 py-2">
                        <Timer className="h-3.5 w-3.5 text-content-subtle" strokeWidth={1.8} />
                        <h2 className="label-xs">Due today and overdue</h2>
                        <span className="ml-auto text-[11px] tabular-nums text-content-subtle">
                            {openCount} tasks · {formatTotal([...overdue, ...dueToday])}
                        </span>
                    </div>

                    {tasksLoading ? (
                        <LoadingRow label="Loading today…" className="m-3" />
                    ) : openCount === 0 ? (
                        <EmptyState
                            title="Nothing due today"
                            body="No task has a deadline on or before today. Plan the next one from the tasks page."
                            actionLabel="Go to tasks"
                            onAction={() => navigate('/tasks')}
                        />
                    ) : (
                        <>
                            {overdue.map((task) => (
                                <TaskRow key={task.id} task={task} onToggle={toggle} canMutate />
                            ))}
                            {dueToday.map((task) => (
                                <TaskRow key={task.id} task={task} onToggle={toggle} canMutate />
                            ))}
                        </>
                    )}
                </section>

                {/* Habits */}
                {habits.length > 0 && (
                    <section className="rounded-card border border-border bg-surface">
                        <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-3 py-2">
                            <Repeat className="h-3.5 w-3.5 text-content-subtle" strokeWidth={1.8} />
                            <h2 className="label-xs">Habits</h2>
                            <Link
                                to="/habits"
                                className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                            >
                                All habits
                                <ArrowRight className="h-3 w-3" strokeWidth={2} />
                            </Link>
                        </div>

                        <div className="divide-y divide-border">
                            {habits.slice(0, 5).map((habit) => (
                                <div key={habit._id} className="flex items-center gap-3 px-3 py-2.5">
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-content">
                                        {habit.title}
                                    </span>
                                    <span className="shrink-0 text-xs tabular-nums text-content-muted">
                                        {habit.currentStreak}d streak
                                    </span>
                                    <Badge variant={habit.currentStreak > 0 ? 'primary' : 'neutral'} square>
                                        {habit.completionRate}%
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </AppShell>
    )
}

export default DashboardPage
