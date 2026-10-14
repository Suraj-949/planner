import { useState } from 'react'
import Button from '../ui/Button'
import Checkbox from '../ui/Checkbox'
import Input from '../ui/Input'
import Label from '../ui/Label'
import {
    CATEGORY_LABELS,
    CUSTOM_CATEGORY,
    RECURRING_OPTIONS,
    TASK_CATEGORIES,
    TASK_PRIORITIES,
    WEEKDAY_LABELS,
    fromRecurrence,
} from '../../constants/taskMeta'
import { toDateInputValue, parseDateValue } from '../../utils/dates'
import { formatEstimate } from '../../utils/taskAdapter'
import { CalendarDays, Plus, Repeat, X } from 'lucide-react'

const SEGMENT_BASE =
    'flex-1 rounded-control border px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors duration-100'

const Field = ({ label, htmlFor, children }) => (
    <div className="space-y-1.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {children}
    </div>
)

const selectClass =
    'h-8 w-full rounded-control border border-border bg-surface-input px-2 text-xs text-content outline-none transition hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary-soft'

/*
 * Today as a local YYYY-MM-DD, used when the form opens with no deadline.
 *
 * Defaults to today rather than an empty value because the API requires a deadline and
 * the submit button is enabled regardless — leaving it blank turned every unedited create
 * into a 400 with no visible cause.
 */
