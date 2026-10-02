import { PRIMARY_NAV, SECONDARY_NAV, WORKSPACE } from '../../constants/navigation'
import Badge from '../ui/Badge'
import {
    LayoutDashboard,
    ListTodo,
    FolderKanban,
    Target,
    CalendarDays,
    Timer,
    Repeat,
    BarChart3,
    Settings,
    LifeBuoy,
    Search,
    ChevronDown,
} from 'lucide-react'

const NAV_ICONS = {
    dashboard: LayoutDashboard,
    tasks: ListTodo,
    projects: FolderKanban,
    goals: Target,
    calendar: CalendarDays,
    focus: Timer,
    habits: Repeat,
    analytics: BarChart3,
    settings: Settings,
    help: LifeBuoy,
}

const ICON_SIZE = 'h-4 w-4'

const NavItem = ({ item, active, onSelect }) => {
    const Icon = NAV_ICONS[item.id] ?? LayoutDashboard

    return (
        <button
            type="button"
            onClick={() => onSelect?.(item.id)}
            aria-current={active ? 'page' : undefined}
            className={`group flex w-full items-center gap-2.5 rounded-control px-2.5 py-1.5 text-left text-sm transition-colors duration-100 ${
                active
                    ? 'bg-primary font-semibold text-primary-contrast'
                    : 'text-content-muted hover:bg-surface-overlay hover:text-content'
            }`}
        >
            <Icon className={ICON_SIZE} strokeWidth={active ? 2.2 : 1.8} />

            <span className="flex-1 truncate">{item.label}</span>

            {item.dot && (
                <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                        active ? 'bg-primary-contrast' : 'bg-primary'
                    }`}
                />
            )}

            {item.meta && (
                <span
                    className={`text-[11px] font-semibold tabular-nums ${
                        active ? 'text-primary-contrast' : 'text-content-subtle'
                    }`}
                >
                    {item.meta}
                </span>
            )}

            {item.count !== undefined && (
                <span
                    className={`min-w-[20px] rounded-[4px] px-1 text-center text-[11px] font-bold tabular-nums ${
                        active ? 'bg-primary-contrast/20 text-primary-contrast' : 'bg-surface-overlay text-content-muted'
                    }`}
                >
                    {item.count}
                </span>
            )}
        </button>
    )
}

const Sidebar = ({ activeItem = 'tasks', onSelectItem, onSearch, onClose }) => {
    return (
        <aside className="flex h-full w-[190px] shrink-0 flex-col border-r border-border bg-sidebar">
            {/* Brand */}
            <div className="flex items-center gap-2 px-3 py-3">
                <span
                    aria-hidden="true"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-black text-primary-contrast"
                >
                    P
                </span>
                <span className="text-[15px] font-semibold tracking-tight text-content">Planner</span>
                <Badge variant="primary" className="px-1.5 py-0 text-[9px]">
                    v2.4 PRO
                </Badge>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close navigation"
                    className="ml-auto rounded-control p-1 text-content-subtle hover:bg-surface-overlay hover:text-content lg:hidden"
                >
                    <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
                        <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                    </svg>
                </button>
            </div>

            {/* Quick jump */}
            <div className="px-3 pb-2">
                <div className="relative">
                    <Search
                        className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-subtle"
                        strokeWidth={1.8}
                    />
                    <input
                        type="search"
                        value={onSearch?.value ?? ''}
                        onChange={(event) => onSearch?.(event.target.value)}
                        placeholder="Search / Quick jump"
                        aria-label="Search and quick jump"
                        className="h-8 w-full rounded-control border border-border bg-surface-input pl-7 pr-2 text-xs text-content outline-none transition placeholder:text-content-subtle focus:border-primary focus:ring-2 focus:ring-primary-soft"
                    />
                </div>
            </div>

            {/* Workspace */}
            <div className="px-3 pb-2">
                <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-control border border-border bg-surface px-2 py-1.5 text-left transition hover:border-border-strong"
                >
                    <span
                        aria-hidden="true"
                        className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-surface-overlay text-[10px] font-bold text-content-muted"
                    >
                        S
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-content">
                            {WORKSPACE.name}
                        </span>
                        <span className="block truncate text-[10px] text-content-subtle">
                            {WORKSPACE.plan}
                        </span>
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-content-subtle" strokeWidth={1.8} />
                </button>
            </div>

            {/* Primary nav */}
            <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1">
                {PRIMARY_NAV.map((item) => (
                    <NavItem
                        key={item.id}
                        item={item}
                        active={item.id === activeItem}
                        onSelect={onSelectItem}
                    />
                ))}
            </nav>

            {/* Footer nav + user */}
            <div className="space-y-0.5 border-t border-border px-3 py-2">
                {SECONDARY_NAV.map((item) => (
                    <NavItem
                        key={item.id}
                        item={item}
                        active={item.id === activeItem}
                        onSelect={onSelectItem}
                    />
                ))}

                <div className="mt-2 flex items-center gap-2 rounded-control px-1.5 py-1.5">
                    <span
                        aria-hidden="true"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-overlay text-[11px] font-bold text-content"
                    >
                        S
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-content">Suraj</span>
                        <span className="block truncate text-[10px] text-content-subtle">
                            6h 15m of 8h · PRO
                        </span>
                    </span>
                </div>
            </div>
        </aside>
    )
}

export default Sidebar
