import { Hand, Activity, Clock, Leaf, Timer, Map } from "lucide-react";
import { Link } from "react-router-dom";

const tools = [
  { to: "/dyspraxia/aomi-library",   icon: Activity, title: "AOMI Library",         desc: "Action observation and motor imagery practice." },
  { to: "/dyspraxia/haptic-pacer",   icon: Timer,    title: "Haptic Pacer",          desc: "Rhythmic pacing cues for coordinated movement." },
  { to: "/dyspraxia/ar-instructions",icon: Leaf,     title: "AR Instruction Cards",  desc: "Visual AR prompts to guide task execution." },
  { to: "/dyspraxia/safe-route",     icon: Map,      title: "Safe Route Planner",    desc: "Plan low-stress routes for physical navigation." },
  { to: "/adhd/breakdown",           icon: Clock,    title: "Task Breakdown",        desc: "Split multi-step tasks into guided smaller steps." },
  { to: "/adhd/timeline",            icon: Hand,     title: "Visual Timeline",       desc: "Organise your day to reduce planning overload." },
];

export default function DyspraxiaDashboard() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto text-center mb-12">
        <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-mode-dyspraxia flex items-center justify-center shadow-xl">
          <Hand className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-black text-mode-dyspraxia mb-2">
          Motor Planning
        </h1>
        <p className="text-base text-slate-600 max-w-xl mx-auto">
          Tools for coordination, sequencing, and getting through physical tasks step by step.
        </p>
      </div>
      {/* Large tap targets throughout (min-height ~80px, generous padding) —
          dyspraxia guidance calls for bigger, more forgiving hit areas since
          precise small-target taps are the specific friction point. */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {tools.map(({ to, icon: Icon, title, desc }) => (
          <Link key={to} to={to}
            className="dyspraxia-btn group relative flex-col items-start justify-start text-left bg-white border border-mode-dyspraxia/25 rounded-2xl p-6 flex gap-3 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden h-auto">
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-mode-dyspraxia/10 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
            <div className="w-11 h-11 rounded-xl bg-mode-dyspraxia/10 border border-mode-dyspraxia/25 flex items-center justify-center text-mode-dyspraxia shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-500 mt-1 normal-case">{desc}</p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-mode-dyspraxia normal-case">Open <span aria-hidden="true">→</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
