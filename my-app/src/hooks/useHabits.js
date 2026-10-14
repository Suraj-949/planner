import { useCallback } from 'react'
import { useResource } from './useResource'
import * as habitsApi from '../services/habits'

/*
 * Habits, with the streaks that arrive already derived from the completion rows.
 *
 * Nothing here recomputes a streak or reads a stored counter. The number on the badge and
 * the number the API would return for the same habit are the same number, because there is
 * only one of them.
 */
export const useHabits = ({ archived } = {}) => {
    const loader = useCallback(() => habitsApi.list({ archived }), [archived])

    const resource = useResource(loader)

    return { ...resource, habits: resource.data?.habits ?? [] }
}

export const useHabit = (id) => {
    const loader = useCallback(() => habitsApi.detail(id), [id])

    const resource = useResource(loader, { enabled: Boolean(id) })

    return { ...resource, habit: resource.data?.habit ?? null }
}

// Completion days as local `YYYY-MM-DD` keys, for the calendar and the tick history.
export const useHabitHistory = (id) => {
    const loader = useCallback(() => habitsApi.history(id), [id])

    const resource = useResource(loader, { enabled: Boolean(id) })

    return { ...resource, dates: resource.data?.dates ?? [] }
}

/*
 * Completion analytics for all habits over a date range, in one request.
 *
 * Serialised by key so changing the window retriggers the fetch while an unchanged
 * window does not — object identity would change on every render. Both shapes are
 * plain objects keyed by day or habit id, safe to default to empty before the first
 * response arrives.
 */
export const useHabitsAnalytics = ({ from, to } = {}) => {
    const key = JSON.stringify({ from, to })

    const loader = useCallback(
        () => habitsApi.analytics({ from, to }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [key]
    )

    const resource = useResource(loader)

    return {
        ...resource,
        perHabit: resource.data?.perHabit ?? {},
        dailyCounts: resource.data?.dailyCounts ?? {},
    }
}

/*
 * Habit mutations.
 *
 * `toggle` sends the next value rather than asking the caller to compute it, so reopening
 * a day cannot accidentally stamp a second completion — the server deletes the row
 * instead of flagging it, which is what keeps the streak from drifting.
 */
export const useHabitActions = (onChanged) => {
    const create = useCallback(
        async (body) => {
            const result = await habitsApi.create(body)
            await onChanged?.()

            return result
        },
        [onChanged]
    )

    const toggle = useCallback(
        async (habit, date) => {
            // `currentStreak` is the habit's own most recent state; a day that has already
            // been ticked has a row, and ticking it again is a no-op server-side.
            await habitsApi.tick(habit._id, { date, completed: true })
            await onChanged?.()
        },
        [onChanged]
    )

    const untick = useCallback(
        async (habit, date) => {
            await habitsApi.tick(habit._id, { date, completed: false })
            await onChanged?.()
        },
        [onChanged]
    )

    const update = useCallback(
        async (id, body) => {
            const result = await habitsApi.update(id, body)
            await onChanged?.()

            return result
        },
        [onChanged]
    )

    const archive = useCallback(
        async (id) => {
            await habitsApi.archive(id)
            await onChanged?.()
        },
        [onChanged]
    )

    const restore = useCallback(
        async (id) => {
            await habitsApi.restore(id)
            await onChanged?.()
        },
        [onChanged]
    )

    const remove = useCallback(
        async (id) => {
            await habitsApi.remove(id)
            await onChanged?.()
        },
        [onChanged]
    )

    return { create, toggle, untick, update, archive, restore, remove }
}
