import Button from '../ui/Button'
import { Bell, CalendarDays, Menu, Plus } from 'lucide-react'
import { formatToday } from '../../utils/dates'

/*
 * The header reads the current date rather than a fixed reference one.
 *
 * `REFERENCE_DATE` (Oct 24, 2025) came from the design mock and was still being shown as
 * "today" long after it stopped being true, which made every relative label on screen —
 * Overdue, Due Today, Tomorrow — look wrong next to a header claiming a different day.
 */
const Header = ({ title, subtitle, onOpenCreate, onOpenNav, onCreateLabel = 'New Task' }) => {
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
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
                <span className="hidden text-content-subtle sm:inline">Planner</span>
                <span aria-hidden="true" className="hidden text-content-subtle sm:inline">
                    /
                </span>
                <span className="truncate font-medium text-content">{title}</span>
            </nav>

            <div className="ml-auto flex items-center gap-2">
                {/* Date pill */}
                <span className="hidden items-center gap-1.5 rounded-control border border-border bg-surface-raised px-2 py-1 text-xs text-content-muted sm:inline-flex">
                    <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.8} />
                    {formatToday(new Date())}
                </span>

                <button
                    type="button"
                    aria-label="Notifications"
                    className="relative rounded-control p-1.5 text-content-muted transition hover:bg-surface-overlay hover:text-content"
                >
                    <Bell className="h-4 w-4" strokeWidth={1.8} />
                </button>

                {onOpenCreate && (
                    <Button variant="primary" size="sm" onClick={onOpenCreate}>
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                        {onCreateLabel}
                    </Button>
                )}

                <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-overlay text-[11px] font-bold text-content"
                >
                    S
                </span>
            </div>

            {subtitle && <span className="sr-only">{subtitle}</span>}
        </header>
    )
}

export default Header
