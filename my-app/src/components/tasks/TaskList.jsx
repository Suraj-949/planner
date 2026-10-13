import TaskRow, { COLUMNS } from './TaskRow'
import { Gauge } from 'lucide-react'

const HeadingGrid =
    'grid min-w-[700px] grid-cols-[28px_minmax(0,1fr)_84px_112px_128px_64px] items-center gap-3 border-b border-border bg-surface-raised px-3 py-2'

const SectionHeading = () => (
    <div className={HeadingGrid}>
        {COLUMNS.map((column) => (
            <span key={column.key} className={`label-xs ${column.className}`}>
                {column.label}
            </span>
        ))}
    </div>
)

const TaskList = ({ activeTasks, completedTasks, onToggle, onStartFocus, onEdit, onDelete, disabled, footer }) => {
    return (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <SectionHeading />

            {activeTasks.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-content-subtle">
                    No active tasks match these filters.
                </p>
            ) : (
                activeTasks.map((task) => (
                    <TaskRow key={task.id} task={task} onToggle={onToggle} onStartFocus={onStartFocus} onEdit={onEdit} onDelete={onDelete} disabled={disabled} />
                ))
            )}

            {/* All completed tasks in the current filter, not only today. */}
            {completedTasks.length > 0 && (
                <div className="border-t border-border bg-sidebar/40">
                    <div className="flex items-center gap-2 px-3 py-2">
                        <h3 className="label-xs">Completed ({completedTasks.length})</h3>
                    </div>

                    {completedTasks.map((task) => (
                        <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} disabled={disabled} />
                    ))}
                </div>
            )}

            {/* Footer stats */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border bg-surface-raised px-3 py-2 text-[11px] text-content-subtle">
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Gauge className="h-3 w-3" strokeWidth={1.8} />
                    Estimated: {footer.estimated}
                </span>
                <span className="tabular-nums">
                    Completed: {footer.completed}/{footer.total} tasks
                </span>
            </div>
        </div>
    )
}

export default TaskList
