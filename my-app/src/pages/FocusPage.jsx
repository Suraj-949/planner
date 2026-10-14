import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import Button from '../components/ui/Button'
import FocusSection from '../components/focus/FocusSection'
import { useAuth } from '../hooks/useAuth'
import { useTasks } from '../hooks/useTasks'
import { LogOut } from 'lucide-react'

/*
 * The Focus page — now the full Focus Mode console rather than the single Pomodoro card
 * it used to be.
 *
 * The old timer is replaced, not joined: both produce focus sessions, and two timers on
 * one page would compete over the same session log while the user wonders which one is
 * "the" session. The new section is a strict superset of the old page's abilities —
 * three modes instead of focus/break, a session ledger, task anchoring, ambience — and
 * it keeps the one behaviour the old page was deliberate about: a running countdown
 * survives a reload, restored from its absolute end time so closing the tab cannot pause
 * or stretch it. A session that fully expires while the page is closed is reported, not
 * silently logged.
 *
 * The open-task query (nearest deadline first, completed dropped) feeds the section's
 * task picker; the list endpoint matches `status` by equality, so completed work is
 * filtered here rather than costing a second request per status.
 */
const FocusPage = () => {
    const navigate = useNavigate()
    const { logout } = useAuth()

    const focusTasksQuery = useMemo(() => ({ limit: 100, sort: 'deadline' }), [])
    const { data: focusTasksData, isLoading: focusTasksLoading } = useTasks(focusTasksQuery)
    const focusTasks = useMemo(
        () => (focusTasksData?.tasks ?? []).filter((task) => task.status !== 'completed').slice(0, 50),
        [focusTasksData]
    )

    // Delegates to the provider so the refresh cookie is cleared server-side too.
    const handleLogout = async () => {
        await logout()
        navigate('/')
    }

    return (
        <AppShell>
            <FocusSection tasks={focusTasks} tasksLoading={focusTasksLoading} />

            <p className="mt-3 text-center text-[11px] text-content-subtle">
                A running countdown is restored from its absolute end time, so closing the tab does not
                pause it. A session that expires entirely while the page is closed is reported, not logged.
            </p>

            {/* The shell has no logout control of its own, so the one place the old timer
                screen offered it is kept here rather than dropped silently. */}
            <div className="mt-3 flex justify-center">
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Log out
                </Button>
            </div>
        </AppShell>
    )
}

export default FocusPage
