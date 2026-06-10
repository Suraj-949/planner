import { useEffect, useState } from 'react'
import axiosInstance from '../axiosInstance'
import { Check, LoaderCircle, X } from 'lucide-react'
import updateStreak from '../utility/updateStreak'


const formatDateForInput = (dateValue) => {
    if (!dateValue) return ''
    const date = new Date(dateValue)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const UpdateTaskModal = ({ task, onClose, onUpdated, onStreakChange }) => {

    const [, setStreak] = useState(
        Number(localStorage.getItem('streak')) || 0
    )

    // initiallly set form data to empty values, will be updated when task prop changes
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        status: 'pending',
        deadline: '',
        category: 'other',
        priority: 'medium'
    })
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!task) return

        setFormData({
            title: task.title || '',
            description: task.description || '',
            status: task.status || 'pending',
            deadline: formatDateForInput(task.deadline),
            category: task.category || 'other',
            priority: task.priority || 'medium'
        })
        setError('')
    }, [task])

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

            // update streak only once
            if (
                oldStatus !== "completed" &&
                newStatus === "completed"
            ) {
                const newStreak = updateStreak()
                setStreak(newStreak)
                onStreakChange?.(newStreak)
            }

            await onUpdated('Task updated successfully.')
            onClose()
        } catch (err) {
            setError(err.response?.data?.message || 'Task update failed.')
            console.error("Update error: ", err)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div  
            className="fixed inset-0 z-20 flex items-center justify-center bg-stone-950/50 px-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl md:p-8"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                            Update task
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold text-stone-900">
                            Edit task details
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 grid gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="title">
                            Task title
                        </label>
                        <input
                            id="title"
                            type="text"
                            value={formData.title}
                            onChange={handleChange}
                            className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="description">
                            Description
                        </label>
                        <textarea
                            id="description"
                            rows="4"
                            value={formData.description}
                            onChange={handleChange}
                            className="w-full resize-none rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="status">
                            Status
                        </label>
                        <select
                            id="status"
                            value={formData.status}
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
                            value={formData.deadline}
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
                            value={formData.category}
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
                            value={formData.priority}
                            onChange={handleChange}
                            className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                        >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>

                    {error && (
                        <p className="md:col-span-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            {error}
                        </p>
                    )}

                    <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={onClose} 
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-300 px-5 py-3 font-semibold text-stone-700 transition hover:bg-stone-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-900 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
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
