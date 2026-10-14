import { Link } from 'react-router-dom'
import { Lightbulb, ArrowRight } from 'lucide-react'

/*
 * Computed productivity insight — the narrative half of the weekly chart.
 *
 * The page passes the weekday with the most completions (and that day's count); with
 * no completions yet the card degrades to an honest prompt instead of inventing a
 * pattern. Orange-tinted surface per the reference layout.
 */
const ProductivityInsight = ({ bestDay, bestDayCount }) => {
    const hasData = bestDay !== null && bestDayCount > 0

    return (
        <section
            aria-label="Productivity insight"
            className="rounded-card border border-primary-border bg-primary-soft px-4 py-3.5"
        >
            <div className="flex items-start gap-2.5">
                <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-primary text-primary-contrast"
                >
                    <Lightbulb className="h-3.5 w-3.5" strokeWidth={2} />
                </span>

                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-content">
                        {hasData
                            ? `You\u2019re most productive on ${bestDay}!`
                            : 'Start a streak to unlock insights'}
                    </h2>

                    <p className="mt-1 text-xs leading-relaxed text-content-muted">
                        {hasData
                            ? `You completed ${bestDayCount} task${bestDayCount === 1 ? '' : 's'} on ${bestDay}s. Consider blocking that day for deep work.`
                            : 'Complete a few tasks this week and the dashboard will surface the day you work best.'}
                    </p>

                    <Link
                        to="/planner"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary transition hover:underline"
                    >
                        View detailed analytics
                        <ArrowRight className="h-3 w-3" strokeWidth={2} />
                    </Link>
                </div>
            </div>
        </section>
    )
}

export default ProductivityInsight
