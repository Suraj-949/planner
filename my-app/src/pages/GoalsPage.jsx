import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Notice from '../components/ui/Notice'
import EmptyState from '../components/ui/EmptyState'
import LoadingRow from '../components/ui/LoadingRow'
import ProgressBar from '../components/ui/ProgressBar'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useGoals, useGoalActions } from '../hooks/useGoals'
import { errorMessage } from '../hooks/useResource'
import { GOAL_STATUSES, GOAL_STATUS_LABELS, GOAL_STATUS_VARIANTS } from '../constants/goalMeta'
import { toDateInputValue } from '../utils/dates'
import { Target, Pencil, Trash2 } from 'lucide-react'

const GoalForm = ({ open, initial, onClose, onSubmit }) => {
    const [title, setTitle] = useState(initial?.title ?? '')
    const [description, setDescription] = useState(initial?.description ?? '')
    const [targetDate, setTargetDate] = useState(initial?.targetDate ? toDateInputValue(initial.targetDate) : '')
    const [status, setStatus] = useState(initial?.status ?? 'active')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const submit = async (event) => {
        event.preventDefault()
        setSaving(true)
        setError(null)

        try {
            await onSubmit({
                title: title.trim(),
                description: description.trim(),
                targetDate: targetDate || null,
                status,
            })
            onClose()
        } catch (err) {
            setError(errorMessage(err, 'Could not save the goal'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal open={open} onClose={saving ? () => {} : onClose} labelledBy="goal-form-title">
            <form onSubmit={submit} className="p-4">
                <h2 id="goal-form-title" className="text-sm font-semibold text-content">
                    {initial ? 'Edit goal' : 'New goal'}
                </h2>

                {error && (
                    <div className="mt-2">
                        <Notice tone="danger" title="Could not save">
                            {error}
                        </Notice>
                    </div>
                )}

                <div className="mt-3 space-y-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="goal-title">Title</Label>
                        <Input
                            id="goal-title"
                            size="sm"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="goal-description">Description</Label>
                        <textarea
                            id="goal-description"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            rows={3}
                            className="w-full rounded-control border border-border bg-surface-input px-2 py-1.5 text-xs text-content outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-soft"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="goal-target">Target date</Label>
                            <Input
                                id="goal-target"
                                type="date"
                                size="sm"
                                value={targetDate}
                                onChange={(event) => setTargetDate(event.target.value)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="goal-status">Status</Label>
                            <select
                                id="goal-status"
                                value={status}
                                onChange={(event) => setStatus(event.target.value)}
                                className="h-8 w-full rounded-control border border-border bg-surface-input px-2 text-xs text-content outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-soft"
                            >
                                {GOAL_STATUSES.map((value) => (
                                    <option key={value} value={value}>
                                        {GOAL_STATUS_LABELS[value]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="subtle" size="sm" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="sm" type="submit" disabled={saving || !title.trim()}>
                        {saving ? 'Saving…' : initial ? 'Save changes' : 'Create goal'}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}

const GoalsPage = () => {
    const [statusFilter, setStatusFilter] = useState('all')
    const { goals, isLoading, error, refetch } = useGoals({ status: statusFilter })

    const { create, update, remove } = useGoalActions()

    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [pendingDelete, setPendingDelete] = useState(null)
    const [notice, setNotice] = useState(null)

    const showError = useCallback((err, title) => {
        setNotice({ tone: 'danger', title, body: errorMessage(err, 'The request was rejected.') })
    }, [])

    return (
        <AppShell
            onCreate={() => {
                setEditing(null)
                setFormOpen(true)
            }}
            createLabel="New Goal"
        >
            {notice && (
                <div className="mb-3">
                    <Notice tone={notice.tone} title={notice.title} onDismiss={() => setNotice(null)}>
                        {notice.body}
                    </Notice>
                </div>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2">
                {['all', ...GOAL_STATUSES].map((value) => (
                    <Button
                        key={value}
                        size="sm"
                        variant={statusFilter === value ? 'primary' : 'subtle'}
                        onClick={() => setStatusFilter(value)}
                    >
                        {value === 'all' ? 'All' : GOAL_STATUS_LABELS[value]}
                    </Button>
                ))}

                <span className="ml-auto text-[11px] tabular-nums text-content-subtle">{goals.length} goals</span>
            </div>

            {isLoading ? (
                <LoadingRow label="Loading goals…" />
            ) : error ? (
                <EmptyState title="Could not load goals" body={errorMessage(error, 'The request failed.')} />
            ) : goals.length === 0 ? (
                <EmptyState
                    title={statusFilter === 'all' ? 'No goals yet' : `No ${GOAL_STATUS_LABELS[statusFilter]?.toLowerCase()} goals`}
                    body="A goal is the outcome; its milestones are the measurable steps. Progress is derived from those milestones, never stored."
                    actionLabel="New goal"
                    onAction={() => setFormOpen(true)}
                />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {goals.map((goal) => (
                        <article key={goal._id} className="rounded-card border border-border bg-surface px-3.5 py-3">
                            <div className="flex items-start gap-2">
                                <Target className="mt-0.5 h-4 w-4 shrink-0 text-content-subtle" strokeWidth={1.8} />

                                <div className="min-w-0 flex-1">
                                    <Link
                                        to={`/goals/${goal._id}`}
                                        className="block truncate text-sm font-semibold text-content hover:underline"
                                    >
                                        {goal.title}
                                    </Link>

                                    {goal.description && (
                                        <p className="mt-1 line-clamp-2 text-xs text-content-subtle">{goal.description}</p>
                                    )}
                                </div>

                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        type="button"
                                        aria-label="Edit goal"
                                        onClick={() => {
                                            setEditing(goal)
                                            setFormOpen(true)
                                        }}
                                        className="rounded-control p-1 text-content-subtle transition hover:bg-surface-overlay hover:text-content"
                                    >
                                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                                    </button>

                                    <button
                                        type="button"
                                        aria-label="Delete goal"
                                        onClick={() => setPendingDelete(goal)}
                                        className="rounded-control p-1 text-content-subtle transition hover:bg-danger-soft hover:text-danger"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-3">
                                <ProgressBar
                                    percent={goal.progress?.percent ?? 0}
                                    label={`${goal.progress?.completed ?? 0} of ${goal.progress?.total ?? 0} milestones`}
                                />
                            </div>

                            <div className="mt-3 flex items-center gap-2 border-t border-border pt-2">
                                <Badge variant={GOAL_STATUS_VARIANTS[goal.status] ?? 'neutral'} square>
                                    {GOAL_STATUS_LABELS[goal.status] ?? goal.status}
                                </Badge>

                                {goal.targetDate && (
                                    <span className="text-[11px] text-content-subtle">
                                        Target {toDateInputValue(goal.targetDate)}
                                    </span>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <GoalForm
                key={editing?._id ?? 'new-goal'}
                open={formOpen}
                initial={editing}
                onClose={() => {
                    setFormOpen(false)
                    setEditing(null)
                }}
                onSubmit={async (payload) => {
                    if (editing) await update(editing._id, payload)
                    else await create(payload)
                    await refetch()
                }}
            />

            <ConfirmDialog
                key={pendingDelete?._id ?? 'confirm-none'}
                open={Boolean(pendingDelete)}
                title="Delete this goal?"
                confirmLabel="Delete"
                onConfirm={async () => {
                    try {
                        await remove(pendingDelete._id)
                        setPendingDelete(null)
                        await refetch()
                    } catch (err) {
                        setPendingDelete(null)
                        await refetch()
                        showError(err, 'Could not delete the goal')
                    }
                }}
                onCancel={() => setPendingDelete(null)}
            >
                <span className="font-medium text-content">&ldquo;{pendingDelete?.title}&rdquo;</span> and its
                milestones will be deleted. Linked tasks are unlinked, not deleted.
            </ConfirmDialog>
        </AppShell>
    )
}

export default GoalsPage
