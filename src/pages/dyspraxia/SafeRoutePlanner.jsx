import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, AlertTriangle, Check, Navigation } from "lucide-react";
const routes = [
    {
        id: "1",
        name: "Park Path (Recommended)",
        distance: "1.2 km",
        time: "18 min",
        stairs: 0,
        narrow: 0,
        stress: "Low",
        features: ["Wide paths", "Flat terrain", "Benches every 100m", "Good lighting"],
    },
    {
        id: "2",
        name: "High Street Route",
        distance: "0.8 km",
        time: "12 min",
        stairs: 2,
        narrow: 3,
        stress: "High",
        features: ["Busy sidewalks", "Curb steps", "Narrow passages near shops"],
    },
    {
        id: "3",
        name: "Residential Detour",
        distance: "1.0 km",
        time: "15 min",
        stairs: 0,
        narrow: 1,
        stress: "Medium",
        features: ["Quiet streets", "Some uneven pavement", "One narrow gate"],
    },
];
export default function SafeRoutePlanner() {
    const [selected, setSelected] = useState("1");
    const stressColor = (s) => {
        if (s === "Low")
            return "bg-success/10 text-success";
        if (s === "Medium")
            return "bg-warning/10 text-warning";
        return "bg-destructive/10 text-destructive";
    };
    return (<div className="animate-fade-in">
      <Link to="/dyspraxia" className="dyspraxia-btn min-h-[56px] bg-transparent border-2 border-border text-sm mb-6 gap-2 inline-flex px-4">
        <ArrowLeft className="w-5 h-5"/>
        Back to CoordiMate
      </Link>

      <h1 className="section-title mb-1">Safe-Route Planner</h1>
      <p className="section-subtitle mb-6">Find low-stress paths that avoid stairs and narrow walkways.</p>

      {/* Mock map */}
      <div className="neuro-card mb-6 p-0 overflow-hidden">
        <div className="h-48 bg-secondary relative flex items-center justify-center">
          <div className="text-center">
            <Navigation className="w-10 h-10 text-muted-foreground mx-auto mb-2"/>
            <p className="text-sm text-muted-foreground">Map View</p>
            <p className="text-xs text-muted-foreground">Interactive map coming soon</p>
          </div>
          {/* Mock path overlay */}
          <div className="absolute bottom-4 left-4 flex items-center gap-1">
            <MapPin className="w-4 h-4 text-mode-dyspraxia"/>
            <span className="text-xs font-semibold">Home</span>
          </div>
          <div className="absolute bottom-4 right-4 flex items-center gap-1">
            <MapPin className="w-4 h-4 text-primary"/>
            <span className="text-xs font-semibold">Destination</span>
          </div>
        </div>
      </div>

      {/* Route options */}
      <div className="flex flex-col gap-3">
        {routes.map((route) => (<button key={route.id} className={`neuro-card text-left p-5 transition-all ${selected === route.id ? "ring-2 ring-mode-dyspraxia" : ""}`} onClick={() => setSelected(route.id)}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-base">{route.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {route.distance} · {route.time}
                </p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${stressColor(route.stress)}`}>
                {route.stress} Stress
              </span>
            </div>

            <div className="flex gap-4 mb-3 text-sm">
              <span className="flex items-center gap-1">
                {route.stairs === 0 ? (<Check className="w-4 h-4 text-success"/>) : (<AlertTriangle className="w-4 h-4 text-warning"/>)}
                {route.stairs} stairs
              </span>
              <span className="flex items-center gap-1">
                {route.narrow === 0 ? (<Check className="w-4 h-4 text-success"/>) : (<AlertTriangle className="w-4 h-4 text-warning"/>)}
                {route.narrow} narrow spots
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {route.features.map((f) => (<span key={f} className="text-xs bg-secondary px-2 py-1 rounded-full">
                  {f}
                </span>))}
            </div>
          </button>))}
      </div>
    </div>);
}
