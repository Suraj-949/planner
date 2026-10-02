import { LoaderCircle, PlusCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import axiosInstance from '../axiosInstance'

import FetchTask from './FetchTask'
import updateStreak from '../utility/updateStreak'
import {
    STATUS_LABELS,
    CATEGORY_LABELS,
    TASK_STATUSES,
    TASK_PRIORITIES,
    TASK_CATEGORIES,
} from '../constants/taskMeta'

// Initial state object for new task form
const initialTask = {
    title: '',
    description: '',
    status: 'pending',
    deadline: '',
    category: 'other',
    priority: 'medium'
}

const FIELD_CLASS =
    'w-full rounded-control border border-border-strong bg-surface-raised px-4 py-3 text-content outline-none transition placeholder:text-content-subtle focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary-soft'

const LABEL_CLASS = 'mb-2 block text-sm font-semibold text-content-muted'

const CreateTask = () => {
    const navigate = useNavigate()
    const { logout } = useAuth()
    const [task, setTask] = useState(initialTask)
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    const [streak, setStreak] = useState(() => {
        return Number(localStorage.getItem("streak")) || 0
    })

    const [taskStats, setTaskStats] = useState({
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        pendingTasks: 0,
        progress: 0,
    })

    useEffect(() => {
        if (!message) return

        const timer = setTimeout(() => {
            setMessage('')
        }, 3000)

        return () => clearTimeout(timer)
    }, [message])

    const handleLogout = async () => {
        await logout()
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

            if (task.status === "completed") {
                const newStreak = updateStreak()
                setStreak(newStreak)
            }

        } catch (err) {
            // Show backend error message if available
            setError(err.response?.data?.message || 'Task creation failed.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main className="min-h-screen bg-background px-6 py-8 text-content">
            <section className="mx-auto max-w-8xl">
                <div className="mb-8">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">
                                Planner
                            </p>
                            <h1 className="mt-2 text-4xl font-semibold">
                                Create a new task
                            </h1>
                        </div>

                        <div className="flex flex-row gap-3">
                            <button
                                type="button"
                                onClick={()=>{navigate("/timer")}}
                                className="rounded-control border border-border-strong px-4 py-2 text-sm font-semibold text-content-muted transition hover:border-primary hover:text-primary"
                            >
                                Timer
                            </button>

                            <button
                                type="button"
                                onClick={handleLogout}
                                className="rounded-control border border-border-strong px-4 py-2 text-sm font-semibold text-content-muted transition hover:border-danger hover:text-danger"
                            >
                                Logout
                            </button>
                        </div>

                    </div>
                    <p className="mt-3 max-w-2xl text-content-muted">
                        plan your day, stay organized, and boost your productivity with our task planner. Create, manage, and track your tasks all in one place.
                    </p>
                </div>

               <section className="mb-6 rounded-3xl border border-border bg-surface p-6">
                <div className="grid grid-cols-12 gap-6">

                    {/* LEFT SIDE - 75% */}
                    <div className="col-span-12 lg:col-span-9">
                        {/* HEADER */}
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                                    Progress tracker
                                </p>
                                <h2 className="mt-2 text-2xl font-semibold text-content">
                                    Your completion overview
                                </h2>
                                <p className="mt-1 text-sm text-content-muted">
                                    Track how many tasks are done,
                                    in progress, and still waiting.
                                </p>

                            </div>

                            <div className="rounded-2xl border border-primary/30 bg-primary-soft px-4 py-3 text-right">

                                <p className="text-xs uppercase tracking-[0.25em] text-primary">
                                    Completion rate
                                </p>

                                <p className="text-3xl font-semibold text-primary">
                                    {Math.round(taskStats.progress)}%
                                </p>

                            </div>

                        </div>

                        {/* PROGRESS BAR */}
                        <div className="mt-5 h-3 overflow-hidden rounded-full bg-surface-sunken">
                            <div
                                className="h-full rounded-full bg-primary transition-all duration-300"
                                style={{
                                    width: `${taskStats.progress}%`
                                }}
                            />
                        </div>

                        {/* STATS CARDS */}
                        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            {[
                                {label: 'Total tasks', value: taskStats.totalTasks},
                                {label: 'Completed', value: taskStats.completedTasks},
                                {label: 'In progress', value: taskStats.inProgressTasks},
                                {label: 'Pending', value: taskStats.pendingTasks}

                            ].map((item) => (

                                <article
                                    key={item.label}
                                    className="rounded-2xl border border-border bg-surface-raised p-5 transition hover:border-border-strong"
                                >
                                    <p className="text-sm text-content-subtle">
                                        {item.label}
                                    </p>
                                    <p className="mt-3 text-3xl font-bold text-content">
                                        {item.value}
                                    </p>
                                </article>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT SIDE - 25% */}
                    <div className="col-span-12 lg:col-span-3">
                        <div className="flex h-full items-center justify-center rounded-3xl border border-secondary/30 bg-secondary-soft p-6">
                            <div className="text-center">
                                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary">
                                    Current streak
                                </p>
                                <h2 className="mt-4 text-5xl font-bold text-secondary">
                                    ðŸ”¥ {streak}
                                </h2>
                                <p className="mt-3 text-sm text-content-muted">
                                    Keep completing tasks daily
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

            </section>

                <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
                    <form
                        onSubmit={handleSubmit}
                        className="h-full rounded-3xl border border-border bg-surface p-6 md:p-8"
                    >
                        <div className="grid gap-5 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <label className={LABEL_CLASS} htmlFor="title">
                                    Task title
                                </label>
                                <input
                                    id="title"
                                    type="text"
                                    value={task.title}
                                    onChange={handleChange}
                                    placeholder="e.g. Finish project UI"
                                    className={FIELD_CLASS}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className={LABEL_CLASS} htmlFor="description">
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    value={task.description}
                                    onChange={handleChange}
                                    placeholder="Short details about this task..."
                                    rows="4"
                                    className={`${FIELD_CLASS} resize-none`}
                                />
                            </div>

                            <div>
                                <label className={LABEL_CLASS} htmlFor="status">
                                    Status
                                </label>
                                <select
                                    id="status"
                                    value={task.status}
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
                                    value={task.deadline}
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
                                    value={task.category}
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
                                    value={task.priority}
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
                        </div>

                        {error && (
                            <p className="mt-5 rounded-control border border-danger/40 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                                {error}
                            </p>
                        )}

                        {message && (
                            <p className="mt-5 rounded-control border border-secondary/40 bg-secondary-soft px-4 py-3 text-sm font-medium text-secondary">
                                {message}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-control bg-primary px-5 py-3 font-semibold text-primary-contrast transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
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
                        <FetchTask
                            refreshTrigger={refreshTrigger}
                            onStatsChange={setTaskStats}
                            onStreakChange={setStreak}
                        />
                    </div>
                </div>
            </section>
        </main>
    )
}

export default CreateTask;
