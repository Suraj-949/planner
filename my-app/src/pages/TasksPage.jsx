import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import Filters from '../components/tasks/Filters'
import TaskList from '../components/tasks/TaskList'
import TaskFormPanel from '../components/tasks/TaskFormPanel'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Notice from '../components/ui/Notice'
import { SEED } from '../data/seedTasks'
import { filterTasks } from '../utils/filterTasks'
import { matchTaskId, toViewTasks, formatTotal, parseEstimate } from '../utils/taskAdapter'
import { toRecurrence } from '../constants/taskMeta'
import { list, create, update, remove } from '../services/tasks'
import { useAuth } from '../hooks/useAuth'
import { LoaderCircle } from 'lucide-react'

const TABS = ['all', 'today', 'upcoming', 'completed']

// The server caps a single page at 100 rows; the list needs the whole set for the
// client-side tabs and counts, so anything larger is pulled through in chunks.
const PAGE_CHUNK = 100

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
    const [panelMode, setPanelMode] = useState('create')
    const [editingTask, setEditingTask] = useState(null)
    const [pendingDelete, setPendingDelete] = useState(null)

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
            // The whole set, not a page: every tab count and the client-side filters below
            // read from this one list, so a truncated response would undercount silently.
            const first = await list({ limit: PAGE_CHUNK })

            let rows = first.tasks ?? []
            const total = first.meta?.total ?? rows.length

            for (let page = 2; rows.length < total; page += 1) {
                const next = await list({ limit: PAGE_CHUNK, page })
                const chunk = next.tasks ?? []

                // An empty page means the collection shrank mid-read; stop rather than loop.
                if (chunk.length === 0) break

                rows = rows.concat(chunk)
            }

            const views = toViewTasks(rows)

            if (views.length === 0) {
                showEmptyState()
            } else {
                setTasks(views)
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

    const showError = useCallback((error, fallback) => {
        setNotice({
            tone: 'danger',
            title: fallback.title,
            body: error.response?.data?.message ?? fallback.body,
        })
    }, [])

    /*
     * Writes a change to the server and reloads, so the list shows what was stored rather
     * than what was optimistically assumed.
     */
    const patchTask = useCallback(
        async (id, patch, fallback) => {
            if (source !== 'live') return

            try {
                await update(id, patch)
                await fetchTasks()
            } catch (error) {
                // Not rolled back by hand: reloading restores whatever the server actually
                // holds, which by definition cannot disagree with reality.
                await fetchTasks()
                showError(error, fallback)
            }
        },
        [source, fetchTasks, showError]
    )

    const toggleAndPersist = useCallback(
        async (id) => {
            if (source !== 'live') return

            const current = tasks.find((task) => matchTaskId(task, id))

            if (!current) return

            const next = current.status === 'completed' ? 'pending' : 'completed'

            // Optimistic so the checkbox responds on the same frame; the request below
            // makes it true. Without it the row flips and then flips back on reload.
            setTasks((rows) =>
                rows.map((task) => (matchTaskId(task, id) ? { ...task, status: next } : task))
            )

            await patchTask(
                id,
                { status: next },
                {
                    title: next === 'completed' ? 'Could not complete the task' : 'Could not reopen the task',
                    body: 'The change was not saved, so the list was reloaded from the server.',
                }
            )
        },
        [source, tasks, patchTask]
    )

    /*
     * Starting focus is modelled as the in-progress state and is now persisted, so the
     * status survives a reload. Recording the session itself belongs to Phase 3.
     */
    const startFocus = useCallback(
        async (id) => {
            if (source !== 'live') return

            const current = tasks.find((task) => matchTaskId(task, id))

            if (!current || current.status === 'completed') return

            setTasks((rows) =>
                rows.map((task) => (matchTaskId(task, id) ? { ...task, status: 'in-progress' } : task))
            )

            await patchTask(
                id,
                { status: 'in-progress' },
                {
                    title: 'Could not start focus',
                    body: 'The status was not saved, so the list was reloaded from the server.',
                }
            )
        },
        [source, tasks, patchTask]
    )

    const openCreate = () => {
        setEditingTask(null)
        setPanelMode('create')
        setPanelOpen(true)
    }

    const openEdit = (task) => {
        setEditingTask(task)
        setPanelMode('edit')
        setPanelOpen(true)
    }

    const submitDraft = async (draft) => {
        if (isPlaceholder) return

        const recurrence = toRecurrence(draft.recurring, draft.daysOfWeek)

        const payload = {
            title: draft.title,
            description: draft.description,
            notes: draft.notes,
            priority: draft.priority,
            deadline: draft.deadline,
            category: draft.category,
            estimateMinutes: parseEstimate(draft.estimate),
            subtasks: draft.subtasks ?? [],
            // An omitted key means "leave unchanged" on a partial update, so clearing the
            // recurrence has to send null rather than nothing.
            recurrence: recurrence ?? null,
        }

        const isEdit = panelMode === 'edit'

        try {
            if (isEdit && editingTask) {
                await update(editingTask.id, payload)
            } else {
                await create(payload)
            }

            setPanelMode('create')
            setEditingTask(null)
            await fetchTasks()
        } catch (error) {
            setNotice({
                tone: 'danger',
                title: isEdit ? 'Could not save the changes' : 'Could not create the task',
                body: error.response?.data?.message ?? 'The server rejected the request.',
            })
        }
    }

    const deleteTask = async () => {
        const target = pendingDelete

        if (!target) return

        try {
            await remove(target.id)
            setPendingDelete(null)
            await fetchTasks()
        } catch (error) {
            setPendingDelete(null)
            showError(error, {
                title: 'Could not delete the task',
                body: 'Nothing was removed, so the list was reloaded from the server.',
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
        <AppShell
            onCreate={openCreate}
            search={{ value: filters.query, onChange: setFilter('query') }}
        >
            {/*
                Bleeds AppShell's main padding so the create panel can sit flush against
                the right edge, the same way it did when the page owned its own layout.
            */}
            <div className="-mx-3 -my-3 flex min-h-[calc(100vh-3rem)] flex-wrap">
                <main className="min-w-0 flex-1 px-3 py-3">
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
                            Everything you need to get done with precision latency.
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
                        onStatusChange={setFilterFromEvent('status')}
                        priority={filters.priority}
                        onPriorityChange={setFilterFromEvent('priority')}
                        category={filters.category}
                        onCategoryChange={setFilterFromEvent('category')}
                        dueDate={filters.dueDate}
                        onDueDateChange={setFilterFromEvent('dueDate')}
                        onNewTask={openCreate}
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
                                    onClick={openCreate}
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
                                onStartFocus={isPlaceholder ? undefined : startFocus}
                                onEdit={openEdit}
                                onDelete={setPendingDelete}
                                canMutate={!isPlaceholder}
                                footer={{
                                    // Derived from estimateMinutes (R-TASK-13), which is
                                    // why the API stores minutes rather than "1h 30m".
                                    logged: `${formatTotal(visible)} total`,
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
                        {/*
                            Keyed on the task being edited so switching from one task to
                            another, or from edit back to create, re-runs the panel's
                            initial-state hook. Without it the form keeps showing the
                            previous task's fields.
                        */}
                        <TaskFormPanel
                            key={panelMode === 'edit' ? `edit-${editingTask?.id}` : 'create'}
                            mode={panelMode}
                            initialTask={editingTask}
                            onClose={() => {
                                setPanelOpen(false)
                                setPanelMode('create')
                                setEditingTask(null)
                            }}
                            onSubmit={submitDraft}
                        />
                    </div>
                )}
            </div>

            <ConfirmDialog
                // Keyed on the target so switching tasks remounts the dialog and its
                // pending state starts over.
                key={pendingDelete?.id ?? 'confirm-none'}
                open={Boolean(pendingDelete)}
                title="Delete this task?"
                confirmLabel="Delete"
                onConfirm={deleteTask}
                onCancel={() => setPendingDelete(null)}
            >
                <span className="font-medium text-content">&ldquo;{pendingDelete?.title}&rdquo;</span> will
                be permanently removed, along with its subtasks. This cannot be undone.
            </ConfirmDialog>
        </AppShell>
    )
}

export default TasksPage
