import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM to 9 PM
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export default function CompulsionHeatmap() {
    const [entries, setEntries] = useState([]);
    const toggleCell = (day, hour) => {
        const existing = entries.find((e) => e.date === day && e.hour === hour);
        if (!existing) {
            setEntries((prev) => [...prev, { date: day, hour, status: "resisted" }]);
        }
        else if (existing.status === "resisted") {
            setEntries((prev) => prev.map((e) => (e.date === day && e.hour === hour ? { ...e, status: "performed" } : e)));
        }
        else {
            setEntries((prev) => prev.filter((e) => !(e.date === day && e.hour === hour)));
        }
    };
    const getCell = (day, hour) => entries.find((e) => e.date === day && e.hour === hour);
    const resistedCount = entries.filter((e) => e.status === "resisted").length;
    const performedCount = entries.filter((e) => e.status === "performed").length;
    return (<div className="animate-fade-in">
      <Link to="/ocd" className="neuro-btn-ghost text-sm mb-6 gap-2 inline-flex min-h-0 py-2 px-3">
        <ArrowLeft className="w-4 h-4"/>
        Back to MindBridge
      </Link>

      <h1 className="section-title mb-1">Compulsion Heatmap</h1>
      <p className="section-subtitle mb-6">
        Click cells to log: <span className="text-success font-semibold">green = resisted</span>,{" "}
        <span className="text-destructive font-semibold">red = performed</span>. Click again to clear.
      </p>

      {/* Stats */}
      <div className="flex gap-4 mb-6">
        <div className="neuro-card flex-1 text-center p-4">
          <p className="text-2xl font-bold text-success">{resistedCount}</p>
          <p className="text-sm text-muted-foreground">Resisted</p>
        </div>
        <div className="neuro-card flex-1 text-center p-4">
          <p className="text-2xl font-bold text-destructive">{performedCount}</p>
          <p className="text-sm text-muted-foreground">Performed</p>
        </div>
        <div className="neuro-card flex-1 text-center p-4">
          <p className="text-2xl font-bold text-primary">
            {entries.length > 0 ? Math.round((resistedCount / entries.length) * 100) : 0}%
          </p>
          <p className="text-sm text-muted-foreground">Resist Rate</p>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="neuro-card overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header */}
          <div className="grid gap-1" style={{ gridTemplateColumns: `60px repeat(${HOURS.length}, 1fr)` }}>
            <div />
            {HOURS.map((h) => (<div key={h} className="text-xs text-muted-foreground text-center py-1">
                {h > 12 ? `${h - 12}p` : h === 12 ? "12p" : `${h}a`}
              </div>))}
          </div>

          {/* Rows */}
          {DAYS.map((day) => (<div key={day} className="grid gap-1" style={{ gridTemplateColumns: `60px repeat(${HOURS.length}, 1fr)` }}>
              <div className="text-sm font-medium flex items-center">{day}</div>
              {HOURS.map((hour) => {
                const cell = getCell(day, hour);
                return (<button key={hour} onClick={() => toggleCell(day, hour)} className={`aspect-square rounded-lg border border-border flex items-center justify-center transition-colors min-h-[32px] ${cell?.status === "resisted"
                        ? "bg-success/20 border-success"
                        : cell?.status === "performed"
                            ? "bg-destructive/20 border-destructive"
                            : "hover:bg-secondary"}`}>
                    {cell?.status === "resisted" && <Check className="w-3 h-3 text-success"/>}
                    {cell?.status === "performed" && <X className="w-3 h-3 text-destructive"/>}
                  </button>);
            })}
            </div>))}
        </div>
      </div>
    </div>);
}
