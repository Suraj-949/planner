import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

const FOCUS_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

const DURATIONS = { focus: FOCUS_TIME, break: BREAK_TIME };

// isRunning is stored as a JSON boolean in one place only. Previously handleReset wrote
// the bare string "false" while handleStartPause wrote JSON.stringify(false), so a
// refresh after a reset produced a different value than the running state implied.
const readIsRunning = () => localStorage.getItem("isRunning") === "true";

const writeIsRunning = (value) =>
    localStorage.setItem("isRunning", JSON.stringify(Boolean(value)));

/*
 * Restore-on-mount used to run in an effect and setState three times, which React's
 * compiler lint flags as a cascading render â€” and which also meant the first painted
 * frame showed a stale time before the correction landed.
 *
 * Resolving the whole initial state up front in a lazy initialiser is equivalent for a
 * component that only ever mounts once, and removes the flash.
 */
const readInitialSession = () => {
    let mode = localStorage.getItem("mode") === "break" ? "break" : "focus";
    const storedTime = Number(localStorage.getItem("timeLeft"));
    const storedEndTime = Number(localStorage.getItem("endTime"));

    // A stored 0 is a real value, so an explicit null check â€” not `||` â€” is required
    // here. `|| focusTime` silently treated 0 as "never started".
    let timeLeft =
        Number.isFinite(storedTime) && storedTime > 0 ? storedTime : DURATIONS[mode];

    let isRunning = readIsRunning();

    if (storedEndTime) {
        const remaining = Math.floor((storedEndTime - Date.now()) / 1000);

        if (remaining > 0) {
            // Still counting â€” resume rather than restarting.
            timeLeft = remaining;
            isRunning = true;
        } else {
            // Timer finished while the page was closed. Advance one mode and stop
            // rather than silently starting a session the user never saw begin.
            mode = mode === "focus" ? "break" : "focus";
            timeLeft = DURATIONS[mode];
            isRunning = false;

            localStorage.setItem("mode", mode);
            localStorage.setItem("timeLeft", String(timeLeft));
            localStorage.removeItem("endTime");
        }
    }

    writeIsRunning(isRunning);

    return { timeLeft, isRunning, mode };
};

