import { useEffect, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'

const FOCUS_TIME = 25 * 60
const BREAK_TIME = 5 * 60

const DURATIONS = { focus: FOCUS_TIME, break: BREAK_TIME }

// isRunning is stored as a JSON boolean in one place only. Previously handleReset wrote
// the bare string "false" while handleStartPause wrote JSON.stringify(false), so a
// refresh after a reset produced a different value than the running state implied.
const readIsRunning = () => localStorage.getItem('isRunning') === 'true'

const writeIsRunning = (value) => localStorage.setItem('isRunning', JSON.stringify(Boolean(value)))

/*
 * Restore-on-mount used to run in an effect and setState three times, which React's
 * compiler lint flags as a cascading render — and which also meant the first painted
 * frame showed a stale time before the correction landed.
 *
 * Resolving the whole initial state up front in a lazy initialiser is equivalent for a
 * component that only ever mounts once, and removes the flash.
 */
const readInitialSession = () => {
    const mode = localStorage.getItem('mode') === 'break' ? 'break' : 'focus'
    const storedTime = Number(localStorage.getItem('timeLeft'))
    const storedEndTime = Number(localStorage.getItem('endTime'))

    // A stored 0 is a real value, so an explicit null check — not `||` — is required
    // here. `|| focusTime` silently treated 0 as "never started".
    let timeLeft = Number.isFinite(storedTime) && storedTime > 0 ? storedTime : DURATIONS[mode]

    let isRunning = readIsRunning()

    if (storedEndTime) {
        const remaining = Math.floor((storedEndTime - Date.now()) / 1000)

        if (remaining > 0) {
            // Still counting — resume rather than restarting.
            timeLeft = remaining
            isRunning = true
        } else {
            // Timer finished while the page was closed. Advance one mode and stop
            // rather than silently starting a session the user never saw begin.
            const nextMode = mode === 'focus' ? 'break' : 'focus'

            localStorage.setItem('mode', nextMode)
            localStorage.setItem('timeLeft', String(DURATIONS[nextMode]))
            localStorage.removeItem('endTime')

            return { timeLeft: DURATIONS[nextMode], isRunning: false, mode: nextMode }
        }
    }

    writeIsRunning(isRunning)

    return { timeLeft, isRunning, mode }
}

const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60

    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

/*
 * The Pomodoro timer, as a page inside the shell rather than as a full-screen detour.
 *
 * It used to own the entire viewport, with its own heading, its own "Tasks" button and its
 * own logout — a second app inside the app. Inside the shell it inherits the sidebar, the
 * heading and the same logout as every other page, so the timer is a view and not a place
 * you have to find your way back from.
 */
const FocusPage = () => {
    const navigate = useNavigate()
    const { logout } = useAuth()

    const [session, setSession] = useState(readInitialSession)
    const { timeLeft, isRunning, mode } = session

    // Timer logic
    useEffect(() => {
        if (!isRunning) return

        const timer = setInterval(() => {
            setSession((current) => {
                if (current.timeLeft > 1) {
                    const next = current.timeLeft - 1

                    // Persist every tick so a reload mid-session resumes correctly.
                    localStorage.setItem('timeLeft', String(next))

                    return { ...current, timeLeft: next }
                }

                // One state transition carries the rollover, rather than nesting
                // setMode/setIsRunning inside a setTimeLeft updater.
                const nextMode = current.mode === 'focus' ? 'break' : 'focus'

                localStorage.setItem('mode', nextMode)
                localStorage.setItem('timeLeft', String(DURATIONS[nextMode]))
                writeIsRunning(false)
                localStorage.removeItem('endTime')

                return {
                    ...current,
                    mode: nextMode,
                    timeLeft: DURATIONS[nextMode],
                    isRunning: false,
                }
            })
        }, 1000)

        // Cleared when the effect re-runs or the component unmounts.
        return () => clearInterval(timer)
    }, [isRunning])

    const handleStartPause = () => {
        const willRun = !isRunning

        if (willRun) {
            // Absolute epoch, so elapsed time while the tab was closed still counts.
            localStorage.setItem('endTime', String(Date.now() + timeLeft * 1000))
        } else {
            localStorage.removeItem('endTime')
        }

        setSession((current) => ({ ...current, isRunning: willRun }))
        writeIsRunning(willRun)
    }

    const handleReset = () => {
        setSession((current) => ({ ...current, isRunning: false, timeLeft: DURATIONS[mode] }))

        localStorage.removeItem('endTime')
        writeIsRunning(false)
        localStorage.setItem('timeLeft', String(DURATIONS[mode]))
    }

    const switchMode = (newMode) => {
        setSession({ mode: newMode, timeLeft: DURATIONS[newMode], isRunning: false })

        localStorage.removeItem('endTime')
        localStorage.setItem('mode', newMode)
        writeIsRunning(false)
        localStorage.setItem('timeLeft', String(DURATIONS[newMode]))
    }

    // Delegates to the provider so the refresh cookie is cleared server-side too.
    const handleLogout = async () => {
        await logout()
        navigate('/')
    }

    const modeButtonClass = (target) =>
        `rounded-control border px-4 py-2.5 text-sm font-semibold transition ${
            mode === target
                ? 'border-primary bg-primary text-primary-contrast'
                : 'border-border-strong bg-surface-raised text-content-muted hover:border-border-focus hover:text-content'
        }`

    // Progress within the current mode, for the ring. Falls back to a full ring when the
    // duration is unknown rather than dividing by zero.
    const total = DURATIONS[mode] || 1
    const progress = Math.max(0, Math.min(1, (total - timeLeft) / total))

    return (
        <AppShell>
            <div className="mx-auto max-w-xl">
                <section className="rounded-card border border-border bg-surface px-6 py-8 text-center shadow-card">
                    <div className="my-4 flex justify-center gap-3">
                        <button type="button" onClick={() => switchMode('focus')} className={modeButtonClass('focus')}>
                            Focus
                        </button>
                        <button type="button" onClick={() => switchMode('break')} className={modeButtonClass('break')}>
                            Break
                        </button>
                    </div>

                    {/* Timer */}
                    <div
                        role="timer"
                        aria-live="off"
                        className={`my-8 text-7xl font-bold tabular-nums tracking-tight ${
                            isRunning ? 'text-primary' : 'text-content'
                        }`}
                    >
                        {formatTime(timeLeft)}
                    </div>

                    {/* Progress within the current session */}
                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress * 100)}
                        aria-label="Session progress"
                        className="mx-auto h-1.5 w-full max-w-xs overflow-hidden rounded-pill bg-surface-overlay"
                    >
                        <div
                            className="h-full rounded-pill bg-primary transition-[width] duration-500"
                            style={{ width: `${progress * 100}%` }}
                        />
                    </div>

                    {/* Controls */}
                    <div className="my-8 flex justify-center gap-3">
                        <Button variant="primary" size="md" onClick={handleStartPause} className="px-8">
                            {isRunning ? 'Pause' : 'Start'}
                        </Button>
                        <Button variant="danger" size="md" onClick={handleReset} className="px-8">
                            Reset
                        </Button>
                    </div>

                    <p className="text-sm text-content-muted">
                        Current mode:{' '}
                        <span className="font-semibold capitalize text-content">{mode}</span>
                    </p>
                </section>

                <p className="mt-3 text-center text-[11px] text-content-subtle">
                    The timer survives a reload — the session is restored from an absolute end time, so
                    closing the tab does not pause it.
                </p>
            </div>

            {/* The shell has no logout control of its own, so the one place the old timer
                screen offered it is kept here rather than dropped silently. */}
            <div className="mt-4 flex justify-center">
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Log out
                </Button>
            </div>
        </AppShell>
    )
}

export default FocusPage
