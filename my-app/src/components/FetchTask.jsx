import { useEffect, useState } from 'react'
import axiosInstance from '../axiosInstance'

const FetchTask = ({ refreshTrigger = 0 }) => {
    const [tasks, setTasks] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

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

    return (
        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
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

            {isLoading && (
                <p className="text-sm text-stone-500">Loading tasks...</p>
            )}

            {error && (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {error}
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
                        className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-stone-900">
                                    {task.title}
                                </h3>
                                {task.description && (
                                    <p className="mt-1 text-sm text-stone-600">
                                        {task.description}
                                    </p>
                                )}
                            </div>

                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                                {task.status}
                            </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-4 text-sm text-stone-600">
                            <p>
                                <span className="font-semibold text-stone-700">Deadline:</span>{' '}
                                {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}
                            </p>
                            <p>
                                <span className="font-semibold text-stone-700">Created:</span>{' '}
                                {task.dateCreated ? new Date(task.dateCreated).toLocaleString() : 'N/A'}
                            </p>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    )
}

export default FetchTask
