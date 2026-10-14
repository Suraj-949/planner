import TaskRow, { GRID, COLUMNS } from './TaskRow'
import { CATEGORY_LABELS } from '../../constants/taskMeta'
import { Check, Gauge, Pencil, Trash2 } from 'lucide-react'

// Composed from TaskRow's GRID rather than restated. It previously duplicated the
// `grid-cols-[...]` template, so adding a column to the row left the header one column
// narrow and every heading shifted left of its cell.
const HeadingGrid = `${GRID} border-b border-border bg-surface-raised px-3 py-2`

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

const CompletedRow = ({ task, onToggle, onEdit, onDelete, canMutate = true }) => (
    <div className="flex items-center gap-2.5 border-b border-border px-3 py-2 transition last:border-b-0 hover:bg-surface-raised">
        <button
            type="button"
            onClick={() => onToggle(task.id)}
            aria-label={`Mark "${task.title}" as incomplete`}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-secondary text-secondary-contrast">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>

            <span className="truncate text-sm text-content-subtle line-through decoration-content-subtle/70">
                {task.title}
            </span>

            <span className="ml-auto shrink-0 text-[11px] text-content-subtle tabular-nums">
                {CATEGORY_LABELS[task.category] ?? task.category}
            </span>
        </button>

        {canMutate && (
            <div className="flex shrink-0 items-center gap-0.5">
                <button
                    type="button"
                    onClick={() => onEdit(task)}
                    aria-label={`Edit "${task.title}"`}
                    title="Edit"
                    className="rounded-control p-1.5 text-content-subtle transition-colors duration-100 hover:bg-surface-overlay hover:text-content"
                >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>

                <button
                    type="button"
                    onClick={() => onDelete(task)}
                    aria-label={`Delete "${task.title}"`}
                    title="Delete"
                    className="rounded-control p-1.5 text-content-subtle transition-colors duration-100 hover:bg-danger-soft hover:text-danger"
                >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
            </div>
        )}
    </div>
)

const TaskList = ({
    activeTasks,
    completedTasks,
    onToggle,
    onStartFocus,
    onEdit,
    onDelete,
    canMutate = true,
    footer,
}) => {
    return (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
            <SectionHeading />

            {activeTasks.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-content-subtle">
                    No tasks match these filters.
                </p>
            ) : (
                activeTasks.map((task) => (
                    <TaskRow
                        key={task.id}
                        task={task}
                        onToggle={onToggle}
                        onStartFocus={onStartFocus}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        canMutate={canMutate}
                    />
                ))
            )}

            {/* Completed */}
            {completedTasks.length > 0 && (
                <div className="border-t border-border bg-sidebar/40">
                    <div className="flex items-center gap-2 px-3 py-2">
                        <h3 className="label-xs">Completed ({completedTasks.length})</h3>
                    </div>

                    {completedTasks.map((task) => (
                        <CompletedRow
                            key={task.id}
                            task={task}
                            onToggle={onToggle}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            canMutate={canMutate}
                        />
                    ))}
                </div>
            )}

            {/* Footer stats */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border bg-surface-raised px-3 py-2 text-[11px] text-content-subtle">
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Gauge className="h-3 w-3" strokeWidth={1.8} />
                    Estimated: {footer.logged}
                </span>
                <span className="tabular-nums">
                    Completed: {footer.completed}/{footer.total} tasks
                </span>
            </div>
        </div>
    )
}

export default TaskList
