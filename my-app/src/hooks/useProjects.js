import { useCallback } from 'react'
import { useResource } from './useResource'
import * as projectsApi from '../services/projects'

/*
 * Projects. Archived ones are excluded unless asked for, which is the same default the
 * server applies — the list a user sees is their live work, not a mixture of live and
 * filed.
 */
export const useProjects = ({ goalId, archived } = {}) => {
    const key = JSON.stringify({ goalId, archived })

    const loader = useCallback(
        () => projectsApi.list({ goalId, archived }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [key]
    )

    const resource = useResource(loader)

    return { ...resource, projects: resource.data?.projects ?? [] }
}

export const useProjectActions = () => {
    const create = useCallback((body) => projectsApi.create(body), [])
    const update = useCallback((id, body) => projectsApi.update(id, body), [])
    const archive = useCallback((id) => projectsApi.archive(id), [])
    const restore = useCallback((id) => projectsApi.restore(id), [])
    const remove = useCallback((id) => projectsApi.remove(id), [])

    return { create, update, archive, restore, remove }
}
