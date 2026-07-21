import { useState } from "react";
import { Link } from "react-router-dom";

export default function ExposureHierarchyBuilder() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ situation: "", suds: "" });

  function addItem(e) {
    e.preventDefault();
    if (!form.situation) return;
    setItems(prev => [...prev, { ...form, id: Date.now() }].sort((a,b) => Number(a.suds)-Number(b.suds)));
    setForm({ situation: "", suds: "" });
  }

  function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link to="/ocd" className="text-indigo-600 hover:underline text-sm">&larr; Back to OCD Toolkit</Link>
          <h1 className="text-2xl font-bold text-indigo-900 mt-2">Exposure Hierarchy Builder</h1>
          <p className="text-indigo-700 text-sm mt-1">Build your fear ladder sorted by SUDS rating (0 = no anxiety, 100 = maximum anxiety)</p>
        </div>

        <form onSubmit={addItem} className="bg-white rounded-xl shadow p-5 mb-6 border border-indigo-100 flex gap-3">
          <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Describe the situation or trigger" value={form.situation} onChange={e=>setForm(f=>({...f,situation:e.target.value}))} required />
          <input type="number" min="0" max="100" className="w-24 border rounded px-3 py-2 text-sm" placeholder="SUDS" value={form.suds} onChange={e=>setForm(f=>({...f,suds:e.target.value}))} />
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700">Add</button>
        </form>

        {items.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Add situations to build your hierarchy.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="bg-white rounded-xl shadow p-4 border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">{idx+1}</span>
                  <span className="text-indigo-800">{item.situation}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${Number(item.suds)>=70?"bg-red-100 text-red-700":Number(item.suds)>=40?"bg-yellow-100 text-yellow-700":"bg-green-100 text-green-700"}`}>SUDS {item.suds}</span>
                  <Link to="/ocd/exposure-session" className="text-xs text-indigo-500 hover:underline">Start</Link>
                  <button onClick={()=>removeItem(item.id)} className="text-gray-300 hover:text-red-400 text-xs">&times;</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
