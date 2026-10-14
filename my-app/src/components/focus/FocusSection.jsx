import { useEffect, useMemo, useRef, useState } from 'react'
import { useFocusSession } from '../../hooks/useFocusSession'
import { formatDateKey } from '../../utils/dates'
import { ambientSupported, setAmbientLevel, startAmbient, stopAmbient } from '../../utils/ambientSound'
import FocusModeHeader from './FocusModeHeader'
import FocusPanel from './FocusPanel'
import TodaysFocusCard from './TodaysFocusCard'
import SessionLedgerCard from './SessionLedgerCard'
import DeepWorkPulseCard from './DeepWorkPulseCard'

/*
 * Focus Mode — the focus page's console: one section that owns the session, the ambience
 * and the three derived cards, replacing the page's old single Pomodoro timer rather than
 * sitting beside it (two timers on one page would fight over the same session log).
 *
 * Reactivity is simpler than it looks: the hook's `sessionCount` is state owned by this
 * section, and every logged session advances it, so a completion re-renders this tree and
 * the cards re-read the shared ledger during that render — the bar, the list and the
 * pulse all move together, with no polling and no second source of truth.
 *
 * Sound and fullscreen are owned here because both are section-lifetime concerns: the
 * ambience is stopped when the section unmounts (a detached component must not keep an
 * audio graph running), and fullscreen targets this section's own element, so entering it
 * does not trap the rest of the app.
 */
const FocusSection = ({ tasks = [], tasksLoading = false }) => {
    const [todayKey] = useState(() => formatDateKey(new Date()))

    const session = useFocusSession({ tasks })

    const [soundOn, setSoundOn] = useState(false)
    const [soundLevel, setSoundLevel] = useState(0.45)
    const [soundError, setSoundError] = useState('')
    const soundSupported = useMemo(() => ambientSupported(), [])

    const rootRef = useRef(null)
    const [isFullscreen, setIsFullscreen] = useState(false)

    useEffect(() => {
        const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
        document.addEventListener('fullscreenchange', handleChange)

        return () => document.removeEventListener('fullscreenchange', handleChange)
    }, [])

    // Leaving the page stops the ambience even if the toggle still reads "on".
    useEffect(() => () => stopAmbient(), [])

    const toggleSound = async () => {
        if (soundOn) {
            stopAmbient()
            setSoundOn(false)
            setSoundError('')
            return
        }

        // The util resolves false when playback is actually unavailable; the toggle and
        // the message follow that result rather than assuming success.
        const started = await startAmbient(soundLevel)
        setSoundOn(started)
        setSoundError(started ? '' : 'Ambient sound could not start in this browser.')
    }

    const changeSoundLevel = (value) => {
        setSoundLevel(value)
        if (soundOn) setAmbientLevel(value)
    }

    const toggleFullscreen = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen?.()
            return
        }

        // Promise-wrapped so a denied request surfaces as a no-op instead of an
        // unhandled rejection.
        Promise.resolve(rootRef.current?.requestFullscreen?.()).catch(() => {})
    }

    return (
        <section
            ref={rootRef}
            aria-label="Focus Mode"
            className="overflow-hidden rounded-card border border-border bg-surface"
        >
            <FocusModeHeader
                modes={session.modes}
                modeId={session.modeId}
                onSelectMode={session.selectMode}
                isRunning={session.isRunning}
                soundSupported={soundSupported}
                soundOn={soundOn}
                soundLevel={soundLevel}
                soundError={soundError}
                onToggleSound={toggleSound}
                onSoundLevelChange={changeSoundLevel}
                isFullscreen={isFullscreen}
                onFullscreen={toggleFullscreen}
            />

            <div className="grid gap-3 p-3 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <FocusPanel session={session} tasks={tasks} tasksLoading={tasksLoading} />
                </div>

                <div className="flex flex-col gap-3">
                    <TodaysFocusCard todayKey={todayKey} />
                    <SessionLedgerCard todayKey={todayKey} />
                    <DeepWorkPulseCard todayKey={todayKey} />
                </div>
            </div>
        </section>
    )
}

export default FocusSection
