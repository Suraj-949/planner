// A single figure on a dashboard or analytics card.
//
// `value` is rendered as given, so a caller decides whether it is a count, a percentage or
// a duration. The component does not format, because "7" and "1h 30m" mean different
// things and only the page knows which it is showing.

const StatCard = ({ label, value, hint, tone = 'default', icon: Icon }) => {
    const TONES = {
        default: 'text-content',
        primary: 'text-primary',
        danger: 'text-danger',
        secondary: 'text-secondary',
    }

    return (
        <div className="rounded-card border border-border bg-surface px-3.5 py-3">
            <div className="flex items-center gap-2">
                {Icon && <Icon className="h-3.5 w-3.5 text-content-subtle" strokeWidth={1.8} />}
                <p className="label-xs text-content-subtle">{label}</p>
            </div>

            <p className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${TONES[tone] ?? TONES.default}`}>
                {value}
            </p>

            {hint && <p className="mt-0.5 text-xs text-content-subtle">{hint}</p>}
        </div>
    )
}

export default StatCard
