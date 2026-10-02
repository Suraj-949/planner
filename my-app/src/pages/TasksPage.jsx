import { useState } from 'react'
import Header from '../components/layout/Header'
import Sidebar from '../components/layout/Sidebar'
import Filters from '../components/tasks/Filters'
import TaskList from '../components/tasks/TaskList'
import CreateTaskPanel from '../components/tasks/CreateTaskPanel'
import { SEED } from '../data/seedTasks'
import { filterTasks } from '../utils/filterTasks'

const TasksPage = () => {
    const [tasks, setTasks] = useState(SEED)

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
    const [activeNav, setActiveNav] = useState('tasks')

    const setFilter = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }))

    const setFilterFromEvent = (key) => (event) => setFilter(key)(event.target.value)

    const toggleTask = (id) =>
        setTasks((current) =>
            current.map((task) =>
                task.id === id
                    ? { ...task, status: task.status === 'completed' ? 'pending' : 'completed' }
                    : task
            )
        )

    // Starting focus is modelled as the in-progress state; the real implementation
    // hands off to the pomodoro timer and records the session.
    const startFocus = (id) =>
        setTasks((current) =>
            current.map((task) => (task.id === id ? { ...task, status: 'in-progress' } : task))
        )

    const createTask = (draft) => {
        const task = {
            id: `local-${Date.now()}`,
            title: draft.title,
            context: draft.project,
            estimate: draft.estimate || '0m',
            priority: draft.priority,
            status: 'pending',
            due: draft.deadline || 'No date',
            dayOffset: 1,
            tags: draft.subtasks ?? [],
        }

        setTasks((current) => [task, ...current])
        setPanelOpen(false)
    }

    const visible = filterTasks(tasks, filters)
    const activeTasks = visible.filter((task) => task.status !== 'completed')
    const completedTasks = visible.filter((task) => task.status === 'completed')

    const activeCount = tasks.filter((task) => task.status !== 'completed').length

    return (
        <div className="flex h-screen overflow-hidden bg-background text-content">
            {/* Sidebar — static on desktop, drawer below lg */}
            <div className="hidden lg:block">
                <Sidebar
                    activeItem={activeNav}
                    onSelectItem={setActiveNav}
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
                                setActiveNav(id)
                                setNavOpen(false)
                            }}
                            onSearch={setFilterFromEvent('query')}
                            onClose={() => setNavOpen(false)}
                        />
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
                                Everything you need to get done with precision latency.
                            </p>
                        </div>

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
                            onNewTask={() => setPanelOpen(true)}
                        />

                        <div className="mt-3">
                            {view === 'list' ? (
                                <TaskList
                                    activeTasks={activeTasks}
                                    completedTasks={completedTasks}
                                    onToggle={toggleTask}
                                    onStartFocus={startFocus}
                                    footer={{
                                        logged: '6h 15m total',
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
                    */}
                    {panelOpen && (
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
