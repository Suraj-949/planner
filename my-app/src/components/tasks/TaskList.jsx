import TaskRow, { COLUMNS } from './TaskRow'
import Badge from '../ui/Badge'
import { Check, Gauge, Keyboard } from 'lucide-react'

const HeadingGrid =
    'grid grid-cols-[28px_minmax(0,1fr)_84px_112px_128px] items-center gap-3 border-b border-border bg-surface-raised px-3 py-2'

const SectionHeading = () => (
    <div className={HeadingGrid}>
        {COLUMNS.map((column) => (
            <span key={column.key} className={`label-xs ${column.className}`}>
                {column.label}
            </span>
        ))}
        <span className="label-xs justify-self-end">Actions</span>
    </div>
)

const CompletedRow = ({ task, onToggle }) => (
    <button
        type="button"
        onClick={() => onToggle(task.id)}
        className="flex w-full items-center gap-2.5 border-b border-border px-3 py-2 text-left transition last:border-b-0 hover:bg-surface-raised"
    >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-secondary text-secondary-contrast">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>

        <span className="truncate text-sm text-content-subtle line-through decoration-content-subtle/70">
            {task.title}
        </span>

        <span className="ml-auto shrink-0 text-[11px] text-content-subtle tabular-nums">
            {task.context}
        </span>
    </button>
)

const TaskList = ({ activeTasks, completedTasks, onToggle, onStartFocus, footer }) => {
    return (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
            <SectionHeading />

            {activeTasks.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-content-subtle">
                    No tasks match these filters.
                </p>
            ) : (
                activeTasks.map((task) => (
                    <TaskRow key={task.id} task={task} onToggle={onToggle} onStartFocus={onStartFocus} />
                ))
            )}

            {/* Completed today */}
            {completedTasks.length > 0 && (
                <div className="border-t border-border bg-sidebar/40">
                    <div className="flex items-center gap-2 px-3 py-2">
                        <h3 className="label-xs">Completed Today ({completedTasks.length})</h3>
                        <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                            100% velocity on target
                        </Badge>
                    </div>

                    {completedTasks.map((task) => (
                        <CompletedRow key={task.id} task={task} onToggle={onToggle} />
                    ))}
                </div>
            )}

            {/* Footer stats */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border bg-surface-raised px-3 py-2 text-[11px] text-content-subtle">
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Gauge className="h-3 w-3" strokeWidth={1.8} />
                    Logged: {footer.logged}
                </span>
                <span className="tabular-nums">
                    Completed: {footer.completed}/{footer.total} tasks
                </span>

                <span className="ml-auto hidden items-center gap-3 sm:flex">
                    <span className="inline-flex items-center gap-1">
                        <Keyboard className="h-3 w-3" strokeWidth={1.8} />
                        J/K Navigate
                    </span>
                    <span>Space Toggle</span>
                </span>
            </div>
        </div>
    )
}

export default TaskList
