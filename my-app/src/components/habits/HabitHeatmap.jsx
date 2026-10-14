import { useMemo, useRef, useState } from 'react'
import { MONTHS, addLocalDaysKey, startOfWeekKey, weekDayKeys } from '../../utils/dates'

const WEEK_COLUMNS = 53 // 52 full weeks plus the current one

// Four green steps plus empty. Counts above 6 share the darkest shade — the GitHub
// convention of saturating rather than inventing hues the palette does not have.
const CELL_CLASSES = [
    'bg-surface-overlay',
    'bg-secondary/25',
    'bg-secondary/45',
    'bg-secondary/70',
    'bg-secondary',
]

const levelFor = (count) => {
    if (!count) return 0
    if (count === 1) return 1
    if (count <= 3) return 2
    if (count <= 6) return 3

    return 4
}

const formatLongDate = (key) => {
    const date = new Date(`${key}T12:00:00`)

    if (Number.isNaN(date.getTime())) return key

    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

/*
 * Contribution-style consistency heatmap for the past year.
 *
 * One row per weekday (Mon–Sun, matching the tracker's week boundary), one column per
 * week, shaded by how many habits were completed that day — read straight from the
 * analytics endpoint's `dailyCounts`, so every square is a real recorded day.
 *
 * The tooltip is positioned from bounding rects rather than nested inside the scrollable
 * grid, so it is not clipped by horizontal scrolling on narrow screens.
 */
const HabitHeatmap = ({ dailyCounts = {}, todayKey, isLoading }) => {
    const cardRef = useRef(null)
    const [tip, setTip] = useState(null)

    const columns = useMemo(() => {
        const currentMonday = startOfWeekKey(todayKey)
        const list = []

        for (let week = WEEK_COLUMNS - 1; week >= 0; week -= 1) {
            list.push(weekDayKeys(addLocalDaysKey(currentMonday, -week * 7)))
        }

        return list
    }, [todayKey])

    const flatDays = useMemo(() => columns.flat(), [columns])

    const busiestDay = useMemo(() => {
        let best = null

        for (const [key, count] of Object.entries(dailyCounts)) {
            if (!best || count > best.count) best = { key, count }
        }

        return best
    }, [dailyCounts])

    const showTip = (event, key, count) => {
        const card = cardRef.current
        if (!card) return

        const cardRect = card.getBoundingClientRect()
        const cellRect = event.currentTarget.getBoundingClientRect()

        setTip({
            x: cellRect.left - cardRect.left + cellRect.width / 2,
            y: cellRect.top - cardRect.top,
            text: `${formatLongDate(key)} · ${count} habit${count === 1 ? '' : 's'} completed`,
        })
    }

    const hideTip = () => setTip(null)

    // Month label above the first column whose Monday falls in a new month.
    const monthLabels = useMemo(
        () =>
            columns.map((days, index) => {
                const date = new Date(`${days[0]}T12:00:00`)
                const previous = index > 0 ? new Date(`${columns[index - 1][0]}T12:00:00`) : null

                if (Number.isNaN(date.getTime())) return ''
                if (!previous || Number.isNaN(previous.getTime())) return MONTHS[date.getMonth()]
                if (date.getMonth() === previous.getMonth()) return ''

                return MONTHS[date.getMonth()]
            }),
        [columns]
    )

    return (
        <section
            ref={cardRef}
            aria-label="Consistency heatmap"
            className="relative rounded-card border border-border bg-surface px-4 py-3.5"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-semibold text-content">Consistency</h2>
                    <p className="text-[11px] text-content-subtle">Habit completions, past year</p>
                </div>

                {busiestDay && (
                    <span className="rounded-pill border border-primary-border bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Best day: {formatLongDate(busiestDay.key)} ({busiestDay.count})
                    </span>
                )}
            </div>

            {isLoading ? (
                <p className="py-8 text-center text-xs text-content-subtle">Loading history…</p>
            ) : (
                <div className="mt-3 overflow-x-auto pb-1">
                    <div className="inline-flex min-w-max gap-3">
                        {/* Weekday labels */}
                        <div className="grid grid-rows-7 gap-[2px] pt-[14px] text-[9px] leading-[10px] text-content-subtle">
                            <span>Mon</span>
                            <span aria-hidden="true" />
                            <span>Wed</span>
                            <span aria-hidden="true" />
                            <span>Fri</span>
                            <span aria-hidden="true" />
                            <span aria-hidden="true" />
                        </div>

                        <div>
                            {/* Month labels */}
                            <div className="mb-1 flex gap-[2px] text-[9px] leading-[10px] text-content-subtle">
                                {monthLabels.map((label, index) => (
                                    <span key={index} className="w-[10px] shrink-0">
                                        {label}
                                    </span>
                                ))}
                            </div>

                            {/* Cells: 53 columns × 7 rows, flowed column-wise */}
                            <div className="grid grid-flow-col grid-rows-7 gap-[2px]">
                                {flatDays.map((key) => {
                                    const count = dailyCounts[key] ?? 0
                                    const level = levelFor(count)
                                    const isToday = key === todayKey

                                    return (
                                        <span
                                            key={key}
                                            role="img"
                                            aria-label={`${formatLongDate(key)}: ${count} completed`}
                                            onMouseEnter={(event) => showTip(event, key, count)}
                                            onMouseLeave={hideTip}
                                            className={`h-[10px] w-[10px] rounded-[2px] transition-colors duration-100 ${
                                                CELL_CLASSES[level]
                                            } ${isToday ? 'ring-1 ring-primary ring-offset-1 ring-offset-surface' : ''} ${
                                                level > 0 ? 'hover:opacity-75' : ''
                                            }`}
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="mt-3 flex items-center gap-2 text-[10px] text-content-subtle">
                <span>Less</span>
                {CELL_CLASSES.map((className, index) => (
                    <span
                        key={index}
                        aria-hidden="true"
                        className={`h-[10px] w-[10px] rounded-[2px] ${className}`}
                    />
                ))}
                <span>More</span>

                <span className="ml-auto inline-flex items-center gap-1.5">
                    <span
                        aria-hidden="true"
                        className="h-[10px] w-[10px] rounded-[2px] bg-surface-overlay ring-1 ring-primary ring-offset-1 ring-offset-surface"
                    />
                    Today
                </span>
            </div>

            {/* Hover tooltip */}
            {tip && (
                <div
                    role="status"
                    className="pointer-events-none absolute z-20 -translate-y-full -translate-x-1/2 whitespace-nowrap rounded-control border border-border bg-surface-overlay px-2 py-1 text-[10px] font-medium text-content shadow-lg shadow-black/40"
                    style={{ left: tip.x, top: tip.y - 6 }}
                >
                    {tip.text}
                </div>
            )}
        </section>
    )
}

export default HabitHeatmap
