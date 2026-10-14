/*
 * Local focus-session history.
 *
 * Focus timers — the dashboard's Pomodoro and the habit page's Focus Mode — are the only
 * things that produce focus time, and both write through `recordFocusSession`, so the
 * dashboard metric, the habit page cards and the session ledger always agree.
 *
 * Three views over one log:
 *   minutes per day  — the "Focus Time" metric and progress bars
 *   session count    — cycle dots and "N sessions logged"
 *   ledger entries   — the chronological Session Ledger, with task and time range
 *
 * localStorage rather than the API: focus sessions are Phase 3 on the backend, and a
 * client-side log keeps every figure real today without inventing an endpoint contract.
 */

const LOG_KEY = 'planner:focus-log' // { '2026-10-14': 75 } — minutes per local day
const SESSIONS_KEY = 'planner:focus-sessions' // { '2026-10-14': 3 } — completed intervals
const LEDGER_KEY = 'planner:focus-ledger' // { '2026-10-14': [entry, …] } — newest first

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

/* ---- ledger ------------------------------------------------------------- */

// Day-keyed map of session entries: { '2026-10-14': [{ …entry }] }, newest first per day.
export const ledgerAll = () => read(LEDGER_KEY)

export const ledgerFor = (dayKey) => read(LEDGER_KEY)[dayKey] ?? []

let entrySeq = 0

/*
 * The single write path: minutes, session count and ledger entry in one call.
 *
 * Every finished session — dashboard timer or habit page Focus Mode — lands here, so no
 * view can show a session another view does not. Returns the fresh ledger for that day so
 * a caller can set state without a second read.
 */
export const recordFocusSession = ({ day, minutes, mode, taskId, taskTitle, startedAt, endedAt }) => {
    const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0))

    const ledger = read(LEDGER_KEY)
    const entry = {
        id: `${day}-${Date.now()}-${(entrySeq += 1)}`,
        day,
        minutes: safeMinutes,
        mode: mode ?? 'pomodoro',
        taskId: taskId ?? null,
        taskTitle: taskTitle ?? 'Focus session',
        startedAt: startedAt ?? endedAt ?? Date.now(),
        endedAt: endedAt ?? Date.now(),
    }

    ledger[day] = [entry, ...(ledger[day] ?? [])]
    write(LEDGER_KEY, ledger)

    const log = read(LOG_KEY)
    log[day] = (Number(log[day]) || 0) + safeMinutes
    write(LOG_KEY, log)

    const sessions = read(SESSIONS_KEY)
    sessions[day] = (Number(sessions[day]) || 0) + 1
    write(SESSIONS_KEY, sessions)

    return ledger[day]
}

/* ---- pulse analytics (Deep Work Pulse card) ----------------------------- */

const startOfLocalKey = (key) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key))
    if (!match) return null

    const [, y, m, d] = match
    return new Date(Number(y), Number(m) - 1, Number(d))
}

/*
 * Consecutive local days, counting back from today, that hold at least one logged
 * session. Local calendar days via Date parts, so the streak cannot drift across a DST
 * boundary the way `Date.now() ± 86400000` arithmetic would.
 */
export const focusStreakDays = (todayKey) => {
    const all = ledgerAll()
    let streak = 0
    let cursor = startOfLocalKey(todayKey)

    if (!cursor) return 0

    // Guarded so a corrupt key can never spin forever.
    for (let guard = 0; guard < 400; guard += 1) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`

        if (!(all[key]?.length > 0)) break

        streak += 1
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1)
    }

    return streak
}

const formatHourLabel = (hour) => {
    const normalized = ((hour % 24) + 24) % 24
    const suffix = normalized < 12 ? 'AM' : 'PM'
    const display = normalized % 12 === 0 ? 12 : normalized % 12

    return `${String(display).padStart(2, '0')}:00 ${suffix}`
}

/*
 * The three-hour window with the most session starts over the past 30 days — "peak focus
 * hours". Derived from real ledger entries; null when there is not enough data to name a
 * peak, which the card renders as an honest empty state rather than a invented window.
 */
export const peakFocusWindow = (todayKey) => {
    const all = ledgerAll()
    const counts = new Map()
    let total = 0

    for (const [day, entries] of Object.entries(all)) {
        if (day > todayKey) continue
        const dayDate = startOfLocalKey(day)
        if (!dayDate) continue
        if (Math.abs(dayDate - startOfLocalKey(todayKey)) > 30 * 86_400_000) continue

        for (const entry of entries) {
            const hour = new Date(entry.startedAt).getHours()
            counts.set(hour, (counts.get(hour) ?? 0) + 1)
            total += 1
        }
    }

    if (total === 0) return null

    let bestHour = null
    let bestCount = 0

    for (const [hour, count] of counts.entries()) {
        if (count > bestCount) {
            bestCount = count
            bestHour = hour
        }
    }

    if (bestHour === null) return null

    return { from: formatHourLabel(bestHour), to: formatHourLabel(bestHour + 3) }
}
