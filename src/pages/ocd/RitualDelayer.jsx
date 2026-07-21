import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, Pause, RotateCcw } from "lucide-react";
const DELAY_SECONDS = 5 * 60; // 5 minutes
export default function RitualDelayer() {
    const [timeLeft, setTimeLeft] = useState(DELAY_SECONDS);
    const [isRunning, setIsRunning] = useState(false);
    const [completed, setCompleted] = useState(false);
    const intervalRef = useRef(null);
    useEffect(() => {
        if (isRunning && timeLeft > 0) {
            intervalRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        setIsRunning(false);
                        setCompleted(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (intervalRef.current)
                clearInterval(intervalRef.current);
        };
    }, [isRunning, timeLeft]);
    const reset = () => {
        setTimeLeft(DELAY_SECONDS);
        setIsRunning(false);
        setCompleted(false);
    };
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const progress = ((DELAY_SECONDS - timeLeft) / DELAY_SECONDS) * 100;
    return (<div className="animate-fade-in">
      <Link to="/ocd" className="neuro-btn-ghost text-sm mb-6 gap-2 inline-flex min-h-0 py-2 px-3">
        <ArrowLeft className="w-4 h-4"/>
        Back to MindBridge
      </Link>

      <h1 className="section-title mb-1">The Ritual Delayer</h1>
      <p className="section-subtitle mb-8">Wait 5 minutes before acting on a compulsion. Ride the wave.</p>

      <div className="max-w-md mx-auto">
        {/* Wave animation area */}
        <div className={`wave-container p-8 mb-6 transition-all duration-500 ${isRunning ? "min-h-[280px]" : "min-h-[200px]"}`}>
          {isRunning && (<div className="text-center mb-4">
              <p className="text-calm-foreground text-lg font-semibold animate-pulse-soft">
                You are riding the wave 🌊
              </p>
              <p className="text-calm-foreground/70 text-sm mt-1">The urge will pass. Stay with it.</p>
            </div>)}

          {/* Timer display */}
          <div className="text-center">
            <p className="text-6xl font-bold text-calm-foreground tracking-wider font-mono">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </p>
          </div>

          {/* Wave SVG */}
          {isRunning && (<div className="mt-4">
              <svg viewBox="0 0 200 40" className="w-full h-12" preserveAspectRatio="none">
                <path d="M 0 20 Q 25 5 50 20 Q 75 35 100 20 Q 125 5 150 20 Q 175 35 200 20" fill="none" stroke="hsl(200 60% 50%)" strokeWidth="2" className="animate-wave"/>
                <path d="M 0 20 Q 30 30 60 20 Q 90 10 120 20 Q 150 30 180 20 Q 195 15 200 20" fill="none" stroke="hsl(200 60% 60% / 0.5)" strokeWidth="1.5" className="animate-wave" style={{ animationDelay: "0.5s" }}/>
              </svg>
            </div>)}

          {/* Progress bar */}
          <div className="mt-4 h-2 bg-calm-foreground/10 rounded-full overflow-hidden">
            <div className="h-full bg-calm-foreground/40 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}/>
          </div>
        </div>

        {completed && (<div className="neuro-card text-center mb-6 bg-success/10">
            <p className="text-success font-bold text-lg">🎉 You did it!</p>
            <p className="text-muted-foreground text-sm">The wave has passed. You are stronger than you think.</p>
          </div>)}

        {/* Controls */}
        <div className="flex gap-3 justify-center">
          {!isRunning && !completed && (<button className="neuro-btn-primary gap-2 text-lg" onClick={() => setIsRunning(true)}>
              <Play className="w-5 h-5"/>
              Wait 5 Minutes
            </button>)}
          {isRunning && (<button className="neuro-btn-outline gap-2" onClick={() => setIsRunning(false)}>
              <Pause className="w-5 h-5"/>
              Pause
            </button>)}
          {(isRunning || completed || timeLeft < DELAY_SECONDS) && (<button className="neuro-btn-ghost gap-2" onClick={reset}>
              <RotateCcw className="w-5 h-5"/>
              Reset
            </button>)}
        </div>
      </div>
    </div>);
}
