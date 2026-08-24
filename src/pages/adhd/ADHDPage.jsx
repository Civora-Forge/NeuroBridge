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
    bg: "bg-[#e4eef5]",
    border: "border-[#b7cfdf]",
    text: "text-[#396d8d]",
    hover: "hover:shadow-[0_10px_24px_rgba(75,141,179,0.14)]",
    manualOnly: true,
  },
  {
    moduleId: "support.task_breakdown",
    feature: FEATURES.ADHD_BREAKDOWN,
    to: "/adhd/breakdown",
    icon: CheckSquare,
    title: "Task Breakdown",
    desc: "Turn a large task into smaller, editable next steps.",
    bg: "bg-[#ffe5df]",
    border: "border-[#f3b7ae]",
    text: "text-[#b84f45]",
    hover: "hover:shadow-[0_10px_24px_rgba(255,111,97,0.16)]",
  },
  {
    moduleId: "support.focus_session",
    feature: FEATURES.ADHD_FOCUS,
    to: "/adhd/focus",
    icon: Timer,
    title: "Focus Session",
    desc: "Use timed focus blocks with Pomodoro-style cues and built-in reset prompts.",
    bg: "bg-[#e5efd9]",
    border: "border-[#bad09f]",
    text: "text-[#527b31]",
    hover: "hover:shadow-[0_10px_24px_rgba(109,159,70,0.16)]",
  },
  {
    moduleId: "support.mood_checkin",
    feature: FEATURES.ADHD_EMOTION,
    to: "/adhd/emotion-coach",
    icon: Brain,
    title: "Mood Check-in",
    desc: "Name what is happening and choose a small regulation prompt.",
    bg: "bg-[#fbf2d7]",
    border: "border-[#edd78d]",
    text: "text-[#786228]",
    hover: "hover:shadow-[0_10px_24px_rgba(247,227,174,0.35)]",
    manualOnly: true,
  },
  {
    moduleId: "support.accountability_session",
    feature: FEATURES.ADHD_DOUBLING,
    to: "/adhd/doubling",
    icon: UsersRound,
    title: "Accountability Session",
    desc: "Set a commitment and use a guided timer to stay with the next task.",
    bg: "bg-[#eeeeee]",
    border: "border-[#c0c0c0]",
    text: "text-[#5a5a5a]",
    hover: "hover:shadow-[0_10px_24px_rgba(120,120,120,0.16)]",
    manualOnly: true,
  },
];

export default function ADHDPage() {
  const { hasFeature } = useAuth();
  const availableTools = ADHD_LANDING_TOOLS.filter((tool) => hasFeature(tool.feature));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#efe3cd_0,_transparent_30%),linear-gradient(135deg,_#faf6ed_0%,_#f8f4ec_60%,_#f3efe5_100%)] px-4 py-8 sm:px-8 sm:py-12">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-10 sm:mb-12">
        <div className="w-16 h-16 mb-5 rounded-2xl bg-[#3d3a35] flex items-center justify-center shadow-lg shadow-[#3d3a35]/20">
          <Zap className="w-10 h-10 text-white" />
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#625e57]">ADHD toolkit</p>
        <h1 className="text-4xl font-black tracking-tight text-[#33302b] mb-2">
          Focus and Planning
        </h1>
        <p className="text-base text-[#5e665d] max-w-xl">
          Choose one small support tool for attention, planning, time, or emotional regulation.
        </p>
      </div>

      {/* Feature cards */}
      <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        {availableTools.map(({ moduleId, to, icon: Icon, title, desc, bg, border, text, hover, manualOnly }) => (
          <Link
            key={moduleId}
            to={to}
            className={`group relative bg-[#fffdf8] ${border} border rounded-2xl p-5 flex flex-col gap-3 shadow-sm ${hover} hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#3d3a35] focus:ring-offset-2 transition-all duration-200 overflow-hidden`}
          >
             <div className={`absolute -top-8 -right-8 w-24 h-24 ${bg} rounded-full blur-2xl group-hover:scale-110 transition-transform duration-300`} />
            <div className={`w-11 h-11 rounded-xl ${bg} ${border} border flex items-center justify-center ${text}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
                <h3 className="font-bold text-[#33302b] transition-colors group-hover:text-[#3d3a35]">{title}</h3>
                <p className="text-sm text-[#5e665d] mt-1 leading-relaxed">{desc}</p>
                 {manualOnly && <p className="mt-2 text-xs font-medium text-[#7b8279]">Start whenever you are ready</p>}
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