const todayInputValue = () => {
    const now = new Date()

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
    ).padStart(2, '0')}`
}

/*
 * One form for both creating and editing a task.
 *
 * Renamed from CreateTaskPanel: it previously only created, so editing a task required a
 * second component (the legacy UpdateTaskModal) with its own copy of every field, its own
 * hardcoded enum lists, and its own idea of what a subtask looks like. One panel means one
 * place where a field is defined.
 */
const TaskFormPanel = ({ mode = 'create', initialTask, onClose, onSubmit }) => {
    const isEdit = mode === 'edit'

    const [form, setForm] = useState(() => {
        const recurrence = fromRecurrence(initialTask?.recurrence)
        const existing = initialTask?.category ?? ''
        // A stored category outside the presets (one the user typed into the Custom input)
        // opens the select on Custom and prefills the text box, rather than silently
        // snapping the task to a preset the moment the form is saved.
        const isPreset = TASK_CATEGORIES.includes(existing)

        return {
            // Empty rather than the previous prefilled demo copy. That draft shipped a real
            // task titled "Implement Dark Mode Heatmap for Habits" with a deadline of
            // 2025-10-26 — already overdue — the moment anyone clicked Create.
            title: initialTask?.title ?? '',
            description: initialTask?.description ?? '',
            notes: initialTask?.notes ?? '',
            category: isPreset ? existing : TASK_CATEGORIES[0],
            customCategory: isPreset ? '' : existing,
            deadline: toDateInputValue(initialTask?.deadline) || todayInputValue(),
            priority: initialTask?.priority ?? 'medium',
            estimate: initialTask?.estimateMinutes ? formatEstimate(initialTask.estimateMinutes) : '',
            recurring: recurrence.preset,
            daysOfWeek: recurrence.daysOfWeek,
        }
    })

    // Subtasks arrive from the API as `{ title, completed }` and are created as plain
    // strings, so both are normalised to objects here — otherwise opening an existing task
    // for edit renders "[object Object]" and saving it corrupts the list.
    const [subtasks, setSubtasks] = useState(() =>
        (initialTask?.subtasks ?? []).map((subtask) =>
            typeof subtask === 'string'
                ? { title: subtask, completed: false }
                : { title: subtask.title ?? '', completed: Boolean(subtask.completed) }
        )
    )

    const [draftSubtask, setDraftSubtask] = useState('')

    const update = (key) => (event) =>
        setForm((current) => ({ ...current, [key]: event.target.value }))

    const toggleDay = (day) =>
        setForm((current) => ({
            ...current,
            daysOfWeek: current.daysOfWeek.includes(day)
                ? current.daysOfWeek.filter((value) => value !== day)
                : [...current.daysOfWeek, day].sort((a, b) => a - b),
        }))

    const addSubtask = () => {
        const value = draftSubtask.trim()

        if (!value) return

        setSubtasks((current) => [...current, { title: value, completed: false }])
        setDraftSubtask('')
    }

    const removeSubtask = (index) =>
        setSubtasks((current) => current.filter((_, position) => position !== index))

    const toggleSubtask = (index) =>
        setSubtasks((current) =>
            current.map((subtask, position) =>
                position === index ? { ...subtask, completed: !subtask.completed } : subtask
            )
        )

    const handleSubmit = (event) => {
        event?.preventDefault?.()

        const title = form.title.trim()

        if (!title) return

        const deadline = parseDateValue(form.deadline)

        if (!deadline) return

        // The Custom sentinel never reaches the API: the typed value becomes the category.
        // A blank custom input falls back to the first preset rather than failing the save
        // with no visible cause — the alternative is a silent 400 from an empty string.
        const custom = form.customCategory.trim()
        const category =
            form.category === CUSTOM_CATEGORY ? custom || TASK_CATEGORIES[0] : form.category

        onSubmit({
            title,
            description: form.description.trim(),
            notes: form.notes.trim(),
            category,
            priority: form.priority,
            deadline,
            estimate: form.estimate,
            recurring: form.recurring,
            subtasks,
        })
    }

    const needsDays = form.recurring === 'weekly'

    return (
        // Width comes from the parent wrapper (fixed 268px column at xl+, full width when
        // stacked), so the panel itself only owns its vertical layout and surfaces.
        <aside
            aria-label={isEdit ? 'Edit task' : 'Create new task'}
            className="flex h-full w-full flex-col overflow-y-auto bg-surface"
        >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2.5">
                <h2 className="text-sm font-semibold text-content">
                    {isEdit ? 'Edit Task' : 'Create New Task'}
                </h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={isEdit ? 'Close edit panel' : 'Close create task panel'}
                    className="rounded-control p-1 text-content-subtle transition hover:bg-surface-overlay hover:text-content"
                >
                    <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 space-y-4 px-3 py-3">
                <Field label="Task Title" htmlFor="ct-title">
                    <Input
                        id="ct-title"
                        size="sm"
                        value={form.title}
                        onChange={update('title')}
                        required
                    />
                </Field>

                <Field label="Description" htmlFor="ct-description">
                    <textarea
                        id="ct-description"
                        rows={3}
                        value={form.description}
                        onChange={update('description')}
                        className="w-full resize-y rounded-control border border-border bg-surface-input px-3 py-2 text-xs leading-relaxed text-content outline-none transition placeholder:text-content-subtle focus:border-primary focus:ring-2 focus:ring-primary-soft"
                    />
                </Field>

                {/* Category + deadline */}
                <div className="grid grid-cols-2 gap-2">
                    <Field label="Category" htmlFor="ct-category">
                        <select
                            id="ct-category"
                            value={form.category}
                            onChange={update('category')}
                            className={selectClass}
                        >
                            {TASK_CATEGORIES.map((option) => (
                                <option key={option} value={option}>
                                    {CATEGORY_LABELS[option] ?? option}
                                </option>
                            ))}
                            <option value={CUSTOM_CATEGORY}>Custom</option>
                        </select>

                        {/* The free-text half of the Custom option. Shown only then: a
                            always-visible input next to a preset select would read as two
                            competing answers to one question. */}
                        {form.category === CUSTOM_CATEGORY && (
                            <Input
                                id="ct-custom-category"
                                size="sm"
                                value={form.customCategory}
                                onChange={update('customCategory')}
                                placeholder="Your category"
                                className="mt-1.5"
                            />
                        )}
                    </Field>

                    <Field label="Deadline" htmlFor="ct-deadline">
                        <div className="relative">
                            <Input
                                id="ct-deadline"
                                type="date"
                                size="sm"
                                value={form.deadline}
                                onChange={update('deadline')}
                                className="pr-7"
                            />
                            <CalendarDays
                                aria-hidden="true"
                                className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-subtle"
                                strokeWidth={1.8}
                            />
                        </div>
                    </Field>
                </div>

                {/* Priority segmented control */}
                <Field label="Priority">
                    <div className="flex gap-1">
                        {TASK_PRIORITIES.map((priority) => {
                            const active = form.priority === priority

                            return (
                                <button
                                    key={priority}
                                    type="button"
                                    onClick={() =>
                                        setForm((current) => ({ ...current, priority }))
                                    }
                                    aria-pressed={active}
                                    className={`${SEGMENT_BASE} ${
                                        active
                                            ? 'border-primary bg-primary text-primary-contrast'
                                            : 'border-border bg-surface-input text-content-subtle hover:border-border-strong hover:text-content-muted'
                                    }`}
                                >
                                    {priority}
                                </button>
                            )
                        })}
                    </div>
                </Field>

                <div className="grid grid-cols-2 gap-2">
                    <Field label="Estimated Time" htmlFor="ct-estimate">
                        <Input
                            id="ct-estimate"
                            size="sm"
                            value={form.estimate}
                            onChange={update('estimate')}
                            placeholder="1h 00m"
                        />
                    </Field>

                    <Field label="Recurring" htmlFor="ct-recurring">
                        <div className="relative">
                            <Repeat
                                aria-hidden="true"
                                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary"
                                strokeWidth={2}
                            />
                            <select
                                id="ct-recurring"
                                value={form.recurring}
                                onChange={update('recurring')}
                                className="h-8 w-full rounded-control border border-border bg-surface-input pl-7 pr-2 text-xs text-content outline-none transition hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary-soft"
                            >
                                {RECURRING_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </Field>
                </div>

                {/* A weekly rule names its days. Shown only then, because a daily or monthly
                    rule would reject the day list server-side. */}
                {needsDays && (
                    <Field label="On days">
                        <div className="flex gap-1">
                            {WEEKDAY_LABELS.map((label, day) => {
                                const active = form.daysOfWeek.includes(day)

                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => toggleDay(day)}
                                        aria-pressed={active}
                                        aria-label={`Day ${day}`}
                                        className={`h-7 w-7 rounded-full border text-[11px] font-semibold transition-colors duration-100 ${
                                            active
                                                ? 'border-primary bg-primary text-primary-contrast'
                                                : 'border-border bg-surface-input text-content-subtle hover:border-border-strong'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                )
                            })}
                        </div>
                    </Field>
                )}

                {/* Subtasks */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label>Subtasks ({subtasks.length})</Label>
                        <button
                            type="button"
                            onClick={addSubtask}
                            disabled={!draftSubtask.trim()}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary transition hover:text-primary-hover disabled:pointer-events-none disabled:opacity-40"
                        >
                            <Plus className="h-3 w-3" strokeWidth={2.4} />
                            Add Item
                        </button>
                    </div>

                    <ul className="space-y-1">
                        {subtasks.map((subtask, index) => (
                            <li
                                key={`${subtask.title}-${index}`}
                                className="group flex items-center gap-2"
                            >
                                <Checkbox
                                    checked={subtask.completed}
                                    onChange={() => toggleSubtask(index)}
                                    aria-label={subtask.title}
                                />
                                <span
                                    className={`flex-1 truncate text-xs ${
                                        subtask.completed
                                            ? 'text-content-subtle line-through'
                                            : 'text-content-muted'
                                    }`}
                                >
                                    {subtask.title}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeSubtask(index)}
                                    aria-label={`Remove ${subtask.title}`}
                                    className="rounded-control p-0.5 text-content-subtle opacity-0 transition group-hover:opacity-100 hover:text-danger"
                                >
                                    <X className="h-3 w-3" strokeWidth={2} />
                                </button>
                            </li>
                        ))}
                    </ul>

                    <Input
                        size="sm"
                        value={draftSubtask}
                        onChange={(event) => setDraftSubtask(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault()
                                addSubtask()
                            }
                        }}
                        placeholder="Add a subtask..."
                        aria-label="New subtask"
                    />
                </div>

                <Field label="Notes" htmlFor="ct-notes">
                    <textarea
                        id="ct-notes"
                        rows={2}
                        value={form.notes}
                        onChange={update('notes')}
                        placeholder="Working notes, blockers, links..."
                        className="w-full resize-y rounded-control border border-border bg-surface-input px-3 py-2 text-xs leading-relaxed text-content outline-none transition placeholder:text-content-subtle focus:border-primary focus:ring-2 focus:ring-primary-soft"
                    />
                </Field>
            </form>

            {/* Actions */}
            <div className="sticky bottom-0 space-y-2 border-t border-border bg-surface px-3 py-3">
                <Button
                    type="button"
                    variant="primary"
                    size="md"
                    className="w-full"
                    onClick={handleSubmit}
                >
                    {isEdit ? 'Save Changes' : 'Create Task'}
                </Button>

                <div className="flex items-center justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[11px] font-semibold text-content-subtle transition hover:text-content-muted"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </aside>
    )
}

export default TaskFormPanel
