import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import LoadingRow from '../components/ui/LoadingRow'
import EmptyState from '../components/ui/EmptyState'
import Notice from '../components/ui/Notice'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Checkbox from '../components/ui/Checkbox'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useTask, useTaskActions } from '../hooks/useTasks'
import { errorMessage } from '../hooks/useResource'
import { STATUS_LABELS, STATUS_VARIANTS, REMINDER_VARIANTS } from '../constants/taskMeta'
import { formatEstimate } from '../utils/taskAdapter'
import { formatDue } from '../utils/taskAdapter'
import { getReminder } from '../utils/dates'
import { Trash2, ArrowLeft, Timer, Repeat, StickyNote } from 'lucide-react'

/*
 * One task, in full.
 *
 * The list view is dense by necessity — six columns in a row that has to stay readable at
 * a glance. Everything that does not fit there lives here: the description, the subtask
 * checklist, notes written after the fact, the estimate against the time actually spent,
 * and the project or goal it is filed under.
 */
const TaskDetailPage = () => {
    const { id } = useParams()
    const navigate = useNavigate()

    const { data: task, isLoading, error, refetch } = useTask(id)
    const { update, remove } = useTaskActions()

    const [notice, setNotice] = useState(null)
    const [pendingDelete, setPendingDelete] = useState(false)
    const [savingSubtask, setSavingSubtask] = useState(null)

    const showError = useCallback((err, fallback) => {
        setNotice({ tone: 'danger', title: fallback, body: errorMessage(err, 'The request was rejected.') })
    }, [])

    const toggleStatus = useCallback(async () => {
        if (!task) return

        const next = task.status === 'completed' ? 'pending' : 'completed'

        try {
            await update(id, { status: next })
            await refetch()
        } catch (err) {
            await refetch()
            showError(err, 'Could not change the status')
        }
    }, [task, id, update, refetch, showError])

    /*
     * A subtask toggle is a write of the whole array, because subtasks are an embedded
     * array on the task rather than their own collection. The index is resolved before the
     * request so a slow response cannot apply the wrong one if the user clicks twice.
     */
    const toggleSubtask = useCallback(
        async (index) => {
            if (!task?.subtasks?.length) return

            setSavingSubtask(index)

            const next = task.subtasks.map((subtask, position) =>
                position === index ? { ...subtask, completed: !subtask.completed } : subtask
            )

            try {
                await update(id, { subtasks: next })
                await refetch()
            } catch (err) {
                await refetch()
                showError(err, 'Could not save the subtask')
            } finally {
                setSavingSubtask(null)
            }
        },
        [task, id, update, refetch, showError]
    )

    const deleteTask = useCallback(async () => {
        try {
            await remove(id)
            navigate('/tasks')
        } catch (err) {
            setPendingDelete(false)
            showError(err, 'Could not delete the task')
        }
    }, [remove, id, navigate, showError])

    const reminder = task ? getReminder(task) : null
    const subtasks = task?.subtasks ?? []
    const completedSubtasks = subtasks.filter((subtask) => subtask.completed).length

    /*
     * The fetch failure is rendered from `error` directly rather than copied into notice
     * state by an effect. Two cases need different treatment: with no data on screen the
     * empty state below carries the message, while a failed *refetch* still has the previous
     * task to show and so needs a banner that does not replace it.
     */
    return (
        <AppShell>
            <Link
                to="/tasks"
                className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-content-muted hover:text-content"
            >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                All tasks
            </Link>

            {error && task && (
                <div className="mb-3">
                    <Notice tone="danger" title="Could not refresh this task">
                        {errorMessage(error, 'The details below may be out of date.')}
                    </Notice>
                </div>
            )}

            {notice && (
                <div className="mb-3">
                    <Notice tone={notice.tone} title={notice.title} onDismiss={() => setNotice(null)}>
                        {notice.body}
                    </Notice>
                </div>
            )}

            {isLoading ? (
                <LoadingRow label="Loading the task…" />
            ) : !task ? (
                <EmptyState
                    title="Task not found"
                    body={
                        error
                            ? errorMessage(error, 'It may have been deleted, or it belongs to another account.')
                            : 'It may have been deleted, or the link may be wrong.'
                    }
                    actionLabel="Back to tasks"
                    onAction={() => navigate('/tasks')}
                />
            ) : (
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
                    {/* Main column */}
                    <div className="space-y-3">
                        <section className="rounded-card border border-border bg-surface px-4 py-4">
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <h1 className="text-lg font-semibold tracking-tight text-content">
                                        {task.title}
                                    </h1>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <Badge variant={STATUS_VARIANTS[task.status]}>
                                            {STATUS_LABELS[task.status]}
                                        </Badge>
                                        <Badge variant={task.priority} square>
                                            {task.priority}
                                        </Badge>
                                        {reminder && (
                                            <Badge variant={REMINDER_VARIANTS[reminder]}>
                                                {reminder === 'overdue'
                                                    ? 'Overdue'
                                                    : reminder === 'today'
                                                      ? 'Due today'
                                                      : 'Due tomorrow'}
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-1">
                                    <Button
                                        size="sm"
                                        variant={task.status === 'completed' ? 'subtle' : 'primary'}
                                        onClick={toggleStatus}
                                    >
                                        {task.status === 'completed' ? 'Reopen' : 'Mark complete'}
                                    </Button>

                                    <button
                                        type="button"
                                        onClick={() => setPendingDelete(true)}
                                        aria-label="Delete this task"
                                        className="rounded-control p-1.5 text-content-subtle transition hover:bg-danger-soft hover:text-danger"
                                    >
                                        <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                                    </button>
                                </div>
                            </div>

                            {task.description && (
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-content-muted">
                                    {task.description}
                                </p>
                            )}

                            <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-border pt-3 text-xs sm:grid-cols-2">
                                <div className="flex items-center gap-2">
                                    <dt className="label-xs text-content-subtle">Due</dt>
                                    <dd className="text-content">{formatDue(task.deadline)}</dd>
                                </div>

                                <div className="flex items-center gap-2">
                                    <dt className="label-xs text-content-subtle">Estimate</dt>
                                    <dd className="inline-flex items-center gap-1 text-content">
                                        <Timer className="h-3 w-3 text-content-subtle" strokeWidth={1.8} />
                                        {formatEstimate(task.estimateMinutes)}
                                    </dd>
                                </div>

                                {task.actualMinutes != null && (
                                    <div className="flex items-center gap-2">
                                        <dt className="label-xs text-content-subtle">Actual</dt>
                                        <dd className="text-content">
                                            {formatEstimate(task.actualMinutes)}
                                        </dd>
                                    </div>
                                )}

                                {task.recurrence && (
                                    <div className="flex items-center gap-2">
                                        <dt className="label-xs text-content-subtle">Repeats</dt>
                                        <dd className="inline-flex items-center gap-1 text-content">
                                            <Repeat className="h-3 w-3 text-content-subtle" strokeWidth={1.8} />
                                            {task.recurrence.freq}
                                            {task.recurrence.interval > 1 ? ` × ${task.recurrence.interval}` : ''}
                                        </dd>
                                    </div>
                                )}

                                {task.tags?.length > 0 && (
                                    <div className="flex items-start gap-2 sm:col-span-2">
                                        <dt className="label-xs shrink-0 pt-0.5 text-content-subtle">Tags</dt>
                                        <dd className="flex flex-wrap gap-1">
                                            {task.tags.map((tag) => (
                                                <Badge key={tag} variant="neutral" square>
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        </section>

                        {/* Subtasks */}
                        <section className="rounded-card border border-border bg-surface">
                            <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-3 py-2">
                                <h2 className="label-xs">Subtasks</h2>
                                <span className="ml-auto text-[11px] tabular-nums text-content-subtle">
                                    {completedSubtasks}/{subtasks.length}
                                </span>
                            </div>

                            {subtasks.length === 0 ? (
                                <p className="px-3 py-8 text-center text-sm text-content-subtle">
                                    No subtasks. Add them from the edit panel.
                                </p>
                            ) : (
                                <ul className="divide-y divide-border">
                                    {subtasks.map((subtask, index) => (
                                        <li key={`${subtask.title}-${index}`} className="flex items-center gap-2.5 px-3 py-2.5">
                                            <Checkbox
                                                checked={Boolean(subtask.completed)}
                                                disabled={savingSubtask === index}
                                                onChange={() => toggleSubtask(index)}
                                                aria-label={`Mark "${subtask.title}" as ${subtask.completed ? 'incomplete' : 'complete'}`}
                                            />
                                            <span
                                                className={`min-w-0 flex-1 truncate text-sm ${
                                                    subtask.completed
                                                        ? 'text-content-subtle line-through'
                                                        : 'text-content'
                                                }`}
                                            >
                                                {subtask.title}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {/* Notes */}
                        <section className="rounded-card border border-border bg-surface">
                            <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-3 py-2">
                                <StickyNote className="h-3.5 w-3.5 text-content-subtle" strokeWidth={1.8} />
                                <h2 className="label-xs">Notes</h2>
                            </div>
                            <p className="whitespace-pre-wrap px-3 py-3 text-sm text-content-muted">
                                {task.notes || 'Nothing written down.'}
                            </p>
                        </section>
                    </div>

                    {/* Side column */}
                    <aside className="space-y-3">
                        <section className="rounded-card border border-border bg-surface px-3 py-3">
                            <h2 className="label-xs text-content-subtle">Filed under</h2>

                            <div className="mt-2 space-y-1.5 text-sm">
                                {task.projectId ? (
                                    <Link
                                        to={`/projects/${task.projectId}`}
                                        className="block truncate font-medium text-primary hover:underline"
                                    >
                                        Project
                                    </Link>
                                ) : (
                                    <p className="text-content-subtle">No project</p>
                                )}

                                {task.goalId ? (
                                    <Link
                                        to={`/goals/${task.goalId}`}
                                        className="block truncate font-medium text-primary hover:underline"
                                    >
                                        Goal
                                    </Link>
                                ) : (
                                    <p className="text-content-subtle">No goal</p>
                                )}
                            </div>
                        </section>

                        <section className="rounded-card border border-border bg-surface px-3 py-3">
                            <h2 className="label-xs text-content-subtle">Created</h2>
                            <p className="mt-1 text-sm text-content-muted">
                                {task.dateCreated ? new Date(task.dateCreated).toLocaleDateString() : '—'}
                            </p>
                        </section>
                    </aside>
                </div>
            )}

            <ConfirmDialog
                open={pendingDelete}
                title="Delete this task?"
                confirmLabel="Delete"
                onConfirm={deleteTask}
                onCancel={() => setPendingDelete(false)}
            >
                <span className="font-medium text-content">&ldquo;{task?.title}&rdquo;</span> will be
                permanently removed. This cannot be undone.
            </ConfirmDialog>
        </AppShell>
    )
}

export default TaskDetailPage
