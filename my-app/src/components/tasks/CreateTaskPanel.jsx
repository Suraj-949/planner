import { useState } from 'react'
import Button from '../ui/Button'
import Checkbox from '../ui/Checkbox'
import Input from '../ui/Input'
import Label from '../ui/Label'
import { PROJECTS, RECURRING_OPTIONS, TASK_PRIORITIES } from '../../constants/taskMeta'
import { CalendarDays, Plus, Repeat, X } from 'lucide-react'

const SEGMENT_BASE =
    'flex-1 rounded-control border px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors duration-100'

const Field = ({ label, htmlFor, children }) => (
    <div className="space-y-1.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {children}
    </div>
)

const CreateTaskPanel = ({ onClose, onCreate }) => {
    const [form, setForm] = useState({
        title: 'Implement Dark Mode Heatmap for Habits',
        description:
            'Build GitHub-style contribution squares using green #22C55E intensities...',
        project: 'Planner Core',
        deadline: '2025-10-26',
        priority: 'high',
        estimate: '1h 45m',
        recurring: 'Daily',
    })

    const [subtasks, setSubtasks] = useState([
        'Define SVG matrix dimensions',
        'Calculate 5 green tone levels',
        'Wire hover tooltips with logged time',
    ])

    const [draftSubtask, setDraftSubtask] = useState('')

    const update = (key) => (event) =>
        setForm((current) => ({ ...current, [key]: event.target.value }))

    const addSubtask = () => {
        const value = draftSubtask.trim()

        if (!value) return

        setSubtasks((current) => [...current, value])
        setDraftSubtask('')
    }

    const removeSubtask = (index) =>
        setSubtasks((current) => current.filter((_, position) => position !== index))

    const handleSubmit = (event) => {
        event.preventDefault()

        const title = form.title.trim()

        if (!title) return

        onCreate({ ...form, title, subtasks })
    }

    return (
        // Width comes from the parent wrapper (fixed 268px column at xl+, full width when
        // stacked), so the panel itself only owns its vertical layout and surfaces.
        <aside
            aria-label="Create new task"
            className="flex h-full w-full flex-col overflow-y-auto bg-surface"
        >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2.5">
                <h2 className="text-sm font-semibold text-content">Create New Task</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close create task panel"
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

                {/* Project + deadline */}
                <div className="grid grid-cols-2 gap-2">
                    <Field label="Project" htmlFor="ct-project">
                        <select
                            id="ct-project"
                            value={form.project}
                            onChange={update('project')}
                            className="h-8 w-full rounded-control border border-border bg-surface-input px-2 text-xs text-content outline-none transition hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary-soft"
                        >
                            {PROJECTS.map((project) => (
                                <option key={project} value={project}>
                                    {project}
                                </option>
                            ))}
                        </select>
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
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </Field>
                </div>

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
                            <li key={`${subtask}-${index}`} className="group flex items-center gap-2">
                                <Checkbox checked readOnly aria-label={subtask} />
                                <span className="flex-1 truncate text-xs text-content-muted">
                                    {subtask}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeSubtask(index)}
                                    aria-label={`Remove ${subtask}`}
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
                    Create Task
                </Button>

                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        className="text-[11px] font-semibold text-primary transition hover:text-primary-hover"
                    >
                        Start Focus Now
                    </button>
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

export default CreateTaskPanel
