import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import EmptyState from '../components/ui/EmptyState'
import LoadingRow from '../components/ui/LoadingRow'
import Notice from '../components/ui/Notice'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Checkbox from '../components/ui/Checkbox'
import Input from '../components/ui/Input'
import ProgressBar from '../components/ui/ProgressBar'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import TaskRow from '../components/tasks/TaskRow'
import { useGoal, useGoalActions, useMilestones, useMilestoneActions } from '../hooks/useGoals'
import { useTasks, useTaskActions } from '../hooks/useTasks'
import { errorMessage } from '../hooks/useResource'
import { GOAL_STATUS_LABELS, GOAL_STATUS_VARIANTS } from '../constants/goalMeta'
import { toDateInputValue } from '../utils/dates'
import { toViewTasks } from '../utils/taskAdapter'
import { ArrowLeft, Trash2, Plus, ListTodo, Target } from 'lucide-react'

/*
 * One goal, with the milestones that measure it and the tasks that serve it.
 *
 * Progress is never edited here. It is the percentage of milestones complete (R-GOAL-1),
 * recomputed on every read, so ticking a milestone is the only action that can change it.
 */
const GoalDetailPage = () => {
    const { id } = useParams()
    const navigate = useNavigate()

    const { goal, isLoading, error, refetch } = useGoal(id)
    const { remove } = useGoalActions()

    const { data: milestones, isLoading: milestonesLoading, refetch: refetchMilestones } = useMilestones(id)
    const { create: createMilestone, toggle: toggleMilestone, remove: removeMilestone } = useMilestoneActions(refetch)

    const { data: taskData, isLoading: tasksLoading, refetch: refetchTasks, setData: setTasks } = useTasks(
        { goalId: id, limit: 25 },
        { enabled: Boolean(id) }
    )
    const { update: updateTask } = useTaskActions()

    const [notice, setNotice] = useState(null)
    const [newTitle, setNewTitle] = useState('')
    const [newDue, setNewDue] = useState('')
    const [adding, setAdding] = useState(false)
    const [pendingDelete, setPendingDelete] = useState(false)
    const [pendingMilestoneDelete, setPendingMilestoneDelete] = useState(null)

    // Memoised so `toggleTask`'s dependency array is stable across renders — a fresh
    // `?? []` would be a new array every time and refire the callback. Mapped through
    // toViewTasks because the API serialises `_id` while TaskRow reads `id`.
    const tasks = useMemo(() => toViewTasks(taskData?.tasks), [taskData])
    const milestoneList = milestones ?? []

    const showError = useCallback((err, title) => {
        setNotice({ tone: 'danger', title, body: errorMessage(err, 'The request was rejected.') })
    }, [])

    const addMilestone = useCallback(
        async (event) => {
            event.preventDefault()

            if (!newTitle.trim()) return

            setAdding(true)

            try {
                await createMilestone({
                    goalId: id,
                    title: newTitle.trim(),
                    dueDate: newDue || null,
                })
                setNewTitle('')
                setNewDue('')
                await refetchMilestones()
            } catch (err) {
                showError(err, 'Could not add the milestone')
            } finally {
                setAdding(false)
            }
        },
        [newTitle, newDue, id, createMilestone, refetchMilestones, showError]
    )

    const toggleTask = useCallback(
        async (taskId) => {
            const current = tasks.find((task) => String(task.id) === String(taskId))

            if (!current) return

            const next = current.status === 'completed' ? 'pending' : 'completed'

            setTasks((state) => ({
                ...state,
                tasks: (state?.tasks ?? []).map((task) =>
                    String(task.id) === String(taskId) ? { ...task, status: next } : task
                ),
            }))

            try {
                await updateTask(current.id, { status: next })
                await refetchTasks()
            } catch (err) {
                await refetchTasks()
                showError(err, 'Could not save that change')
            }
        },
        [tasks, updateTask, refetchTasks, setTasks, showError]
    )

    const percent = goal?.progress?.percent ?? 0

    return (
        <AppShell>
            <Link
                to="/goals"
                className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-content-muted hover:text-content"
            >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                All goals
            </Link>

            {notice && (
                <div className="mb-3">
                    <Notice tone={notice.tone} title={notice.title} onDismiss={() => setNotice(null)}>
                        {notice.body}
                    </Notice>
                </div>
            )}

            {isLoading ? (
                <LoadingRow label="Loading the goal…" />
            ) : !goal ? (
                <EmptyState
                    title="Goal not found"
                    body={error ? errorMessage(error, 'It may have been deleted.') : 'It may have been deleted, or the link may be wrong.'}
                    actionLabel="Back to goals"
                    onAction={() => navigate('/goals')}
                />
            ) : (
                <div className="space-y-3">
                    <section className="rounded-card border border-border bg-surface px-4 py-4">
                        <div className="flex items-start gap-3">
                            <Target className="mt-1 h-4 w-4 shrink-0 text-content-subtle" strokeWidth={1.8} />

                            <div className="min-w-0 flex-1">
                                <h1 className="text-lg font-semibold tracking-tight text-content">{goal.title}</h1>
                                {goal.description && (
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-content-muted">{goal.description}</p>
                                )}

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Badge variant={GOAL_STATUS_VARIANTS[goal.status] ?? 'neutral'} square>
                                        {GOAL_STATUS_LABELS[goal.status] ?? goal.status}
                                    </Badge>

                                    {goal.targetDate && (
                                        <span className="text-[11px] text-content-subtle">
                                            Target {toDateInputValue(goal.targetDate)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                aria-label="Delete goal"
                                onClick={() => setPendingDelete(true)}
                                className="rounded-control p-1.5 text-content-subtle transition hover:bg-danger-soft hover:text-danger"
                            >
                                <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                            </button>
                        </div>

                        <div className="mt-4">
                            <ProgressBar
                                percent={percent}
                                label={`${goal.progress?.completed ?? 0} of ${goal.progress?.total ?? 0} milestones`}
                            />
                        </div>
                    </section>

                    <div className="grid gap-3 xl:grid-cols-2">
                        {/* Milestones */}
                        <section className="rounded-card border border-border bg-surface">
                            <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-3 py-2">
                                <h2 className="label-xs">Milestones</h2>
                                <span className="ml-auto text-[11px] tabular-nums text-content-subtle">
                                    {milestoneList.filter((milestone) => milestone.completedAt).length}/
                                    {milestoneList.length}
                                </span>
                            </div>

                            {/* Add form */}
                            <form onSubmit={addMilestone} className="flex items-center gap-2 border-b border-border px-3 py-2">
                                <Input
                                    size="sm"
                                    value={newTitle}
                                    onChange={(event) => setNewTitle(event.target.value)}
                                    placeholder="Add a milestone"
                                    aria-label="Milestone title"
                                    className="flex-1"
                                />
                                <Input
                                    type="date"
                                    size="sm"
                                    value={newDue}
                                    onChange={(event) => setNewDue(event.target.value)}
                                    aria-label="Milestone due date"
                                    className="w-32"
                                />
                                <Button variant="primary" size="sm" type="submit" disabled={adding || !newTitle.trim()}>
                                    <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                                    Add
                                </Button>
                            </form>

                            {milestonesLoading ? (
                                <LoadingRow label="Loading milestones…" className="m-3" />
                            ) : milestoneList.length === 0 ? (
                                <p className="px-3 py-8 text-center text-sm text-content-subtle">
                                    No milestones yet. Progress stays at 0% until there is something to measure.
                                </p>
                            ) : (
                                <ul className="divide-y divide-border">
                                    {milestoneList.map((milestone) => (
                                        <li key={milestone._id} className="flex items-center gap-2.5 px-3 py-2.5">
                                            <Checkbox
                                                checked={milestone.completedAt != null}
                                                onChange={async () => {
                                                    try {
                                                        await toggleMilestone(milestone)
                                                        // The goal refetches inside the hook, but the milestone
                                                        // list is its own resource and would otherwise keep
                                                        // showing the old tick state.
                                                        await refetchMilestones()
                                                    } catch (err) {
                                                        showError(err, 'Could not save the milestone')
                                                    }
                                                }}
                                                aria-label={`Mark "${milestone.title}" as ${milestone.completedAt ? 'incomplete' : 'complete'}`}
                                            />

                                            <span
                                                className={`min-w-0 flex-1 truncate text-sm ${
                                                    milestone.completedAt ? 'text-content-subtle line-through' : 'text-content'
                                                }`}
                                            >
                                                {milestone.title}
                                            </span>

                                            {milestone.dueDate && (
                                                <span className="shrink-0 text-[11px] text-content-subtle">
                                                    {toDateInputValue(milestone.dueDate)}
                                                </span>
                                            )}

                                            <button
                                                type="button"
                                                aria-label="Delete milestone"
                                                onClick={() => setPendingMilestoneDelete(milestone)}
                                                className="shrink-0 rounded-control p-1 text-content-subtle transition hover:bg-danger-soft hover:text-danger"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {/* Linked tasks */}
                        <section className="overflow-hidden rounded-card border border-border bg-surface">
                            <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-3 py-2">
                                <ListTodo className="h-3.5 w-3.5 text-content-subtle" strokeWidth={1.8} />
                                <h2 className="label-xs">Linked tasks</h2>
                                <span className="ml-auto text-[11px] tabular-nums text-content-subtle">{tasks.length}</span>
                            </div>

                            {tasksLoading ? (
                                <LoadingRow label="Loading tasks…" className="m-3" />
                            ) : tasks.length === 0 ? (
                                <p className="px-3 py-8 text-center text-sm text-content-subtle">
                                    No tasks point at this goal yet.
                                </p>
                            ) : (
                                tasks.map((task) => <TaskRow key={task.id} task={task} onToggle={toggleTask} canMutate />)
                            )}
                        </section>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={pendingDelete}
                title="Delete this goal?"
                confirmLabel="Delete"
                onConfirm={async () => {
                    try {
                        await remove(id)
                        navigate('/goals')
                    } catch (err) {
                        setPendingDelete(false)
                        showError(err, 'Could not delete the goal')
                    }
                }}
                onCancel={() => setPendingDelete(false)}
            >
                This goal and its milestones will be deleted. Linked tasks are unlinked, not deleted.
            </ConfirmDialog>

            <ConfirmDialog
                key={pendingMilestoneDelete?._id ?? 'confirm-none'}
                open={Boolean(pendingMilestoneDelete)}
                title="Delete this milestone?"
                confirmLabel="Delete"
                onConfirm={async () => {
                    try {
                        await removeMilestone(pendingMilestoneDelete._id)
                        setPendingMilestoneDelete(null)
                        await refetchMilestones()
                    } catch (err) {
                        setPendingMilestoneDelete(null)
                        showError(err, 'Could not delete the milestone')
                    }
                }}
                onCancel={() => setPendingMilestoneDelete(null)}
            >
                <span className="font-medium text-content">&ldquo;{pendingMilestoneDelete?.title}&rdquo;</span>{' '}
                will be removed, and the goal's progress will be recomputed without it.
            </ConfirmDialog>
        </AppShell>
    )
}

export default GoalDetailPage
