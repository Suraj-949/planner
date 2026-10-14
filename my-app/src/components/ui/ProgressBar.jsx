import { PROGRESS_TONE } from '../../constants/goalMeta'

/*
 * A derived percentage, shown as a bar.
 *
 * The width is clamped rather than passed through: a progress figure computed from
 * milestones can briefly exceed 100% if a milestone is deleted while another is being
 * ticked, and a bar wider than its track looks like a layout bug rather than a race.
 */
const ProgressBar = ({ percent = 0, label, className = '' }) => {
    const value = Math.max(0, Math.min(100, Math.round(percent ?? 0)))

    return (
        <div className={className}>
            {label && (
                <div className="mb-1 flex items-baseline justify-between">
                    <span className="label-xs text-content-subtle">{label}</span>
                    <span className="text-xs font-semibold tabular-nums text-content">{value}%</span>
                </div>
            )}

            <div
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={label ?? 'Progress'}
                className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-overlay"
            >
                <div
                    className={`h-full rounded-pill transition-[width] duration-300 ${PROGRESS_TONE(value)}`}
                    style={{ width: `${value}%` }}
                />
            </div>
        </div>
    )
}

export default ProgressBar
