import { Brain, CalendarClock, CheckSquare, Headphones, Timer, UsersRound, Zap } from "lucide-react";
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
    bg: "bg-blue-50",
    border: "border-blue-100",
    text: "text-blue-700",
    hover: "hover:shadow-[0_12px_28px_rgba(37,99,235,0.16)]",
    manualOnly: true,
  },
  {
    moduleId: "support.task_breakdown",
    feature: FEATURES.ADHD_BREAKDOWN,
    to: "/adhd/breakdown",
    icon: CheckSquare,
    title: "Task Breakdown",
    desc: "Turn a large task into smaller, editable next steps.",
    bg: "bg-lime-50",
    border: "border-lime-200",
    text: "text-lime-800",
    hover: "hover:shadow-[0_12px_28px_rgba(132,204,22,0.2)]",
  },
  {
    moduleId: "support.focus_session",
    feature: FEATURES.ADHD_FOCUS,
    to: "/adhd/focus",
    icon: Timer,
    title: "Focus Session",
    desc: "Use timed focus blocks with Pomodoro-style cues and built-in reset prompts.",
    bg: "bg-blue-50",
    border: "border-blue-100",
    text: "text-blue-700",
    hover: "hover:shadow-[0_12px_28px_rgba(37,99,235,0.16)]",
  },
  {
    moduleId: "support.mood_checkin",
    feature: FEATURES.ADHD_EMOTION,
    to: "/adhd/emotion-coach",
    icon: Brain,
    title: "Mood Check-in",
    desc: "Name what is happening and choose a small regulation prompt.",
    bg: "bg-sky-50",
    border: "border-sky-100",
    text: "text-sky-800",
    hover: "hover:shadow-[0_12px_28px_rgba(14,165,233,0.16)]",
    manualOnly: true,
  },
  {
    moduleId: "support.accountability_session",
    feature: FEATURES.ADHD_DOUBLING,
    to: "/adhd/doubling",
    icon: UsersRound,
    title: "Accountability Session",
    desc: "Set a commitment and use a guided timer to stay with the next task.",
    bg: "bg-indigo-50",
    border: "border-indigo-100",
    text: "text-indigo-700",
    hover: "hover:shadow-[0_12px_28px_rgba(79,70,229,0.16)]",
    manualOnly: true,
  },
  {
    moduleId: "support.soundscapes",
    feature: FEATURES.ADHD_SOUNDS,
    to: "/adhd/soundscapes",
    icon: Headphones,
    title: "Soundscapes",
    desc: "Layer ambient sounds and set a timer for a focused session.",
    bg: "bg-blue-50",
    border: "border-lime-200",
    text: "text-blue-700",
    hover: "hover:shadow-[0_12px_28px_rgba(37,99,235,0.16)]",
  },
];

export default function ADHDPage() {
  const { hasFeature } = useAuth();
  const availableTools = ADHD_LANDING_TOOLS.filter((tool) => hasFeature(tool.feature));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#d9f99d_0,_transparent_28%),linear-gradient(135deg,_#eff6ff_0%,_#f8fbff_55%,_#f7fee7_100%)] px-4 py-8 sm:px-8 sm:py-12">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-10 sm:mb-12">
        <div className="w-16 h-16 mb-5 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-600/25">
          <Zap className="w-10 h-10 text-white" />
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">ADHD toolkit</p>
        <h1 className="text-4xl font-black tracking-tight text-slate-950 mb-2">
          Focus and Planning
        </h1>
        <p className="text-base text-slate-600 max-w-xl">
          Choose one small support tool for attention, planning, time, or emotional regulation.
        </p>
      </div>

      {/* Feature cards */}
      <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        {availableTools.map(({ moduleId, to, icon: Icon, title, desc, bg, border, text, hover, manualOnly }) => (
          <Link
            key={moduleId}
            to={to}
            className={`group relative bg-white ${border} border rounded-2xl p-5 flex flex-col gap-3 shadow-sm ${hover} hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-all duration-200 overflow-hidden`}
          >
             <div className={`absolute -top-8 -right-8 w-24 h-24 ${bg} rounded-full blur-2xl group-hover:scale-110 transition-transform duration-300`} />
            <div className={`w-11 h-11 rounded-xl ${bg} ${border} border flex items-center justify-center ${text}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
                <h3 className="font-bold text-slate-900 transition-colors group-hover:text-blue-800">{title}</h3>
               <p className="text-sm text-slate-500 mt-1 leading-relaxed">{desc}</p>
                {manualOnly && <p className="mt-2 text-xs font-medium text-slate-400">Start whenever you are ready</p>}
            </div>
            <span className={`mt-auto inline-flex items-center gap-1 text-xs font-semibold ${text}`}>
                Open tool <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
