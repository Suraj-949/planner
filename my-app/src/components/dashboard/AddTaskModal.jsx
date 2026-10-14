import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Label from '../ui/Label'
import { errorMessage } from '../../hooks/useResource'
import {
    CATEGORY_LABELS,
    CUSTOM_CATEGORY,
    TASK_CATEGORIES,
    TASK_PRIORITIES,
} from '../../constants/taskMeta'
import { toDateInputValue } from '../../utils/dates'
import { X } from 'lucide-react'

const selectClass =
    'h-8 w-full rounded-control border border-border bg-surface-input px-2 text-xs text-content outline-none transition hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary-soft'

const SEGMENT =
    'flex-1 rounded-control border px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors duration-100'

/*
 * Quick-create drawer for the dashboard's "+ Add Task" button.
 *
 * Deliberately slimmer than the full TaskFormPanel on /tasks: four fields, no subtasks,
 * no recurrence — the dashboard's job is capture, not configuration. Writes through the
 * same create endpoint, so a task made here is indistinguishable from one made on the
 * tasks page.
 */
const AddTaskModal = ({ open, onClose, onCreate }) => {
    const [title, setTitle] = useState('')
    const [category, setCategory] = useState(TASK_CATEGORIES[0])
    const [customCategory, setCustomCategory] = useState('')
    const [priority, setPriority] = useState('medium')
    const [status, setStatus] = useState('pending')
    const [deadline, setDeadline] = useState(() => toDateInputValue(new Date()))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const reset = () => {
        setTitle('')
        setCategory(TASK_CATEGORIES[0])
        setCustomCategory('')
        setPriority('medium')
        setStatus('pending')
        setDeadline(toDateInputValue(new Date()))
        setError(null)
    }

    const handleClose = () => {
        if (saving) return
        reset()
        onClose()
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        const trimmed = title.trim()

        if (!trimmed || !deadline || saving) return

        const custom = customCategory.trim()
        const resolvedCategory =
            category === CUSTOM_CATEGORY ? custom || TASK_CATEGORIES[0] : category

        setSaving(true)
        setError(null)

        try {
            await onCreate({
                title: trimmed,
                category: resolvedCategory,
                priority,
                status,
                deadline,
            })
            reset()
            onClose()
        } catch (err) {
            setError(errorMessage(err, 'The server rejected the task.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal open={open} onClose={handleClose} labelledBy="add-task-title">
            <form onSubmit={handleSubmit}>
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h2 id="add-task-title" className="text-sm font-semibold text-content">
                        Add Task
                    </h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        aria-label="Close add task"
                        className="rounded-control p-1 text-content-subtle transition hover:bg-surface-overlay hover:text-content"
                    >
                        <X className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                </div>

                <div className="space-y-3.5 px-4 py-4">
                    {error && (
                        <p className="rounded-control border border-danger-border bg-danger-soft px-3 py-2 text-xs text-danger">
                            {error}
                        </p>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="add-task-title-input">Title</Label>
                        <Input
                            id="add-task-title-input"
                            size="sm"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="What needs doing?"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="add-task-category">Category</Label>
                            <select
                                id="add-task-category"
                                value={category}
                                onChange={(event) => setCategory(event.target.value)}
                                className={selectClass}
                            >
                                {TASK_CATEGORIES.map((option) => (
                                    <option key={option} value={option}>
                                        {CATEGORY_LABELS[option] ?? option}
                                    </option>
                                ))}
                                <option value={CUSTOM_CATEGORY}>Custom</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="add-task-deadline">Deadline</Label>
                            <Input
                                id="add-task-deadline"
                                type="date"
                                size="sm"
                                value={deadline}
                                onChange={(event) => setDeadline(event.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {category === CUSTOM_CATEGORY && (
                        <div className="space-y-1.5">
                            <Label htmlFor="add-task-custom">Custom category</Label>
                            <Input
                                id="add-task-custom"
                                size="sm"
                                value={customCategory}
                                onChange={(event) => setCustomCategory(event.target.value)}
                                placeholder="Your category"
                            />
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>Priority</Label>
                        <div className="flex gap-1">
                            {TASK_PRIORITIES.map((option) => {
                                const active = priority === option

                                return (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => setPriority(option)}
                                        aria-pressed={active}
                                        className={`${SEGMENT} ${
                                            active
                                                ? 'border-primary bg-primary text-primary-contrast'
                                                : 'border-border bg-surface-input text-content-subtle hover:border-border-strong hover:text-content-muted'
                                        }`}
                                    >
                                        {option}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="add-task-status">Status</Label>
                        <select
                            id="add-task-status"
                            value={status}
                            onChange={(event) => setStatus(event.target.value)}
                            className={selectClass}
                        >
                            <option value="pending">Pending</option>
                            <option value="in-progress">In Progress</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
                    <Button size="sm" onClick={handleClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={saving || !title.trim() || !deadline}
                    >
                        {saving ? 'Creating…' : 'Create Task'}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}

export default AddTaskModal
