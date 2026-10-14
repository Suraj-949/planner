import { Activity, Flame, Target } from 'lucide-react'
import { focusStreakDays, peakFocusWindow } from '../../utils/focusStore'

/*
 * Deep Work Pulse — three honest signals about focus patterns.
 *
 * Streak and peak hours are computed from the real session ledger: the streak counts
 * consecutive local days holding at least one session, and the peak is the busiest
 * three-hour window of session starts over the past month. When there is not enough data
 * to name a peak, it says so rather than inventing a window.
 *
 * "Distractions intercepted" is explicitly marked as sample data. The app does not track
 * interruptions yet, and a fabricated figure presented as measured would be exactly the
 * kind of decoration this dashboard was rebuilt to remove — so it carries an asterisk and
 * a plain-language footnote until real tracking exists.
 */
const DeepWorkPulseCard = ({ todayKey }) => {
    // Both figures are computed from the ledger during render — FocusSection re-renders
    // whenever a session logs, so the pulse never lags behind a just-finished timer.
    const streak = focusStreakDays(todayKey)
    const peak = peakFocusWindow(todayKey)

    return (
        <section
            aria-label="Deep work pulse"
            className="rounded-card border border-border bg-surface-raised px-4 py-3.5"
        >
            <div className="flex items-center gap-2">
                <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-primary-soft text-primary"
                >
                    <Activity className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <span className="label-xs">Deep Work Pulse</span>
            </div>

            <dl className="mt-3 divide-y divide-border">
                <div className="flex items-center justify-between py-2">
                    <dt className="flex items-center gap-2 text-xs text-content-muted">
                        <Flame className="h-3.5 w-3.5 text-primary" strokeWidth={1.9} />
                        Focus streak
                    </dt>
                    <dd className="text-sm font-bold tabular-nums text-content">{streak}d</dd>
                </div>

                <div className="flex items-center justify-between py-2">
                    <dt className="flex items-center gap-2 text-xs text-content-muted">
                        <Target className="h-3.5 w-3.5 text-primary" strokeWidth={1.9} />
                        Peak focus hours
                    </dt>
                    <dd className="text-sm font-semibold tabular-nums text-content">
                        {peak ? `${peak.from} – ${peak.to}` : '—'}
                    </dd>
                </div>

                <div className="flex items-center justify-between py-2">
                    <dt className="flex items-center gap-2 text-xs text-content-muted">
                        <Activity className="h-3.5 w-3.5 text-primary" strokeWidth={1.9} />
                        Distractions intercepted<sup className="text-content-subtle">*</sup>
                    </dt>
                    <dd className="text-sm font-bold tabular-nums text-content">
                        3<sup className="text-content-subtle">*</sup>
                    </dd>
                </div>
            </dl>

            <p className="mt-1 text-[10px] leading-relaxed text-content-subtle">
                *Sample figure — distraction tracking isn&rsquo;t wired up yet. Streak and peak hours
                are measured from your logged sessions.
            </p>
        </section>
    )
}

export default DeepWorkPulseCard
