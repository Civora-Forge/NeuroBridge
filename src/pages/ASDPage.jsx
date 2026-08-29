import { useState } from "react";
import { ArrowRight, Heart, Sparkles, BookOpen, Smile, MessageCircle, MessagesSquare, Clock, Moon, Hand, RefreshCcw, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";
import AdaptiveGreeting from "@/components/neurobridge/AdaptiveGreeting";
import SensorySettings from "@/components/neurobridge/SensorySettings";
import { useASDData } from "@/hooks/useASDData";
import { useAuth } from "@/context/AuthContext";
import InterventionModal from "@/components/interventions/InterventionModal";
import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";

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

const asdInterventions = [
  {
    id: "sensory_reset",
    title: "Sensory Reset",
    description: "Low-stimulation sanctuary with gentle pulse orb & quiet checklist.",
    icon: Moon,
    badge: "Step 1 · Calm",
    color: "bg-[#134E4A]",
    accent: "text-[#0D9488]",
    borderAccent: "border-l-[#134E4A]",
  },
  {
    id: "grounding_activity",
    title: "Grounding Activity",
    description: "5-step gentle regulation: Pause, Look around, Notice one thing.",
    icon: Hand,
    badge: "Step 2 · Ground",
    color: "bg-[#0D9488]",
    accent: "text-[#0D9488]",
    borderAccent: "border-l-[#0D9488]",
  },
  {
    id: "transition_support",
    title: "Transition Support",
    description: "Now · Next · Then routine to make activity switching easy.",
    icon: RefreshCcw,
    badge: "Step 3 · Next",
    color: "bg-[#2DD4BF]",
    accent: "text-[#0F766E]",
    borderAccent: "border-l-[#2DD4BF]",
  },
];

function ASDLeafField() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
      <span className="nb-leaf" style={{ left: "6%", top: "4%", width: 14, height: 14, "--nb-leaf-dur": "9s", animationDelay: "0s", background: "radial-gradient(circle at 30% 30%, #ffffff, #a7f3d0)" }} />
      <span className="nb-leaf" style={{ left: "38%", top: "2%", width: 10, height: 10, "--nb-leaf-dur": "11s", animationDelay: "1.4s", background: "radial-gradient(circle at 30% 30%, #ffffff, #6ee7b7)" }} />
      <span className="nb-leaf" style={{ right: "12%", top: "8%", width: 16, height: 16, "--nb-leaf-dur": "10s", animationDelay: "0.7s", background: "radial-gradient(circle at 30% 30%, #ffffff, #5eead4)" }} />
      <span className="nb-leaf" style={{ left: "72%", top: "0%", width: 9, height: 9, "--nb-leaf-dur": "12s", animationDelay: "2.2s", background: "radial-gradient(circle at 30% 30%, #ffffff, #99f6e4)" }} />
    </div>
  );
}

