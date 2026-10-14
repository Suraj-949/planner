import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import TopBar from './TopBar'
import Sidebar from './Sidebar'
import { titleForPath } from '../../constants/navigation'
import { useStats, useStreak } from '../../hooks/useTasks'

/*
 * The authenticated frame: thin top bar, sidebar, scrollable workspace, status strip.
 *
 * Previously every page re-implemented this block, so adding a ninth page meant a ninth
 * copy of the drawer's open state, the desktop/mobile split and the active-item bookkeeping
 * — and each copy drifted slightly from the others. One shell means a page renders only its
 * own content.
 *
 * The workspace column owns the only scroll region (`overflow-y-auto`) so the top bar and
 * status strip stay pinned while content moves — the reference layout's behaviour.
 *
 * The sidebar's live counts come from the same endpoints the dashboard reads, so the badge
 * and the page it points at can never disagree about how many tasks are open.
 */
const AppShell = ({ children, onCreate, createLabel = 'New Task', search }) => {
    const [navOpen, setNavOpen] = useState(false)
    const location = useLocation()

    const { stats } = useStats()
    const { streak } = useStreak()

    const heading = titleForPath(location.pathname)

    /*
     * Derived from the stats the shell already fetched, rather than a second request per
     * badge. `open` is everything not completed — the number a user means when they ask
     * how much is left.
     */
    const badges = useMemo(() => {
        if (!stats) return {}

        const open = (stats.pending ?? 0) + (stats['in-progress'] ?? 0)

        return {
            tasks: open || undefined,
            habits: streak > 0 ? `${streak}d` : undefined,
        }
    }, [stats, streak])

    return (
        <div className="flex h-screen overflow-hidden bg-background text-content">
            {/* Sidebar runs the full height of the viewport, flush with the top. */}
            <div className="hidden h-full lg:block">
                <Sidebar badges={badges} onSearch={search} />
            </div>

            {navOpen && (
                <div className="fixed inset-0 z-40 flex lg:hidden">
                    <button
                        type="button"
                        aria-label="Close navigation"
                        onClick={() => setNavOpen(false)}
                        className="absolute inset-0 bg-black/60"
                    />
                    <div className="relative z-10">
                        <Sidebar
                            badges={badges}
                            onSearch={search}
                            onClose={() => setNavOpen(false)}
                        />
                    </div>
                </div>
            )}

            {/* Right column: top bar, scrollable main, status strip. */}
            <div className="flex min-w-0 flex-1 flex-col">
                <TopBar
                    title={heading.title}
                    subtitle={heading.subtitle}
                    onOpenNav={() => setNavOpen(true)}
                    onOpenCreate={onCreate}
                    onCreateLabel={createLabel}
                />

                <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
                    {children}
                </main>
            </div>
        </div>
    )
}

export default AppShell
