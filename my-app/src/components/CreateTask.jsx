import { LoaderCircle, PlusCircle } from 'lucide-react'
import { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AuthContext } from '../AuthProvider'
import axiosInstance from '../axiosInstance'

import FetchTask from './FetchTask'
import { useEffect } from 'react'

// Initial state object for new task form
const initialTask = {
    title: '',
    description: '',
    status: 'pending',
    deadline: '',
    category: 'other',
    priority: 'medium'
}

const CreateTask = () => {
    const navigate = useNavigate()
    const { setIsAuthenticated } = useContext(AuthContext)
    const [task, setTask] = useState(initialTask)
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    useEffect(() => {
        if (!message) return

        const timer = setTimeout(() => {
            setMessage('')
        }, 3000)

        return () => clearTimeout(timer)
    }, [message])

    const handleLogout = () => {
        localStorage.removeItem('accessToken')
        setIsAuthenticated(false)
        navigate('/')
    }

    const handleChange = (e) => {
        setTask({
            ...task,
            [e.target.id]: e.target.value
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setMessage('')
        setError('')
        
        // check the required fields before sending request
        if (!task.title.trim() || !task.deadline) {
            setError('Title and deadline are required.')
            return
        }

        try { 
            setIsLoading(true)

            // Send POST request to create task
            await axiosInstance.post('/tasks/create', task)
            setTask(initialTask)
            setMessage('Task created successfully!')
            setRefreshTrigger((currentValue) => currentValue + 1)

        } catch (err) {
            // Show backend error message if available
            setError(err.response?.data?.message || 'Task creation failed.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main className="min-h-screen bg-stone-50 px-4 py-8 text-stone-900">
            <section className="mx-auto max-w-6xl">
                <div className="mb-8">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">
                                Planner
                            </p>
                            <h1 className="mt-2 font-serif text-4xl font-semibold">
                                Create a new task
                            </h1>
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="rounded-2xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-100"
                        >
                            Logout
                        </button>
                    </div>
                    <p className="mt-3 text-stone-600">
                        plan your day, stay organized, and boost your productivity with our task planner. Create, manage, and track your tasks all in one place.
                    </p>
                </div>

                <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
                    <form
                        onSubmit={handleSubmit}
                        className="rounded-3xl h-full border border-stone-200 bg-white p-6 shadow-sm md:p-8"
                    >
                        <div className="grid gap-5 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="title">
                                    Task title
                                </label>
                                <input
                                    id="title" 
                                    type="text"
                                    value={task.title}
                                    onChange={handleChange}
                                    placeholder="e.g. Finish project UI"
                                    className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="description">
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    value={task.description}
                                    onChange={handleChange}
                                    placeholder="Short details about this task..."
                                    rows="4"
                                    className="w-full resize-none rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="status">
                                    Status
                                </label>
                                <select
                                    id="status"
                                    value={task.status}
                                    onChange={handleChange}
                                    className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="in-progress">In progress</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="deadline">
                                    Deadline
                                </label>
                                <input
                                    id="deadline"
                                    type="date"
                                    value={task.deadline}
                                    onChange={handleChange}
                                    className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="category">
                                    Category
                                </label>
                                <select
                                    id="category"
                                    value={task.category}
                                    onChange={handleChange}
                                    className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                                >
                                    <option value="DSA">DSA</option>
                                    <option value="development">Development</option>
                                    <option value="college">College</option>
                                    <option value="personal">Personal</option>
                                    <option value="work">Work</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="priority">
                                    Priority
                                </label>
                                <select
                                    id="priority"
                                    value={task.priority}
                                    onChange={handleChange}
                                    className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                                >
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                            </div>
                        </div>

                        {error && (
                            <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                {error}
                            </p>
                        )}

                        {message && (
                            <p className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                                {message}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isLoading ? (
                                <>
                                    <LoaderCircle className="h-5 w-5 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <PlusCircle className="h-5 w-5" />
                                    Create task
                                </>
                            )}
                        </button>
                    </form>

                    <div className="lg:sticky lg:top-8">
                        <FetchTask refreshTrigger={refreshTrigger} />
                    </div>
                </div>
            </section>
        </main>
    )
}   

export default CreateTask
