import { useCallback, useEffect, useState } from 'react'

/*
 * One async resource, with the three states every page needs kept distinct.
 *
 * `isLoading`, `error` and `data` are separate rather than collapsed into a single status
 * string, because "still loading", "loaded and empty" and "failed" look identical on
 * screen and need opposite treatment: the first two are both honest, the third has to say
 * so rather than showing an empty list that reads as "you have nothing".
 *
 * `loader` must be memoised by the caller — typically with `useCallback`. Its identity is
 * what retriggers the effect, so an inline arrow would refetch on every render.
 */
export const useResource = (loader, { enabled = true, initial = null } = {}) => {
    const [data, setData] = useState(initial)
    const [isLoading, setIsLoading] = useState(enabled)
    const [error, setError] = useState(null)

    const load = useCallback(async () => {
        // Set here rather than in the effect body, which the React compiler lint flags as
        // a cascading render. `loader` is async, so this runs once per fetch rather than
        // once per render, and it also covers the case where `enabled` flips false → true
        // and the initial `useState(enabled)` was false.
        setIsLoading(true)
        setError(null)

        try {
            const result = await loader()
            setData(result)

            return result
        } catch (err) {
            setError(err)

            return undefined
        } finally {
            setIsLoading(false)
        }
    }, [loader])

    /*
     * Refetch, from an event handler. `load` already sets the flag before awaiting, so the
     * caller can show a spinner over data that is about to be replaced.
     */
    const reload = useCallback(() => load(), [load])

    useEffect(() => {
        // A disabled resource never starts a request. Its `isLoading` initial value is
        // `enabled`, so a disabled resource renders as settled rather than as loading.
        if (!enabled) return

        // Deferred by a tick rather than started synchronously, because `load` sets state
        // and the React compiler lint forbids a synchronous setState in an effect body.
        // Scheduling it keeps the first paint free of a cascading render.
        const timer = setTimeout(load, 0)

        return () => clearTimeout(timer)
    }, [enabled, load])

    return { data, isLoading, error, refetch: reload, setData }
}

/*
 * The message a failed request should show.
 *
 * The server's own message is preferred, because it is the one place that knows which
 * rule was actually broken; the fallback covers network failures, where there is no
 * response to read and `error.response` is undefined.
 */
export const errorMessage = (error, fallback) => error?.response?.data?.message ?? fallback
