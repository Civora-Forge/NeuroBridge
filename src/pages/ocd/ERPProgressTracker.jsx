import { useState } from "react";
import { Link } from "react-router-dom";

const SAMPLE_LEVELS = [
  { id: 1, label: "Touching door handles", suds: 20, sessions: 5, avgReduction: 12 },
  { id: 2, label: "Leaving lights off", suds: 45, sessions: 3, avgReduction: 18 },
  { id: 3, label: "Not checking stove", suds: 70, sessions: 1, avgReduction: 5 },
];

export default function ERPProgressTracker() {
  const [levels] = useState(SAMPLE_LEVELS);

  const totalSessions = levels.reduce((s,l)=>s+l.sessions, 0);
  const streak = 4; // placeholder

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link to="/ocd" className="text-indigo-600 hover:underline text-sm">&larr; Back to OCD Toolkit</Link>
          <h1 className="text-2xl font-bold text-indigo-900 mt-2">ERP Progress Tracker</h1>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-5 border border-indigo-100 text-center">
            <div className="text-3xl font-bold text-indigo-700">{totalSessions}</div>
            <div className="text-sm text-gray-500 mt-1">Total Sessions</div>
          </div>
          <div className="bg-white rounded-xl shadow p-5 border border-indigo-100 text-center">
            <div className="text-3xl font-bold text-indigo-700">{streak} 🔥</div>
            <div className="text-sm text-gray-500 mt-1">Day Streak</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5 border border-indigo-100 mb-6">
          <h2 className="font-semibold text-indigo-800 mb-4">Progress by Hierarchy Level</h2>
          <div className="space-y-4">
            {levels.map(l => (
              <div key={l.id}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-700">{l.label}</span>
                  <span className="text-xs text-gray-400">{l.sessions} sessions</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-100 rounded-full h-3">
                    <div
                      className="bg-indigo-500 h-3 rounded-full"
                      style={{ width: `${Math.min((l.avgReduction/l.suds)*100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-indigo-600 font-medium">-{l.avgReduction} SUDS avg</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 text-sm text-indigo-700">
          <strong>Tip:</strong> Complete exposures regularly to see SUDS reduction over time. Aim for at least 3 sessions per hierarchy item.
        </div>
      </div>
    </div>
  );
}
