import { useCallback } from 'react'
import { useResource } from './useResource'
import * as goalsApi from '../services/goals'
import * as milestonesApi from '../services/milestones'

/*
 * Goals and their milestones.
 *
 * `progress` arrives already derived from the milestones server-side, so a goal list never
 * has to fan out one request per row to render its progress bar.
 */
export const useGoals = ({ status } = {}) => {
    const loader = useCallback(() => goalsApi.list({ status }), [status])

    const resource = useResource(loader)

    return { ...resource, goals: resource.data?.goals ?? [] }
}

export const useGoal = (id) => {
    const loader = useCallback(() => goalsApi.detail(id), [id])

    const resource = useResource(loader, { enabled: Boolean(id) })

    return { ...resource, goal: resource.data?.goal ?? null }
}

export const useGoalActions = () => {
    const create = useCallback((body) => goalsApi.create(body), [])
    const update = useCallback((id, body) => goalsApi.update(id, body), [])
    const remove = useCallback((id) => goalsApi.remove(id), [])

    return { create, update, remove }
}

export const useMilestones = (goalId) => {
    const loader = useCallback(
        () => milestonesApi.listForGoal(goalId).then((data) => data.milestones ?? []),
        [goalId]
    )

    return useResource(loader, { enabled: Boolean(goalId) })
}

/*
 * Milestone mutations.
 *
 * `toggle` is expressed as set-completed rather than complete-and-uncomplete so the caller
 * never has to work out the next value from the current one — and so reopening cannot
 * accidentally stamp a second `completedAt`, which would make a late milestone look on
 * time.
 */
export const useMilestoneActions = (onChanged) => {
    const create = useCallback(
        async (body) => {
            const result = await milestonesApi.create(body)
            await onChanged?.()

            return result
        },
        [onChanged]
    )

    const toggle = useCallback(
        async (milestone) => {
            await milestonesApi.setCompleted(milestone._id, milestone.completedAt == null)
            await onChanged?.()
        },
        [onChanged]
    )

    const update = useCallback(
        async (id, body) => {
            const result = await milestonesApi.update(id, body)
            await onChanged?.()

            return result
        },
        [onChanged]
    )

    const remove = useCallback(
        async (id) => {
            await milestonesApi.remove(id)
            await onChanged?.()
        },
        [onChanged]
    )

    return { create, toggle, update, remove }
}
