import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Notice from '../components/ui/Notice'
import EmptyState from '../components/ui/EmptyState'
import LoadingRow from '../components/ui/LoadingRow'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useProjects, useProjectActions } from '../hooks/useProjects'
import { errorMessage } from '../hooks/useResource'
import { PROJECT_COLOURS, PROJECT_COLOUR_FALLBACK } from '../constants/projectMeta'
import { Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react'

/*
 * Create/edit form for a project.
 *
 * Deliberately small: a project is a name, a note and an optional colour. Anything more
 * (task counts, progress) is derived elsewhere rather than collected here.
 */
const ProjectForm = ({ open, initial, onClose, onSubmit }) => {
    const [title, setTitle] = useState(initial?.title ?? '')
    const [description, setDescription] = useState(initial?.description ?? '')
    const [color, setColor] = useState(initial?.color ?? '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const submit = async (event) => {
        event.preventDefault()
        setSaving(true)
        setError(null)

        try {
            await onSubmit({ title: title.trim(), description: description.trim(), color: color || null })
            onClose()
        } catch (err) {
            setError(errorMessage(err, 'Could not save the project'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal open={open} onClose={saving ? () => {} : onClose} labelledBy="project-form-title">
            <form onSubmit={submit} className="p-4">
                <h2 id="project-form-title" className="text-sm font-semibold text-content">
                    {initial ? 'Edit project' : 'New project'}
                </h2>

                {error && (
                    <div className="mt-2">
                        <Notice tone="danger" title="Could not save">
                            {error}
                        </Notice>
                    </div>
                )}

                <div className="mt-3 space-y-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="project-title">Name</Label>
                        <Input
                            id="project-title"
                            size="sm"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="project-description">Description</Label>
                        <textarea
                            id="project-description"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            rows={3}
                            className="w-full rounded-control border border-border bg-surface-input px-2 py-1.5 text-xs text-content outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-soft"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Colour</Label>
                        <div className="flex flex-wrap gap-1.5">
                            {PROJECT_COLOURS.map((swatch) => (
                                <button
                                    key={swatch}
                                    type="button"
                                    aria-label={`Use colour ${swatch}`}
                                    aria-pressed={color === swatch}
                                    onClick={() => setColor(color === swatch ? '' : swatch)}
                                    className={`h-6 w-6 rounded-full transition ${
                                        color === swatch ? 'ring-2 ring-content ring-offset-2 ring-offset-surface' : ''
                                    }`}
                                    style={{ backgroundColor: swatch }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="subtle" size="sm" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="sm" type="submit" disabled={saving || !title.trim()}>
                        {saving ? 'Saving…' : initial ? 'Save changes' : 'Create project'}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}

const ProjectsPage = () => {
    const [archived, setArchived] = useState(false)
    const { projects, isLoading, error, refetch } = useProjects({ archived })

    const { create, update, archive, restore, remove } = useProjectActions()

    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [pendingDelete, setPendingDelete] = useState(null)
    const [notice, setNotice] = useState(null)

    const showError = useCallback((err, title) => {
        setNotice({ tone: 'danger', title, body: errorMessage(err, 'The request was rejected.') })
    }, [])

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

    return (
        <AppShell
            onCreate={() => {
                setEditing(null)
                setFormOpen(true)
            }}
            createLabel="New Project"
        >
            {notice && (
                <div className="mb-3">
                    <Notice tone={notice.tone} title={notice.title} onDismiss={() => setNotice(null)}>
                        {notice.body}
                    </Notice>
                </div>
            )}

            <div className="mb-3 flex items-center gap-2">
                <Button size="sm" variant={archived ? 'subtle' : 'primary'} onClick={() => setArchived(false)}>
                    Active
                </Button>
                <Button size="sm" variant={archived ? 'primary' : 'subtle'} onClick={() => setArchived(true)}>
                    Archived
                </Button>

                <span className="ml-auto text-[11px] tabular-nums text-content-subtle">
                    {projects.length} projects
                </span>
            </div>

            {isLoading ? (
                <LoadingRow label="Loading projects…" />
            ) : error ? (
                <EmptyState title="Could not load projects" body={errorMessage(error, 'The request failed.')} />
            ) : projects.length === 0 ? (
                <EmptyState
                    title={archived ? 'Nothing archived' : 'No projects yet'}
                    body={
                        archived
                            ? 'Archived projects appear here. They keep their tasks, they just leave the active list.'
                            : 'A project groups the tasks that serve one outcome. Create one to get started.'
                    }
                    actionLabel={archived ? undefined : 'New project'}
                    onAction={archived ? undefined : () => setFormOpen(true)}
                />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {projects.map((project) => (
                        <article
                            key={project._id}
                            className="rounded-card border border-border bg-surface px-3.5 py-3"
                        >
                            <div className="flex items-start gap-2">
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                                    style={{ backgroundColor: project.color || PROJECT_COLOUR_FALLBACK }}
                                />

                                <div className="min-w-0 flex-1">
                                    <Link
                                        to={`/projects/${project._id}`}
                                        className="block truncate text-sm font-semibold text-content hover:underline"
                                    >
                                        {project.title}
                                    </Link>

                                    {project.description && (
                                        <p className="mt-1 line-clamp-2 text-xs text-content-subtle">
                                            {project.description}
                                        </p>
                                    )}
                                </div>

                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        type="button"
                                        aria-label="Edit project"
                                        onClick={() => {
                                            setEditing(project)
                                            setFormOpen(true)
                                        }}
                                        className="rounded-control p-1 text-content-subtle transition hover:bg-surface-overlay hover:text-content"
                                    >
                                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                                    </button>

                                    <button
                                        type="button"
                                        aria-label={project.archivedAt ? 'Restore project' : 'Archive project'}
                                        onClick={() =>
                                            run(
                                                () => (project.archivedAt ? restore(project._id) : archive(project._id)),
                                                'Could not update the project'
                                            )
                                        }
                                        className="rounded-control p-1 text-content-subtle transition hover:bg-surface-overlay hover:text-content"
                                    >
                                        {project.archivedAt ? (
                                            <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={1.8} />
                                        ) : (
                                            <Archive className="h-3.5 w-3.5" strokeWidth={1.8} />
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        aria-label="Delete project"
                                        onClick={() => setPendingDelete(project)}
                                        className="rounded-control p-1 text-content-subtle transition hover:bg-danger-soft hover:text-danger"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-3 flex items-center gap-2 border-t border-border pt-2">
                                <span className="text-[11px] tabular-nums text-content-subtle">
                                    {project.openTaskCount ?? 0} open tasks
                                </span>

                                {project.archivedAt && (
                                    <Badge variant="neutral" square>
                                        Archived
                                    </Badge>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <ProjectForm
                key={editing?._id ?? 'new-project'}
                open={formOpen}
                initial={editing}
                onClose={() => {
                    setFormOpen(false)
                    setEditing(null)
                }}
                onSubmit={async (payload) => {
                    if (editing) await update(editing._id, payload)
                    else await create(payload)
                    await refetch()
                }}
            />

            <ConfirmDialog
                key={pendingDelete?._id ?? 'confirm-none'}
                open={Boolean(pendingDelete)}
                title="Delete this project?"
                confirmLabel="Delete"
                onConfirm={async () => {
                    try {
                        await remove(pendingDelete._id)
                        setPendingDelete(null)
                        await refetch()
                    } catch (err) {
                        setPendingDelete(null)
                        await refetch()
                        showError(err, 'Could not delete the project')
                    }
                }}
                onCancel={() => setPendingDelete(null)}
            >
                <span className="font-medium text-content">&ldquo;{pendingDelete?.title}&rdquo;</span> will be
                deleted. Tasks that belong to it are unlinked, not deleted.
            </ConfirmDialog>
        </AppShell>
    )
}

export default ProjectsPage
