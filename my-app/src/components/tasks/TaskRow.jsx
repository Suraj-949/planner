import Badge from '../ui/Badge'
import Checkbox from '../ui/Checkbox'
import { STATUS_LABELS, STATUS_DOT } from '../../constants/taskMeta'
import { Timer, Play, Check } from 'lucide-react'

const GRID =
    'grid grid-cols-[28px_minmax(0,1fr)_84px_112px_128px] items-center gap-3'

// Column headings mirror GRID above; kept in one place so they can never drift.
const COLUMNS = [
    { key: 'check', label: '', className: 'justify-self-center' },
    { key: 'task', label: 'Task & Context', className: '' },
    { key: 'priority', label: 'Priority', className: '' },
    { key: 'status', label: 'Status', className: '' },
    { key: 'due', label: 'Due Date', className: '' },
]

const TaskRow = ({ task, onToggle, onStartFocus }) => {
    const completed = task.status === 'completed'
    const focusing = task.status === 'in-progress'

    return (
        <div
            className={`${GRID} border-b border-border px-3 py-2.5 transition-colors duration-100 last:border-b-0 hover:bg-surface-raised ${
                completed ? 'bg-surface/40' : ''
            }`}
        >
            <Checkbox
                checked={completed}
                onChange={() => onToggle(task.id)}
                aria-label={`Mark "${task.title}" as ${completed ? 'incomplete' : 'complete'}`}
                className="justify-self-center"
            />

            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span
                        className={`truncate text-sm ${
                            completed
                                ? 'text-content-subtle line-through decoration-content-subtle'
                                : 'font-medium text-content'
                        }`}
                    >
                        {task.title}
                    </span>
                </div>

                <div className="mt-1 flex items-center gap-2 text-[11px] text-content-subtle">
                    <span className="truncate">{task.context}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                        <Timer className="h-3 w-3" strokeWidth={1.8} />
                        {task.estimate}
                    </span>

                    {focusing && !completed && (
                        <button
                            type="button"
                            onClick={() => onStartFocus(task.id)}
                            className="ml-1 inline-flex items-center gap-1 rounded-control bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-contrast transition hover:bg-primary-hover"
                        >
                            <Play className="h-2.5 w-2.5 fill-current" strokeWidth={0} />
                            Start Focus
                        </button>
                    )}
                </div>
            </div>

            <div>
                <Badge variant={task.priority} square>
                    {task.priority}
                </Badge>
            </div>

            <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[task.status]}`} />
                <span className="truncate text-xs text-content-muted">{STATUS_LABELS[task.status]}</span>
            </div>

            <div className="flex items-center justify-between gap-2">
                <span
                    className={`truncate text-xs tabular-nums ${
                        completed ? 'text-content-subtle' : 'text-content-muted'
                    }`}
                >
                    {task.due}
                </span>

                {completed && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-secondary">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        Done
                    </span>
                )}
            </div>
        </div>
    )
}

export default TaskRow
export { COLUMNS, GRID }
