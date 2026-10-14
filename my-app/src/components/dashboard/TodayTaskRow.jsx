import { Link } from 'react-router-dom'
import Badge from '../ui/Badge'
import Checkbox from '../ui/Checkbox'
import {
    CATEGORY_LABELS,
    PRIORITY_VARIANTS,
    STATUS_DOT,
    STATUS_VARIANTS,
} from '../../constants/taskMeta'
import { daysBetween, formatDateKey } from '../../utils/dates'
import { Play } from 'lucide-react'

/*
 * Compact task row for the dashboard's Today's Tasks card.
 *
 * Checkbox completes optimistically through the page's toggle handler; title deep-links
 * to the full task; the orange "Start Focus" action appears on in-progress work and on
 * the first pending task, arming the focus timer below.
 */
const TodayTaskRow = ({ task, onToggle, onFocused }) => {
    const todayKey = formatDateKey(new Date())
    const dayOffset = task.deadline ? daysBetween(todayKey, task.deadline) : null

    const due = (() => {
        if (task.status === 'completed') return { label: 'Done', className: 'text-secondary' }
        if (dayOffset === null) return { label: 'No deadline', className: 'text-content-subtle' }
        if (dayOffset < 0) return { label: `${Math.abs(dayOffset)}d overdue`, className: 'text-danger' }
        if (dayOffset === 0) return { label: 'Today', className: 'text-primary' }
        if (dayOffset === 1) return { label: 'Tomorrow', className: 'text-content-subtle' }
        return { label: formatDateKey(new Date(task.deadline)), className: 'text-content-subtle' }
    })()

    const completed = task.status === 'completed'

    return (
        <li className="group flex items-center gap-2.5 border-b border-border py-2 last:border-b-0">
            <Checkbox
                checked={completed}
                onChange={() => onToggle(task)}
                aria-label={`Mark "${task.title}" ${completed ? 'pending' : 'completed'}`}
            />

            <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    STATUS_DOT[task.status] ?? STATUS_DOT.pending
                }`}
            />

            <div className="min-w-0 flex-1">
                <Link
                    to={`/tasks/${task.id}`}
                    className={`block truncate text-xs font-medium transition hover:underline ${
                        completed ? 'text-content-subtle line-through' : 'text-content'
                    }`}
                >
                    {task.title}
                </Link>

                <span className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-[10px] text-content-subtle">
                        {CATEGORY_LABELS[task.category] ?? task.category}
                    </span>
                    <Badge variant={PRIORITY_VARIANTS[task.priority] ?? 'neutral'} square>
                        {task.priority}
                    </Badge>
                    <Badge variant={STATUS_VARIANTS[task.status] ?? 'neutral'} square>
                        {task.status}
                    </Badge>
                </span>
            </div>

            <span className={`shrink-0 text-[10px] font-medium tabular-nums ${due.className}`}>
                {due.label}
            </span>

            {!completed && (
                <button
                    type="button"
                    onClick={() => onFocused(task)}
                    className="hidden shrink-0 items-center gap-1 rounded-control border border-primary-border bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary transition hover:bg-primary hover:text-primary-contrast group-hover:inline-flex sm:inline-flex"
                >
                    <Play className="h-2.5 w-2.5" strokeWidth={2.4} />
                    Start Focus
                </button>
            )}
        </li>
    )
}

export default TodayTaskRow
