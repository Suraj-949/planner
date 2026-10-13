import { useNavigate } from 'react-router-dom'
import UpdateTaskModal from '../components/UpdateTaskModal'
import { taskService } from '../services/taskService'
import updateStreak from '../utility/updateStreak'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Header from '../components/layout/Header'
import Sidebar from '../components/layout/Sidebar'
import Filters from '../components/tasks/Filters'
import TaskList from '../components/tasks/TaskList'
import CreateTaskPanel from '../components/tasks/CreateTaskPanel'
import Notice from '../components/ui/Notice'
import { SEED } from '../data/seedTasks'
import { filterTasks } from '../utils/filterTasks'
import { matchTaskId, toViewTasks, formatTotal, parseEstimate } from '../utils/taskAdapter'
import axiosInstance from '../axiosInstance'
import { useAuth } from '../hooks/useAuth'
import { LoaderCircle } from 'lucide-react'

const TABS = ['all', 'today', 'upcoming', 'completed']

/*
 * Where the visible rows came from. Kept distinct rather than collapsed into a boolean,
 * because "the account has no tasks" and "the request failed" look identical on screen yet
 * need opposite treatment: one offers to create a task, the other explains that the rows
 * are not real.
 *
 *   loading - first request in flight
 *   live    - the account's own tasks
 *   empty   - authenticated, genuinely nothing stored
 *   error   - unreachable or unauthenticated; SEED rows are standing in
 */
