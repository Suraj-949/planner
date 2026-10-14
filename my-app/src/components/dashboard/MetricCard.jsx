/*
 * Compact KPI card — one figure, one label, optional trend and progress.
 *
 * The value is rendered as given: the page decides whether it is a count, a duration or
 * a percentage, because only the page knows which it is showing.
 */

const ACCENTS = {
    primary: 'bg-primary-soft text-primary',
    secondary: 'bg-secondary-soft text-secondary',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-surface-overlay text-content-muted',
}

const BADGE_TONES = {
    secondary: 'bg-secondary-soft text-secondary',
    primary: 'bg-primary-soft text-primary',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-surface-overlay text-content-muted',
}

const MetricCard = ({
    icon: Icon,
    accent = 'neutral',
    value,
    label,
    badge,
    badgeTone = 'secondary',
    hint,
    progress,
}) => {
    const bar = Math.max(0, Math.min(100, Math.round(progress ?? 0)))

    return (
        <div className="rounded-card border border-border bg-surface px-4 py-3.5">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-[11px] font-medium text-content-muted">{label}</p>
                    <p className="mt-1 truncate text-2xl font-bold tabular-nums tracking-tight text-content">
                        {value}
                    </p>
                </div>

                {Icon && (
                    <span
                        aria-hidden="true"
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] ${
                            ACCENTS[accent] ?? ACCENTS.neutral
                        }`}
                    >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                )}
            </div>

            {(badge || hint) && (
                <div className="mt-2 flex min-w-0 items-center gap-1.5">
                    {badge && (
                        <span
                            className={`inline-flex shrink-0 items-center rounded-pill px-1.5 py-px text-[10px] font-bold tabular-nums ${
                                BADGE_TONES[badgeTone] ?? BADGE_TONES.neutral
                            }`}
                        >
                            {badge}
                        </span>
                    )}
                    {hint && (
                        <span className="truncate text-[11px] text-content-subtle">{hint}</span>
                    )}
                </div>
            )}

            {progress !== undefined && (
                <div
                    role="progressbar"
                    aria-valuenow={bar}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${label} progress`}
                    className="mt-2.5 h-1 overflow-hidden rounded-pill bg-surface-overlay"
                >
                    <div
                        className="h-full rounded-pill bg-secondary transition-[width] duration-500"
                        style={{ width: `${bar}%` }}
                    />
                </div>
            )}
        </div>
    )
}

export default MetricCard
