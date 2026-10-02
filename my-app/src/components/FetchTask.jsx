import { useEffect, useState, useMemo } from 'react'
import axiosInstance from '../axiosInstance'
import { Ellipsis, PencilLine, X } from 'lucide-react'

import UpdateTaskModal from './UpdateTaskModal'
import Badge from './ui/Badge'
import { getReminder } from '../utils/dates'
import {
    REMINDER_VARIANTS,
    PRIORITY_VARIANTS,
    STATUS_LABELS,
    STATUS_VARIANTS,
    CATEGORY_LABELS,
} from '../constants/taskMeta'

const REMINDER_LABELS = {
    overdue: 'Overdue',
    today: 'Due Today',
    tomorrow: 'Due Tomorrow',
}

const FetchTask = ({ refreshTrigger = 0, onStatsChange, onStreakChange }) => {
    const [tasks, setTasks] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const [dropDownId, setDropDownId] = useState('')
    const [editingTask, setEditingTask] = useState(null)
    const [updateMessage, setUpdateMessage] = useState('')
    const [taskPendingDelete, setTaskPendingDelete] = useState(null)

    const fetchTasks = async () => {
        try {
            setIsLoading(true)
            setError('')
            const response = await axiosInstance.get('/tasks/fetch')
            setTasks(response.data.tasks || [])
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load tasks.')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        // `fetchTasks` sets state synchronously on entry, which React's compiler lint
        // flags as a cascading render. Deferring to a microtask keeps the fetch
        // effect-driven without re-entering the render phase from the effect body.
        const frame = requestAnimationFrame(() => {
            fetchTasks()
        })

        return () => cancelAnimationFrame(frame)
    }, [refreshTrigger])

    useEffect(() => {
        if (!updateMessage) return

        const timer = setTimeout(() => {
            setUpdateMessage('')
        }, 3000)

        return () => clearTimeout(timer)
    }, [updateMessage])

    // Opens/closes the dropdown for a specific task. If the clicked task is already open,
    // close it by setting an empty string. Otherwise, set the clicked taskId as the active
    // dropdown.
    const openDropDown = (taskId) => {
        setDropDownId((currentValue) => (currentValue === taskId ? '' : taskId))
    }

    // open the modal by selecting task
    const openUpdateModal = (task) => {
        setDropDownId('')
        setEditingTask(task)
    }

    const handleUpdated = async (message) => {
        setUpdateMessage(message)
        await fetchTasks()
    }

    const handleDelete = async () => {
        const task = taskPendingDelete

        if (!task) return

        setError('')
        setUpdateMessage('')
        setTaskPendingDelete(null)

        try {
            await axiosInstance.delete(`/tasks/delete/${task._id}`)
            setUpdateMessage('Task deleted successfully.')
            await fetchTasks()
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete task.')
        }
    }

    const calculateStats = (taskList) => {
        const totalTasks = taskList.length
        const completedTasks = taskList.filter((task) => task.status === 'completed').length
        const inProgressTasks = taskList.filter((task) => task.status === 'in-progress').length
        const pendingTasks = taskList.filter((task) => task.status === 'pending').length
        const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

        return { totalTasks, completedTasks, inProgressTasks, pendingTasks, progress }
    }

    // Memorize stats so recalculation happens only when tasks change
    const stats = useMemo(() => calculateStats(tasks), [tasks])

    // Report stats upward whenever they change. Derived during render from useMemo, so
    // it only re-runs when the task list actually changes.
    useEffect(() => {
        onStatsChange?.(stats)
    }, [stats, onStatsChange])

    return (
        <section
            className="rounded-3xl border border-border bg-surface p-6 shadow-card md:p-8"
            onClick={() => setDropDownId('')}
        >
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-semibold text-content">Your tasks</h2>
                    <p className="mt-1 text-sm text-content-muted">Here&rsquo;s your task list.</p>
                </div>
                <button
                    onClick={fetchTasks}
                    className="rounded-control border border-border-strong px-4 py-2 text-sm font-semibold text-content-muted transition hover:border-primary hover:text-primary"
                    type="button"
                >
                    Refresh
                </button>
            </div>

            {isLoading && <p className="text-sm text-content-subtle">Loading tasks...</p>}

            {error && (
                <p className="rounded-control border border-danger/40 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                    {error}
                </p>
            )}

            {updateMessage && (
                <p className="mt-3 rounded-control border border-secondary/40 bg-secondary-soft px-4 py-3 text-sm font-medium text-secondary">
                    {updateMessage}
                </p>
            )}

            {!isLoading && !error && tasks.length === 0 && (
                <p className="rounded-control border border-dashed border-border-strong px-4 py-6 text-sm text-content-subtle">
                    No tasks yet. Create your first one above.
                </p>
            )}

            <div className="mt-4 grid max-h-120 gap-4 overflow-y-auto">
                {tasks.map((task) => {
                    const reminder = getReminder(task)

                    return (
                        <article
                            key={task._id}
                            className="relative rounded-2xl border border-border bg-surface-raised p-4 transition hover:border-border-strong"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-semibold text-content">{task.title}</h3>
                                    {task.description && (
                                        <p className="mt-1 text-sm text-content-muted">
                                            {task.description}
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-row items-center gap-2">
                                    {reminder && (
                                        <Badge variant={REMINDER_VARIANTS[reminder]}>
                                            {REMINDER_LABELS[reminder]}
                                        </Badge>
                                    )}

                                    <Badge variant={PRIORITY_VARIANTS[task.priority] ?? 'neutral'}>
                                        {task.priority}
                                    </Badge>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="grid gap-3 text-sm text-content-muted sm:grid-cols-2">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-content-subtle">
                                            Status
                                        </p>
                                        <p className="mt-1 font-medium text-content">
                                            <Badge variant={STATUS_VARIANTS[task.status] ?? 'neutral'}>
                                                {STATUS_LABELS[task.status] ?? task.status}
                                            </Badge>
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-content-subtle">
                                            Category
                                        </p>
                                        <p className="mt-1 font-medium text-content">
                                            {CATEGORY_LABELS[task.category] ?? task.category}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-content-subtle">
                                            Deadline
                                        </p>
                                        <p className="mt-1 font-medium text-content">
                                            {task.deadline
                                                ? new Date(task.deadline).toLocaleDateString()
                                                : 'N/A'}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-content-subtle">
                                            Created
                                        </p>
                                        <p className="mt-1 font-medium text-content">
                                            {task.dateCreated
                                                ? new Date(task.dateCreated).toLocaleString()
                                                : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                <div className="relative">
                                    <button
                                        type="button"
                                        aria-label={`More options for ${task.title}`}
                                        onClick={(event) => {
                                            // stopPropagation keeps the section's click handler
                                            // from closing the dropdown in the same tick it opens.
                                            event.stopPropagation()
                                            openDropDown(task._id)
                                        }}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-overlay text-content-subtle transition hover:border-primary hover:text-primary"
                                    >
                                        <Ellipsis size={16} className="rotate-90" />
                                    </button>

                                    {dropDownId === task._id && (
                                        <div
                                            className="absolute right-0 top-10 z-10 w-40 overflow-hidden rounded-2xl border border-border-strong bg-surface-overlay shadow-overlay"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => openUpdateModal(task)}
                                                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-content transition hover:bg-surface-raised"
                                            >
                                                <PencilLine size={16} />
                                                Update
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTaskPendingDelete(task)}
                                                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-danger transition hover:bg-danger-soft"
                                            >
                                                <X size={16} />
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </article>
                    )
                })}
            </div>

            {taskPendingDelete && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    onClick={() => setTaskPendingDelete(null)}
                >
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="confirm-delete-title"
                        onClick={(event) => event.stopPropagation()}
                        className="w-full max-w-md rounded-3xl border border-border-strong bg-surface-overlay p-6 shadow-overlay"
                    >
                        <h3 id="confirm-delete-title" className="text-lg font-semibold text-content">
                            Delete this task?
                        </h3>
                        <p className="mt-2 text-sm text-content-muted">
                            &ldquo;{taskPendingDelete.title}&rdquo; will be permanently removed.
                            This cannot be undone.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setTaskPendingDelete(null)}
                                className="rounded-control border border-border-strong px-4 py-2 text-sm font-semibold text-content-muted transition hover:text-content"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="rounded-control bg-danger px-4 py-2 text-sm font-semibold text-danger-contrast transition hover:bg-danger-hover"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingTask && (
                <UpdateTaskModal
                    key={editingTask._id}
                    task={editingTask}
                    onClose={() => setEditingTask(null)}
                    onUpdated={handleUpdated}
                    onStreakChange={onStreakChange}
                />
            )}
        </section>
    )
}

export default FetchTask
