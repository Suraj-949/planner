import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import Badge from '../ui/Badge'

/*
 * Weekly productivity chart.
 *
 * Two series per weekday: focus hours (orange, from the local focus log) and tasks
 * completed (green, from real `completedAt` timestamps). The data arrives already
 * bucketed by the page into Mon–Sun keys — this component renders, it does not compute.
 *
 * recharts tooltips cannot inherit CSS variables from theme tokens automatically, so
 * fills pass through `var(--color-*)` which resolves against the `@theme` block in
 * index.css — still token-driven, no hardcoded hex.
 */

const AXIS_TICK = { fill: 'var(--color-content-subtle)', fontSize: 10 }
const GRID_STROKE = 'var(--color-border)'

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null

    return (
        <div className="rounded-control border border-border bg-surface-overlay px-2.5 py-2 shadow-xl shadow-black/40">
            <p className="text-[10px] font-semibold text-content-muted">{label}</p>
            {payload.map((entry) => (
                <p key={entry.dataKey} className="mt-0.5 text-[11px] tabular-nums text-content">
                    <span
                        aria-hidden="true"
                        className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                        style={{ background: entry.color }}
                    />
                    {entry.dataKey === 'focus'
                        ? `${entry.value}h focus`
                        : `${entry.value} completed`}
                </p>
            ))}
        </div>
    )
}

const WeeklyProductivityChart = ({ week = [] }) => {
    const totalCompleted = week.reduce((sum, day) => sum + day.completed, 0)
    const peak = week.reduce(
        (best, day) => (day.completed > best.completed ? day : best),
        { completed: 0 },
    )
    const optimal = totalCompleted > 0 && peak.completed >= 2

    return (
        <section
            aria-label="Productivity this week"
            className="rounded-card border border-border bg-surface px-4 py-3.5"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                    <h2 className="text-sm font-semibold text-content">
                        Productivity This Week
                    </h2>
                    <span className="text-[10px] text-content-subtle">Mon–Sun</span>
                </div>

                <Badge variant={optimal ? 'secondary' : 'neutral'}>
                    {totalCompleted === 0 ? 'No data' : optimal ? 'Optimal' : 'Building'}
                </Badge>
            </div>

            <div className="mt-3 flex items-center gap-4 text-[10px] text-content-subtle">
                <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-primary" />
                    Focus hours
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-secondary" />
                    Tasks completed
                </span>
            </div>

            <div className="mt-2 h-[168px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={week} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={GRID_STROKE}
                            vertical={false}
                        />
                        <XAxis
                            dataKey="day"
                            tick={AXIS_TICK}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={AXIS_TICK}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'var(--color-surface-overlay)', opacity: 0.5 }}
                            content={<ChartTooltip />}
                        />
                        <Bar
                            dataKey="focus"
                            fill="var(--color-primary)"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={18}
                        />
                        <Bar
                            dataKey="completed"
                            fill="var(--color-secondary)"
                            radius={[3, 3, 0, 0]}
                            maxBarSize={18}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </section>
    )
}

export default WeeklyProductivityChart
