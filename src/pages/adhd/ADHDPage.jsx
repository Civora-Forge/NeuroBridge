import { ArrowRight, Brain, CalendarClock, Check, CheckSquare, Heart, Sparkles, Timer, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { FEATURES } from "@/lib/featureRegistry";

export const ADHD_LANDING_TOOLS = [
  { moduleId: "support.visual_timeline", feature: FEATURES.ADHD_TIMELINE, to: "/adhd/timeline", icon: CalendarClock, title: "Visual Timeline", desc: "Organize tasks and routines with clear visual time blocks.", hint: "Start whenever you are ready", tone: "sky", manualOnly: true },
  { moduleId: "support.task_breakdown", feature: FEATURES.ADHD_BREAKDOWN, to: "/adhd/breakdown", icon: CheckSquare, title: "Task Breakdown", desc: "Turn a large task into smaller, editable next steps.", hint: "Break it down. Get it done.", tone: "rose" },
  { moduleId: "support.focus_session", feature: FEATURES.ADHD_FOCUS, to: "/adhd/focus", icon: Timer, title: "Focus Session", desc: "Use timed focus blocks with Pomodoro-style cues and built-in reset prompts.", hint: "Stay focused, one block at a time", tone: "green" },
  { moduleId: "support.mood_checkin", feature: FEATURES.ADHD_EMOTION, to: "/adhd/emotion-coach", icon: Brain, title: "Mood Check-in", desc: "Name what is happening and choose a small regulation prompt.", hint: "Start whenever you are ready", tone: "gold", manualOnly: true },
  { moduleId: "support.accountability_session", feature: FEATURES.ADHD_DOUBLING, to: "/adhd/doubling", icon: UsersRound, title: "Accountability Session", desc: "Set a commitment and use a guided timer to stay with the next task.", hint: "Start whenever you are ready", tone: "violet", manualOnly: true },
];

const toneStyles = {
  sky: { card: "border-[#b6d8fb] bg-gradient-to-br from-white via-[#fbfdff] to-[#f3f8ff]", icon: "bg-gradient-to-br from-[#47b4ff] to-[#1680db]", accent: "text-[#177fd4]" },
  rose: { card: "border-[#ffc1cc] bg-gradient-to-br from-white via-[#fffafb] to-[#fff4f6]", icon: "bg-gradient-to-br from-[#ff8096] to-[#ef4b6c]", accent: "text-[#e84f6e]" },
  green: { card: "border-[#c3e5b8] bg-gradient-to-br from-white via-[#fcfff9] to-[#f5fff1]", icon: "bg-gradient-to-br from-[#79d34c] to-[#3ca02b]", accent: "text-[#37972c]" },
  gold: { card: "border-[#f3d58a] bg-gradient-to-br from-white via-[#fffdf8] to-[#fff9ec]", icon: "bg-gradient-to-br from-[#ffd84d] to-[#ffad09]", accent: "text-[#d89500]" },
  violet: { card: "border-[#d1c0ff] bg-gradient-to-br from-white via-[#fcfaff] to-[#f8f5ff]", icon: "bg-gradient-to-br from-[#9c73ff] to-[#6844e5]", accent: "text-[#704ce1]" },
};

function TimelineArt() {
  return <div className="relative h-[150px] w-[160px]"><div className="absolute left-[28px] top-3 h-[130px] w-[3px] rounded-full bg-[#4a73df]" />{[{ top: 12, color: "bg-[#cfe1ff]" }, { top: 60, color: "bg-[#ccecc8]" }, { top: 108, color: "bg-[#ded3ff]" }].map(({ top, color }) => <div key={top} className="absolute left-[20px]" style={{ top }}><span className="absolute left-0 top-2 h-[18px] w-[18px] rounded-full border-[3px] border-[#4a73df] bg-white" /><span className={`absolute left-10 top-0 h-[35px] w-[92px] rounded-xl ${color}`} /></div>)}</div>;
}
function BreakdownArt() {
  return <div className="relative flex h-[150px] w-[165px] items-center justify-center"><div className="relative w-[125px] rounded-[22px] border border-[#ffc4d0] bg-white p-4 shadow-[0_10px_25px_rgba(220,80,110,.10)]">{[true, false, false, false].map((checked, index) => <div key={index} className={`flex items-center gap-3 ${index < 3 ? "mb-3" : ""}`}><span className={`grid h-[17px] w-[17px] shrink-0 place-items-center rounded-[5px] border ${checked ? "border-[#ef6681] bg-[#ef6681]" : "border-[#f2a8b6] bg-white"}`}>{checked && <Check size={11} strokeWidth={3} className="text-white" />}</span><span className={`h-[6px] rounded-full bg-[#f5cbd3] ${index % 2 === 0 ? "w-[56px]" : "w-[44px]"}`} /></div>)}</div><Sparkles size={22} className="absolute right-0 top-2 text-[#ff7691]" /></div>;
}
function ToolArt({ tone }) {
  if (tone === "sky") return <TimelineArt />;
  if (tone === "rose") return <BreakdownArt />;
  const assets = { green: ["/focus-tomato.svg", "h-[140px] w-[140px]"], gold: ["/mood-sun.svg", "h-[130px] w-[150px]"], violet: ["/accountability-mascot.svg", "h-[135px] w-[245px]"] };
  const [src, size] = assets[tone];
  return <div className={`flex h-[150px] ${tone === "violet" ? "w-[270px]" : "w-[175px]"} items-center justify-center`}><img src={src} alt="" aria-hidden="true" className={`${size} object-contain`} /></div>;
}
function ToolCard({ tool }) {
  const { to, icon: Icon, title, desc, hint, tone } = tool;
  const styles = toneStyles[tone];
  const isAccountability = tone === "violet";
  return <Link to={to} className={`group relative overflow-hidden rounded-[28px] border ${styles.card} ${isAccountability ? "sm:col-span-2" : ""} shadow-[0_5px_18px_rgba(34,40,70,.065)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(34,40,70,.11)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200`}><div className={isAccountability ? "grid min-h-[230px] items-center gap-7 p-7 sm:p-8 lg:grid-cols-[1fr_300px] lg:px-10" : "grid min-h-[305px] gap-3 p-7 sm:p-8 lg:grid-cols-[minmax(0,1fr)_175px] lg:items-center"}><div className="relative z-10 flex h-full min-w-0 flex-col"><div className={`grid h-[58px] w-[58px] place-items-center rounded-[18px] text-white ${styles.icon} shadow-[0_7px_16px_rgba(50,50,100,.14)]`}><Icon size={29} strokeWidth={2} /></div><h2 className="mt-5 text-[24px] font-black tracking-[-0.035em] text-[#172039] sm:text-[26px]">{title}</h2><p className="mt-2 max-w-[360px] text-[14px] leading-[1.55] text-[#525b72]">{desc}</p><div className="mt-auto pt-5"><p className="flex items-center gap-2 text-[13px] font-medium text-[#596178]"><Sparkles size={17} strokeWidth={2.2} className={styles.accent} />{hint}</p><span className={`mt-4 inline-flex items-center gap-2 text-[15px] font-black ${styles.accent} transition-all group-hover:gap-3`}>Open tool <ArrowRight size={17} /></span></div></div><div className={`pointer-events-none hidden items-center justify-center lg:flex ${isAccountability ? "justify-self-end" : ""}`}><ToolArt tone={tone} /></div></div></Link>;
}

export default function ADHDPage() {
  const { hasFeature } = useAuth();
  const availableTools = ADHD_LANDING_TOOLS.filter((tool) => hasFeature(tool.feature));
  return <main className="min-h-screen bg-[#fffefa] text-[#182039]"><div className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12"><header className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_390px]"><div><h1 className="max-w-[760px] text-[46px] font-black leading-[1] tracking-[-0.055em] text-[#151c31] sm:text-[58px] lg:text-[64px]">Focus and <span className="bg-gradient-to-r from-[#6546da] to-[#9158ec] bg-clip-text text-transparent">Planning</span></h1><span className="sr-only">Focus and Planning</span><p className="mt-5 max-w-[610px] text-[17px] leading-[1.55] text-[#58627a] sm:text-[19px]">Choose one small support tool for attention, planning, time, or emotional regulation.</p></div><div className="relative hidden min-h-[230px] lg:block"><img src="/focus-mascot.svg" alt="Pink brain writing in a notebook beside a potted plant" className="absolute bottom-0 left-0 h-[220px] w-[270px] object-contain" /><div className="absolute right-0 top-4 rounded-[24px] border border-[#ddcdf8] bg-[#fcf8ff] px-6 py-4 text-center text-[15px] font-bold leading-6 text-[#31374e] shadow-sm">Small tools.<br />Big impact. <Heart size={15} className="inline fill-[#865ce1] text-[#865ce1]" /></div><Sparkles size={25} className="absolute bottom-3 right-[70px] text-[#efb31c]" /></div></header><section className="mt-10 grid gap-5 sm:grid-cols-2">{availableTools.map((tool) => <ToolCard key={tool.moduleId} tool={tool} />)}</section><footer className="mt-6 flex min-h-[68px] items-center justify-center gap-3 rounded-[24px] bg-gradient-to-r from-[#fff8fc] via-[#faf5ff] to-[#fffaf1] px-5 text-center text-[14px] text-[#596178] sm:text-[16px]"><Heart size={23} strokeWidth={2} className="shrink-0 text-[#f05f9b]" /><span>You don&apos;t need perfect focus - just the <strong className="font-black text-[#6847d9]">next right step.</strong></span><Sparkles size={21} className="shrink-0 text-[#e5a91d]" /></footer></div></main>;
}
