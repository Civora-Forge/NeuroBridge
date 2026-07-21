import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
export default function LogicCheckJournal() {
    const [entries, setEntries] = useState([]);
    const [fear, setFear] = useState("");
    const [evidence, setEvidence] = useState("");
    const addEntry = () => {
        if (!fear.trim() || !evidence.trim())
            return;
        setEntries((prev) => [
            {
                id: Date.now().toString(),
                fear: fear.trim(),
                evidence: evidence.trim(),
                timestamp: new Date().toLocaleString(),
            },
            ...prev,
        ]);
        setFear("");
        setEvidence("");
    };
    const removeEntry = (id) => setEntries((prev) => prev.filter((e) => e.id !== id));
    return (<div className="animate-fade-in">
      <Link to="/ocd" className="neuro-btn-ghost text-sm mb-6 gap-2 inline-flex min-h-0 py-2 px-3">
        <ArrowLeft className="w-4 h-4"/>
        Back to MindBridge
      </Link>

      <h1 className="section-title mb-1">Logic-Check Journal</h1>
      <p className="section-subtitle mb-6">Challenge your obsessive thoughts with evidence and facts.</p>

      {/* Split-screen input */}
      <div className="neuro-card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm font-semibold text-destructive mb-2 block">
              😰 The Fear (Obsession)
            </label>
            <textarea className="neuro-textarea" placeholder="What is the intrusive thought telling you?" value={fear} onChange={(e) => setFear(e.target.value)}/>
          </div>
          <div>
            <label className="text-sm font-semibold text-success mb-2 block">
              🧠 The Evidence (Facts)
            </label>
            <textarea className="neuro-textarea" placeholder="What does the evidence actually say?" value={evidence} onChange={(e) => setEvidence(e.target.value)}/>
          </div>
        </div>
        <button className="neuro-btn-primary gap-2 w-full sm:w-auto" onClick={addEntry}>
          <Plus className="w-5 h-5"/>
          Save Entry
        </button>
      </div>

      {/* Past entries */}
      {entries.length === 0 ? (<div className="neuro-card text-center py-12">
          <p className="text-muted-foreground">No journal entries yet. Challenge your first thought above.</p>
        </div>) : (<div className="flex flex-col gap-3">
          {entries.map((e) => (<div key={e.id} className="neuro-card">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs text-muted-foreground">{e.timestamp}</span>
                <button className="text-muted-foreground hover:text-destructive p-1" onClick={() => removeEntry(e.id)}>
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-destructive/5 p-4 border border-destructive/20">
                  <p className="text-xs font-semibold text-destructive mb-1">The Fear</p>
                  <p className="text-sm">{e.fear}</p>
                </div>
                <div className="rounded-xl bg-success/5 p-4 border border-success/20">
                  <p className="text-xs font-semibold text-success mb-1">The Evidence</p>
                  <p className="text-sm">{e.evidence}</p>
                </div>
              </div>
            </div>))}
        </div>)}
    </div>);
}
