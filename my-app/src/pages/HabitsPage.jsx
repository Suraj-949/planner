import { useCallback, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import Button from '../components/ui/Button'
import Checkbox from '../components/ui/Checkbox'
import Notice from '../components/ui/Notice'
import EmptyState from '../components/ui/EmptyState'
import LoadingRow from '../components/ui/LoadingRow'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useHabits, useHabitHistory, useHabitActions } from '../hooks/useHabits'
import { errorMessage } from '../hooks/useResource'
import { HABIT_CADENCES, HABIT_CADENCE_LABELS, MAX_HABIT_TARGET } from '../constants/habitMeta'
import { formatDateKey } from '../utils/dates'
import { Flame, Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react'

/*
 * One habit row, with its own history fetch.
 *
 * "Done today" cannot be derived from the list response — the summary carries streaks and
 * rates, not the individual days — so each row loads its own completion dates. That is one
 * request per habit rather than one per click, and it means the checkbox reflects what the
 * server actually holds instead of an optimistic guess.
 */
const HabitRow = ({ habit, onChanged, onEdit, onArchive, onRestore, onDelete }) => {
    const { dates, isLoading } = useHabitHistory(habit._id)
    const { tick, untick } = useHabitActions(onChanged)

    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(null)

    const todayKey = formatDateKey(new Date())
    const doneToday = dates.includes(todayKey)

    const toggleToday = useCallback(async () => {
        setBusy(true)
        setError(null)

        try {
            if (doneToday) await untick(habit, todayKey)
            else await tick(habit, todayKey)
        } catch (err) {
            setError(errorMessage(err, 'Could not save today'))
        } finally {
            setBusy(false)
        }
    }, [doneToday, habit, todayKey, tick, untick])

    return (
        <li className="px-3 py-2.5">
            {error && (
                <div className="mb-2">
                    <Notice tone="danger" title="Could not save" onDismiss={() => setError(null)}>
                        {error}
                    </Notice>
                </div>
            )}

            <div className="flex items-center gap-3">
                <Checkbox
                    checked={doneToday}
                    disabled={busy || isLoading}
                    onChange={toggleToday}
                    aria-label={`Mark "${habit.title}" as ${doneToday ? 'not done' : 'done'} for today`}
                />

                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-content">{habit.title}</p>
                    <p className="text-[11px] text-content-subtle">
                        {HABIT_CADENCE_LABELS[habit.cadence] ?? habit.cadence} · target {habit.targetPerPeriod}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-xs tabular-nums text-content-muted">
                        <Flame className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
                        {habit.currentStreak}d
                    </span>

                    <span className="w-10 text-right text-xs tabular-nums text-content-subtle">
                        {habit.completionRate}%
                    </span>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            aria-label="Edit habit"
                            onClick={() => onEdit(habit)}
                            className="rounded-control p-1 text-content-subtle transition hover:bg-surface-overlay hover:text-content"
                        >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </button>

                        <button
                            type="button"
                            aria-label={habit.archivedAt ? 'Restore habit' : 'Archive habit'}
                            onClick={() => (habit.archivedAt ? onRestore(habit) : onArchive(habit))}
                            className="rounded-control p-1 text-content-subtle transition hover:bg-surface-overlay hover:text-content"
                        >
                            {habit.archivedAt ? (
                                <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={1.8} />
                            ) : (
                                <Archive className="h-3.5 w-3.5" strokeWidth={1.8} />
                            )}
                        </button>

                        <button
                            type="button"
                            aria-label="Delete habit"
                            onClick={() => onDelete(habit)}
                            className="rounded-control p-1 text-content-subtle transition hover:bg-danger-soft hover:text-danger"
                        >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </button>
                    </div>
                </div>
            </div>
        </li>
    )
}

const HabitForm = ({ open, initial, onClose, onSubmit }) => {
    const [title, setTitle] = useState(initial?.title ?? '')
    const [cadence, setCadence] = useState(initial?.cadence ?? 'daily')
    const [target, setTarget] = useState(initial?.targetPerPeriod ?? 1)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const submit = async (event) => {
        event.preventDefault()
        setSaving(true)
        setError(null)

        try {
            await onSubmit({ title: title.trim(), cadence, targetPerPeriod: Number(target) })
            onClose()
        } catch (err) {
            setError(errorMessage(err, 'Could not save the habit'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal open={open} onClose={saving ? () => {} : onClose} labelledBy="habit-form-title">
            <form onSubmit={submit} className="p-4">
                <h2 id="habit-form-title" className="text-sm font-semibold text-content">
                    {initial ? 'Edit habit' : 'New habit'}
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
                        <Label htmlFor="habit-title">Title</Label>
                        <Input
                            id="habit-title"
                            size="sm"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="habit-cadence">Cadence</Label>
                            <select
                                id="habit-cadence"
                                value={cadence}
                                onChange={(event) => setCadence(event.target.value)}
                                className="h-8 w-full rounded-control border border-border bg-surface-input px-2 text-xs text-content outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-soft"
                            >
                                {HABIT_CADENCES.map((value) => (
                                    <option key={value} value={value}>
                                        {HABIT_CADENCE_LABELS[value]}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="habit-target">Target per period</Label>
                            <Input
                                id="habit-target"
                                type="number"
                                min={1}
                                max={MAX_HABIT_TARGET}
                                size="sm"
                                value={target}
                                onChange={(event) => setTarget(event.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="subtle" size="sm" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="sm" type="submit" disabled={saving || !title.trim()}>
                        {saving ? 'Saving…' : initial ? 'Save changes' : 'Create habit'}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}

const HabitsPage = () => {
    const [archived, setArchived] = useState(false)
    const { habits, isLoading, error, refetch } = useHabits({ archived })

    const { create, update, archive, restore, remove } = useHabitActions(refetch)

    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [pendingDelete, setPendingDelete] = useState(null)
    const [notice, setNotice] = useState(null)

    const showError = useCallback((err, title) => {
        setNotice({ tone: 'danger', title, body: errorMessage(err, 'The request was rejected.') })
    }, [])

    const run = useCallback(
        async (action, title) => {
            try {
                await action()
            } catch (err) {
                showError(err, title)
            }
        },
        [showError]
    )

    return (
        <AppShell
            onCreate={() => {
                setEditing(null)
                setFormOpen(true)
            }}
            createLabel="New Habit"
        >
            {notice && (
                <div className="mb-3">
                    <Notice tone={notice.tone} title={notice.title} onDismiss={() => setNotice(null)}>
                        {notice.body}
                    </Notice>
                </div>
            )}

            <div className="mb-3 flex items-center gap-2">
                <Button size="sm" variant={archived ? 'subtle' : 'primary'} onClick={() => setArchived(false)}>
                    Active
                </Button>
                <Button size="sm" variant={archived ? 'primary' : 'subtle'} onClick={() => setArchived(true)}>
                    Archived
                </Button>

                <span className="ml-auto text-[11px] tabular-nums text-content-subtle">{habits.length} habits</span>
            </div>

            <section className="overflow-hidden rounded-card border border-border bg-surface">
                {isLoading ? (
                    <LoadingRow label="Loading habits…" className="m-3" />
                ) : error ? (
                    <p className="px-3 py-8 text-center text-sm text-content-subtle">
                        {errorMessage(error, 'Could not load habits.')}
                    </p>
                ) : habits.length === 0 ? (
                    <EmptyState
                        title={archived ? 'Nothing archived' : 'No habits yet'}
                        body={
                            archived
                                ? 'Archived habits keep their history and leave the active list.'
                                : 'A habit is something you intend to repeat. Streaks and rates are derived from the days you tick, never stored.'
                        }
                        actionLabel={archived ? undefined : 'New habit'}
                        onAction={archived ? undefined : () => setFormOpen(true)}
                    />
                ) : (
                    <ul className="divide-y divide-border">
                        {habits.map((habit) => (
                            <HabitRow
                                key={habit._id}
                                habit={habit}
                                onChanged={refetch}
                                onEdit={(target) => {
                                    setEditing(target)
                                    setFormOpen(true)
                                }}
                                onArchive={(target) => run(() => archive(target._id), 'Could not archive the habit')}
                                onRestore={(target) => run(() => restore(target._id), 'Could not restore the habit')}
                                onDelete={(target) => setPendingDelete(target)}
                            />
                        ))}
                    </ul>
                )}
            </section>

            <HabitForm
                key={editing?._id ?? 'new-habit'}
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
                title="Delete this habit?"
                confirmLabel="Delete"
                onConfirm={async () => {
                    try {
                        await remove(pendingDelete._id)
                        setPendingDelete(null)
                    } catch (err) {
                        setPendingDelete(null)
                        showError(err, 'Could not delete the habit')
                    }
                }}
                onCancel={() => setPendingDelete(null)}
            >
                <span className="font-medium text-content">&ldquo;{pendingDelete?.title}&rdquo;</span> and its
                entire completion history will be deleted. This cannot be undone.
            </ConfirmDialog>
        </AppShell>
    )
}

export default HabitsPage
