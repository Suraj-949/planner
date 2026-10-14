import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStats, useStreak, useTasks, useTaskActions } from '../hooks/useTasks'
import { useGoals } from '../hooks/useGoals'
import AppShell from '../components/layout/AppShell'
import DashboardHeader from '../components/dashboard/DashboardHeader'
import TodayProgress from '../components/dashboard/TodayProgress'
import MetricCard from '../components/dashboard/MetricCard'
import FocusTimer from '../components/dashboard/FocusTimer'
import WeeklyProductivityChart from '../components/dashboard/WeeklyProductivityChart'
import ProductivityInsight from '../components/dashboard/ProductivityInsight'
import ActiveGoals from '../components/dashboard/ActiveGoals'
import AddTaskModal from '../components/dashboard/AddTaskModal'
import TodayTaskRow from '../components/dashboard/TodayTaskRow'
import LoadingRow from '../components/ui/LoadingRow'
import EmptyState from '../components/ui/EmptyState'
import Notice from '../components/ui/Notice'
import Button from '../components/ui/Button'
import { addLocalDaysKey, daysBetween, formatDateKey } from '../utils/dates'
import { focusMinutesFor, focusMinutesForDays } from '../utils/focusStore'
import { formatEstimate } from '../utils/taskAdapter'
import { CheckCircle2, Timer, Flame, Target } from 'lucide-react'

const DAILY_FOCUS_TARGET_MINUTES = 240
const WEEK_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const TODAY_TABS = [
    { id: 'all', label: 'All' },
    { id: 'high', label: 'High Priority' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'finished', label: 'Finished' },
]

/*
 * Forge dashboard — the execution console.
 *
 * Every number is derived from a real source: the task list query (due on or before
 * today), the completed-tasks query (bucketed by completedAt for the week chart), the
 * streak and stats endpoints, active goals, and the local focus log the timer writes.
 * There is no seeded or placeholder figure anywhere on this page.
 *
 * Two bounded task queries rather than one: the "due window" list drives progress,
 * notifications, toggling and the focus picker; the "recently completed" list drives the
 * weekly chart and the completion trend. Completed tasks with future deadlines would be
 * invisible to a deadline-windowed query alone.
 */