function ASDToolArt({ tone }) {
  const arts = {
    stories: (
      <div className="relative h-[150px] w-[165px]">
        <div className="absolute left-4 top-2 h-[120px] w-[100px] rounded-[14px] border border-[#b2dfdb] bg-white p-3 shadow-[0_8px_20px_rgba(13,148,136,.10)]">
          <div className="mb-2 h-[6px] w-[50px] rounded-full bg-[#0d9488]/20"/>
          <div className="mb-2 h-[6px] w-[65px] rounded-full bg-[#0d9488]/15"/>
          <div className="mb-2 h-[6px] w-[40px] rounded-full bg-[#0d9488]/20"/>
          <div className="h-[6px] w-[55px] rounded-full bg-[#0d9488]/15"/>
        </div>
        <Sparkles size={20} className="absolute right-2 top-0 text-[#2dd4a8] nb-twinkle"/>
      </div>
    ),
    feelings: (
      <div className="relative flex h-[150px] w-[165px] items-center justify-center gap-2">
        {["#ff8096","#ffd84d","#9c73ff","#47b4ff"].map((c, i) => (
          <div key={i} className="grid h-[42px] w-[42px] place-items-center rounded-full border-2 bg-white shadow-[2px_2px_0_#f7d5e5]" style={{ borderColor: c }}>
            <span className="text-[18px]">{["😊","😐","😟","😮"][i]}</span>
          </div>
        ))}
        <Sparkles size={18} className="absolute -right-1 top-1 text-[#ef4b6c] nb-twinkle"/>
      </div>
    ),
    practice: (
      <div className="relative flex h-[150px] w-[165px] items-center justify-center">
        <div className="rounded-[14px] border border-[#cbb9ff] bg-white p-4 shadow-[0_8px_20px_rgba(104,68,229,.10)]">
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
        <Sparkles size={18} className="absolute -right-1 top-2 text-[#704ce1] nb-twinkle"/>
      </div>
    ),
    talk: (
      <div className="relative flex h-[150px] w-[165px] items-center justify-center">
        <div className="rounded-[14px] border border-[#f3d58a] bg-[#fffdf8] p-4 shadow-[0_8px_20px_rgba(216,149,0,.08)]">
          <div className="mb-1.5 rounded-xl rounded-bl-sm bg-[#fff9ec] px-3 py-2 text-[11px] font-bold text-[#d89500]">Hi there!</div>
          <div className="ml-4 mb-1.5 rounded-xl rounded-br-sm bg-[#fff1b8] px-3 py-2 text-[11px] font-bold text-[#735b05]">Hello! How are you?</div>
          <div className="rounded-xl rounded-bl-sm bg-[#fff9ec] px-3 py-2 text-[11px] font-bold text-[#d89500]">I'm good, thanks!</div>
        </div>
        <Sparkles size={18} className="absolute -right-1 top-2 text-[#d89500] nb-twinkle"/>
      </div>
    ),
  };
  return arts[tone] || null;
}

