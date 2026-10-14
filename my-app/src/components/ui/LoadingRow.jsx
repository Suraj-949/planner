import { LoaderCircle } from 'lucide-react'

// Inline loading strip. Small enough to sit above a list that is being refetched, rather
// than replacing it with a full-page spinner and losing the rows the user was reading.
const LoadingRow = ({ label = 'Loading…', className = '' }) => (
    <div
        role="status"
        aria-live="polite"
        className={`flex items-center gap-2 rounded-card border border-border bg-surface px-3.5 py-3 text-sm text-content-muted ${className}`}
    >
        <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} />
        {label}
    </div>
)

export default LoadingRow
