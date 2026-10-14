import { ListChecks } from 'lucide-react'
import { ledgerFor } from '../../utils/focusStore'
import { FOCUS_MODES } from '../../hooks/useFocusSession'

/*
 * Session Ledger — the day's finished sessions as chronological records.
 *
 * Every row is a real ledger entry: when the session started and ended, which mode it ran
 * in, what it was anchored to and how many minutes were logged. Nothing here is derived
 * from a count or a target — an empty day shows an empty list, not a projected one.
 * Newest first, because the question this card answers is "what have I just done".
 */
const MODE_LABELS = Object.fromEntries(FOCUS_MODES.map((mode) => [mode.id, mode.label]))

const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const hour = date.getHours()

    return `${String(hour % 12 || 12).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} ${
        hour < 12 ? 'AM' : 'PM'
    }`
}

const SessionLedgerCard = ({ todayKey }) => {
    // Read during render: the ledger is written outside React, and FocusSection
    // re-renders the moment a session is logged (the hook's session count is state), so
    // the list is always current without a memo whose invalidation would be guesswork.
    const entries = ledgerFor(todayKey)

    return (
        <section
            aria-label="Session ledger"
            className="rounded-card border border-border bg-surface-raised"
        >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                    <span
                        aria-hidden="true"
                        className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-primary-soft text-primary"
                    >
                        <ListChecks className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span className="label-xs">Session Ledger</span>
                </div>
                <span className="rounded-pill bg-surface-overlay px-2 py-0.5 text-[10px] font-bold tabular-nums text-content-muted">
                    {entries.length} today
                </span>
            </div>

            {entries.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-content-subtle">
                    No sessions logged today yet.
                </p>
            ) : (
                <ul className="max-h-52 divide-y divide-border overflow-y-auto">
                    {entries.map((entry) => (
                        <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                            <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-content">
                                    {entry.taskTitle}
                                </p>
                                <p className="mt-0.5 text-[11px] text-content-subtle">
                                    {formatTime(entry.startedAt)} – {formatTime(entry.endedAt)}
                                    {' · '}
                                    {MODE_LABELS[entry.mode] ?? entry.mode}
                                </p>
                            </div>
                            <span className="shrink-0 rounded-pill bg-primary-soft px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                                {entry.minutes}m
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}

export default SessionLedgerCard
