// A dismissible banner. The design system had no toast primitive, and this is the only
// place one is needed, so it stays local rather than becoming a global notification system
// that nothing else uses.

import { X } from 'lucide-react';

const TONES = {
    info: 'border-primary/40 bg-primary-soft text-primary',
    warn: 'border-medium/40 bg-medium-soft text-medium-text',
    danger: 'border-danger/40 bg-danger-soft text-danger',
}

const Notice = ({ tone = 'info', title, children, onDismiss }) => (
    <div
        role="status"
        aria-live="polite"
        className={`flex items-start gap-3 rounded-card border px-3.5 py-3 text-sm ${TONES[tone]}`}
    >
        <div className="min-w-0 flex-1">
            {title && <p className="font-semibold">{title}</p>}
            {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
        </div>

        {onDismiss && (
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss notification"
                className="shrink-0 rounded-control p-1 transition hover:bg-surface-overlay/50"
            >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
        )}
    </div>
)

export default Notice