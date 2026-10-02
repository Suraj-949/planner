import Button from '../ui/Button'
import { Bell, CalendarDays, Menu, Plus, Search } from 'lucide-react'
import { REFERENCE_DATE, formatToday } from '../../utils/dates'

const Header = ({
    date = REFERENCE_DATE,
    onOpenCreate,
    onOpenNav,
    onOpenCommand,
    hasNotifications = true,
}) => {
    return (
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
            <button
                type="button"
                onClick={onOpenNav}
                aria-label="Open navigation"
                className="rounded-control p-1.5 text-content-muted hover:bg-surface-overlay hover:text-content lg:hidden"
            >
                <Menu className="h-4 w-4" strokeWidth={1.8} />
            </button>

            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
                <span className="text-content-subtle">Planner</span>
                <span aria-hidden="true" className="text-content-subtle">
                    /
                </span>
                <span className="font-medium text-content">Execution Engine</span>
            </nav>

            <div className="ml-auto flex items-center gap-2">
                {/* Date pill */}
                <span className="hidden items-center gap-1.5 rounded-control border border-border bg-surface-raised px-2 py-1 text-xs text-content-muted sm:inline-flex">
                    <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.8} />
                    {formatToday(date)}
                </span>

                {/* Search / command palette */}
                <button
                    type="button"
                    onClick={onOpenCommand}
                    className="hidden h-8 items-center gap-1.5 rounded-control border border-border bg-surface-input pl-2 pr-1.5 text-xs text-content-subtle transition hover:border-border-strong hover:text-content-muted md:inline-flex"
                >
                    <Search className="h-3.5 w-3.5" strokeWidth={1.8} />
                    <span className="w-24 text-left">Search…</span>
                    <kbd className="rounded-[4px] border border-border bg-surface-overlay px-1.5 py-0.5 font-mono text-[10px] text-content-subtle">
                        ⌘K
                    </kbd>
                </button>

                <button
                    type="button"
                    aria-label="Notifications"
                    className="relative rounded-control p-1.5 text-content-muted transition hover:bg-surface-overlay hover:text-content"
                >
                    <Bell className="h-4 w-4" strokeWidth={1.8} />
                    {hasNotifications && (
                        <span
                            aria-hidden="true"
                            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary"
                        />
                    )}
                </button>

                <Button variant="primary" size="sm" onClick={onOpenCreate}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                    New Task
                </Button>

                <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-overlay text-[11px] font-bold text-content"
                >
                    S
                </span>
            </div>
        </header>
    )
}

export default Header
