import Input from '../ui/Input'
import { TASK_FILTERS, VIEW_MODES } from '../../constants/taskMeta'
import { LayoutList, KanbanSquare, CalendarDays } from 'lucide-react'

const VIEW_ICONS = {
    list: LayoutList,
    board: KanbanSquare,
    calendar: CalendarDays,
}

const TABS = ['all', 'today', 'upcoming', 'completed']

const SELECT_CLASS =
    'h-8 rounded-control border border-border bg-surface-input pl-2 pr-6 text-xs text-content-muted outline-none transition hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary-soft'

const Filters = ({
    activeTab,
    onTabChange,
    query,
    onQueryChange,
    view,
    onViewChange,
    status,
    onStatusChange,
    priority,
    onPriorityChange,
    category,
    onCategoryChange,
    dueDate,
    onDueDateChange,
    onNewTask,
}) => {
    return (
        <div className="space-y-2">
            {/* Search + view switcher + new task */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                    <Input
                        type="search"
                        size="sm"
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder="Filter tasks or tags..."
                        aria-label="Filter tasks or tags"
                        className="pl-2.5"
                    />
                </div>

                <div
                    role="tablist"
                    aria-label="View mode"
                    className="flex items-center gap-0.5 rounded-control border border-border bg-surface-input p-0.5"
                >
                    {VIEW_MODES.map((mode) => {
                        const Icon = VIEW_ICONS[mode.id]
                        const active = view === mode.id

                        return (
                            <button
                                key={mode.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => onViewChange(mode.id)}
                                className={`inline-flex h-7 items-center gap-1.5 rounded-[4px] px-2 text-xs font-medium transition-colors duration-100 ${
                                    active
                                        ? 'bg-surface-overlay text-content'
                                        : 'text-content-subtle hover:text-content-muted'
                                }`}
                            >
                                <Icon className="h-3.5 w-3.5" strokeWidth={active ? 2 : 1.8} />
                                {mode.label}
                            </button>
                        )
                    })}
                </div>

                <button
                    type="button"
                    onClick={onNewTask}
                    className="inline-flex h-8 items-center gap-1.5 rounded-control bg-primary px-3 text-xs font-semibold text-primary-contrast transition hover:bg-primary-hover active:bg-primary-active"
                >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
                        <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
                    </svg>
                    New Task
                </button>
            </div>

            {/* Tabs + selects */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div role="tablist" aria-label="Task filter" className="flex items-center gap-1">
                    {TABS.map((tab) => {
                        const meta = TASK_FILTERS.find((item) => item.id === tab)
                        const active = activeTab === tab

                        return (
                            <button
                                key={tab}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => onTabChange(tab)}
                                className={`inline-flex h-7 items-center gap-1.5 rounded-pill px-2.5 text-xs font-medium transition-colors duration-100 ${
                                    active
                                        ? 'bg-primary-soft text-primary'
                                        : 'text-content-subtle hover:bg-surface-overlay hover:text-content-muted'
                                }`}
                            >
                                {meta.label}
                                <span className="tabular-nums opacity-70">{meta.count}</span>
                            </button>
                        )
                    })}
                </div>

                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    <span className="label-xs">Status</span>
                    <select
                        value={status}
                        onChange={(event) => onStatusChange(event.target.value)}
                        aria-label="Filter by status"
                        className={SELECT_CLASS}
                    >
                        <option value="all">All</option>
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                    </select>

                    <span className="label-xs">Priority</span>
                    <select
                        value={priority}
                        onChange={(event) => onPriorityChange(event.target.value)}
                        aria-label="Filter by priority"
                        className={SELECT_CLASS}
                    >
                        <option value="all">All</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>

                    <span className="label-xs">Category</span>
                    <select
                        value={category}
                        onChange={(event) => onCategoryChange(event.target.value)}
                        aria-label="Filter by category"
                        className={SELECT_CLASS}
                    >
                        <option value="all">All</option>
                        <option value="Engineering">Engineering</option>
                        <option value="Design">Design</option>
                        <option value="Strategy">Strategy</option>
                        <option value="Infrastructure">Infrastructure</option>
                    </select>

                    <span className="label-xs">Due Date</span>
                    <Input
                        type="date"
                        size="sm"
                        value={dueDate}
                        onChange={(event) => onDueDateChange(event.target.value)}
                        aria-label="Filter by due date"
                        className="w-[140px]"
                    />
                </div>
            </div>
        </div>
    )
}

export default Filters
export { TABS, SELECT_CLASS }