const DashboardPage = () => {
    const navigate = useNavigate()
    const todayKey = useMemo(() => formatDateKey(new Date()), [])

    // Monday-start week containing today, as local day keys.
    const weekKeys = useMemo(() => {
        const day = new Date().getDay() // 0 Sun … 6 Sat
        const offsetToMonday = day === 0 ? -6 : 1 - day

        return Array.from({ length: 7 }, (_, index) =>
            addLocalDaysKey(todayKey, offsetToMonday + index)
        )
    }, [todayKey])

    const dueQuery = useMemo(() => ({ to: todayKey, limit: 100 }), [todayKey])
    const completedQuery = useMemo(
        () => ({ status: 'completed', limit: 100 }),
        []
    )

    const due = useTasks(dueQuery)
    const completedRecent = useTasks(completedQuery)
    const {
        isLoading: statsLoading,
        refetch: refetchStats,
    } = useStats()
    const {
        streak,
        longestStreak,
        isLoading: streakLoading,
        refetch: refetchStreak,
    } = useStreak()
    const { goals, isLoading: goalsLoading } = useGoals({ status: 'active' })
    const { update, create } = useTaskActions()

    const [actionError, setActionError] = useState(null)
    const [taskSearch, setTaskSearch] = useState('')
    const [todayTab, setTodayTab] = useState('all')
    const [addOpen, setAddOpen] = useState(false)
    const [focusTaskId, setFocusTaskId] = useState(null)

    // Bumped by the timer each time a focus interval lands, so the Focus Time metric
    // re-reads the store without the metric owning any timer state.
    const [focusPulse, setFocusPulse] = useState(0)
    const timerRef = useRef(null)

    const tasks = useMemo(() => due.data?.tasks ?? [], [due.data])
    const completedTasks = useMemo(
        () => completedRecent.data?.tasks ?? [],
        [completedRecent.data]
    )

    /* ---- derived counts ---- */

    const windowCounts = useMemo(() => {
        let completed = 0
        let pending = 0
        let inProgress = 0

        for (const task of tasks) {
            if (task.status === 'completed') completed += 1
            else if (task.status === 'in-progress') inProgress += 1
            else pending += 1
        }

        return { completed, pending, inProgress, total: tasks.length }
    }, [tasks])

    const activeTasks = useMemo(
        () => tasks.filter((task) => task.status !== 'completed'),
        [tasks]
    )

    const weekCompletedCount = useMemo(() => {
        const keys = new Set(weekKeys)

        return completedTasks.reduce(
            (sum, task) =>
                task.completedAt && keys.has(formatDateKey(task.completedAt))
                    ? sum + 1
                    : sum,
            0
        )
    }, [completedTasks, weekKeys])

    const todayFocusMinutes = useMemo(
        () => focusMinutesFor(todayKey),
        // focusPulse: external store, re-read when the timer reports a new interval.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [todayKey, focusPulse]
    )

    const weekFocusMinutes = useMemo(
        () => focusMinutesForDays(weekKeys),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [weekKeys, focusPulse]
    )

    const weekData = useMemo(() => {
        const completedByDay = Object.fromEntries(weekKeys.map((key) => [key, 0]))

        for (const task of completedTasks) {
            if (!task.completedAt) continue
            const key = formatDateKey(task.completedAt)
            if (key in completedByDay) completedByDay[key] += 1
        }

        return weekKeys.map((key, index) => ({
            day: WEEK_DAY_NAMES[index],
            key,
            completed: completedByDay[key],
            focus: Number((weekFocusMinutes[index] / 60).toFixed(1)),
        }))
    }, [weekKeys, completedTasks, weekFocusMinutes])

    const bestDay = useMemo(() => {
        const peak = weekData.reduce(
            (best, day) => (day.completed > (best?.completed ?? -1) ? day : best),
            null
        )

        return peak && peak.completed > 0 ? peak : null
    }, [weekData])

    const goalAggregate = useMemo(() => {
        const total = goals.reduce((sum, goal) => sum + (goal.progress?.total ?? 0), 0)
        const done = goals.reduce((sum, goal) => sum + (goal.progress?.completed ?? 0), 0)

        return total > 0 ? Math.round((done / total) * 100) : 0
    }, [goals])

    const notifications = useMemo(
        () =>
            activeTasks
                .map((task) => {
                    const offset = task.deadline ? daysBetween(todayKey, task.deadline) : null

                    if (offset === null || offset > 0) return null

                    return {
                        id: task.id,
                        tone: offset < 0 ? 'danger' : 'primary',
                        title: offset < 0 ? `Overdue: ${task.title}` : `Due today: ${task.title}`,
                        body:
                            offset < 0
                                ? `${Math.abs(offset)} day${Math.abs(offset) === 1 ? '' : 's'} late`
                                : 'Due before the day ends',
                        to: `/tasks/${task.id}`,
                    }
                })
                .filter(Boolean)
                .slice(0, 8),
        [activeTasks, todayKey]
    )

    const visibleTasks = useMemo(() => {
        const query = taskSearch.trim().toLowerCase()

        return tasks.filter((task) => {
            // The Finished tab is the only one that keeps completed rows; everywhere
            // else they have already served their purpose in the progress bar.
            if (todayTab === 'finished') {
                if (task.status !== 'completed') return false
            } else if (task.status === 'completed') {
                return false
            }

            if (todayTab === 'high' && task.priority !== 'high') return false
            if (todayTab === 'in-progress' && task.status !== 'in-progress') return false

            if (query) {
                const match =
                    task.title.toLowerCase().includes(query) ||
                    String(task.category ?? '').toLowerCase().includes(query)
                if (!match) return false
            }

            return true
        })
    }, [tasks, taskSearch, todayTab])

    const visibleCounts = useMemo(
        () => ({
            all: activeTasks.length,
            high: activeTasks.filter((task) => task.priority === 'high').length,
            'in-progress': activeTasks.filter((task) => task.status === 'in-progress').length,
            finished: windowCounts.completed,
        }),
        [activeTasks, windowCounts.completed]
    )

    const focusTasks = useMemo(
        () => tasks.filter((task) => task.status !== 'completed'),
        [tasks]
    )

    const focusTask = useMemo(
        () => focusTasks.find((task) => task.id === focusTaskId) ?? null,
        [focusTasks, focusTaskId]
    )

    /* ---- mutations ---- */

    const refreshAll = useCallback(
        async () => {
            // Task lists, stats and streak all move when a task is completed — refetching
            // only the list would leave the sidebar badges and the streak card stale until
            // the next navigation.
            await Promise.all([
                due.refetch(),
                completedRecent.refetch(),
                refetchStats(),
                refetchStreak(),
            ])
        },
        [due, completedRecent, refetchStats, refetchStreak]
    )

    const toggle = useCallback(
        async (task) => {
            const next = task.status === 'completed' ? 'pending' : 'completed'

            // Optimistic so the checkbox responds on the same frame; the reload below
            // makes it true. Without it the row flips and then flips back.
            due.setData((state) => ({
                ...state,
                tasks: (state?.tasks ?? []).map((row) =>
                    row.id === task.id ? { ...row, status: next } : row
                ),
            }))

            try {
                await update(task.id, { status: next })
                await refreshAll()
            } catch (error) {
                // Not rolled back by hand: reloading restores whatever the server actually
                // holds, which by definition cannot disagree with reality.
                await refreshAll()
                setActionError(error.message)
            }
        },
        [update, due, refreshAll]
    )

    const handleCreate = useCallback(
        async (body) => {
            await create(body)
            await refreshAll()
        },
        [create, refreshAll]
    )

    const handleQuickFocus = useCallback(() => {
        const next =
            focusTasks.find((task) => task.status === 'in-progress') ?? focusTasks[0]

        if (!next) return

        setFocusTaskId(next.id)
        timerRef.current?.start()
    }, [focusTasks])

    const handleFocusedFromRow = useCallback((task) => {
        setFocusTaskId(task.id)
        timerRef.current?.start()
    }, [])

    const loading = due.isLoading && !due.data
    const emptyWindow = !due.isLoading && windowCounts.total === 0

    return (
        <AppShell>
            <div className="space-y-4">
                {actionError && (
                    <Notice
                        tone="danger"
                        title="Could not save that change"
                        onDismiss={() => setActionError(null)}
                    >
                        {actionError}
                    </Notice>
                )}

                <DashboardHeader
                    search={{ value: taskSearch, onChange: setTaskSearch }}
                    notifications={notifications}
                    onQuickFocus={handleQuickFocus}
                    onAddTask={() => setAddOpen(true)}
                />

                {/* Progress line bar */}
                <TodayProgress
                    completed={windowCounts.completed}
                    total={windowCounts.total}
                    pending={windowCounts.pending}
                    inProgress={windowCounts.inProgress}
                />

                {/* KPI strip — Focus Time is the actual logged value, not an estimate. */}
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <MetricCard
                        icon={CheckCircle2}
                        accent="secondary"
                        value={statsLoading ? '—' : String(windowCounts.completed)}
                        label="Tasks Completed"
                        badge={`+${weekCompletedCount}`}
                        badgeTone="secondary"
                        hint="this week"
                    />
                    <MetricCard
                        icon={Timer}
                        accent="primary"
                        value={formatEstimate(todayFocusMinutes)}
                        label="Focus Time"
                        hint={`Daily target ${formatEstimate(DAILY_FOCUS_TARGET_MINUTES)}`}
                        progress={
                            (todayFocusMinutes / DAILY_FOCUS_TARGET_MINUTES) * 100
                        }
                    />
                    <MetricCard
                        icon={Flame}
                        accent="primary"
                        value={streakLoading ? '—' : `${streak}d`}
                        label="Current Streak"
                        hint={
                            longestStreak > 0
                                ? `Best: ${longestStreak} days`
                                : 'Complete a task today'
                        }
                    />
                    <MetricCard
                        icon={Target}
                        accent="secondary"
                        value={goalsLoading ? '—' : `${goalAggregate}%`}
                        label="Goal Progress"
                        hint={`${goals.length} active goal${goals.length === 1 ? '' : 's'}`}
                        progress={goalAggregate}
                    />
                </div>

                {/* Main column + right rail */}
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                    <div className="space-y-3 xl:col-span-2">
                        <section
                            aria-label="Today's tasks"
                            className="rounded-card border border-border bg-surface"
                        >
                            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                                <h2 className="text-sm font-semibold text-content">
                                    Today&rsquo;s Tasks
                                </h2>
                                <span className="rounded-pill bg-surface-overlay px-2 py-0.5 text-[11px] font-bold tabular-nums text-content-muted">
                                    {visibleCounts.all}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => navigate('/tasks')}
                                    className="ml-auto text-[11px] font-semibold text-content-muted transition hover:text-content"
                                >
                                    View All →
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
                                {TODAY_TABS.map((tab) => {
                                    const active = todayTab === tab.id

                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setTodayTab(tab.id)}
                                            aria-pressed={active}
                                            className={`rounded-control border px-2 py-1 text-[11px] font-semibold transition-colors duration-100 ${
                                                active
                                                    ? 'border-primary bg-primary text-primary-contrast'
                                                    : 'border-border bg-surface-input text-content-subtle hover:border-border-strong hover:text-content-muted'
                                            }`}
                                        >
                                            {tab.label}{' '}
                                            <span className="tabular-nums opacity-80">
                                                {visibleCounts[tab.id]}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>

                            {loading ? (
                                <LoadingRow label="Loading today's tasks…" className="m-4" />
                            ) : emptyWindow ? (
                                <div className="px-4 py-8">
                                    <EmptyState
                                        title="Nothing due today"
                                        body="No task has a deadline on or before today. Capture the next one here or plan ahead on the tasks page."
                                        actionLabel="Add your first task"
                                        onAction={() => setAddOpen(true)}
                                    />
                                </div>
                            ) : visibleTasks.length === 0 ? (
                                <div className="px-4 py-8 text-center">
                                    <p className="text-xs text-content-subtle">
                                        No tasks match this filter.
                                    </p>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setTodayTab('all')
                                            setTaskSearch('')
                                        }}
                                        className="mt-2"
                                    >
                                        Clear filters
                                    </Button>
                                </div>
                            ) : (
                                <ul className="px-4">
                                    {visibleTasks.map((task) => (
                                        <TodayTaskRow
                                            key={task.id}
                                            task={task}
                                            onToggle={toggle}
                                            onFocused={handleFocusedFromRow}
                                        />
                                    ))}
                                </ul>
                            )}
                        </section>

                        <ActiveGoals goals={goals} />
                    </div>

                    <div className="space-y-3">
                        <FocusTimer
                            ref={timerRef}
                            task={focusTask}
                            tasks={focusTasks}
                            onTaskChange={setFocusTaskId}
                            onFocusLogged={() => setFocusPulse((n) => n + 1)}
                        />
                        <WeeklyProductivityChart week={weekData} />
                        <ProductivityInsight
                            bestDay={bestDay?.day ?? null}
                            bestDayCount={bestDay?.completed ?? 0}
                        />
                    </div>
                </div>
            </div>

            <AddTaskModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                onCreate={handleCreate}
            />
        </AppShell>
    )
}

export default DashboardPage
