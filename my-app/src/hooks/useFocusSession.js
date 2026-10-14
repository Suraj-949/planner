import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDateKey } from '../utils/dates'
import { recordFocusSession, sessionsFor } from '../utils/focusStore'

/*
 * Focus Mode session state for the focus page.
 *
 * Three modes over one timer: Pomodoro (25:00 countdown), Deep Work (50:00 countdown)
 * and Flow State (a stopwatch that only stops when the user says so).
 *
 * Countdown accuracy uses the absolute end-time pattern: the target moment is stamped
 * into `endRef` once when a run starts, and every visible tick is derived from it, so a
 * throttled background tab still lands on the real wall-clock end rather than counting
 * late. The stopwatch stamps an absolute origin the same way. The single interval effect
 * re-arms only when the run state or the mode changes — a repaint never restarts it — and
 * every setState happens inside the interval callback, never in the effect body.
 *
 * The session survives a reload. A running countdown is restored from its absolute end
 * time (never from a stored tick count, which would drift), so closing the tab does not
 * pause it — and a countdown that fully expired while the page was away is deliberately
 * *not* logged: the user never saw it end, and inventing a completed session for time
 * they may not have spent is exactly the silent fabrication the focus log exists to
 * prevent. The restore says so instead. Storage writes happen at transitions — start,
 * pause, finish, reset, skip, mode change — never per tick.
 *
 * Finishing a session (timer expired, or the Finish button pressed with a minute on the
 * clock) writes exactly one ledger entry through `recordFocusSession` — the same single
 * write path the dashboard timer uses — so the dashboard "Focus Time" metric, the Session
 * Ledger card and Today's Focus can never disagree. A session under a minute is reported
 * as too short rather than padded into a fake row.
 *
 * Tasks are only ever read here. A focus session never completes, edits or mutates the
 * task it is anchored to — the task is context for the session, not its output.
 */

const MIN_LOG_SECONDS = 60
const FEEDBACK_MS = 3200
// The Flow State arc completes over a 50-minute stretch and then holds — a stopwatch has
// no natural end, so the ring needs a scale of its own rather than dividing by zero.
const FLOW_ARC_SECONDS = 50 * 60
const SESSION_KEY = 'planner:focus-mode-session'

export const FOCUS_MODES = [
    { id: 'pomodoro', label: 'Pomodoro', hint: '25:00', seconds: 25 * 60, kind: 'countdown' },
    { id: 'deep', label: 'Deep Work', hint: '50:00', seconds: 50 * 60, kind: 'countdown' },
    { id: 'flow', label: 'Flow State', hint: 'Stopwatch', seconds: 0, kind: 'stopwatch' },
]

const resetValueFor = (mode) => (mode.kind === 'countdown' ? mode.seconds : 0)

const freshSession = () => ({
    modeId: FOCUS_MODES[0].id,
    seconds: FOCUS_MODES[0].seconds,
    extended: 0,
    running: false,
    sessionStart: null,
    end: 0,
    origin: 0,
    taskId: null,
    notice: null,
})

/*
 * Restore the previous session, if any.
 *
 * A running countdown resumes from its absolute end time rather than a stored tick
 * count, so a reload cannot stretch or shrink it — the same wall-clock discipline the
 * interval itself uses. A stopwatch resumes from its stored origin and keeps counting the
 * real elapsed time. Corrupt or partial storage degrades to a fresh session rather than
 * throwing inside a lazy initialiser.
 */
const readInitialSession = () => {
    let stored = null

    try {
        stored = JSON.parse(localStorage.getItem(SESSION_KEY))
    } catch {
        return freshSession()
    }

    if (!stored || typeof stored !== 'object') return freshSession()

    const mode = FOCUS_MODES.find((item) => item.id === stored.modeId) ?? FOCUS_MODES[0]
    const extended = Number.isFinite(stored.extended) && stored.extended > 0 ? stored.extended : 0
    const seconds = Number.isFinite(stored.seconds) && stored.seconds >= 0
        ? stored.seconds
        : resetValueFor(mode)
    const taskId = typeof stored.taskId === 'string' && stored.taskId ? stored.taskId : null
    const sessionStart = Number.isFinite(stored.sessionStart) && stored.sessionStart > 0
        ? stored.sessionStart
        : null
    const end = Number.isFinite(stored.end) && stored.end > 0 ? stored.end : 0
    const origin = Number.isFinite(stored.origin) && stored.origin > 0 ? stored.origin : 0

    if (!stored.running) {
        return {
            modeId: mode.id,
            seconds,
            extended,
            running: false,
            sessionStart,
            end: 0,
            origin: 0,
            taskId,
            notice: null,
        }
    }

    if (mode.kind === 'countdown') {
        if (!end) return freshSession()

        const remaining = Math.ceil((end - Date.now()) / 1000)

        if (remaining > 0) {
            return {
                modeId: mode.id,
                seconds: remaining,
                extended,
                running: true,
                sessionStart,
                end,
                origin: 0,
                taskId,
                notice: null,
            }
        }

        return {
            ...freshSession(),
            modeId: mode.id,
            taskId,
            notice: 'Session ended while the page was closed — nothing was logged.',
        }
    }

    // Stopwatch: the origin still stands, so elapsed time keeps counting across a reload.
    if (!origin) return freshSession()

    return {
        modeId: mode.id,
        seconds: Math.max(0, Math.round((Date.now() - origin) / 1000)),
        extended,
        running: true,
        sessionStart: sessionStart ?? origin,
        end: 0,
        origin,
        taskId,
        notice: null,
    }
}

