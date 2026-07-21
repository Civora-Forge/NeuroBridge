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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/40 to-teal-50/40 p-8">
      <div className="max-w-5xl mx-auto text-center mb-12">
        <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shadow-xl">
          <Hand className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-black bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent mb-2">
          Motor Planning Hub
        </h1>
        <p className="text-base text-slate-600 max-w-xl mx-auto">
          Tools for coordination, sequencing and physical task management.
        </p>
      </div>
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {tools.map(({ to, icon: Icon, title, desc }) => (
          <Link key={to} to={to}
            className="group relative bg-white border border-green-100 rounded-2xl p-6 flex flex-col gap-3 shadow-sm hover:shadow-[0_10px_30px_rgba(34,197,94,0.18)] hover:-translate-y-1 transition-all duration-300 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-green-100/60 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
            <div className="w-11 h-11 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-600">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 group-hover:text-green-700 transition-colors">{title}</h3>
              <p className="text-sm text-slate-500 mt-1">{desc}</p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-green-600 group-hover:text-green-700">Open Tool →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
