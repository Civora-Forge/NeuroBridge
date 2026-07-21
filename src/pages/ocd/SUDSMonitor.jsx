import { useState } from "react";
import { Link } from "react-router-dom";

export default function SUDSMonitor() {
  const [sessions, setSessions] = useState([]);
  const [current, setCurrent] = useState(50);
  const [note, setNote] = useState("");

  function logReading() {
    setSessions(prev => [{
      id: Date.now(),
      suds: current,
      note,
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
    }, ...prev]);
    setNote("");
  }

  const levelColor = (s) => s >= 70 ? "text-red-600" : s >= 40 ? "text-yellow-600" : "text-green-600";
  const levelLabel = (s) => s >= 70 ? "High" : s >= 40 ? "Moderate" : "Low";

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link to="/ocd" className="text-indigo-600 hover:underline text-sm">&larr; Back to OCD Toolkit</Link>
          <h1 className="text-2xl font-bold text-indigo-900 mt-2">SUDS Monitor</h1>
          <p className="text-indigo-700 text-sm mt-1">Subjective Units of Distress Scale — check in with your anxiety level (0–100)</p>
        </div>

        <div className="bg-white rounded-xl shadow p-6 mb-6 border border-indigo-100">
          <div className="text-center mb-4">
            <span className={`text-6xl font-bold ${levelColor(current)}`}>{current}</span>
            <div className={`text-sm mt-1 font-medium ${levelColor(current)}`}>{levelLabel(current)} Anxiety</div>
          </div>
          <input
            type="range" min="0" max="100" value={current}
            onChange={e=>setCurrent(Number(e.target.value))}
            className="w-full accent-indigo-600 mb-4"
          />
          <div className="flex justify-between text-xs text-gray-400 mb-4">
            <span>0 — None</span><span>50 — Moderate</span><span>100 — Maximum</span>
          </div>
          <input className="w-full border rounded px-3 py-2 text-sm mb-3" placeholder="Optional note about this check-in..." value={note} onChange={e=>setNote(e.target.value)} />
          <button onClick={logReading} className="w-full bg-indigo-600 text-white py-2 rounded font-medium hover:bg-indigo-700">Log Check-In</button>
        </div>

        <div className="space-y-3">
          {sessions.length === 0 && <p className="text-center text-gray-400 text-sm py-4">No check-ins logged yet.</p>}
          {sessions.map(s => (
            <div key={s.id} className="bg-white rounded-xl shadow p-4 border border-indigo-100 flex items-center justify-between">
              <div>
                <span className={`text-2xl font-bold ${levelColor(s.suds)}`}>{s.suds}</span>
                {s.note && <p className="text-sm text-gray-500 mt-0.5">{s.note}</p>}
              </div>
              <span className="text-xs text-gray-400">{s.date} {s.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
