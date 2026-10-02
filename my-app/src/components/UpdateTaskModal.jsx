import { useState } from 'react'
import axiosInstance from '../axiosInstance'
import { Check, LoaderCircle, X } from 'lucide-react'
import updateStreak from '../utility/updateStreak'
import { toDateInputValue } from '../utils/dates'
import {
    STATUS_LABELS,
    CATEGORY_LABELS,
    TASK_STATUSES,
    TASK_PRIORITIES,
    TASK_CATEGORIES,
} from '../constants/taskMeta'

const FIELD_CLASS =
    'w-full rounded-control border border-border-strong bg-surface-raised px-4 py-3 text-content outline-none transition placeholder:text-content-subtle focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary-soft'

const LABEL_CLASS = 'mb-2 block text-sm font-semibold text-content-muted'

// The modal remounts per task via `key`, so seeding state directly replaces the
// old task-status -> formData effect (which the React Compiler lint flags as a
// cascading render and which left stale form values for one paint).
const buildInitialFormData = (task) => ({
    title: task.title || '',
    description: task.description || '',
    status: task.status || 'pending',
    // toDateInputValue treats the stored deadline as a local calendar date, so the date
    // picker shows the same day the user originally picked.
    deadline: toDateInputValue(task.deadline),
    category: task.category || 'other',
    priority: task.priority || 'medium'
})

const UpdateTaskModal = ({ task, onClose, onUpdated, onStreakChange }) => {
    const [formData, setFormData] = useState(() => buildInitialFormData(task))
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')

    // update form data state on input change
    const handleChange = (event) => {
        const { id, value } = event.target
        setFormData((currentValue) => ({
            ...currentValue,
            [id]: value
        }))
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (!formData.title.trim() || !formData.deadline) {
            setError('Title and deadline are required.')
            return
        }

        try {
            setIsSaving(true)
            setError('')

            const oldStatus = task.status
            const newStatus = formData.status

            await axiosInstance.put(`/tasks/update/${task._id}`, {
                title: formData.title,
                description: formData.description,
                status: formData.status,
                deadline: formData.deadline,
                category: formData.category,
                priority: formData.priority
            })

            // Only a genuine transition into completed counts toward the streak —
            // re-saving an already-completed task must not increment it again.
            if (oldStatus !== "completed" && newStatus === "completed") {
                const newStreak = updateStreak()
                onStreakChange?.(newStreak)
            }

            await onUpdated('Task updated successfully.')
            onClose()
        } catch (err) {
            setError(err.response?.data?.message || 'Task update failed.')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-4"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="update-task-title"
                className="w-full max-w-2xl rounded-3xl border border-border-strong bg-surface-overlay p-6 shadow-overlay md:p-8"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                            Update task
                        </p>
                        <h3 id="update-task-title" className="mt-2 text-2xl font-semibold text-content">
                            Edit task details
                        </h3>
                    </div>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-content-subtle transition hover:border-danger hover:bg-danger-soft hover:text-danger"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 grid gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                        <label className={LABEL_CLASS} htmlFor="title">
                            Task title
                        </label>
                        <input
                            id="title"
                            type="text"
                            value={formData.title}
                            onChange={handleChange}
                            className={FIELD_CLASS}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className={LABEL_CLASS} htmlFor="description">
                            Description
                        </label>
                        <textarea
                            id="description"
                            rows="4"
                            value={formData.description}
                            onChange={handleChange}
                            className={`${FIELD_CLASS} resize-none`}
                        />
                    </div>

                    <div>
                        <label className={LABEL_CLASS} htmlFor="status">
                            Status
                        </label>
                        <select
                            id="status"
                            value={formData.status}
                            onChange={handleChange}
                            className={FIELD_CLASS}
                        >
                            {TASK_STATUSES.map((value) => (
                                <option key={value} value={value}>
                                    {STATUS_LABELS[value]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={LABEL_CLASS} htmlFor="deadline">
                            Deadline
                        </label>
                        <input
                            id="deadline"
                            type="date"
                            value={formData.deadline}
                            onChange={handleChange}
                            className={FIELD_CLASS}
                        />
                    </div>

                    <div>
                        <label className={LABEL_CLASS} htmlFor="category">
                            Category
                        </label>
                        <select
                            id="category"
                            value={formData.category}
                            onChange={handleChange}
                            className={FIELD_CLASS}
                        >
                            {TASK_CATEGORIES.map((value) => (
                                <option key={value} value={value}>
                                    {CATEGORY_LABELS[value]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={LABEL_CLASS} htmlFor="priority">
                            Priority
                        </label>
                        <select
                            id="priority"
                            value={formData.priority}
                            onChange={handleChange}
                            className={FIELD_CLASS}
                        >
                            {TASK_PRIORITIES.map((value) => (
                                <option key={value} value={value}>
                                    {value.charAt(0).toUpperCase() + value.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {error && (
                        <p className="rounded-control border border-danger/40 bg-danger-soft px-4 py-3 text-sm font-medium text-danger md:col-span-2">
                            {error}
                        </p>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end md:col-span-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center justify-center gap-2 rounded-control border border-border-strong px-5 py-3 font-semibold text-content-muted transition hover:border-border-focus hover:text-content"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex items-center justify-center gap-2 rounded-control bg-primary px-5 py-3 font-semibold text-primary-contrast transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isSaving ? (
                                <>
                                    <LoaderCircle className="h-5 w-5 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <Check size={18} />
                                    Save changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default UpdateTaskModal
