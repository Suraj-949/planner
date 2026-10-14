import { useMemo } from 'react'
import Modal from '../ui/Modal'
import Badge from '../ui/Badge'
import { HABIT_CADENCE_LABELS } from '../../constants/habitMeta'
import { MONTHS, addLocalDaysKey, startOfWeekKey, weekDayKeys, formatDateKey } from '../../utils/dates'
import { Flame, TrendingUp, Target, CalendarCheck, X } from 'lucide-react'

const CHART_WEEKS = 12

const StatTile = ({ icon: Icon, label, value, accent = 'neutral' }) => {
    const accents = {
        primary: 'bg-primary-soft text-primary',
        secondary: 'bg-secondary-soft text-secondary',
        neutral: 'bg-surface-overlay text-content-muted',
    }

    return (
        <div className="rounded-control border border-border bg-surface-raised px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-content-subtle">
                <Icon className={`h-3 w-3 ${accents[accent].split(' ')[1]}`} strokeWidth={2} />
                {label}
            </span>
            <p className="mt-1 text-lg font-bold tabular-nums text-content">{value}</p>
        </div>
    )
}

/*
 * Expanded habit detail: the summary numbers the list already carries, plus a completion
 * chart computed from the same analytics day keys the tracker and heatmap use.
 *
 * Twelve weeks of buckets, Mon→Sun, matching the tracker's boundary; the current week is
 * drawn in the orange accent so "where am I now" reads at a glance. No extra request —
 * the page hands in what it already fetched.
 */
const HabitDetailModal = ({ open, habit, dayKeys = [], onClose }) => {
    const chart = useMemo(() => {
        if (!habit) return []

        const counts = new Set(dayKeys)
        const currentMonday = startOfWeekKey(formatDateKey(new Date()))
        const buckets = []

        for (let week = CHART_WEEKS - 1; week >= 0; week -= 1) {
            const start = addLocalDaysKey(currentMonday, -week * 7)
            const days = weekDayKeys(start)
            const count = days.filter((key) => counts.has(key)).length

            buckets.push({
                key: start,
                count,
                isCurrent: week === 0,
                label: String(new Date(`${start}T12:00:00`).getMonth() + 1).padStart(2, '0'),
            })
        }

        return buckets
    }, [habit, dayKeys])

    const peak = Math.max(1, ...chart.map((bucket) => bucket.count))

    const recent = useMemo(
        () => [...dayKeys].sort((a, b) => b.localeCompare(a)).slice(0, 14),
        [dayKeys]
    )

    if (!habit) return null

    return (
        <Modal open={open} onClose={onClose} labelledBy="habit-detail-title" width="lg">
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                    <h2 id="habit-detail-title" className="truncate text-sm font-semibold text-content">
                        {habit.title}
                    </h2>
                    <span className="mt-1 inline-flex items-center gap-1.5">
                        <Badge variant="neutral" square>
                            {HABIT_CADENCE_LABELS[habit.cadence] ?? habit.cadence}
                        </Badge>
                        <Badge variant="primary" square>
                            target {habit.targetPerPeriod}
                        </Badge>
                    </span>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close habit details"
                    className="rounded-control p-1 text-content-subtle transition hover:bg-surface-overlay hover:text-content"
                >
                    <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
            </div>

            <div className="space-y-4 px-4 py-4">
                {/* Summary stats */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <StatTile
                        icon={Flame}
                        label="Current streak"
                        value={`${habit.currentStreak}d`}
                        accent="primary"
                    />
                    <StatTile
                        icon={TrendingUp}
                        label="Longest streak"
                        value={`${habit.longestStreak}d`}
                        accent="secondary"
                    />
                    <StatTile
                        icon={Target}
                        label="Completion rate"
                        value={`${habit.completionRate}%`}
                    />
                    <StatTile
                        icon={CalendarCheck}
                        label="Total done"
                        value={habit.completedCount ?? dayKeys.length}
                    />
                </div>

                {/* Weekly completion chart */}
                <div>
                    <h3 className="label-xs text-content-subtle">Last {CHART_WEEKS} weeks</h3>

                    <div className="mt-2 flex h-24 items-end gap-1.5">
                        {chart.map((bucket) => {
                            const height = bucket.count === 0 ? 2 : Math.max(8, (bucket.count / peak) * 100)

                            return (
                                <div
                                    key={bucket.key}
                                    className="flex flex-1 flex-col items-center gap-1"
                                    title={`Week of ${bucket.key}: ${bucket.count} completed`}
                                >
                                    <span className="text-[9px] tabular-nums text-content-subtle">
                                        {bucket.count || ''}
                                    </span>
                                    <div
                                        className={`w-full rounded-[3px] transition-[height] duration-300 ${
                                            bucket.isCurrent
                                                ? 'bg-primary'
                                                : bucket.count > 0
                                                  ? 'bg-secondary'
                                                  : 'bg-surface-overlay'
                                        }`}
                                        style={{ height: `${height}%` }}
                                    />
                                </div>
                            )
                        })}
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[9px] text-content-subtle">
                        <span>{chart[0] ? formatWeekLabel(chart[0].key) : ''}</span>
                        <span className="inline-flex items-center gap-1">
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-sm bg-primary" />
                            This week
                        </span>
                    </div>
                </div>

                {/* Recent completions */}
                <div>
                    <h3 className="label-xs text-content-subtle">Recent completions</h3>

                    {recent.length === 0 ? (
                        <p className="mt-2 text-xs text-content-subtle">
                            Nothing recorded yet — tick a day to start the history.
                        </p>
                    ) : (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {recent.map((key) => (
                                <span
                                    key={key}
                                    className="rounded-pill bg-secondary-soft px-2 py-0.5 text-[10px] font-semibold tabular-nums text-secondary"
                                >
                                    {formatShortDate(key)}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    )
}

const formatShortDate = (key) => {
    const date = new Date(`${key}T12:00:00`)

    if (Number.isNaN(date.getTime())) return key

    return `${MONTHS[date.getMonth()]} ${date.getDate()}`
}

const formatWeekLabel = (key) => {
    const date = new Date(`${key}T12:00:00`)

    if (Number.isNaN(date.getTime())) return ''

    return `${MONTHS[date.getMonth()]} ${date.getDate()}`
}

export default HabitDetailModal
