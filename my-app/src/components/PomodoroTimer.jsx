import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../AuthProvider";


const PomodoroTimer = () => {
    const focusTime = 25 * 60;
    const breakTime = 5 * 60;

    const navigate = useNavigate()
    const { setIsAuthenticated } = useContext(AuthContext)

    const [timeLeft, setTimeLeft] = useState(() => {
        return Number(localStorage.getItem("timeLeft")) || focusTime;
    });

    const [isRunning, setIsRunning] = useState(() => {
        return JSON.parse(localStorage.getItem("isRunning")) || false;
    });

    const [mode, setMode] = useState(() => {
        return localStorage.getItem("mode") || "focus";
    });

    // Restore timer data when component loads
    useEffect(() => {
        const savedEndTime = localStorage.getItem("endTime");

        // Check if a timer was previously running
        if (savedEndTime) {
            const remaining = Math.floor(
                (Number(savedEndTime) - Date.now()) / 1000
            );

            // If timer is still active
            if (remaining > 0) {
                setTimeLeft(remaining);
                setIsRunning(true);
            } 
            // Timer finished while page was closed
            else { 
                if (mode === "focus") {
                    setMode("break");
                    setTimeLeft(breakTime);
                } else {
                    setMode("focus");
                    setTimeLeft(focusTime);
                }

                setIsRunning(false);
            }
        }
    }, []);

    // Timer Logic
    useEffect(() => {
        if (!isRunning) return;

        const timer = setInterval(() => {

            // take previous seconds
            setTimeLeft((prev) => {
                // if timer almost finishes, end timer
                if (prev <= 1) {
                    clearInterval(timer);

                    if (mode === "focus") {
                        setMode("break");
                        localStorage.setItem("mode", "break");
                        localStorage.setItem("timeLeft", breakTime);
                        return breakTime;
                    } 
                    else {
                        setMode("focus");
                        localStorage.setItem("mode", "focus");
                        localStorage.setItem("timeLeft", focusTime);
                        return focusTime;
                    }
                }
                // Save updated time in localStorage so timer persists after refresh
                localStorage.setItem("timeLeft", prev - 1);
                
                // Update React state with decreased time
                return prev - 1;
            });
        }, 1000);

        // Effect dobara chale ya component remove ho toh purana timer stop karo
        return () => clearInterval(timer);
    }, [isRunning, mode]);

    // Convert seconds → mm:ss
    const formatTime = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;

        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };

    // Start / Pause
    const handleStartPause = () => {
        // If timer is currently paused
        if (!isRunning) {

            // Start logic
            const endTime = Date.now() + timeLeft * 1000;
            localStorage.setItem("endTime", endTime);
        } 
        else {

            // pause logic
            // Remove saved end time when timer is paused
            localStorage.removeItem("endTime");
        }
        const runningState = !isRunning;
        setIsRunning(runningState);

        localStorage.setItem("isRunning", JSON.stringify(runningState));
    };

    const handleReset = () => {
        setIsRunning(false);

        localStorage.removeItem("endTime");
        localStorage.setItem("isRunning", false);

        if (mode === "focus") {
            setTimeLeft(focusTime);
            localStorage.setItem("timeLeft", focusTime);
        } else {
            setTimeLeft(breakTime);
            localStorage.setItem("timeLeft", breakTime);
        }
    };

    // Switch Mode
    const switchMode = (newMode) => {
        setIsRunning(false);
        setMode(newMode);

        localStorage.removeItem("endTime");

        localStorage.setItem("mode", newMode);
        localStorage.setItem("isRunning", false);

        if (newMode === "focus") {
            setTimeLeft(focusTime);
            localStorage.setItem("timeLeft", focusTime);
        } else {
            setTimeLeft(breakTime);
            localStorage.setItem("timeLeft", breakTime); 
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('accessToken')
        setIsAuthenticated(false)
        navigate('/')
    }

    return (
        <main className="min-h-screen px-15 py-8 bg-stone-50">
            <section className=" mx-auto max-w-8xl">
                
                <div className="mb-8">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            {/* Heading */}
                            <p className="text-m font-semibold mb-6 uppercase tracking-[0.25em] text-emerald-700">
                                Pomodoro Timer
                            </p>
                            <h1 className="mt-2 font-serif text-4xl font-semibold">
                                Manage your time
                            </h1>
                        </div>

                        <div className="flex flex-row gap-4">
                            <button
                                type="button"
                                onClick={()=>{navigate("/create-task")}}
                                className="rounded-2xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-100"
                            >
                                Tasks
                            </button>

                            <button
                                type="button"
                                onClick={handleLogout}
                                className="rounded-2xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-100"
                            >
                                Logout
                            </button>
                        </div>
                    </div>

                    <p className="mt-3 text-stone-600">
                        Stay focused, manage your time efficiently, and get more done with our Pomodoro timer. Break your work into productive sessions, track your focus time, and build better study and work habits every day.
                    </p>
                </div>

                
                <div className="max-w-350 mx-auto text-center bg-white p-10 rounded-3xl shadow-lg">
                    {/* Mode Buttons */}
                    <div className="flex gap-10 justify-center my-10 text-center">
                        <button
                            onClick={() => switchMode("focus")}
                            className={`px-4 py-1 rounded-lg font-medium ${
                                mode === "focus"
                                    ? "rounded-2xl border-3 border-stone-300 bg-green-300"
                                    : "rounded-2xl border-3 border-stone-300  bg-stone-100"
                            }`}
                        >
                            Focus
                        </button>

                        <button
                            onClick={() => switchMode("break")}
                            className={`px-4 py-2 rounded-lg font-medium ${
                                mode === "break"
                                    ? "rounded-2xl border-3 border-stone-300 bg-green-300 px-4 py-3"
                                    : "rounded-2xl border-3 border-stone-300  bg-stone-100 px-4 py-3"
                            }`}
                        >
                            Break
                        </button>
                    </div>

                    {/* Timer */}
                    <div className="text-9xl font-bold mb-10">
                        {formatTime()}
                    </div>

                    {/* Controls */}
                    <div className="flex justify-center gap-4 mb-10">
                        <button
                            onClick={handleStartPause}
                            className="bg-black text-white px-6 py-2 rounded-lg"
                        >
                            {isRunning ? "Pause" : "Start"}
                        </button>

                        <button
                            onClick={handleReset}
                            className="bg-red-500 text-white px-6 py-2 rounded-lg"
                        >
                            Reset
                        </button>
                    </div>

                    {/* Current Mode */}
                    <p className="text-gray-600 mb-10">
                        Current Mode:{" "}
                        <span className="font-semibold capitalize">
                            {mode}
                        </span>
                    </p>
                </div>
                
            </section>
        </main>
    );
};

export default PomodoroTimer;
