import Button from '../ui/Button'
import Input from '../ui/Input'
import NotificationPanel from './NotificationPanel'
import { Plus, Search, Timer } from 'lucide-react'

const greeting = () => {
    const hour = new Date().getHours()

    if (hour < 5) return 'Good night'
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'

    return 'Good evening'
}

/*
 * Page-level dashboard header: greeting and the row of actions.
 *
 * Distinct from the global TopBar — that strip carries app chrome; this one is the
 * dashboard's own command row. The search field filters the task list on this page,
 * the bell reports overdue and due-today work, and Quick Focus arms the timer below.
 */
const DashboardHeader = ({ search, notifications, onQuickFocus, onAddTask }) => {
    return (
        <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
                <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-content">
                    {greeting()}, Suraj <span aria-hidden="true">👋</span>
                </h1>
                <p className="mt-0.5 text-xs text-content-muted">
                    Let&rsquo;s turn today&rsquo;s plans into progress.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative hidden sm:block">
                    <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-subtle"
                        strokeWidth={1.8}
                    />
                    <Input
                        type="search"
                        size="sm"
                        value={search.value}
                        onChange={(event) => search.onChange(event.target.value)}
                        placeholder="Search tasks..."
                        aria-label="Search tasks on this page"
                        className="w-44 pl-8 lg:w-56"
                    />
                </div>

                <NotificationPanel items={notifications} />

                <Button size="sm" onClick={onQuickFocus} className="border border-primary-border">
                    <Timer className="h-3.5 w-3.5" strokeWidth={2} />
                    Quick Focus
                </Button>

                <Button variant="primary" size="sm" onClick={onAddTask}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                    Add Task
                </Button>
            </div>
        </header>
    )
}

export default DashboardHeader
