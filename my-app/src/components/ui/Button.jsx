// Button primitive. Variants map to theme tokens; sizes are deliberately small and
// consistent (h-8 / h-9) so the dense task rows and the header stay aligned.

const BASE =
    'inline-flex items-center justify-center gap-1.5 rounded-control font-semibold transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50'

const VARIANTS = {
    primary: 'bg-primary text-primary-contrast hover:bg-primary-hover active:bg-primary-active',
    secondary:
        'bg-secondary text-secondary-contrast hover:bg-secondary-hover active:bg-secondary-hover',
    subtle: 'border border-border bg-surface-raised text-content-muted hover:text-content hover:border-border-strong',
    ghost: 'text-content-muted hover:bg-surface-overlay hover:text-content',
    danger: 'bg-danger text-danger-contrast hover:bg-danger-hover',
}

const SIZES = {
    xs: 'h-7 px-2 text-xs',
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-3.5 text-sm',
}

const Button = ({
    variant = 'subtle',
    size = 'sm',
    type = 'button',
    className = '',
    ...rest
}) => {
    return (
        <button
            type={type}
            className={`${BASE} ${VARIANTS[variant] ?? VARIANTS.subtle} ${
                SIZES[size] ?? SIZES.sm
            } ${className}`}
            {...rest}
        />
    )
}

export default Button
export { BASE, VARIANTS, SIZES }
