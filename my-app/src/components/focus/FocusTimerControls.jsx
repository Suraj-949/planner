import Button from '../ui/Button'
import { CheckCircle2, Pause, Play, Plus, RotateCcw, SkipForward, Sparkles } from 'lucide-react'

/*
 * Session controls: extend, pause/resume, finish, reset, skip.
 *
 * "Finish" is the dark button with the green check — deliberately not another orange fill,
 * so the safe, logging action reads differently from the one that keeps time moving. It
 * is the only button that writes a ledger entry (the timer expiring writes its own), and
 * it stays disabled once a session has already finished so one interval cannot be logged
 * twice. "+5m" only makes sense on a countdown, and "+5m" during a run pushes the stamped
 * end time rather than restarting the clock.
 */
const FocusTimerControls = ({ isRunning, finished, isCountdown, elapsed, onToggle, onFinish, onReset, onSkip, onAddFive }) => (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button
            variant="subtle"
            size="sm"
            onClick={onAddFive}
            disabled={!isCountdown || finished}
            aria-label="Add five minutes"
        >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
            5m
        </Button>

        <Button
            variant="primary"
            size="sm"
            onClick={onToggle}
            className="min-w-40"
        >
            {isRunning ? (
                <>
                    <Pause className="h-3.5 w-3.5" strokeWidth={2.4} />
                    Pause Focus
                </>
            ) : finished ? (
                <>
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
                    Start New
                </>
            ) : elapsed > 0 ? (
                <>
                    <Play className="h-3.5 w-3.5" strokeWidth={2.4} />
                    Resume Focus
                </>
            ) : (
                <>
                    <Play className="h-3.5 w-3.5" strokeWidth={2.4} />
                    Start Focus
                </>
            )}
        </Button>

        <Button
            variant="subtle"
            size="sm"
            onClick={onFinish}
            disabled={finished}
            aria-label="Finish session and log it"
            className="min-w-24"
        >
            <CheckCircle2 className="h-3.5 w-3.5 text-secondary" strokeWidth={2.2} />
            Finish
        </Button>

        <Button variant="ghost" size="sm" onClick={onReset} aria-label="Reset timer" title="Reset">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.9} />
        </Button>

        <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            aria-label="Skip to the next mode"
            title="Skip to next mode"
        >
            <SkipForward className="h-3.5 w-3.5" strokeWidth={1.9} />
        </Button>
    </div>
)

export default FocusTimerControls
