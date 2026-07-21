import { Zap, Clock, Timer } from "lucide-react";
import { Link } from "react-router-dom";

const tools = [
  {
    to: "/adhd/timeline",
    icon: Clock,
    title: "Visual Timeline",
    desc: "Organise your schedule visually to beat time blindness and plan your day with clarity.",
    color: "from-green-500 to-emerald-500",
    bg: "bg-green-50",
    border: "border-green-100",
    text: "text-green-600",
    hover: "hover:shadow-[0_10px_30px_rgba(34,197,94,0.2)]",
  },
  {
    to: "/adhd/focus",
    icon: Timer,
    title: "Focus Sessions",
    desc: "Use timed focus blocks with Pomodoro-style cues and built-in reset prompts.",
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    text: "text-emerald-600",
    hover: "hover:shadow-[0_10px_30px_rgba(16,185,129,0.2)]",
  },
];

export default function ADHDPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/40 to-emerald-50/40 p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-12">
        <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-xl">
          <Zap className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
          ADHD Dashboard
        </h1>
        <p className="text-base text-slate-600 max-w-xl mx-auto">
          Focus and time management tools to help you stay on track.
        </p>
      </div>

      {/* Feature cards */}
      <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
        {tools.map(({ to, icon: Icon, title, desc, bg, border, text, hover }) => (
          <Link
            key={to}
            to={to}
            className={`group relative bg-white ${border} border rounded-2xl p-6 flex flex-col gap-3 shadow-sm ${hover} hover:-translate-y-1 transition-all duration-300 overflow-hidden`}
          >
            <div className={`absolute -top-8 -right-8 w-24 h-24 ${bg} rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500`} />
            <div className={`w-11 h-11 rounded-xl ${bg} ${border} border flex items-center justify-center ${text}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-bold text-slate-900 group-hover:${text} transition-colors`}>{title}</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">{desc}</p>
            </div>
            <span className={`mt-auto inline-flex items-center gap-1 text-xs font-semibold ${text}`}>
              Open Tool →
            </span>
          </Link>
        ))}
      </div>

      <p className="text-center text-xs text-slate-400 mt-10">
        More tools will be added to your dashboard as your profile develops.
      </p>
    </div>
  );
}
