import { Link } from "react-router-dom";

const OCD_FEATURES = [
  { label: "ERP Exposure Tracker", path: "/ocd/exposure-tracker", desc: "Log and track your exposure sessions" },
  { label: "Exposure Hierarchy Builder", path: "/ocd/exposure-hierarchy", desc: "Build your fear ladder with SUDS ratings" },
  { label: "SUDS Monitor", path: "/ocd/suds-monitor", desc: "Track anxiety levels 0-100 across sessions" },
  { label: "Exposure Session Timer", path: "/ocd/exposure-session", desc: "Timed exposure sessions with prompts" },
  { label: "ERP Progress Tracker", path: "/ocd/progress", desc: "View progress by hierarchy level and streaks" },
];

export default function OCDPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link to="/" className="text-indigo-600 hover:underline text-sm">&larr; Back to Dashboard</Link>
          <h1 className="text-3xl font-bold text-indigo-900 mt-2">OCD / ERP Toolkit</h1>
          <p className="text-indigo-700 mt-1">Exposure and Response Prevention tools to help manage OCD</p>
        </div>
        <div className="grid gap-4">
          {OCD_FEATURES.map((f) => (
            <Link
              key={f.path}
              to={f.path}
              className="bg-white rounded-xl shadow p-5 hover:shadow-md transition-shadow border border-indigo-100 flex items-center justify-between group"
            >
              <div>
                <h2 className="font-semibold text-indigo-800 group-hover:text-indigo-600">{f.label}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{f.desc}</p>
              </div>
              <span className="text-indigo-400 group-hover:text-indigo-600 text-xl">&rsaquo;</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
