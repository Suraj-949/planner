import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import LoadingRow from '../components/ui/LoadingRow'
import EmptyState from '../components/ui/EmptyState'
import Notice from '../components/ui/Notice'
import Button from '../components/ui/Button'
import Checkbox from '../components/ui/Checkbox'
import { useTasks, useTaskActions } from '../hooks/useTasks'
import { errorMessage } from '../hooks/useResource'
import { formatDateKey, MONTHS } from '../utils/dates'
import { formatTotal, formatEstimate, toViewTasks } from '../utils/taskAdapter'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

/*
 * Seven local days, starting from Monday of the selected week.
 *
 * Built with date parts rather than by adding 7 × 24 hours, so a DST change inside the
 * week cannot shift a day into the wrong bucket — the same arithmetic the reminder badges
 * and the streak use.
 */
const startOfWeek = (anchor) => {
    const day = anchor.getDay()
    // getDay() is 0 = Sunday … 6 = Saturday; the offset walks back to Monday.
    const offset = day === 0 ? -6 : 1 - day

    return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + offset)
}

const addDays = (date, amount) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)

/*
 * A task, compressed to what fits a seventh of the screen.
 *
 * The full TaskRow is a six-column grid sized for the tasks list and overflows badly in a
 * seven-wide week, so the planner uses this instead: title, estimate, and a completion
 * checkbox. The title still opens the same detail page.
 */
const DayTask = ({ task, onToggle }) => {
    const completed = task.status === 'completed'

    return (
        <div className="flex items-start gap-2 px-2.5 py-2">
            <Checkbox
                checked={completed}
                onChange={() => onToggle(task.id)}
                aria-label={`Mark "${task.title}" as ${completed ? 'incomplete' : 'complete'}`}
                className="mt-0.5"
            />

            <div className="min-w-0 flex-1">
                <Link
                    to={`/tasks/${task.id}`}
                    className={`block truncate text-xs hover:underline ${
                        completed ? 'text-content-subtle line-through' : 'font-medium text-content'
                    }`}
                >
                    {task.title}
                </Link>

                <span className="text-[10px] tabular-nums text-content-subtle">
                    {formatEstimate(task.estimateMinutes)}
                </span>
            </div>
        </div>
    )
}

const PlannerPage = () => {
    const [anchor, setAnchor] = useState(() => new Date())
    const navigate = useNavigate()

    const weekStart = useMemo(() => startOfWeek(anchor), [anchor])
    const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

    const query = useMemo(
        () => ({
            from: formatDateKey(weekStart),
            to: formatDateKey(weekEnd),
            sort: 'deadline',
            limit: 100,
        }),
        [weekStart, weekEnd]
    )

    const { data, isLoading, error, refetch, setData } = useTasks(query)
    const { update } = useTaskActions()

    const [notice, setNotice] = useState(null)

    // Mapped through toViewTasks: the API serialises `_id`, while the chips and links
    // below read the presentation shape (`id`, `due`, `estimate`).
    const tasks = useMemo(() => toViewTasks(data?.tasks), [data])

    const days = useMemo(() => {
        const todayKey = formatDateKey(new Date())

        return Array.from({ length: 7 }, (_, index) => {
            const date = addDays(weekStart, index)
            const key = formatDateKey(date)

            return {
                key,
                date,
                isToday: key === todayKey,
                tasks: tasks.filter((task) => task.deadline && formatDateKey(task.deadline) === key),
            }
        })
    }, [weekStart, tasks])

    const toggle = useCallback(
        async (taskId) => {
            const current = tasks.find((task) => String(task.id) === String(taskId))

            if (!current) return

            const next = current.status === 'completed' ? 'pending' : 'completed'

            setData((state) => ({
                ...state,
                tasks: (state?.tasks ?? []).map((task) =>
                    String(task.id) === String(taskId) ? { ...task, status: next } : task
                ),
            }))

            try {
                await update(current.id, { status: next })
                await refetch()
            } catch (err) {
                await refetch()
                setNotice({
                    tone: 'danger',
                    title: 'Could not save that change',
                    body: errorMessage(err, 'The list was reloaded from the server.'),
                })
            }
        },
        [tasks, update, refetch, setData]
    )

    return (
        <AppShell>
            {notice && (
                <div className="mb-3">
                    <Notice tone={notice.tone} title={notice.title} onDismiss={() => setNotice(null)}>
                        {notice.body}
                    </Notice>
                </div>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => setAnchor(addDays(anchor, -7))}>
                    <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
                    Previous
                </Button>

                <span className="text-sm font-semibold text-content">
                    {MONTHS[weekStart.getMonth()]} {weekStart.getDate()} – {MONTHS[weekEnd.getMonth()]}{' '}
                    {weekEnd.getDate()}
                </span>

                <Button size="sm" onClick={() => setAnchor(addDays(anchor, 7))}>
                    Next
                    <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                </Button>

                <Button size="sm" variant="ghost" onClick={() => setAnchor(new Date())}>
                    This week
                </Button>

                <span className="ml-auto text-[11px] tabular-nums text-content-subtle">
                    {tasks.length} tasks · {formatTotal(tasks)} estimated
                </span>
            </div>

            {isLoading ? (
                <LoadingRow label="Loading the week…" />
            ) : error ? (
                <EmptyState title="Could not load the week" body={errorMessage(error, 'The request failed.')} />
            ) : (
                <>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
                        {days.map((day) => (
                            <section
                                key={day.key}
                                className={`rounded-card border bg-surface ${
                                    day.isToday ? 'border-primary' : 'border-border'
                                }`}
                            >
                                <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-2.5 py-2">
                                    <CalendarDays className="h-3.5 w-3.5 text-content-subtle" strokeWidth={1.8} />
                                    <h2 className="label-xs">
                                        {day.date.toLocaleDateString(undefined, { weekday: 'short' })}
                                    </h2>
                                    <span className="ml-auto text-[11px] tabular-nums text-content-subtle">
                                        {MONTHS[day.date.getMonth()]} {day.date.getDate()}
                                    </span>
                                </div>

                                {day.tasks.length === 0 ? (
                                    <p className="px-2.5 py-6 text-center text-[11px] text-content-subtle">
                                        Nothing due
                                    </p>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {day.tasks.map((task) => (
                                            <DayTask key={task.id} task={task} onToggle={toggle} />
                                        ))}
                                    </div>
                                )}
                            </section>
                        ))}
                    </div>

                    {tasks.length === 0 && (
                        <div className="mt-3">
                            <EmptyState
                                title="A clear week"
                                body="No task has a deadline in this range. Add one from the tasks page and it will appear on its day."
                                actionLabel="Go to tasks"
                                onAction={() => navigate('/tasks')}
                            />
                        </div>
                    )}
                </>
            )}

            <p className="mt-3 text-[11px] text-content-subtle">
                Tasks without a deadline are not shown here — see{' '}
                <Link to="/tasks" className="font-semibold text-primary hover:underline">
                    all tasks
                </Link>
                .
            </p>
        </AppShell>
    )
}

export default PlannerPage
