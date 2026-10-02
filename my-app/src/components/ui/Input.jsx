// Text inputs share one visual contract: darker inset surface (#111111 via
// --color-surface-input), 1px border, orange focus ring.

const BASE =
    'w-full rounded-control border border-border bg-surface-input px-3 text-content outline-none transition placeholder:text-content-subtle focus:border-primary focus:ring-2 focus:ring-primary-soft disabled:opacity-50'

const SIZES = {
    sm: 'h-8 text-xs',
    md: 'h-9 text-sm',
}

const Input = ({ size = 'md', className = '', ...rest }) => {
    return <input className={`${BASE} ${SIZES[size] ?? SIZES.md} ${className}`} {...rest} />
}

export default Input
export { BASE }
