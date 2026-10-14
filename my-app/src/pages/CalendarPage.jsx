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
import { toViewTasks } from '../utils/taskAdapter'
import { CATEGORY_LABELS } from '../constants/taskMeta'
import { formatDateKey, MONTHS } from '../utils/dates'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/*
 * A calendar month, grid-aligned.
 *
 * The month is walked in whole days from the 1st rather than by stepping 30 days at a
 * time, so February and every DST boundary land on the right cell. Deadlines are bucketed
 * by the same local day key the planner and the streaks use, so a task appears on the same
 * day in every view.
 */
const startOfMonth = (anchor) => new Date(anchor.getFullYear(), anchor.getMonth(), 1)

const endOfMonth = (anchor) => new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)

const CalendarPage = () => {
    const [anchor, setAnchor] = useState(() => new Date())
    const navigate = useNavigate()

    const monthStart = useMemo(() => startOfMonth(anchor), [anchor])
    const monthEnd = useMemo(() => endOfMonth(anchor), [anchor])

    const query = useMemo(
        () => ({
            from: formatDateKey(monthStart),
            to: formatDateKey(monthEnd),
            sort: 'deadline',
            limit: 100,
        }),
        [monthStart, monthEnd]
    )

    const { data, isLoading, error, refetch, setData } = useTasks(query)
    const { update } = useTaskActions()

    const [notice, setNotice] = useState(null)
    const [selected, setSelected] = useState(null)

    // Mapped through toViewTasks: the API serialises `_id`, while TaskRow and the links
    // below read the presentation shape (`id`, `due`, `estimate`).
    const tasks = useMemo(() => toViewTasks(data?.tasks), [data])

    // Six rows of seven cells is what a fixed grid needs; leading blanks align the 1st.
    const cells = useMemo(() => {
        const todayKey = formatDateKey(new Date())
        const leading = monthStart.getDay()
        const totalDays = monthEnd.getDate()

        const byDay = new Map()

        for (const task of tasks) {
            if (!task.deadline) continue

            const key = formatDateKey(task.deadline)

            if (!byDay.has(key)) byDay.set(key, [])
            byDay.get(key).push(task)
        }

        return Array.from({ length: 42 }, (_, index) => {
            const dayNumber = index - leading + 1

            if (dayNumber < 1 || dayNumber > totalDays) return null

            const date = new Date(anchor.getFullYear(), anchor.getMonth(), dayNumber)
            const key = formatDateKey(date)

            return {
                key,
                dayNumber,
                isToday: key === todayKey,
                tasks: byDay.get(key) ?? [],
            }
        })
    }, [anchor, monthStart, monthEnd, tasks])

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

    const selectedTasks = selected ? (cells.find((cell) => cell?.key === selected)?.tasks ?? []) : []

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
                <Button size="sm" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}>
                    <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
                    Previous
                </Button>

                <span className="text-sm font-semibold text-content">
                    {MONTHS[anchor.getMonth()]} {anchor.getFullYear()}
                </span>

                <Button size="sm" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}>
                    Next
                    <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                </Button>

                <Button size="sm" variant="ghost" onClick={() => setAnchor(new Date())}>
                    This month
                </Button>

                <span className="ml-auto text-[11px] tabular-nums text-content-subtle">{tasks.length} deadlines</span>
            </div>

            {isLoading ? (
                <LoadingRow label="Loading the month…" />
            ) : error ? (
                <EmptyState title="Could not load the month" body={errorMessage(error, 'The request failed.')} />
            ) : (
                <>
                    <div className="overflow-hidden rounded-card border border-border bg-surface">
                        <div className="grid grid-cols-7 border-b border-border bg-surface-raised">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                                <div key={label} className="px-2 py-1.5 text-center label-xs text-content-subtle">
                                    {label}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7">
                            {cells.map((cell, index) =>
                                cell ? (
                                    <button
                                        key={cell.key}
                                        type="button"
                                        onClick={() => setSelected(cell.key === selected ? null : cell.key)}
                                        className={`min-h-[72px] border-b border-r border-border px-1.5 py-1.5 text-left transition-colors duration-100 last:border-r-0 hover:bg-surface-raised ${
                                            selected === cell.key ? 'bg-surface-raised' : ''
                                        }`}
                                    >
                                        <span
                                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] tabular-nums ${
                                                cell.isToday
                                                    ? 'bg-primary font-semibold text-primary-contrast'
                                                    : 'text-content-muted'
                                            }`}
                                        >
                                            {cell.dayNumber}
                                        </span>

                                        {cell.tasks.length > 0 && (
                                            <span className="mt-1 block">
                                                <span
                                                    className={`block truncate rounded-[4px] px-1 py-0.5 text-[10px] font-medium ${
                                                        cell.tasks.some((task) => task.status !== 'completed')
                                                            ? 'bg-primary-soft text-primary'
                                                            : 'bg-surface-overlay text-content-subtle line-through'
                                                    }`}
                                                >
                                                    {cell.tasks.length} task{cell.tasks.length > 1 ? 's' : ''}
                                                </span>
                                            </span>
                                        )}
                                    </button>
                                ) : (
                                    <div
                                        key={`blank-${index}`}
                                        className="min-h-[72px] border-b border-r border-border bg-surface/40 last:border-r-0"
                                    />
                                )
                            )}
                        </div>
                    </div>

                    {/* Selected day */}
                    {selected && (
                        <section className="mt-3 overflow-hidden rounded-card border border-border bg-surface">
                            <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-3 py-2">
                                <h2 className="label-xs">
                                    {new Date(selected).toLocaleDateString(undefined, {
                                        weekday: 'long',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </h2>
                                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(null)}>
                                    Close
                                </Button>
                            </div>

                            {selectedTasks.length === 0 ? (
                                <p className="px-3 py-6 text-center text-sm text-content-subtle">
                                    Nothing due on this day.
                                </p>
                            ) : (
                                <ul className="divide-y divide-border">
                                    {selectedTasks.map((task) => (
                                        <li key={task.id} className="flex items-center gap-2.5 px-3 py-2.5">
                                            <Checkbox
                                                checked={task.status === 'completed'}
                                                onChange={() => toggle(task.id)}
                                                aria-label={`Mark "${task.title}" as ${
                                                    task.status === 'completed' ? 'incomplete' : 'complete'
                                                }`}
                                            />

                                            <Link
                                                to={`/tasks/${task.id}`}
                                                className={`min-w-0 flex-1 truncate text-sm hover:underline ${
                                                    task.status === 'completed'
                                                        ? 'text-content-subtle line-through'
                                                        : 'font-medium text-content'
                                                }`}
                                            >
                                                {task.title}
                                            </Link>

                                            <span className="shrink-0 text-[11px] text-content-subtle">
                                                {CATEGORY_LABELS[task.category] ?? task.category}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}

                    {tasks.length === 0 && !selected && (
                        <div className="mt-3">
                            <EmptyState
                                title="No deadlines this month"
                                body="Nothing has a deadline in this month. The calendar fills as tasks are given dates."
                                actionLabel="Go to tasks"
                                onAction={() => navigate('/tasks')}
                            />
                        </div>
                    )}
                </>
            )}
        </AppShell>
    )
}

export default CalendarPage