export const useFocusSession = ({ tasks = [] } = {}) => {
    // One lazy read per mount; every field below is initialised from that single
    // snapshot so the restored pieces cannot disagree with each other.
    const [initial] = useState(readInitialSession)

    const [modeId, setModeId] = useState(initial.modeId)
    const [seconds, setSeconds] = useState(initial.seconds)
    // Extra seconds granted by "+5m" on the current countdown; state, not a ref, so the
    // ring's progress recomputes in the same render that shows the new time.
    const [extended, setExtended] = useState(initial.extended)
    const [running, setRunning] = useState(initial.running)
    const [finished, setFinished] = useState(false)
    const [feedback, setFeedback] = useState(initial.notice)
    const [selectedTaskId, setSelectedTaskId] = useState(initial.taskId)
    const [sessionCount, setSessionCount] = useState(() => sessionsFor(formatDateKey(new Date())))

    const mode = useMemo(() => FOCUS_MODES.find((item) => item.id === modeId) ?? FOCUS_MODES[0], [modeId])

    const endRef = useRef(initial.end) // absolute end moment of the current countdown run
    const watchRef = useRef(initial.origin) // absolute origin of the current stopwatch run
    const sessionStartRef = useRef(initial.sessionStart) // when this session was first armed
    const feedbackTimerRef = useRef(null)

    const selectedTask = useMemo(
        () => tasks.find((task) => task.id === selectedTaskId) ?? null,
        [tasks, selectedTaskId]
    )

    // Mirrored into a ref so the interval closure — stamped once per run — records the
    // task as it is when the session ends, never as it happened to be at Start.
    const taskRef = useRef(null)

    useEffect(() => {
        taskRef.current = selectedTask
    }, [selectedTask])

    // Any pending feedback message is abandoned with the component, not fired into a
    // detached tree.
    useEffect(() => () => window.clearTimeout(feedbackTimerRef.current), [])

    const showFeedback = useCallback((text) => {
        setFeedback(text)
        window.clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), FEEDBACK_MS)
    }, [])

    /*
     * Persistence. `persistSession` writes the full snapshot (closure state plus explicit
     * overrides), so each call site only names what it actually changed. The refs are
     * read at call time — they are stamped in the same handler or effect that persists,
     * so the stored end/origin always matches the visible timer.
     */
    const persistSession = useCallback(
        (next) => {
            try {
                localStorage.setItem(
                    SESSION_KEY,
                    JSON.stringify({
                        modeId,
                        seconds,
                        extended,
                        running,
                        sessionStart: sessionStartRef.current,
                        end: endRef.current,
                        origin: watchRef.current,
                        taskId: selectedTaskId,
                        ...next,
                    })
                )
            } catch {
                // Private mode or quota: persistence is best-effort, never a timer error.
            }
        },
        [modeId, seconds, extended, running, selectedTaskId]
    )

    // The resting snapshot every stop writes: same mode, timer full, nothing armed — so
    // a reload returns to exactly this mode rather than to the default one.
    const persistResting = useCallback(
        (overrides = {}) => {
            persistSession({
                running: false,
                sessionStart: null,
                end: 0,
                origin: 0,
                ...overrides,
            })
        },
        [persistSession]
    )

    const record = useCallback(
        (loggedSeconds) => {
            const day = formatDateKey(new Date())
            const task = taskRef.current
            const endedAt = Date.now()

            recordFocusSession({
                day,
                minutes: Math.max(1, Math.round(loggedSeconds / 60)),
                mode: modeId,
                taskId: task?.id ?? null,
                taskTitle: task?.title ?? 'Focus session',
                startedAt: sessionStartRef.current ?? endedAt - loggedSeconds * 1000,
                endedAt,
            })

            // Fresh read of the store that was just written, so the cycle dots advance in
            // the same update that created the session.
            setSessionCount(sessionsFor(day))
        },
        [modeId]
    )

    useEffect(() => {
        if (!running) return

        if (mode.kind === 'countdown') {
            endRef.current = Date.now() + seconds * 1000
        } else {
            watchRef.current = Date.now() - seconds * 1000
        }

        if (sessionStartRef.current === null) sessionStartRef.current = Date.now()

        // Persist here — after the stamps — so a reload mid-run restores from the same
        // end time this render is counting against.
        persistSession({ running: true })

        const interval = window.setInterval(() => {
            if (mode.kind === 'countdown') {
                const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000))
                setSeconds(left)

                if (left > 0) return

                window.clearInterval(interval)
                // Recorded before the start stamp is cleared, so the ledger keeps the
                // real armed-at moment (pauses appear in the span, not in the minutes).
                record(mode.seconds)
                sessionStartRef.current = null
                setRunning(false)
                setFinished(true)
                setExtended(0)
                persistResting({ seconds: mode.seconds, extended: 0 })
                showFeedback(`${mode.label} complete · ${Math.round(mode.seconds / 60)} min logged`)
                return
            }

            setSeconds(Math.round((Date.now() - watchRef.current) / 1000))
        }, 250)

        return () => window.clearInterval(interval)
        // Re-armed only when the run state or mode changes; `seconds` is read through the
        // stamped refs so a countdown repaint does not restart the interval. `mode`,
        // `record`, `persistSession` and `persistResting` are stable across a run because
        // modeId is itself a dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, modeId])

    const clearRun = useCallback(() => {
        setRunning(false)
        setFinished(false)
        setExtended(0)
        sessionStartRef.current = null
    }, [])

    const toggle = () => {
        if (finished) {
            clearRun()
            setSeconds(resetValueFor(mode))
            setRunning(true)
            // The effect re-persists once it stamps the fresh end time.
            return
        }

        if (running) {
            setRunning(false)
            persistSession({ running: false })
            return
        }

        setRunning(true)
    }

    const finish = () => {
        const logged = seconds

        if (logged < MIN_LOG_SECONDS) {
            clearRun()
            setSeconds(resetValueFor(mode))
            persistResting({ seconds: resetValueFor(mode), extended: 0 })
            showFeedback('Session too short to log — a minute is the minimum')
            return
        }

        // Recorded before clearRun so the ledger entry keeps the armed-at start time;
        // only afterwards does the timer return to its ready state.
        record(logged)
        clearRun()
        setSeconds(resetValueFor(mode))
        persistResting({ seconds: resetValueFor(mode), extended: 0 })
        showFeedback(`${Math.round(logged / 60)} min logged`)
    }

    const reset = () => {
        clearRun()
        setSeconds(resetValueFor(mode))
        persistResting({ seconds: resetValueFor(mode), extended: 0 })
        showFeedback('Timer reset')
    }

    const skip = () => {
        const index = FOCUS_MODES.findIndex((item) => item.id === modeId)
        const next = FOCUS_MODES[(index + 1) % FOCUS_MODES.length]

        clearRun()
        setModeId(next.id)
        setSeconds(resetValueFor(next))
        persistResting({ modeId: next.id, seconds: resetValueFor(next), extended: 0 })
        showFeedback(`Skipped to ${next.label}`)
    }

    const selectMode = (id) => {
        const next = FOCUS_MODES.find((item) => item.id === id)

        if (!next || next.id === modeId) return

        clearRun()
        setModeId(next.id)
        setSeconds(resetValueFor(next))
        persistResting({ modeId: next.id, seconds: resetValueFor(next), extended: 0 })
    }

    const addFiveMinutes = () => {
        if (mode.kind !== 'countdown' || finished) return

        if (running) endRef.current += 5 * 60 * 1000

        setExtended((current) => current + 5 * 60)
        setSeconds((current) => current + 5 * 60)
        persistSession({
            seconds: seconds + 5 * 60,
            extended: extended + 5 * 60,
            end: endRef.current,
        })
        showFeedback('+5 minutes')
    }

    const selectTask = (id) => {
        setSelectedTaskId(id || null)
        persistSession({ taskId: id || null })
    }

    const elapsed = mode.kind === 'countdown'
        ? Math.max(0, mode.seconds + extended - seconds)
        : seconds

    const progress = mode.kind === 'countdown'
        ? Math.max(0, Math.min(1, elapsed / (mode.seconds + extended)))
        : Math.min(1, seconds / FLOW_ARC_SECONDS)

    return {
        modes: FOCUS_MODES,
        mode,
        modeId,
        selectMode,
        seconds,
        elapsed,
        progress,
        isRunning: running,
        finished,
        isCountdown: mode.kind === 'countdown',
        toggle,
        finish,
        reset,
        skip,
        addFiveMinutes,
        feedback,
        task: selectedTask,
        selectTask,
        sessionCount,
        // Four intervals make a full cycle; the counter runs on for the day's history.
        cycle: Math.min((sessionCount % 4) + 1, 4),
    }
}
