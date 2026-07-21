import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";
export default function ERPHierarchy() {
    const [triggers, setTriggers] = useState([]);
    const [newTrigger, setNewTrigger] = useState("");
    const [newRating, setNewRating] = useState(5);
    const addTrigger = () => {
        if (!newTrigger.trim())
            return;
        const t = {
            id: Date.now().toString(),
            text: newTrigger.trim(),
            rating: newRating,
        };
        setTriggers((prev) => [...prev, t].sort((a, b) => a.rating - b.rating));
        setNewTrigger("");
        setNewRating(5);
    };
    const removeTrigger = (id) => {
        setTriggers((prev) => prev.filter((t) => t.id !== id));
    };
    const getRatingColor = (r) => {
        if (r <= 3)
            return "bg-success text-success-foreground";
        if (r <= 6)
            return "bg-warning text-warning-foreground";
        return "bg-destructive text-destructive-foreground";
    };
    return (<div className="animate-fade-in">
      <Link to="/ocd" className="neuro-btn-ghost text-sm mb-6 gap-2 inline-flex min-h-0 py-2 px-3">
        <ArrowLeft className="w-4 h-4"/>
        Back to MindBridge
      </Link>

      <h1 className="section-title mb-1">ERP Fear Hierarchy</h1>
      <p className="section-subtitle mb-6">Rank your triggers from 1 (least anxiety) to 10 (most anxiety).</p>

      {/* Add trigger form */}
      <div className="neuro-card mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input className="neuro-input flex-1" placeholder="Describe a trigger..." value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTrigger()}/>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium whitespace-nowrap">
              Anxiety: <span className="font-bold">{newRating}</span>
            </label>
            <input type="range" min={1} max={10} value={newRating} onChange={(e) => setNewRating(Number(e.target.value))} className="w-32 accent-primary"/>
            <button className="neuro-btn-primary min-h-[48px] px-4" onClick={addTrigger}>
              <Plus className="w-5 h-5"/>
            </button>
          </div>
        </div>
      </div>

      {/* Hierarchy list */}
      {triggers.length === 0 ? (<div className="neuro-card text-center py-12">
          <p className="text-muted-foreground">No triggers yet. Add your first one above to start building your hierarchy.</p>
        </div>) : (<div className="flex flex-col gap-2">
          {triggers.map((t) => (<div key={t.id} className="neuro-card flex items-center gap-4 p-4">
              <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0"/>
              <span className={`text-sm font-bold rounded-lg px-3 py-1 ${getRatingColor(t.rating)}`}>
                {t.rating}
              </span>
              <p className="flex-1 font-medium">{t.text}</p>
              <button className="neuro-btn-ghost min-h-0 p-2 text-muted-foreground hover:text-destructive" onClick={() => removeTrigger(t.id)}>
                <Trash2 className="w-4 h-4"/>
              </button>
            </div>))}
        </div>)}
    </div>);
}
