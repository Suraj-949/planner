import CircularFocusTimer from './CircularFocusTimer'
import FocusTimerControls from './FocusTimerControls'

/*
 * The main focus panel: status line, ring, task anchor, controls and live feedback.
 *
 * The status line is the panel's heartbeat — "Cognitive Flow Active" with a green dot
 * only while the interval is genuinely running, so the words cannot claim a session the
 * timer is not keeping.
 *
 * The task picker lists open tasks only — completed work is not something to aim a new
 * session at — and choosing one changes nothing about the task itself: a focus session is
 * context, not a mutation. The panel also surfaces the hook's feedback line ("+5 minutes",
 * "Session too short to log", mode-completion notices) in an aria-live region so timer
 * actions are announced without stealing focus.
 */
const FocusPanel = ({ session, tasks, tasksLoading }) => (
    <section
        aria-label="Focus timer"
        className="rounded-card border border-border bg-surface-raised px-4 py-5 sm:px-6"
    >
        {/* Panel status: green and pulsing only while a session is genuinely running. */}
        <div className="flex items-center justify-center gap-2">
            <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                    session.isRunning ? 'animate-pulse bg-secondary' : session.finished ? 'bg-secondary' : 'bg-content-subtle'
                }`}
            />
            <span className="label-xs">
                {session.isRunning
                    ? 'Cognitive Flow Active'
                    : session.finished
                        ? 'Session Complete'
                        : 'Standing By'}
            </span>
        </div>

        <CircularFocusTimer
            mode={session.mode}
            seconds={session.seconds}
            elapsed={session.elapsed}
            progress={session.progress}
            isRunning={session.isRunning}
            finished={session.finished}
            task={session.task}
            sessionCount={session.sessionCount}
            cycle={session.cycle}
        />

        {tasksLoading ? (
            <p className="mt-4 text-center text-xs text-content-subtle">Loading open tasks…</p>
        ) : tasks.length > 0 ? (
            <select
                value={session.task?.id ?? ''}
                onChange={(event) => session.selectTask(event.target.value)}
                aria-label="Task to focus on"
                className="mt-4 h-9 w-full rounded-control border border-border bg-surface-input px-2.5 text-sm text-content outline-none transition hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary-soft"
            >
                <option value="">No task selected</option>
                {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                        {task.title}
                    </option>
                ))}
            </select>
        ) : (
            <p className="mt-4 text-center text-xs text-content-subtle">
                No open tasks right now — focus on anything, or create a task to anchor a session.
            </p>
        )}

        <FocusTimerControls
            isRunning={session.isRunning}
            finished={session.finished}
            isCountdown={session.isCountdown}
            elapsed={session.elapsed}
            onToggle={session.toggle}
            onFinish={session.finish}
            onReset={session.reset}
            onSkip={session.skip}
            onAddFive={session.addFiveMinutes}
        />

        <p
            aria-live="polite"
            className="mt-3 min-h-4 text-center text-xs font-medium text-primary"
        >
            {session.feedback ?? ''}
        </p>
    </section>
)

export default FocusPanel
