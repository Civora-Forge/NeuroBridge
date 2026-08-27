import { ArrowRight, Heart, Sparkles, BookOpen, Smile, MessageCircle, MessagesSquare, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";
import AdaptiveGreeting from "@/components/neurobridge/AdaptiveGreeting";
import SensorySettings from "@/components/neurobridge/SensorySettings";
import { useASDData } from "@/hooks/useASDData";
import { useAuth } from "@/context/AuthContext";

const toolTones = {
  stories: { card: "border-[#b2dfdb] bg-gradient-to-br from-white via-[#f0faf7] to-[#e0f5ef]", icon: "bg-gradient-to-br from-[#2dd4a8] to-[#0d9488]", accent: "text-[#0d9488]" },
  feelings: { card: "border-[#f7d5e5] bg-gradient-to-br from-white via-[#fffaff] to-[#fff4f6]", icon: "bg-gradient-to-br from-[#ff8096] to-[#ef4b6c]", accent: "text-[#e84f6e]" },
  practice: { card: "border-[#cbb9ff] bg-gradient-to-br from-white via-[#fcfaff] to-[#f4efff]", icon: "bg-gradient-to-br from-[#9c73ff] to-[#6844e5]", accent: "text-[#704ce1]" },
  talk: { card: "border-[#f3d58a] bg-gradient-to-br from-white via-[#fffdf8] to-[#fff9ec]", icon: "bg-gradient-to-br from-[#ffd84d] to-[#ffad09]", accent: "text-[#d89500]" },
};

const quickActions = [
  { to: "/asd/stories", icon: BookOpen, label: "Stories", description: "Practice real-world situations with gentle story cards.", sticker: "calm-leaf", tone: "stories", hint: "Gentle practice, one story at a time" },
  { to: "/asd/emotion", icon: Smile, label: "Feelings", description: "Recognise and name emotions with kind feedback.", sticker: "calm-star", tone: "feelings", hint: "All feelings are welcome here" },
  { to: "/asd/social-scenarios", icon: MessageCircle, label: "Practice", description: "Try one social situation at a time.", sticker: "grounding-flower", tone: "practice", hint: "You set the pace" },
  { to: "/communication", icon: MessagesSquare, label: "Talk", description: "Practice conversations with one-tap phrases.", sticker: "focus-star", tone: "talk", hint: "One conversation, one step" },
];

function ASDToolArt({ tone }) {
  const arts = {
    stories: (
      <div className="relative h-[150px] w-[165px]">
        <div className="absolute left-4 top-2 h-[120px] w-[100px] rounded-[22px] border border-[#b2dfdb] bg-white p-3 shadow-[0_8px_20px_rgba(13,148,136,.10)]">
          <div className="mb-2 h-[6px] w-[50px] rounded-full bg-[#0d9488]/20"/>
          <div className="mb-2 h-[6px] w-[65px] rounded-full bg-[#0d9488]/15"/>
          <div className="mb-2 h-[6px] w-[40px] rounded-full bg-[#0d9488]/20"/>
          <div className="h-[6px] w-[55px] rounded-full bg-[#0d9488]/15"/>
        </div>
        <Sparkles size={20} className="absolute right-2 top-0 text-[#2dd4a8]"/>
      </div>
    ),
    feelings: (
      <div className="relative flex h-[150px] w-[165px] items-center justify-center gap-2">
        {["#ff8096","#ffd84d","#9c73ff","#47b4ff"].map((c, i) => (
          <div key={i} className="grid h-[42px] w-[42px] place-items-center rounded-full border-2 bg-white shadow-[2px_2px_0_#f7d5e5]" style={{ borderColor: c }}>
            <span className="text-[18px]">{["😊","😐","😟","😮"][i]}</span>
          </div>
        ))}
        <Sparkles size={18} className="absolute -right-1 top-1 text-[#ef4b6c]"/>
      </div>
    ),
    practice: (
      <div className="relative flex h-[150px] w-[165px] items-center justify-center">
        <div className="rounded-[22px] border border-[#cbb9ff] bg-white p-4 shadow-[0_8px_20px_rgba(104,68,229,.10)]">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-[10px] w-[10px] rounded-full bg-[#6844e5]"/>
            <div className="h-[6px] w-[60px] rounded-full bg-[#cbb9ff]"/>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-[10px] w-[10px] rounded-full bg-[#9c73ff]"/>
            <div className="h-[6px] w-[50px] rounded-full bg-[#dfd2ff]"/>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-[10px] w-[10px] rounded-full bg-[#cbb9ff]"/>
            <div className="h-[6px] w-[55px] rounded-full bg-[#eee6ff]"/>
          </div>
        </div>
        <Sparkles size={18} className="absolute -right-1 top-2 text-[#704ce1]"/>
      </div>
    ),
    talk: (
      <div className="relative flex h-[150px] w-[165px] items-center justify-center">
        <div className="rounded-[22px] border border-[#f3d58a] bg-[#fffdf8] p-4 shadow-[0_8px_20px_rgba(216,149,0,.08)]">
          <div className="mb-1.5 rounded-xl rounded-bl-sm bg-[#fff9ec] px-3 py-2 text-[11px] font-bold text-[#d89500]">Hi there!</div>
          <div className="ml-4 mb-1.5 rounded-xl rounded-br-sm bg-[#fff1b8] px-3 py-2 text-[11px] font-bold text-[#735b05]">Hello! How are you?</div>
          <div className="rounded-xl rounded-bl-sm bg-[#fff9ec] px-3 py-2 text-[11px] font-bold text-[#d89500]">I'm good, thanks!</div>
        </div>
        <Sparkles size={18} className="absolute -right-1 top-2 text-[#d89500]"/>
      </div>
    ),
  };
  return arts[tone] || null;
}

function ASDToolCard({ tool }) {
  const { to, icon: Icon, label, description, hint, tone } = tool;
  const s = toolTones[tone];
  return (
    <Link
      to={to}
      className={`group relative overflow-hidden rounded-[28px] border ${s.card} shadow-[0_5px_18px_rgba(34,40,70,.065)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(34,40,70,.11)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200`}
    >
      <div className="grid min-h-[305px] gap-3 p-7 sm:p-8 lg:grid-cols-[minmax(0,1fr)_175px] lg:items-center">
        <div className="relative z-10 flex h-full min-w-0 flex-col">
          <div className={`grid h-[58px] w-[58px] place-items-center rounded-[18px] text-white ${s.icon} shadow-[0_7px_16px_rgba(50,50,100,.14)]`}>
            <Icon size={29} strokeWidth={2} />
          </div>
          <h2 className="mt-5 text-[24px] font-black tracking-[-0.035em] text-[#134E4A] sm:text-[26px]">{label}</h2>
          <p className="mt-2 max-w-[360px] text-[14px] leading-[1.55] text-[#5F8A87]">{description}</p>
          <div className="mt-auto pt-5">
            <p className="flex items-center gap-2 text-[13px] font-medium text-[#5F8A87]">
              <Sparkles size={17} strokeWidth={2.2} className={s.accent} />{hint}
            </p>
            <span className={`mt-4 inline-flex items-center gap-2 text-[15px] font-black ${s.accent} transition-all group-hover:gap-3`}>
              Open tool <ArrowRight size={17} />
            </span>
          </div>
        </div>
        <div className="pointer-events-none hidden items-center justify-center lg:flex">
          <ASDToolArt tone={tone} />
        </div>
      </div>
    </Link>
  );
}

export default function ASDPage() {
  const { hasFeature } = useAuth();
  const { routines, loading: routinesLoading } = useASDData();
  const nextRoutineTask = routines?.find((r) => !r.completed) || null;

  return (
    <SupportToolThemeProvider theme="asd_social">
      <SupportToolLayout title="Social & Emotional Support" description="A calm space to practise emotions, conversations, and social stories.">
        <main className="min-h-screen bg-[#f0faf7] text-[#134E4A]">
          <div className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">

            {/* ── Hero Header with Mascot ── */}
            <header className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_390px]">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0d9488] flex items-center gap-2">
                  <Sparkles size={15} /> Social & Emotional Support
                </p>
                <h1 className="mt-3 max-w-[760px] text-[46px] font-black leading-[1] tracking-[-0.055em] text-[#134E4A] sm:text-[58px] lg:text-[64px]">
                  Feelings & <span className="bg-gradient-to-r from-[#0d9488] to-[#2dd4a8] bg-clip-text text-transparent">Friends</span>
                </h1>
                <span className="sr-only">Feelings and Friends</span>
                <p className="mt-5 max-w-[610px] text-[17px] leading-[1.55] text-[#5F8A87] sm:text-[19px]">
                  Choose one gentle tool for emotions, stories, social practice, or conversations.
                </p>
                <AdaptiveGreeting responseTier={0} seed={0} />
              </div>
              <div className="relative hidden min-h-[230px] lg:block">
                <img src="/asd-mascot.svg" alt="A friendly cloud character with a small leaf friend" className="absolute bottom-0 left-0 h-[220px] w-[270px] object-contain" />
                <div className="absolute right-0 top-4 rounded-[24px] border border-[#b2dfdb] bg-[#f0faf7] px-6 py-4 text-center text-[15px] font-bold leading-6 text-[#134E4A] shadow-sm">
                  You belong here.<br />Every feeling is welcome. <Heart size={15} className="inline fill-[#2dd4a8] text-[#2dd4a8]" />
                </div>
                <Sparkles size={25} className="absolute bottom-3 right-[70px] text-[#2dd4a8]" />
              </div>
            </header>

            {/* ── Routine hint ── */}
            {nextRoutineTask && !routinesLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 rounded-[22px] border border-[#b2dfdb] bg-gradient-to-r from-white via-[#f0faf7] to-[#e0f5ef] p-5 shadow-[3px_3px_0_#d1fae5] flex items-center gap-4"
              >
                <div className="grid h-[44px] w-[44px] place-items-center rounded-full bg-[#0d9488]/10 text-[#0d9488]">
                  <Clock size={22} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0d9488]">Coming up next</p>
                  <p className="text-[15px] font-bold text-[#134E4A] mt-0.5">{nextRoutineTask.title || nextRoutineTask.name}</p>
                </div>
                <Link to="/asd/stories" className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-[#0d9488] px-5 text-[14px] font-black text-white shadow-[3px_3px_0_#b2dfdb] transition-colors hover:bg-[#0f766e]">
                  Continue <ArrowRight size={16} />
                </Link>
              </motion.div>
            )}

            {/* ── Tool Grid ── */}
            <section className="mt-10 grid gap-5 sm:grid-cols-2">
              {quickActions.map((tool) => (
                <ASDToolCard key={tool.to} tool={tool} />
              ))}
            </section>

            {/* ── Sensory Settings ── */}
            <div className="mt-8">
              <SensorySettings moduleKey="asd" />
            </div>

            {/* ── Footer ── */}
            <footer className="mt-6 flex min-h-[68px] items-center justify-center gap-3 rounded-[24px] bg-gradient-to-r from-[#e0f5ef] via-[#f0faf7] to-[#e8f8f5] px-5 text-center text-[14px] text-[#5F8A87] sm:text-[16px]">
              <Heart size={23} strokeWidth={2} className="shrink-0 text-[#2dd4a8]" />
              <span>You don&apos;t need to have it all figured out — just the <strong className="font-black text-[#0d9488]">next small step.</strong></span>
              <Sparkles size={21} className="shrink-0 text-[#80cbc4]" />
            </footer>
          </div>
        </main>
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}
