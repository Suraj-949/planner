import { useEffect, useState, useMemo } from 'react'
import axiosInstance from '../axiosInstance'
import { Ellipsis, PencilLine, X } from 'lucide-react'

import UpdateTaskModal from './UpdateTaskModal'

const FetchTask = ({ refreshTrigger = 0, onStatsChange }) => {
    const [tasks, setTasks] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    
    const [dropDownId, setDropDownId] = useState('')
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

    useEffect(() => {
        if (!updateMessage) return

        const timer = setTimeout(() => {
            setUpdateMessage('')
        }, 3000)

        return () => clearTimeout(timer)
    }, [updateMessage])

    // Opens/closes the dropdown for a specific task. If the clicked task is already open, close it by setting an empty string. Otherwise, set the clicked taskId as the active dropdown.
    const openDropDown = (taskId) => {
        setDropDownId((currentValue) => (currentValue === taskId ? '' : taskId))
    }

    // open the modal by selectiing task 
    const openUpdateModal = (task) => { 
        setDropDownId('')
        setEditingTask(task) 
    }

    const handleUpdated = async (message) => {
        setUpdateMessage(message)
        await fetchTasks()
    } 

    const handleDelete = async (task) => {
        setError('')
        setUpdateMessage('')
        setDropDownId('')

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

    // Send updated stats to parent component whenever called, using the callback function received via props
    useEffect(() => {

        // Call parent function and pass latest stats
        onStatsChange?.(stats)
    }, [onStatsChange, stats])

    const reminder = (task) => {
        const today = new Date().setHours(0, 0, 0, 0)
        const deadline = new Date(task.deadline).setHours(0, 0, 0, 0)
        const timeDifference = (deadline - today) / (1000 * 60 * 60 * 24); // Convert milliseconds difference into days

        return timeDifference;
    }

    return (
        <section
            className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8"
            onClick={() => setDropDownId('')} // This onClick handler on the section ensures that clicking anywhere outside the dropdown menu will close it by resetting dropDownId to an empty string.
        >
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-semibold text-stone-900">Your tasks</h2>
                    <p className="mt-1 text-sm text-stone-600">Here’s your task list.</p>
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

            <div className="mt-4 grid gap-4 max-h-120 overflow-y-auto">
                {tasks.map((task) => (
                    <article
                        key={task._id}
                        className="relative rounded-2xl border border-emerald-200 bg-stone-50 p-4 transition hover:border-stone-300 hover:bg-stone-100/70"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-stone-900">{task.title}</h3>
                                {task.description && (
                                    <p className="mt-1 text-sm text-stone-600">{task.description}</p>
                                )}
                            </div>
                            
                            <div className="flex flex-row items-center gap-3">
                                
                                {/* Deadline reminder logic */}
                                {task.deadline &&
                                task.status !== "completed" &&
                                reminder(task) < 0 && (
                                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                                        Overdue
                                    </span>
                                )}

                                {task.deadline &&
                                task.status !== "completed" &&
                                reminder(task) === 0 && (
                                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                                        Due Today
                                    </span>
                                )}

                                {task.deadline &&
                                task.status !== "completed" &&
                                reminder(task) === 1 && (
                                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800">
                                        Due Tomorrow
                                    </span>
                                )}

                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-bold ${task.priority === 'high' ? "bg-red-100 text-red-800" : task.priority === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"} `}>
                                        {task.priority}
                                </span>
                            </div>
                                
                        </div>

                        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="grid gap-3 text-sm text-stone-600 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                                        Status
                                    </p>
                                    <p className="mt-1 font-medium text-stone-700">
                                        {task.status}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                                        Category
                                    </p>
                                    <p className="mt-1 font-medium text-stone-700">
                                        {task.category}
                                    </p>
                                </div> 

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                                        Deadline
                                    </p>
                                    <p className="mt-1 font-medium text-stone-700">
                                        {/* this checks if deadline exists before formatting, otherwise shows 'N/A' to avoid errors */}
                                        {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                                        Created
                                    </p>
                                    <p className="mt-1 font-medium text-stone-700">
                                        {/* this checks if dateCreated exists before formatting, otherwise shows 'N/A' to avoid errors */}
                                        {task.dateCreated ? new Date(task.dateCreated).toLocaleString() : 'N/A'}
                                    </p>
                                </div> 
                            </div>

                            <div className="relative">
                                <button
                                    type="button"
                                    aria-label={`More options for ${task.title}`}
                                    onClick={(event) => {
                                        event.stopPropagation() // yaha pe isliye stopPropagation use kiya hai taki jab user dropdown toggle kare, toh woh click event parent element pe propagate na ho jaye aur dropdown khulte hi close na ho jaye.
                                        openDropDown(task._id)
                                    }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:bg-stone-100 hover:text-stone-700"
                                >
                                    <Ellipsis size={16} className="rotate-90" />
                                </button>
                                

                                {/* Conditionally render the Dropdown menu jab dropDownId current taskId ke equal ho */}
                                {dropDownId === task._id && (
                                    <div
                                        className="absolute right-0 top-10 z-10 w-40 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg"
                                        onClick={(event) => event.stopPropagation()} //
                                    >
                                        <button
                                            type="button"
                                            onClick={() => openUpdateModal(task)}
                                            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                                        >
                                            <PencilLine size={16} />
                                            Update
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(task)}
                                            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                                        >
                                            <X size={16} />
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </article>
                ))}
            </div>

            {/* conditionally render the UpdateTaskModal when a task is being edited, passing the selected task and handlers as props */}
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
