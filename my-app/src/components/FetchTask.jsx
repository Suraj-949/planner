import { useEffect, useState } from 'react'
import axiosInstance from '../axiosInstance'
import { Ellipsis, PencilLine } from 'lucide-react'

import UpdateTaskModal from './UpdateTaskModal'

const FetchTask = ({ refreshTrigger = 0 }) => {
    const [tasks, setTasks] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [activeMenuId, setActiveMenuId] = useState('')
    const [editingTask, setEditingTask] = useState(null)
    const [updateMessage, setUpdateMessage] = useState('')

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
        fetchTasks()
    }, [refreshTrigger])

    const openMenu = (taskId) => {
        setActiveMenuId((currentValue) => (currentValue === taskId ? '' : taskId))
    }

    const openUpdateModal = (task) => {
        setActiveMenuId('')
        setEditingTask(task)
    }

    const handleUpdated = async (message) => {
        setUpdateMessage(message)
        await fetchTasks()
    }

    return (
        <section
            className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8"
            onClick={() => setActiveMenuId('')}
        >
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-semibold text-stone-900">Your tasks</h2>
                    <p className="mt-1 text-sm text-stone-600">Here’s the latest list from the server.</p>
                </div>
                <button
                    onClick={fetchTasks}
                    className="rounded-2xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-100"
                    type="button"
                >
                    Refresh
                </button>
            </div>

            {isLoading && <p className="text-sm text-stone-500">Loading tasks...</p>}

            {error && (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {error}
                </p>
            )}

            {updateMessage && (
                <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {updateMessage}
                </p>
            )}

            {!isLoading && !error && tasks.length === 0 && (
                <p className="rounded-2xl border border-dashed border-stone-300 px-4 py-6 text-sm text-stone-500">
                    No tasks yet. Create your first one above.
                </p>
            )}

            <div className="mt-4 grid gap-4">
                {tasks.map((task) => (
                    <article
                        key={task._id}
                        className="relative rounded-2xl border border-stone-200 bg-stone-50 p-4 transition hover:border-stone-300 hover:bg-stone-100/70"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-stone-900">{task.title}</h3>
                                {task.description && (
                                    <p className="mt-1 text-sm text-stone-600">{task.description}</p>
                                )}
                            </div>

                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                                {task.status}
                            </span>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="grid gap-3 text-sm text-stone-600 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                                        Deadline
                                    </p>
                                    <p className="mt-1 font-medium text-stone-700">
                                        {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                                        Created
                                    </p>
                                    <p className="mt-1 font-medium text-stone-700">
                                        {task.dateCreated ? new Date(task.dateCreated).toLocaleString() : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="relative">
                                <button
                                    type="button"
                                    aria-label={`More options for ${task.title}`}
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        openMenu(task._id)
                                    }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:bg-stone-100 hover:text-stone-700"
                                >
                                    <Ellipsis size={16} className="rotate-90" />
                                </button>

                                {activeMenuId === task._id && (
                                    <div
                                        className="absolute right-0 top-10 z-10 w-40 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg"
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => openUpdateModal(task)}
                                            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                                        >
                                            <PencilLine size={16} />
                                            Update
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </article>
                ))}
            </div>

            {editingTask && (
                <UpdateTaskModal
                    task={editingTask}
                    onClose={() => setEditingTask(null)}
                    onUpdated={handleUpdated}
                />
            )}
        </section>
    )
}

export default FetchTask
