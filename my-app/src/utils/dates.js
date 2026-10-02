// Date helpers for calendar-date values.
//
// The bug this exists to prevent: <input type="date"> submits "YYYY-MM-DD", which
// `new Date()` parses as UTC midnight. Normalising that to *local* midnight shifts the
// date back one day in every timezone behind UTC — which made tasks due tomorrow render
// as "Overdue" and reset the streak. See BUSINESS-LOGIC.md §3.3 (R-DATE-1…7).

const DAY_MS = 24 * 60 * 60 * 1000

const BARE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

// Accepts a Date, a "YYYY-MM-DD" calendar date, or a full ISO timestamp.
export const parseDateValue = (value) => {
    if (!value) return null

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value
    }

    const match = BARE_DATE.exec(String(value).trim())

    if (match) {
        const [, year, month, day] = match

        // Constructed from parts rather than parsed, so this is a *local* calendar date.
        return new Date(Number(year), Number(month) - 1, Number(day))
    }

    const parsed = new Date(value)

    return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const startOfLocalDay = (value) => {
    const date = parseDateValue(value)

    if (!date) return null

    const start = new Date(date)
    start.setHours(0, 0, 0, 0)

    return start
}

// Whole local days from `from` to `to`. Rounded rather than divided, so a DST
// transition producing 23 or 25 hours still yields the correct calendar count.
export const daysBetween = (from, to) => {
    const start = startOfLocalDay(from)
    const end = startOfLocalDay(to)

    if (!start || !end) return null

    return Math.round((end.getTime() - start.getTime()) / DAY_MS)
}

export const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// Fixed reference date from the design reference (Oct 24, 2025), built from parts so it
// is a *local* date. Overridable at the call site for a real deployment.
export const REFERENCE_DATE = new Date(2025, 9, 24)

export const formatToday = (date = REFERENCE_DATE) =>
    `Today, ${MONTHS[date.getMonth()]} ${date.getDate()}`

export const toDateInputValue = (value) => {
    const date = startOfLocalDay(value)

    if (!date) return ''

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

/*
 * Local YYYY-MM-DD key for a date. This is the single day-identity function: both the
 * streak counter and the reminder/day-diff logic derive "which day is it" from here, so
 * they cannot disagree about where one day ends and the next begins.
 *
 * Built from getFullYear/getMonth/getDate rather than from a UTC ISO string, which would
 * report the previous day for every user west of UTC.
 */
export const formatDateKey = (value) => {
    const date = parseDateValue(value)

    if (!date) return ''

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

// 'overdue' | 'today' | 'tomorrow' | null
export const getReminder = (task) => {
    if (!task?.deadline || task.status === 'completed') return null

    const diff = daysBetween(new Date(), task.deadline)

    if (diff === null) return null
    if (diff < 0) return 'overdue'
    if (diff === 0) return 'today'
    if (diff === 1) return 'tomorrow'

    return null
}
