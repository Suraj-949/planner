/*
 * Local focus-session history.
 *
 * The Pomodoro timer on the dashboard is the only thing that produces focus time, so its
 * output is recorded here per local day. Nothing else in the app can write this log,
 * which makes the "Focus Time" metric an honest measurement rather than a decoration —
 * it reads 0m until the timer has actually run.
 *
 * localStorage rather than the API: focus sessions are Phase 3 on the backend, and a
 * client-side log keeps the metric real today without inventing an endpoint contract.
 */

const LOG_KEY = 'planner:focus-log' // { '2026-10-14': 75 } — minutes per local day
const SESSIONS_KEY = 'planner:focus-sessions' // { '2026-10-14': 3 } — completed 25m intervals

const read = (key) => {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? {}
    } catch {
        // Corrupt or unavailable storage — treat as empty rather than throwing mid-timer.
        return {}
    }
}

const write = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch {
        // Private mode or quota: tracking is best-effort and must never break the timer.
    }
}

export const focusMinutesFor = (dayKey) => Number(read(LOG_KEY)[dayKey]) || 0

export const addFocusMinutes = (dayKey, minutes) => {
    const log = read(LOG_KEY)
    log[dayKey] = (Number(log[dayKey]) || 0) + minutes
    write(LOG_KEY, log)

    return log[dayKey]
}

export const focusMinutesForDays = (dayKeys) => dayKeys.map((key) => focusMinutesFor(key))

export const sessionsFor = (dayKey) => Number(read(SESSIONS_KEY)[dayKey]) || 0

export const addSession = (dayKey) => {
    const log = read(SESSIONS_KEY)
    log[dayKey] = (Number(log[dayKey]) || 0) + 1
    write(SESSIONS_KEY, log)

    return log[dayKey]
}
