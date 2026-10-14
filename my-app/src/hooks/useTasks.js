import { useCallback } from 'react'
import { useResource, errorMessage } from './useResource'
import * as tasksApi from '../services/tasks'
import { toViewTasks, toViewTask } from '../utils/taskAdapter'

/*
 * Tasks, with the server doing the filtering.
 *
 * The client used to download the whole collection and narrow it in the browser, which
 * meant the first row could not render until every row had arrived. The query now carries
 * the filters, so the response is only what is on screen — and pagination is possible at
 * all, which it was not when the list was unbounded.
 */
export const useTasks = (query = {}, { enabled = true } = {}) => {
    // Serialised so a filter change retriggers the fetch while an unchanged filter set
    // does not — object identity would change on every render.
    const key = JSON.stringify(query)

    const loader = useCallback(
        async () => tasksApi.list(query).then((data) => ({
            ...data,
            tasks: toViewTasks(data.tasks),
        })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [key]
    )

    const resource = useResource(loader, { enabled })

    return { ...resource, meta: resource.data?.meta ?? null }
}

export const useTask = (id) => {
    const loader = useCallback(
        async () => tasksApi.detail(id).then((data) => toViewTask(data.task)),
        [id]
    )

    return useResource(loader, { enabled: Boolean(id) })
}

export const useStreak = () => {
    const loader = useCallback(() => tasksApi.streak(), [])

    const resource = useResource(loader)

    return {
        ...resource,
        streak: resource.data?.streak ?? 0,
        longestStreak: resource.data?.longestStreak ?? 0,
    }
}

export const useStats = (params = {}) => {
    const key = JSON.stringify(params)

    const loader = useCallback(
        () => tasksApi.stats(params),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [key]
    )

    const resource = useResource(loader)

    // The controller answers `{ stats }`, so the counts live one level down. Reading
    // `data` directly made every figure on the dashboard render as "—".
    return { ...resource, stats: resource.data?.stats ?? null }
}

/*
 * Mutations.
 *
 * Each returns the fresh value so a caller can decide whether to update local state or
 * reload. Errors are not swallowed — they are re-thrown after the caller has had a chance
 * to show a message — because a mutation that fails silently is the defect this layer
 * exists to prevent.
 */
export const useTaskActions = () => {
    const create = useCallback(async (body) => {
        try {
            return await tasksApi.create(body)
        } catch (error) {
            throw new Error(errorMessage(error, 'Could not create the task'), { cause: error })
        }
    }, [])

    const update = useCallback(async (id, body) => {
        try {
            return await tasksApi.update(id, body)
        } catch (error) {
            throw new Error(errorMessage(error, 'Could not save the task'), { cause: error })
        }
    }, [])

    const remove = useCallback(async (id) => {
        try {
            return await tasksApi.remove(id)
        } catch (error) {
            throw new Error(errorMessage(error, 'Could not delete the task'), { cause: error })
        }
    }, [])

    return { create, update, remove }
}
