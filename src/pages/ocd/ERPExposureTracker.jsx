import { useState } from "react";
import { Link } from "react-router-dom";

const INITIAL_ENTRIES = [];

export default function ERPExposureTracker() {
  const [entries, setEntries] = useState(INITIAL_ENTRIES);
  const [form, setForm] = useState({ trigger: "", suds_before: "", suds_after: "", duration: "", notes: "" });

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.trigger) return;
    setEntries((prev) => [{ ...form, id: Date.now(), date: new Date().toLocaleDateString() }, ...prev]);
    setForm({ trigger: "", suds_before: "", suds_after: "", duration: "", notes: "" });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link to="/ocd" className="text-indigo-600 hover:underline text-sm">&larr; Back to OCD Toolkit</Link>
          <h1 className="text-2xl font-bold text-indigo-900 mt-2">ERP Exposure Tracker</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 mb-6 border border-indigo-100 space-y-4">
          <h2 className="font-semibold text-indigo-800">Log an Exposure</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Trigger / Situation</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.trigger} onChange={e=>setForm(f=>({...f,trigger:e.target.value}))} placeholder="Describe the exposure trigger" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">SUDS Before (0-100)</label>
              <input type="number" min="0" max="100" className="w-full border rounded px-3 py-2 text-sm" value={form.suds_before} onChange={e=>setForm(f=>({...f,suds_before:e.target.value}))} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">SUDS After (0-100)</label>
              <input type="number" min="0" max="100" className="w-full border rounded px-3 py-2 text-sm" value={form.suds_after} onChange={e=>setForm(f=>({...f,suds_after:e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Duration (minutes)</label>
            <input type="number" min="1" className="w-full border rounded px-3 py-2 text-sm" value={form.duration} onChange={e=>setForm(f=>({...f,duration:e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Notes</label>
            <textarea className="w-full border rounded px-3 py-2 text-sm" rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm font-medium">Add Entry</button>
        </form>

        <div className="space-y-3">
          {entries.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No exposures logged yet. Start by adding one above.</p>}
          {entries.map(en => (
            <div key={en.id} className="bg-white rounded-xl shadow p-4 border border-indigo-100">
              <div className="flex justify-between items-start">
                <h3 className="font-medium text-indigo-800">{en.trigger}</h3>
                <span className="text-xs text-gray-400">{en.date}</span>
              </div>
              <div className="mt-2 flex gap-4 text-sm text-gray-600">
                <span>Before: <strong>{en.suds_before || "—"}</strong></span>
                <span>After: <strong>{en.suds_after || "—"}</strong></span>
                <span>Duration: <strong>{en.duration ? `${en.duration}m` : "—"}</strong></span>
              </div>
              {en.notes && <p className="mt-1 text-sm text-gray-500">{en.notes}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
