import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import EmptyState from '../components/ui/EmptyState'
import LoadingRow from '../components/ui/LoadingRow'
import Notice from '../components/ui/Notice'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import StatCard from '../components/ui/StatCard'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import TaskRow from '../components/tasks/TaskRow'
import { useProjects, useProjectActions } from '../hooks/useProjects'
import { useTasks, useTaskActions, useStats } from '../hooks/useTasks'
import { errorMessage } from '../hooks/useResource'
import { PROJECT_COLOUR_FALLBACK } from '../constants/projectMeta'
import { toViewTasks } from '../utils/taskAdapter'
import { ArrowLeft, Archive, ArchiveRestore, Trash2, ListTodo, CheckCircle2 } from 'lucide-react'

/*
 * One project, with the tasks filed under it.
 *
 * There is no single-project endpoint — the list is the read model — so this page finds
 * its project inside the collection it already loads. That keeps the page honest about
 * what a project is (a grouping the tasks point at) rather than pretending it is a second
 * aggregate that could disagree with the list.
 */
const ProjectDetailPage = () => {
    const { id } = useParams()
    const navigate = useNavigate()

    const { projects, isLoading, error, refetch } = useProjects()
    const { archive, restore, remove } = useProjectActions()

    const project = useMemo(() => projects.find((item) => String(item._id) === String(id)), [projects, id])

    const { data: taskData, isLoading: tasksLoading, refetch: refetchTasks, setData: setTasks, error: tasksError } = useTasks(
        { projectId: id, limit: 50 },
        { enabled: Boolean(id) }
    )
    const { stats } = useStats({ projectId: id })
    const { update } = useTaskActions()

    const [notice, setNotice] = useState(null)
    const [pendingDelete, setPendingDelete] = useState(false)

    // Mapped through toViewTasks: the API serialises `_id`, while TaskRow reads `id`.
    const tasks = useMemo(() => toViewTasks(taskData?.tasks), [taskData])

    const showError = useCallback((err, title) => {
        setNotice({ tone: 'danger', title, body: errorMessage(err, 'The request was rejected.') })
    }, [])

    const toggle = useCallback(
        async (taskId) => {
            const current = tasks.find((task) => String(task.id) === String(taskId))

            if (!current) return

            const next = current.status === 'completed' ? 'pending' : 'completed'

            setTasks((state) => ({
                ...state,
                tasks: (state?.tasks ?? []).map((task) =>
                    String(task.id) === String(taskId) ? { ...task, status: next } : task
                ),
            }))

            try {
                await update(current.id, { status: next })
                await refetchTasks()
            } catch (err) {
                await refetchTasks()
                showError(err, 'Could not save that change')
            }
        },
        [tasks, update, refetchTasks, setTasks, showError]
    )

    const run = useCallback(
        async (action, title) => {
            try {
                await action()
                await refetch()
            } catch (err) {
                await refetch()
                showError(err, title)
            }
        },
        [refetch, showError]
    )

    const openTasks = tasks.filter((task) => task.status !== 'completed')
    const completedTasks = tasks.filter((task) => task.status === 'completed')

    return (
        <AppShell>
            <Link
                to="/projects"
                className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-content-muted hover:text-content"
            >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                All projects
            </Link>

            {notice && (
                <div className="mb-3">
                    <Notice tone={notice.tone} title={notice.title} onDismiss={() => setNotice(null)}>
                        {notice.body}
                    </Notice>
                </div>
            )}

            {isLoading ? (
                <LoadingRow label="Loading the project…" />
            ) : !project ? (
                <EmptyState
                    title="Project not found"
                    body={error ? errorMessage(error, 'It may have been deleted.') : 'It may have been deleted, or the link may be wrong.'}
                    actionLabel="Back to projects"
                    onAction={() => navigate('/projects')}
                />
            ) : (
                <div className="space-y-3">
                    <section className="rounded-card border border-border bg-surface px-4 py-4">
                        <div className="flex items-start gap-3">
                            <span
                                aria-hidden="true"
                                className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: project.color || PROJECT_COLOUR_FALLBACK }}
                            />

                            <div className="min-w-0 flex-1">
                                <h1 className="text-lg font-semibold tracking-tight text-content">{project.title}</h1>
                                {project.description && (
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-content-muted">{project.description}</p>
                                )}
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                                <Button
                                    size="sm"
                                    variant="subtle"
                                    onClick={() =>
                                        run(
                                            () => (project.archivedAt ? restore(project._id) : archive(project._id)),
                                            'Could not update the project'
                                        )
                                    }
                                >
                                    {project.archivedAt ? (
                                        <>
                                            <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={1.8} />
                                            Restore
                                        </>
                                    ) : (
                                        <>
                                            <Archive className="h-3.5 w-3.5" strokeWidth={1.8} />
                                            Archive
                                        </>
                                    )}
                                </Button>

                                <button
                                    type="button"
                                    aria-label="Delete project"
                                    onClick={() => setPendingDelete(true)}
                                    className="rounded-control p-1.5 text-content-subtle transition hover:bg-danger-soft hover:text-danger"
                                >
                                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                                </button>
                            </div>
                        </div>

                        {project.archivedAt && (
                            <div className="mt-3">
                                <Badge variant="neutral" square>
                                    Archived
                                </Badge>
                            </div>
                        )}
                    </section>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <StatCard
                            label="Open tasks"
                            value={stats?.pending != null ? (stats.pending ?? 0) + (stats['in-progress'] ?? 0) : '—'}
                            icon={ListTodo}
                        />
                        <StatCard label="Completed" value={stats?.completed ?? 0} icon={CheckCircle2} />
                        <StatCard
                            label="Completion rate"
                            value={`${stats?.completionRate ?? 0}%`}
                            tone="secondary"
                            hint={stats ? `${stats.total} tasks in this project` : undefined}
                        />
                    </div>

                    <section className="overflow-hidden rounded-card border border-border bg-surface">
                        <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-3 py-2">
                            <h2 className="label-xs">Tasks in this project</h2>
                            <span className="ml-auto text-[11px] tabular-nums text-content-subtle">
                                {tasks.length} shown
                            </span>
                        </div>

                        {tasksLoading ? (
                            <LoadingRow label="Loading tasks…" className="m-3" />
                        ) : tasksError ? (
                            <p className="px-3 py-8 text-center text-sm text-content-subtle">
                                {errorMessage(tasksError, 'Could not load the tasks for this project.')}
                            </p>
                        ) : tasks.length === 0 ? (
                            <p className="px-3 py-8 text-center text-sm text-content-subtle">
                                No tasks point at this project yet.
                            </p>
                        ) : (
                            <>
                                {openTasks.map((task) => (
                                    <TaskRow key={task.id} task={task} onToggle={toggle} canMutate />
                                ))}
                                {completedTasks.map((task) => (
                                    <TaskRow key={task.id} task={task} onToggle={toggle} canMutate />
                                ))}
                            </>
                        )}
                    </section>
                </div>
            )}

            <ConfirmDialog
                open={pendingDelete}
                title="Delete this project?"
                confirmLabel="Delete"
                onConfirm={async () => {
                    if (!project) return
                    try {
                        await remove(project._id)
                        navigate('/projects')
                    } catch (err) {
                        setPendingDelete(false)
                        showError(err, 'Could not delete the project')
                    }
                }}
                onCancel={() => setPendingDelete(false)}
            >
                <span className="font-medium text-content">&ldquo;{project?.title}&rdquo;</span> will be
                deleted. Tasks that belong to it are unlinked, not deleted.
            </ConfirmDialog>
        </AppShell>
    )
}

export default ProjectDetailPage
