import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellOff, AlertTriangle, Clock } from 'lucide-react'

const TONES = {
    danger: 'bg-danger',
    primary: 'bg-primary',
}

/*
 * Notification dropdown built from live task state, not a mock feed.
 *
 * The page passes overdue and due-today items derived from the same list the dashboard
 * already renders, so the bell's count can never disagree with what the tasks card
 * shows. Clicking an item deep-links to the task.
 */
const NotificationPanel = ({ items = [] }) => {
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const rootRef = useRef(null)

    useEffect(() => {
        if (!open) return

        const onPointerDown = (event) => {
            // Closes when the click lands outside the panel — a click on the bell itself
            // is handled by the button's own toggle.
            if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
        }

        const onKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false)
        }

        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)

        return () => {
            document.removeEventListener('mousedown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-label={`Notifications${items.length ? `, ${items.length} unread` : ''}`}
                aria-expanded={open}
                className="relative rounded-control border border-border bg-surface p-1.5 text-content-muted transition hover:border-border-strong hover:text-content"
            >
                <Bell className="h-3.5 w-3.5" strokeWidth={1.8} />

                {items.length > 0 && (
                    <span
                        aria-hidden="true"
                        className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold tabular-nums text-primary-contrast"
                    >
                        {items.length}
                    </span>
                )}
            </button>

            {open && (
                <div
                    role="menu"
                    aria-label="Notifications"
                    className="absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-card border border-border bg-surface shadow-2xl shadow-black/50"
                >
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                        <span className="text-xs font-semibold text-content">Notifications</span>
                        <span className="text-[10px] tabular-nums text-content-subtle">
                            {items.length} new
                        </span>
                    </div>

                    {items.length === 0 ? (
                        <div className="px-3 py-6 text-center">
                            <BellOff
                                className="mx-auto h-4 w-4 text-content-subtle"
                                strokeWidth={1.8}
                            />
                            <p className="mt-2 text-xs text-content-subtle">
                                All caught up — nothing overdue or due today.
                            </p>
                        </div>
                    ) : (
                        <ul className="max-h-72 overflow-y-auto">
                            {items.map((item) => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            setOpen(false)
                                            navigate(item.to)
                                        }}
                                        className="flex w-full items-start gap-2.5 border-b border-border px-3 py-2.5 text-left transition last:border-b-0 hover:bg-surface-raised"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                                                TONES[item.tone] ?? TONES.primary
                                            }`}
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-xs font-medium text-content">
                                                {item.title}
                                            </span>
                                            <span className="mt-0.5 flex items-center gap-1 text-[10px] text-content-subtle">
                                                {item.tone === 'danger' ? (
                                                    <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2} />
                                                ) : (
                                                    <Clock className="h-2.5 w-2.5" strokeWidth={2} />
                                                )}
                                                {item.body}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}

export default NotificationPanel
