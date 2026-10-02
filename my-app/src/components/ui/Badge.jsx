// Colour variants resolve to the theme tokens declared in src/index.css.
// No raw hex values, and no Tailwind palette classes — retheming happens in one file.

const VARIANT_CLASSES = {
    primary: 'bg-primary-soft text-primary',
    secondary: 'bg-secondary-soft text-secondary',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-surface-overlay text-content-muted',

    // Priority badges: warm, muted and dark respectively — deliberately quieter
    // than the accent fill so HIGH doesn't compete with the primary buttons.
    high: 'bg-high-soft text-high-text',
    medium: 'bg-medium-soft text-medium-text',
    low: 'bg-low-soft text-low-text',
}

const Badge = ({ variant = 'neutral', children, className = '', square = false }) => {
    return (
        <span
            className={`inline-flex shrink-0 items-center font-semibold uppercase tracking-wide ${
                square ? 'rounded-control px-2 py-0.5 text-[10px]' : 'rounded-pill px-2.5 py-0.5 text-xs'
            } ${VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.neutral} ${className}`}
        >
            {children}
        </span>
    )
}

export default Badge
export { VARIANT_CLASSES }
