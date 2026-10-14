import {
    MONTHS,
    WEEKDAY_SHORT,
    daysBetween,
    weekDayKeys,
} from '../../utils/dates'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const formatRange = (weekStartKey) => {
    const keys = weekDayKeys(weekStartKey)
    const start = new Date(`${keys[0]}T12:00:00`)
    const end = new Date(`${keys[6]}T12:00:00`)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''

    const startLabel = `${MONTHS[start.getMonth()]} ${start.getDate()}`
    const endLabel =
        start.getMonth() === end.getMonth()
            ? `${end.getDate()}`
            : `${MONTHS[end.getMonth()]} ${end.getDate()}`

    return `${startLabel} – ${endLabel}, ${end.getFullYear()}`
}

/*
 * Monday–Sunday tracker, one row per habit.
 *
 * Three cell states, and deliberately only three:
 *
 *   green      — completed on that day
 *   neutral    — a day on or before today that could still be (or was available for)
 *                completing; the dot for an unscheduled day, never a missed mark
 *   faint      — a future day, not yet available
 *
 * A weekly or monthly habit has no per-day schedule in the model — it needs N days
 * somewhere inside the period — so no day is treated as missed until the period itself
 * ends. The existing streak logic (server-side) remains the only authority on whether a
 * period was met; this grid only shows which days carry a tick.
 *
 * Clicking the habit name opens the detail view.
 */
const HabitWeekTracker = ({
    habits,
    weekStartKey,
    perHabit = {},
    todayKey,
    onPrev,
    onNext,
    onHabitClick,
    canPrev,
    canNext,
    isLoading,
}) => {
    const days = weekDayKeys(weekStartKey)

    return (
        <section
            aria-label="Weekly habit tracker"
            className="rounded-card border border-border bg-surface"
        >
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-content">Weekly Tracker</h2>
                <span className="text-[11px] text-content-subtle">{formatRange(weekStartKey)}</span>

                <div className="ml-auto flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onPrev}
                        disabled={!canPrev}
                        aria-label="Previous week"
                        className="rounded-control border border-border p-1 text-content-muted transition hover:border-border-strong hover:text-content disabled:pointer-events-none disabled:opacity-40"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </button>

                    <button
                        type="button"
                        onClick={onNext}
                        disabled={!canNext}
                        aria-label="Next week"
                        className="rounded-control border border-border p-1 text-content-muted transition hover:border-border-strong hover:text-content disabled:pointer-events-none disabled:opacity-40"
                    >
                        <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </button>
                </div>
            </div>

            {/* Header row: habit label + seven weekday columns */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                <span className="w-40 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-content-subtle sm:w-52">
                    Habit
                </span>

                <div className="grid flex-1 grid-cols-7 gap-1 sm:gap-1.5">
                    {WEEKDAY_SHORT.map((label) => (
                        <span
                            key={label}
                            className="text-center text-[10px] font-semibold uppercase text-content-subtle"
                        >
                            {label}
                        </span>
                    ))}
                </div>

                <span className="hidden w-14 shrink-0 text-right text-[10px] font-semibold uppercase text-content-subtle sm:block">
                    Done
                </span>
            </div>

            {isLoading ? (
                <p className="px-4 py-6 text-center text-xs text-content-subtle">Loading tracker…</p>
            ) : habits.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-content-subtle">
                    No active habits to track this week.
                </p>
            ) : (
                <ul className="divide-y divide-border">
                    {habits.map((habit) => {
                        const keys = new Set(perHabit[habit._id] ?? [])
                        const done = days.filter((key) => keys.has(key)).length

                        return (
                            <li key={habit._id} className="flex items-center gap-2 px-4 py-2.5">
                                <button
                                    type="button"
                                    onClick={() => onHabitClick(habit)}
                                    className="w-40 shrink-0 truncate text-left text-xs font-medium text-content transition hover:text-primary sm:w-52"
                                    title={`Open details for ${habit.title}`}
                                >
                                    {habit.title}
                                </button>

                                <div className="grid flex-1 grid-cols-7 gap-1 sm:gap-1.5">
                                    {days.map((key) => {
                                        const completed = keys.has(key)
                                        const future = daysBetween(todayKey, key) > 0
                                        const isToday = key === todayKey

                                        return (
                                            <span
                                                key={key}
                                                title={`${key}${completed ? ' · completed' : future ? ' · upcoming' : ''}`}
                                                aria-label={`${key}${completed ? ', completed' : ''}`}
                                                className={`mx-auto h-5 w-5 rounded-[5px] border transition-colors duration-100 ${
                                                    completed
                                                        ? 'border-secondary bg-secondary'
                                                        : future
                                                          ? 'border-border bg-surface-input opacity-50'
                                                          : 'border-border-strong bg-surface-overlay'
                                                } ${isToday && !completed ? 'ring-1 ring-primary ring-offset-1 ring-offset-surface' : ''}`}
                                            />
                                        )
                                    })}
                                </div>

                                <span className="hidden w-14 shrink-0 text-right text-xs font-semibold tabular-nums text-content-muted sm:block">
                                    {done}
                                </span>
                            </li>
                        )
                    })}
                </ul>
            )}
        </section>
    )
}

export default HabitWeekTracker
