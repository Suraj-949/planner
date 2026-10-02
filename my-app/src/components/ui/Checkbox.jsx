// Theme-aware checkbox. Native inputs are kept for accessibility (keyboard, labels) and only the appearance is replaced.
const Checkbox = ({ checked, onChange, label, className = '', ...rest }) => {
    return (
        <label className={`inline-flex items-center gap-2 ${className}`}>
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="peer sr-only"
                {...rest}
            />
            <span
                aria-hidden="true"
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-100 ${checked
                        ? 'border-secondary bg-secondary text-secondary-contrast'
                        : 'border-border-strong bg-surface-input group-hover:border-content-subtle'
                    } peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-primary`}
            >
                {checked && (
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-none stroke-current stroke-[2]">
                        <path d="M2.5 6.5 4.8 8.8 9.5 3.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </span>
            {label && <span className="text-sm text-content-muted">{label}</span>}
        </label>
    )
}

export default Checkbox
