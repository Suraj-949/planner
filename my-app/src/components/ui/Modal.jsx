import { useEffect, useRef } from 'react'

// Modal primitive. Used by the task form and the delete confirmation.
//
// Deliberately not portalled: the app already renders a fixed overlay for the mobile
// navigation drawer, and a second React root would need its own focus management and
// Escape handling for no gain at this size.

const PANEL =
    'w-full max-w-md rounded-card border border-border bg-surface shadow-2xl shadow-black/40'

// Anything the browser will let the user tab to.
const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const Modal = ({ open, onClose, labelledBy, children, width = 'md', initialFocus = 'first' }) => {
    const panelRef = useRef(null)

    useEffect(() => {
        if (!open) return

        const targets = panelRef.current?.querySelectorAll(FOCUSABLE)
        const target = initialFocus === 'last' ? targets?.[targets.length - 1] : targets?.[0]

        // Focused on open rather than left on the trigger behind the backdrop, so the next
        // Tab starts inside the dialog instead of walking the page underneath it.
        target?.focus()
    }, [open, initialFocus])

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
            onMouseDown={(event) => {
                // Only the backdrop itself, so a mousedown inside the panel that ends in a
                // click outside does not close it.
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                className={`${PANEL} ${width === 'lg' ? 'max-w-xl' : ''}`}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') onClose()
                }}
            >
                {children}
            </div>
        </div>
    )
}

export default Modal
export { PANEL }
