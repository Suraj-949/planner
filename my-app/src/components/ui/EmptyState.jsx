import Button from './Button'

/*
 * The empty state, with the action that ends it.
 *
 * Separate from an error state on purpose. "You have nothing yet" and "we could not load
 * your anything" look identical on screen and need opposite treatment: the first offers to
 * create something, the second explains that what is on screen is not real.
 */
const EmptyState = ({ title, body, actionLabel, onAction, icon: Icon, children }) => {
    return (
        <div className="rounded-card border border-dashed border-border-strong bg-surface px-4 py-12 text-center">
            {Icon && (
                <Icon className="mx-auto h-6 w-6 text-content-subtle" strokeWidth={1.6} />
            )}

            <p className="mt-2 text-sm font-medium text-content">{title}</p>

            {body && <p className="mx-auto mt-1 max-w-sm text-sm text-content-subtle">{body}</p>}

            {children}

            {actionLabel && onAction && (
                <div className="mt-4">
                    <Button variant="primary" size="sm" onClick={onAction}>
                        {actionLabel}
                    </Button>
                </div>
            )}
        </div>
    )
}

export default EmptyState