const TasksPage = () => {
    const { isAuthenticated } = useAuth()
    const navigate = useNavigate()
    const mutationLock = useRef(false)
    const [isMutating, setIsMutating] = useState(false)
    const [editingTask, setEditingTask] = useState(null)
    const [pendingDelete, setPendingDelete] = useState(null)

    const [tasks, setTasks] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [source, setSource] = useState('loading')
    const [notice, setNotice] = useState(null)

    const [filters, setFilters] = useState({
        tab: 'all',
        query: '',
        status: 'all',
        priority: 'all',
        category: 'all',
        dueDate: '',
    })

    const [view, setView] = useState('list')
    const [panelOpen, setPanelOpen] = useState(true)
    const [navOpen, setNavOpen] = useState(false)
    const activeNav = 'tasks'
    const selectNav = (id) => {
        if (id === 'focus') navigate('/timer')
        else if (id !== 'tasks') setNotice({ tone: 'info', title: 'Coming soon', body: 'This page is planned but is not available yet.' })
    }

    const setFilter = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }))

    const setFilterFromEvent = (key) => (event) => setFilter(key)(event.target.value)

    /*
     * A genuine empty account is left empty, with an invitation to create something. Falling
     * back to SEED here would dress up "you have no tasks" as a populated list, and the rows
     * would look exactly like real ones.
     */
    const showEmptyState = useCallback(() => {
        setTasks([])
        setSource('empty')
        setNotice({
            tone: 'info',
            title: 'No tasks yet',
            body: 'This account has nothing stored, so nothing is loaded. Create your first task to get started.',
        })
    }, [])

    /*
     * Placeholder rows are reserved for a failed or impossible request, where an empty screen
     * would look like a broken page. The notice says so plainly, so placeholder data is
     * never mistaken for the user's own.
     */
    const showSampleData = useCallback(() => {
        setTasks(SEED)
        setSource('error')
        setNotice({
            tone: 'warn',
            title: 'Showing sample data',
            body: 'Could not load your tasks from the server, so this list is placeholder data. Nothing here is saved to your account.',
        })
    }, [])

    const fetchTasks = useCallback(async () => {
        setIsLoading(true)
        setNotice(null)

        // Without a session there is no token to send, so the request could only 401.
        if (!isAuthenticated) {
            showSampleData()
            setIsLoading(false)
            return
        }

        try {
            const rows = toViewTasks(await taskService.list())

            if (rows.length === 0) {
                showEmptyState()
            } else {
                setTasks(rows)
                setSource('live')
            }
        } catch {
            showSampleData()
        } finally {
            setIsLoading(false)
        }
    }, [isAuthenticated, showEmptyState, showSampleData])

    useEffect(() => {
        // `fetchTasks` sets state synchronously on entry, which React's compiler lint flags
        // as a cascading render. Deferring a frame keeps the fetch effect-driven without
        // re-entering the render phase from the effect body — the same approach FetchTask
        // uses for its initial load.
        const frame = requestAnimationFrame(() => {
            fetchTasks()
        })

        return () => cancelAnimationFrame(frame)
    }, [fetchTasks])

    // Placeholder rows are only on screen for a failed request, so every task-mutating
    // handler is withheld in that state — toggling a row that exists only in module scope
    // would look saved and then vanish on the next load.
    const isPlaceholder = source === 'error'
    const isEmpty = source === 'empty'

    // Keep the server as the source of truth. A synchronous lock also protects
    // against double clicks before React renders the disabled controls.
    const mutateTask = async (operation) => {
        if (source !== 'live' || mutationLock.current) return
        mutationLock.current = true
        setIsMutating(true)
        try {
            await operation()
        } catch (error) {
            setNotice({ tone: 'danger', title: 'Task action failed', body: error.response?.data?.message ?? 'Please try again. Your changes were not saved.' })
        } finally {
            mutationLock.current = false
            setIsMutating(false)
        }
    }

    const toggleAndPersist = (id) => mutateTask(async () => {
        const task = tasks.find((row) => matchTaskId(row, id))
        if (!task) return
        const status = task.status === 'completed' ? 'pending' : 'completed'
        await taskService.update(id, { status })
        if (status === 'completed') updateStreak()
        await fetchTasks()
    })

    const startFocus = (id) => mutateTask(async () => {
        await taskService.update(id, { status: 'in-progress' })
        navigate('/timer')
    })

    const deleteTask = () => mutateTask(async () => {
        await taskService.remove(pendingDelete.id)
        setPendingDelete(null)
        await fetchTasks()
    })

    const createTask = async (draft) => {
        if (isPlaceholder) return

        try {
            await axiosInstance.post('/tasks/create', {
                title: draft.title,
                description: draft.description,
                priority: draft.priority,
                deadline: draft.deadline,
                context: draft.project,
                // The panel collects "1h 45m"; the API stores minutes (R-TASK-13), so the
                // string is parsed here rather than sent through as-is.
                estimateMinutes: parseEstimate(draft.estimate),
                subtasks: draft.subtasks ?? [],
            })

            setPanelOpen(false)
            await fetchTasks()
        } catch (error) {
            setNotice({
                tone: 'danger',
                title: 'Could not create the task',
                body: error.response?.data?.message ?? 'The server rejected the request.',
            })
        }
    }

    const visible = filterTasks(tasks, filters)
    const activeTasks = visible.filter((task) => task.status !== 'completed')
    const completedTasks = visible.filter((task) => task.status === 'completed')

    const activeCount = tasks.filter((task) => task.status !== 'completed').length

    const counts = useMemo(
        () =>
            Object.fromEntries(
                TABS.map((tab) => [
                    tab,
                    tasks.filter((task) =>
                        tab === 'all'
                            ? true
                            : tab === 'completed'
                              ? task.status === 'completed'
                              : tab === 'today'
                                ? task.dayOffset === 0 && task.status !== 'completed'
                                : task.dayOffset > 0
                    ).length,
                ])
            ),
        [tasks]
    )

    return (
        <div className="flex h-screen overflow-hidden bg-background text-content">
            {/* Sidebar — static on desktop, drawer below lg */}
            <div className="hidden lg:block">
                <Sidebar
                    activeItem={activeNav}
                    onSelectItem={selectNav}
                    onSearch={setFilterFromEvent('query')}
                />
            </div>

            {navOpen && (
                <div className="fixed inset-0 z-40 flex lg:hidden">
                    <button
                        type="button"
                        aria-label="Close navigation"
                        onClick={() => setNavOpen(false)}
                        className="absolute inset-0 bg-black/60"
                    />
                    <div className="relative z-10">
                        <Sidebar
                            activeItem={activeNav}
                            onSelectItem={(id) => {
                                selectNav(id)
                                setNavOpen(false)
                            }}
                            onSearch={setFilterFromEvent('query')}
                            onClose={() => setNavOpen(false)}
                        />
                    </div>
                </div>
            )}

            {editingTask && (
                <UpdateTaskModal key={editingTask.id} task={editingTask}
                    onClose={() => setEditingTask(null)} onUpdated={fetchTasks} />
            )}
            {pendingDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className="w-full max-w-md rounded-card border border-border bg-surface p-6">
                        <h2 id="delete-title" className="text-lg font-semibold">Delete this task?</h2>
                        <p className="my-4">“{pendingDelete.title}” will be permanently removed.</p>
                        <div className="flex justify-end gap-4">
                            <button type="button" disabled={isMutating} onClick={() => setPendingDelete(null)}>Cancel</button>
                            <button type="button" disabled={isMutating} onClick={deleteTask} className="text-danger">{isMutating ? 'Deleting…' : 'Delete'}</button>
                        </div>
                        {notice?.tone === 'danger' && <p role="alert" className="mt-3 text-danger">{notice.body}</p>}
                    </div>
                </div>
            )}
            {/* Main column */}
            <div className="flex min-w-0 flex-1 flex-col">
                <Header onOpenCreate={() => setPanelOpen(true)} onOpenNav={() => setNavOpen(true)} />

                {/* Row wraps below xl so the create panel stacks under the task list. */}
                <div className="flex min-h-0 flex-1 flex-wrap overflow-y-auto">
                    <main className="min-w-0 flex-1 overflow-y-auto px-3 py-3">
                        {/* Page heading */}
                        <div className="mb-3">
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-semibold tracking-tight text-content">
                                    My Tasks
                                </h1>
                                <span className="inline-flex items-center gap-1.5 rounded-pill bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    {activeCount} active
                                </span>
                            </div>
                            <p className="mt-0.5 text-xs text-content-subtle">
                                Plan your tasks and keep track of what matters.
                            </p>
                        </div>

                        {isLoading && (
                            <div className="mb-3 flex items-center gap-2 rounded-card border border-border bg-surface px-3.5 py-3 text-sm text-content-muted">
                                <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} />
                                Loading your tasks&hellip;
                            </div>
                        )}

                        {notice && (
                            <div className="mb-3">
                                <Notice
                                    tone={notice.tone}
                                    title={notice.title}
                                    onDismiss={() => setNotice(null)}
                                >
                                    {notice.body}
                                </Notice>
                            </div>
                        )}

                        <Filters
                            activeTab={filters.tab}
                            onTabChange={setFilter('tab')}
                            query={filters.query}
                            onQueryChange={setFilter('query')}
                            view={view}
                            onViewChange={setView}
                            status={filters.status}
                            onStatusChange={setFilter('status')}
                            priority={filters.priority}
                            onPriorityChange={setFilter('priority')}
                            category={filters.category}
                            onCategoryChange={setFilter('category')}
                            dueDate={filters.dueDate}
                            onDueDateChange={setFilter('dueDate')}
                            onNewTask={() => setPanelOpen(true)}
                            counts={counts}
                        />

                        <div className="mt-3">
                            {/* Ordered deliberately: a genuinely empty account is explained
                                and offered an action, rather than being reported as "no
                                tasks match these filters" — which would blame the filters for
                                a condition they did not cause. */}
                            {isEmpty ? (
                                <div className="rounded-card border border-dashed border-border-strong bg-surface px-4 py-12 text-center">
                                    <p className="text-sm font-medium text-content">
                                        Nothing here yet
                                    </p>
                                    <p className="mx-auto mt-1 max-w-sm text-sm text-content-subtle">
                                        This account has no tasks stored. Create one and it will
                                        appear here straight away.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setPanelOpen(true)}
                                        className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-control bg-primary px-3.5 text-xs font-semibold text-primary-contrast transition hover:bg-primary-hover active:bg-primary-active"
                                    >
                                        Create your first task
                                    </button>
                                </div>
                            ) : !isLoading && visible.length === 0 && !isPlaceholder ? (
                                <p className="rounded-card border border-dashed border-border-strong bg-surface px-3 py-10 text-center text-sm text-content-subtle">
                                    No tasks match these filters.
                                </p>
                            ) : view === 'list' ? (
                                <TaskList
                                    activeTasks={activeTasks}
                                    completedTasks={completedTasks}
                                    onToggle={toggleAndPersist}
                                    onStartFocus={startFocus}
                                    onEdit={setEditingTask}
                                    onDelete={setPendingDelete}
                                    disabled={isPlaceholder || isMutating || isLoading}
                                    footer={{
                                        // Derived from estimateMinutes (R-TASK-13), which is
                                        // why the API stores minutes rather than "1h 30m".
                                        estimated: `${formatTotal(visible)} total`,
                                        completed: completedTasks.length,
                                        total: activeTasks.length + completedTasks.length,
                                    }}
                                />
                            ) : (
                                <div className="rounded-card border border-border bg-surface px-3 py-10 text-center text-sm text-content-subtle">
                                    {view === 'board'
                                        ? 'Board view — group tasks by status.'
                                        : 'Calendar view — lay tasks out by due date.'}
                                </div>
                            )}
                        </div>
                    </main>

                    {/*
                        Rendered once. The wrapper is a fixed-width column at xl and
                        above, and a full-width stacked block below — a second instance
                        would duplicate form state and ids.

                        Withheld while dummy data is on screen: creating a task would leave the
                        list unchanged, since the next fetch still has no records to show.
                    */}
                    {panelOpen && !isPlaceholder && (
                        <div className="w-full shrink-0 border-t border-border xl:w-[268px] xl:border-t-0 xl:border-l">
                            <CreateTaskPanel
                                onClose={() => setPanelOpen(false)}
                                onCreate={createTask}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default TasksPage