const PomodoroTimer = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();

    const [session, setSession] = useState(readInitialSession);

    const { timeLeft, isRunning, mode } = session;

    const setTimeLeft = (value) =>
        setSession((current) => ({
            ...current,
            timeLeft: typeof value === "function" ? value(current.timeLeft) : value,
        }));

    const setIsRunning = (value) =>
        setSession((current) => ({
            ...current,
            isRunning: typeof value === "function" ? value(current.isRunning) : value,
        }));

    const setMode = (value) =>
        setSession((current) => ({
            ...current,
            mode: typeof value === "function" ? value(current.mode) : value,
        }));

    // Timer logic
    useEffect(() => {
        if (!isRunning) return;

        const timer = setInterval(() => {
            setSession((current) => {
                if (current.timeLeft > 1) {
                    const next = current.timeLeft - 1;

                    // Persist every tick so a reload mid-session resumes correctly.
                    localStorage.setItem("timeLeft", String(next));

                    return { ...current, timeLeft: next };
                }

                // One state transition carries the rollover, rather than nesting
                // setMode/setIsRunning inside a setTimeLeft updater.
                const nextMode = current.mode === "focus" ? "break" : "focus";

                localStorage.setItem("mode", nextMode);
                localStorage.setItem("timeLeft", String(DURATIONS[nextMode]));
                writeIsRunning(false);
                localStorage.removeItem("endTime");

                return {
                    ...current,
                    mode: nextMode,
                    timeLeft: DURATIONS[nextMode],
                    isRunning: false,
                };
            });
        }, 1000);

        // Cleared when the effect re-runs or the component unmounts.
        return () => clearInterval(timer);
    }, [isRunning]);

    // Convert seconds â†’ mm:ss
    const formatTime = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;

        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };

    // Start / Pause
    const handleStartPause = () => {
        const willRun = !isRunning;

        if (willRun) {
            // Absolute epoch, so elapsed time while the tab was closed still counts.
            localStorage.setItem("endTime", String(Date.now() + timeLeft * 1000));
        } else {
            localStorage.removeItem("endTime");
        }

        setIsRunning(willRun);
        writeIsRunning(willRun);
    };

    const handleReset = () => {
        setIsRunning(false);
        setTimeLeft(DURATIONS[mode]);

        localStorage.removeItem("endTime");
        writeIsRunning(false);
        localStorage.setItem("timeLeft", String(DURATIONS[mode]));
    };

    // Switch mode
    const switchMode = (newMode) => {
        setIsRunning(false);
        setMode(newMode);
        setTimeLeft(DURATIONS[newMode]);

        localStorage.removeItem("endTime");
        localStorage.setItem("mode", newMode);
        writeIsRunning(false);
        localStorage.setItem("timeLeft", String(DURATIONS[newMode]));
    };

    // Delegates to the provider so the refresh cookie is cleared server-side too.
    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const modeButtonClass = (target) =>
        `rounded-control border px-4 py-3 font-semibold transition ${
            mode === target
                ? 'border-primary bg-primary text-primary-contrast'
                : 'border-border-strong bg-surface-raised text-content-muted hover:border-border-focus hover:text-content'
        }`;

    return (
        <main className="min-h-screen bg-background px-6 py-8">
            <section className="mx-auto max-w-8xl">

                <div className="mb-8">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">
                                Pomodoro Timer
                            </p>
                            <h1 className="mt-2 text-4xl font-semibold text-content">
                                Manage your time
                            </h1>
                        </div>

                        <div className="flex flex-row gap-3">
                            <button
                                type="button"
                                onClick={()=>{navigate("/tasks")}}
                                className="rounded-control border border-border-strong px-4 py-2 text-sm font-semibold text-content-muted transition hover:border-primary hover:text-primary"
                            >
                                Tasks
                            </button>

                            <button
                                type="button"
                                onClick={handleLogout}
                                className="rounded-control border border-border-strong px-4 py-2 text-sm font-semibold text-content-muted transition hover:border-danger hover:text-danger"
                            >
                                Logout
                            </button>
                        </div>
                    </div>

                    <p className="mt-3 max-w-2xl text-content-muted">
                        Stay focused, manage your time efficiently, and get more done with our Pomodoro timer. Break your work into productive sessions, track your focus time, and build better study and work habits every day.
                    </p>
                </div>

                <div className="mx-auto max-w-xl rounded-3xl border border-border bg-surface p-10 text-center shadow-card">
                    {/* Mode Buttons */}
                    <div className="my-10 flex justify-center gap-4">
                        <button
                            type="button"
                            onClick={() => switchMode("focus")}
                            className={modeButtonClass("focus")}
                        >
                            Focus
                        </button>

                        <button
                            type="button"
                            onClick={() => switchMode("break")}
                            className={modeButtonClass("break")}
                        >
                            Break
                        </button>
                    </div>

                    {/* Timer */}
                    <div
                        className={`mb-10 text-8xl font-bold tabular-nums tracking-tight ${
                            isRunning ? 'text-primary' : 'text-content'
                        }`}
                    >
                        {formatTime()}
                    </div>

                    {/* Controls */}
                    <div className="mb-10 flex justify-center gap-4">
                        <button
                            type="button"
                            onClick={handleStartPause}
                            className="rounded-control bg-primary px-6 py-3 font-semibold text-primary-contrast transition hover:bg-primary-hover"
                        >
                            {isRunning ? "Pause" : "Start"}
                        </button>

                        <button
                            type="button"
                            onClick={handleReset}
                            className="rounded-control bg-danger px-6 py-3 font-semibold text-danger-contrast transition hover:bg-danger-hover"
                        >
                            Reset
                        </button>
                    </div>

                    {/* Current Mode */}
                    <p className="text-content-muted">
                        Current Mode:{" "}
                        <span className="font-semibold capitalize text-content">{mode}</span>
                    </p>
                </div>

            </section>
        </main>
    );
};

export default PomodoroTimer;
