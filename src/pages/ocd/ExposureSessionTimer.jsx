import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const PROMPTS = [
  "Stay with the discomfort — it will pass.",
  "Resist the urge to perform a compulsion.",
  "Notice the anxiety without acting on it.",
  "You are safe. The anxiety will peak and subside.",
  "Focus on the present moment.",
  "Let the thought be there without engaging with it.",
];

export default function ExposureSessionTimer() {
  const [duration, setDuration] = useState(10);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [done, setDone] = useState(false);
  const intervalRef = useRef(null);
  const promptIntervalRef = useRef(null);

  function start() {
    setRemaining(duration * 60);
    setDone(false);
    setRunning(true);
  }

  function stop() {
    setRunning(false);
    clearInterval(intervalRef.current);
    clearInterval(promptIntervalRef.current);
    setRemaining(null);
  }

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current);
          clearInterval(promptIntervalRef.current);
          setRunning(false);
          setDone(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    promptIntervalRef.current = setInterval(() => {
      setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
    }, 45000);
    return () => { clearInterval(intervalRef.current); clearInterval(promptIntervalRef.current); };
  }, [running]);

  const pct = remaining !== null ? ((duration*60 - remaining)/(duration*60))*100 : 0;
  const mins = remaining !== null ? String(Math.floor(remaining/60)).padStart(2,"0") : String(duration).padStart(2,"0");
  const secs = remaining !== null ? String(remaining%60).padStart(2,"0") : "00";

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <Link to="/ocd" className="text-indigo-600 hover:underline text-sm">&larr; Back to OCD Toolkit</Link>
          <h1 className="text-2xl font-bold text-indigo-900 mt-2">Exposure Session Timer</h1>
        </div>

        <div className="bg-white rounded-xl shadow p-8 border border-indigo-100 text-center">
          {!running && !done && (
            <div className="mb-6">
              <label className="block text-sm text-gray-600 mb-2">Session Duration (minutes)</label>
              <input type="number" min="1" max="90" value={duration} onChange={e=>setDuration(Number(e.target.value))} className="w-24 border rounded px-3 py-2 text-center text-lg font-bold" />
            </div>
          )}

          <div className="relative w-40 h-40 mx-auto mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e0e7ff" strokeWidth="2.5"/>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#4f46e5" strokeWidth="2.5"
                strokeDasharray={`${pct} 100`} strokeLinecap="round"/>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-indigo-800">{mins}:{secs}</span>
            </div>
          </div>

          {running && (
            <div className="bg-indigo-50 rounded-lg p-4 mb-6 text-sm text-indigo-700 italic">"{prompt}"</div>
          )}

          {done && (
            <div className="bg-green-50 rounded-lg p-4 mb-6 text-green-700 font-medium">
              Session complete! Great work staying with the discomfort.
            </div>
          )}

          {!running ? (
            <button onClick={start} className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-indigo-700">
              {done ? "New Session" : "Start Session"}
            </button>
          ) : (
            <button onClick={stop} className="bg-red-500 text-white px-8 py-3 rounded-lg font-medium hover:bg-red-600">End Session</button>
          )}
        </div>
      </div>
    </div>
  );
}
