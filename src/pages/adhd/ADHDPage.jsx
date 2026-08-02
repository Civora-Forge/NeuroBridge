import { Brain, CalendarClock, CheckSquare, Timer, UsersRound, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { FEATURES } from "@/lib/featureRegistry";

export const ADHD_LANDING_TOOLS = [
  {
    moduleId: "support.visual_timeline",
    feature: FEATURES.ADHD_TIMELINE,
    to: "/adhd/timeline",
    icon: CalendarClock,
    title: "Visual Timeline",
    desc: "Organize tasks and routines with clear visual time blocks.",
    color: "from-green-500 to-emerald-500",
    bg: "bg-green-50",
    border: "border-green-100",
    text: "text-green-600",
    hover: "hover:shadow-[0_10px_30px_rgba(34,197,94,0.2)]",
    manualOnly: true,
  },
  {
    moduleId: "support.task_breakdown",
    feature: FEATURES.ADHD_BREAKDOWN,
    to: "/adhd/breakdown",
    icon: CheckSquare,
    title: "Task Breakdown",
    desc: "Turn a large task into smaller, editable next steps.",
    color: "from-lime-500 to-green-500",
    bg: "bg-lime-50",
    border: "border-lime-100",
    text: "text-lime-700",
    hover: "hover:shadow-[0_10px_30px_rgba(132,204,22,0.2)]",
  },
  {
    moduleId: "support.focus_session",
    feature: FEATURES.ADHD_FOCUS,
    to: "/adhd/focus",
    icon: Timer,
    title: "Focus Session",
    desc: "Use timed focus blocks with Pomodoro-style cues and built-in reset prompts.",
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    text: "text-emerald-600",
    hover: "hover:shadow-[0_10px_30px_rgba(16,185,129,0.2)]",
  },
  {
    moduleId: "support.mood_checkin",
    feature: FEATURES.ADHD_EMOTION,
    to: "/adhd/emotion-coach",
    icon: Brain,
    title: "Mood Check-in",
    desc: "Name what is happening and choose a small regulation prompt.",
    color: "from-teal-500 to-cyan-500",
    bg: "bg-teal-50",
    border: "border-teal-100",
    text: "text-teal-700",
    hover: "hover:shadow-[0_10px_30px_rgba(20,184,166,0.2)]",
    manualOnly: true,
  },
  {
    moduleId: "support.accountability_session",
    feature: FEATURES.ADHD_DOUBLING,
    to: "/adhd/doubling",
    icon: UsersRound,
    title: "Accountability Session",
    desc: "Set a commitment and use a guided timer to stay with the next task.",
    color: "from-sky-500 to-blue-500",
    bg: "bg-sky-50",
    border: "border-sky-100",
    text: "text-sky-700",
    hover: "hover:shadow-[0_10px_30px_rgba(14,165,233,0.2)]",
    manualOnly: true,
  },
];

export default function ADHDPage() {
  const { hasFeature } = useAuth();
  const availableTools = ADHD_LANDING_TOOLS.filter((tool) => hasFeature(tool.feature));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/40 to-emerald-50/40 p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-12">
        <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-xl">
          <Zap className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
          Focus and Planning
        </h1>
        <p className="text-base text-slate-600 max-w-xl mx-auto">
          Choose one small support tool for attention, planning, time, or emotional regulation.
        </p>
      </div>

      {/* Feature cards */}
      <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
        {availableTools.map(({ moduleId, to, icon: Icon, title, desc, bg, border, text, hover, manualOnly }) => (
          <Link
            key={moduleId}
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
               {manualOnly && <p className="mt-2 text-xs text-slate-400">Manual tool</p>}
            </div>
            <span className={`mt-auto inline-flex items-center gap-1 text-xs font-semibold ${text}`}>
               Open tool
            </span>
          </Link>
        ))}
      </div>

      <p className="text-center text-xs text-slate-400 mt-10">
        Soundscapes is unavailable until audio assets and playback error handling are ready.
      </p>
    </div>
  );
}