function ASDToolCard({ tool, index, reduced, gentle }) {
  const { to, icon: Icon, label, description, hint, tone } = tool;
  const s = toolTones[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: gentle ? 0.35 : 0.45, delay: reduced ? 0 : index * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={reduced ? undefined : { y: -4, transition: { duration: 0.2 } }}
    >
      <Link
        to={to}
        className={`group relative overflow-hidden rounded-[16px] border-l-[4px] ${s.card} shadow-[0_4px_14px_rgba(13,148,136,.08)] transition-shadow duration-200 hover:shadow-[0_10px_24px_rgba(13,148,136,.14)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 block`}
      >
        <div className="grid min-h-[305px] gap-3 p-7 sm:p-8 lg:grid-cols-[minmax(0,1fr)_175px] lg:items-center">
          <div className="relative z-10 flex h-full min-w-0 flex-col">
            <div className="flex items-center gap-2">
              <div className={`grid h-[44px] w-[44px] place-items-center rounded-[10px] text-white ${s.icon} shadow-[0_4px_10px_rgba(13,148,136,.18)]`}>
                <Icon size={22} strokeWidth={2} />
              </div>
              <span className="h-1.5 w-1.5 rounded-full bg-[#0d9488]/30" aria-hidden="true" />
              <span className="text-[11px] font-bold tracking-wide text-[#5F8A87]">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <h2 className="mt-4 text-[22px] font-black tracking-[-0.03em] text-[#134E4A] sm:text-[24px]">{label}</h2>
            <p className="mt-2 max-w-[360px] text-[14px] leading-[1.55] text-[#5F8A87]">{description}</p>
            <div className="mt-auto pt-5">
              <p className="flex items-center gap-2 text-[12px] font-semibold tracking-wide text-[#5F8A87]">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0d9488]/10 text-[#0d9488]"><Check size={11} strokeWidth={3} /></span>{hint}
              </p>
              <span className={`mt-3 inline-flex items-center gap-2 text-[14px] font-black ${s.accent} transition-all group-hover:gap-3`}>
                Open tool <ArrowRight size={16} />
              </span>
            </div>
          </div>
          <div className="pointer-events-none hidden items-center justify-center lg:flex">
            <ASDToolArt tone={tone} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function ASDPage() {
  const { hasFeature } = useAuth();
  const { routines, loading: routinesLoading } = useASDData();
  const nextRoutineTask = routines?.find((r) => !r.completed) || null;
  const [activeIntervention, setActiveIntervention] = useState(null);
  const { reduced, gentle } = useSensoryReducedMotion();

  const heroVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduced ? 0 : 0.11 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: reduced ? 0 : 14 },
    visible: { opacity: 1, y: 0, transition: { duration: gentle ? 0.32 : 0.48, ease: [0.25, 0.1, 0.25, 1] } },
  };

  return (
    <SupportToolThemeProvider theme="asd_social">
      <SupportToolLayout title="Social & Emotional Support" description="A calm space to practise emotions, conversations, and social stories.">
        <main className="min-h-screen bg-[#f0faf7] text-[#134E4A]">
          <div className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">

            {/* ── Hero Header with Mascot ── */}
            <motion.header
              variants={heroVariants}
              initial="hidden"
              animate="visible"
              className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_390px] overflow-hidden rounded-[20px] lg:rounded-[24px] lg:border lg:border-[#b2dfdb]/50 lg:bg-white/40 lg:p-6"
            >
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[20px]">
                <ASDLeafField />
              </div>
              <div className="relative z-10">
                <motion.p variants={itemVariants} className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0d9488] flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0d9488] text-white"><Sparkles size={11} /></span> Social & Emotional Support
                </motion.p>
                <motion.h1 variants={itemVariants} className="mt-3 max-w-[760px] text-[46px] font-black leading-[1] tracking-[-0.055em] text-[#134E4A] sm:text-[58px] lg:text-[64px]">
                  Feelings & <span className="bg-gradient-to-r from-[#0d9488] to-[#2dd4a8] bg-clip-text text-transparent">Friends</span>
                </motion.h1>
                <span className="sr-only">Feelings and Friends</span>
                <motion.p variants={itemVariants} className="mt-5 max-w-[610px] text-[17px] leading-[1.55] text-[#5F8A87] sm:text-[19px]">
                  Choose one gentle tool for emotions, stories, social practice, or sensory support.
                </motion.p>
                <motion.div variants={itemVariants}>
                  <AdaptiveGreeting responseTier={0} seed={0} />
                </motion.div>
              </div>
              <motion.div variants={itemVariants} className="relative hidden min-h-[230px] lg:block">
                <img src="/asd-mascot.svg" alt="A friendly cloud character with a small leaf friend" className="absolute bottom-0 left-0 h-[220px] w-[270px] object-contain nb-mascot-float" />
                <div className="absolute right-0 top-4 rounded-[14px] border-l-[4px] border-[#0d9488] bg-white px-6 py-4 text-center text-[15px] font-bold leading-6 text-[#134E4A] shadow-sm">
                  You belong here.<br />Every feeling is welcome. <Heart size={15} className="inline fill-[#2dd4a8] text-[#2dd4a8]" />
                </div>
                <Sparkles size={22} className="absolute bottom-3 right-[70px] text-[#2dd4a8] nb-twinkle" />
              </motion.div>
            </motion.header>

            {/* ── Routine hint ── */}
            {nextRoutineTask && !routinesLoading && (
              <motion.div
                initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: gentle ? 0.32 : 0.48, ease: [0.25, 0.1, 0.25, 1] }}
                className="mt-8 rounded-[14px] border-l-[4px] border-[#0d9488] bg-white p-5 shadow-[0_4px_14px_rgba(13,148,136,.08)] flex items-center gap-4"
              >
                <div className="grid h-[44px] w-[44px] place-items-center rounded-[10px] bg-[#0d9488] text-white shrink-0">
                  <Clock size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0d9488] flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-[#2dd4a8] animate-pulse" aria-hidden="true" /> Coming up next
                  </p>
                  <p className="text-[15px] font-bold text-[#134E4A] mt-0.5 truncate">{nextRoutineTask.title || nextRoutineTask.name}</p>
                </div>
                <Link to="/asd/stories" className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[#0d9488] px-5 text-[14px] font-black text-white shadow-[2px_2px_0_#b2dfdb] transition-colors hover:bg-[#0f766e] shrink-0">
                  Continue <ArrowRight size={16} />
                </Link>
              </motion.div>
            )}

            {/* ── Interactive ASD Support (Role 3 Interventions) ── */}
            <motion.section
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              transition={{ duration: gentle ? 0.32 : 0.5, ease: [0.25, 0.1, 0.25, 1] }}
              className="mt-10"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#134E4A] flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-[#0d9488] text-white"><Sparkles size={14} /></span> Interactive ASD Support
                  </h2>
                  <p className="text-xs sm:text-sm text-[#5F8A87] mt-1">
                    Predictable steps — one at a time, at your pace.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {asdInterventions.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: reduced ? 0 : 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.18 }}
                      transition={{ duration: gentle ? 0.32 : 0.45, delay: reduced ? 0 : i * 0.09, ease: [0.25, 0.1, 0.25, 1] }}
                      whileHover={reduced ? undefined : { y: -4 }}
                      onClick={() => setActiveIntervention(item.id)}
                      className={`group relative overflow-hidden rounded-[14px] border border-[#B2DFDB] border-l-[4px] ${item.borderAccent} bg-white p-5 shadow-[0_4px_12px_rgba(13,148,136,.07)] transition-shadow duration-200 hover:shadow-[0_8px_20px_rgba(13,148,136,.12)] cursor-pointer flex flex-col justify-between`}
                    >
                      <div className="absolute right-3 top-3 flex gap-1" aria-hidden="true">
                        {[0,1,2].map((dot) => (
                          <span key={dot} className={`h-1.5 w-1.5 rounded-full ${dot === i ? "bg-[#0d9488]" : "bg-[#b2dfdb]/60"}`} />
                        ))}
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-[10px] ${item.color} text-white flex items-center justify-center shadow-sm shrink-0`}>
                            <Icon size={18} strokeWidth={2.2} />
                          </div>
                          <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-black tracking-wide bg-[#F0FAF7] text-[#0D9488] border border-[#B2DFDB]">
                            {item.badge}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-[16px] font-black tracking-[-0.02em] text-[#134E4A]">{item.title}</h3>
                          <p className="text-[12px] text-[#5F8A87] mt-1 leading-relaxed">{item.description}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-1.5 text-[12px] font-black text-[#0D9488]">
                        <span className="grid h-5 w-5 place-items-center rounded-full border border-[#b2dfdb] text-[#0d9488] group-hover:bg-[#0d9488] group-hover:text-white group-hover:border-[#0d9488] transition-colors">
                          <ArrowRight size={12} />
                        </span>
                        Start Exercise
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.section>

            {/* ── Main Tool Grid ── */}
            <motion.section
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.08 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mt-10 grid gap-5 sm:grid-cols-2"
            >
              {quickActions.map((tool, i) => (
                <ASDToolCard key={tool.to} tool={tool} index={i} reduced={reduced} gentle={gentle} />
              ))}
            </motion.section>

            {/* ── Sensory Settings ── */}
            <div className="mt-8">
              <SensorySettings moduleKey="asd" />
            </div>

            {/* ── Footer ── */}
            <motion.footer
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mt-6 flex min-h-[68px] items-center justify-center gap-3 rounded-[14px] border-l-[4px] border-[#0d9488] bg-white px-5 text-center text-[14px] text-[#5F8A87] sm:text-[16px] shadow-sm"
            >
              <Heart size={18} strokeWidth={2} className="shrink-0 text-[#2dd4a8]" />
              <span>You don&apos;t need to have it all figured out — just the <strong className="font-black text-[#0d9488]">next small step.</strong></span>
              <Sparkles size={18} className="shrink-0 text-[#80cbc4] nb-twinkle" />
            </motion.footer>
          </div>
        </main>

        {/* Role 3 Active Intervention Modal */}
        <InterventionModal
          isOpen={Boolean(activeIntervention)}
          recommendationId={activeIntervention}
          onClose={() => setActiveIntervention(null)}
          onComplete={() => setActiveIntervention(null)}
        />
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}
