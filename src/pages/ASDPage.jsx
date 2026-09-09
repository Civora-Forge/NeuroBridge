import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Hand,
  MessageCircle,
  MessagesSquare,
  Moon,
  RefreshCcw,
  ScanFace,
  Sparkles,
  PartyPopper,
} from "lucide-react";
import { motion } from "framer-motion";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";
import AdaptiveGreeting from "@/components/neurobridge/AdaptiveGreeting";
import SensorySettings from "@/components/neurobridge/SensorySettings";
import InterventionModal from "@/components/interventions/InterventionModal";
import { useASDData } from "@/hooks/useASDData";
import {
  AsdCard,
  AsdCharacter,
  AsdChip,
  AsdDecor,
  AsdProgressRing,
  AsdVisualRoot,
  AsdVisualStyleSelector,
  useASDPracticeCounts,
  useASDVisualStyle,
} from "@/components/asd/ui";
import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";

const featureCards = [
  {
    key: "stories",
    to: "/asd/stories",
    title: "Social Stories",
    description: "Play gentle, illustrated story cards one scene at a time.",
    tone: "teal",
    icon: BookOpen,
    progressLabel: "stories completed",
    cta: "Open a story",
    ctaPlayful: "Let's read!",
    strip: "linear-gradient(145deg,#E9F8F3 0%,#BCF3E3 60%,#D0F5E6 100%)",
    iconBg: "linear-gradient(135deg,#2DD4A8 0%,#0D9488 100%)",
    rail: "#0D9488",
    rail2: "#2DD4A8",
    art: "stories",
    sticker: "⭐",
  },
  {
    key: "emotion",
    to: "/asd/emotion",
    title: "Emotion Decoder",
    description: "Read a small situation and spot what someone is feeling.",
    tone: "amber",
    icon: ScanFace,
    progressLabel: "emotions solved",
    cta: "Decode a feeling",
    ctaPlayful: "Spot the feeling!",
    strip: "linear-gradient(145deg,#FFF8E7 0%,#FCE7BD 60%,#FCEFD9 100%)",
    rail: "#D97706",
    rail2: "#FBBF24",
    iconBg: "linear-gradient(135deg,#FCD34D 0%,#F59E0B 100%)",
    art: "emotion",
    sticker: "💛",
  },
  {
    key: "scenarios",
    to: "/asd/social-scenarios",
    title: "Scenario Simulator",
    description: "Step into one situation and practise how you would respond.",
    tone: "violet",
    icon: MessagesSquare,
    progressLabel: "situations practised",
    cta: "Step into a situation",
    ctaPlayful: "Step in!",
    strip: "linear-gradient(145deg,#F3EFFF 0%,#E3D6FF 60%,#E7DEFB 100%)",
    rail: "#7C3AED",
    rail2: "#A78BFA",
    iconBg: "linear-gradient(135deg,#C4B5FD 0%,#7C3AED 100%)",
    art: "simulator",
    sticker: "🎭",
  },
  {
    key: "conversation",
    to: "/communication",
    title: "Conversation Practice",
    description: "Rehearse a real chat — speak or type, your way.",
    tone: "cyan",
    icon: MessageCircle,
    progressLabel: "conversations completed",
    cta: "Start a chat",
    ctaPlayful: "Let's chat!",
    strip: "linear-gradient(145deg,#E4F7FC 0%,#C9EFFB 60%,#D3EEF9 100%)",
    rail: "#0891B2",
    rail2: "#22D3EE",
    iconBg: "linear-gradient(135deg,#67E8F9 0%,#0891B2 100%)",
    art: "conversation",
    sticker: "💬",
  },
];

const quickCalm = [
  { id: "sensory_reset", icon: Moon, label: "Sensory Reset", hint: "A quiet pause", tile: "bg-gradient-to-br from-[#5EEAD4]/25 to-[#99F6E4]/15 text-[#0D9488]" },
  { id: "grounding_activity", icon: Hand, label: "Grounding", hint: "5 gentle steps", tile: "bg-gradient-to-br from-[#F9A8D4]/20 to-[#FBCFE8]/20 text-[#DB2777]" },
  { id: "transition_support", icon: RefreshCcw, label: "Transition", hint: "Now · Next · Then", tile: "bg-gradient-to-br from-[#A5B4FC]/20 to-[#C7D2FE]/20 text-[#4F46E5]" },
];

/** Decorative atmosphere for the hero. Denser for younger, minimal for clear. */
function HeroAmbience({ density = "soft" }) {
  const items =
    density === "full"
      ? [
          { kind: "bubble", style: { left: "8%", top: "18%", width: 26, height: 26, "--nb-bubble-dur": "9s" } },
          { kind: "bubble", style: { left: "22%", top: "64%", width: 16, height: 16, "--nb-bubble-dur": "12s", opacity: 0.6 } },
          { kind: "bubble", style: { right: "12%", top: "30%", width: 20, height: 20, "--nb-bubble-dur": "10s", opacity: 0.7 } },
          { kind: "leaf", style: { left: "46%", top: "20%", width: 14, height: 14, "--nb-leaf-dur": "11s" } },
          { kind: "leaf", style: { right: "24%", top: "70%", width: 18, height: 18, "--nb-leaf-dur": "13s", opacity: 0.8 } },
          { kind: "twinkle", char: "✦", style: { left: "28%", top: "80%", position: "absolute" } },
          { kind: "twinkle", char: "✦", style: { right: "6%", top: "12%", position: "absolute", animationDelay: "0.6s" } },
        ]
      : density === "light"
        ? [
            { kind: "bubble", style: { left: "8%", top: "20%", width: 22, height: 22, "--nb-bubble-dur": "11s", opacity: 0.5 } },
            { kind: "leaf", style: { right: "20%", top: "66%", width: 16, height: 16, "--nb-leaf-dur": "14s", opacity: 0.55 } },
          ]
        : [{ kind: "twinkle", char: "✦", style: { right: "10%", top: "16%", position: "absolute" } }];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {items.map((item, index) => {
        const cls = item.kind === "bubble" ? "nb-bubble" : item.kind === "leaf" ? "nb-leaf" : "nb-twinkle inline-block";
        return (
          <span key={index} className={cls} style={item.style}>
            {item.char ?? null}
          </span>
        );
      })}
    </div>
  );
}

function FeatureArt({ art, illustration }) {
  const isFull = illustration === 1;
  if (art === "stories") {
    return (
      <div className="pointer-events-none relative h-[104px] w-full" aria-hidden="true">
        <span className="absolute right-[52%] top-2 flex items-end gap-1.5">
          <i className="block h-10 w-7 rounded-md border-2 border-[#A7F3D0] bg-white shadow-[2px_2px_0_#D1FAE5]" />
          <i className="block h-12 w-7 rounded-md border-2 border-[#B2DFDB] bg-[#F0FDF4] shadow-[2px_2px_0_#D5F5EC]" />
          <i className="block h-9 w-7 rounded-md border-2 border-[#BAE6FD] bg-white shadow-[2px_2px_0_#E0F2FE]" />
        </span>
        <AsdCharacter size={52} tone="sky" accessory="leaf" ariaHidden className="nb-mascot-float absolute bottom-1 right-3" style={{ animationDelay: "0.5s" }} />
        {isFull && <AsdDecor className="absolute left-3 top-1 text-lg" label="a star">⭐</AsdDecor>}
      </div>
    );
  }
  if (art === "emotion") {
    return (
      <div className="pointer-events-none relative h-[104px] w-full" aria-hidden="true">
        <div className="absolute left-4 top-2 flex items-center gap-1.5">
          {[
            { face: "😊", ring: "#FDE68A" },
            { face: "😐", ring: "#E0E7FF" },
            { face: "😟", ring: "#FECDD3" },
          ].map((item, i) => (
            <span key={i} className="nb-twinkle grid h-12 w-12 place-items-center rounded-full border-2 bg-white text-xl" style={{ borderColor: item.ring, animationDelay: `${i * 0.4}s` }}>
              {item.face}
            </span>
          ))}
        </div>
        <AsdCharacter size={56} tone="amber" accessory="spark" ariaHidden className="nb-mascot-float absolute bottom-1 right-4" />
        {isFull && <AsdDecor className="absolute right-1 top-1 text-lg" label="a heart">💛</AsdDecor>}
      </div>
    );
  }
  if (art === "simulator") {
    return (
      <div className="pointer-events-none relative h-[104px] w-full" aria-hidden="true">
        <span className="absolute left-4 top-3 rotate-[-4deg] rounded-lg border-2 border-[#DDD6FE] bg-white px-2.5 py-1.5 text-lg shadow-[2px_2px_0_#EDE9FE]">🎭</span>
        <div className="absolute right-[46%] top-4 w-[110px] rounded-2xl border border-[#DDD6FE] bg-white p-3 shadow-[2px_2px_0_#EDE9FE]">
          <div className="mb-1 h-[5px] w-2/3 rounded-full bg-[#7C3AED]/15" />
          <div className="h-[5px] w-1/2 rounded-full bg-[#7C3AED]/15" />
        </div>
        <AsdCharacter size={52} tone="violet" accessory="hand" ariaHidden className="nb-mascot-float absolute bottom-1 right-4" style={{ animationDelay: "0.8s" }} />
        {isFull && <AsdDecor className="absolute left-1 top-1 text-lg" label="a sparkle">✨</AsdDecor>}
      </div>
    );
  }
  return (
    <div className="pointer-events-none relative h-[104px] w-full" aria-hidden="true">
      <div className="absolute left-4 top-3 w-[112px] rounded-2xl rounded-bl-sm border border-[#A5F3FC] bg-white px-3 py-2 shadow-[2px_2px_0_#CFFAFE]">
        <div className="h-[5px] w-full rounded-full bg-[#0891B2]/15" />
        <div className="mt-1 h-[5px] w-3/4 rounded-full bg-[#0891B2]/15" />
      </div>
      <div className="absolute right-[54%] top-6 w-[104px] rounded-2xl rounded-br-sm border border-[#A5F3FC] bg-white px-3 py-2 shadow-[2px_2px_0_#CFFAFE]">
        <div className="h-[5px] w-2/3 rounded-full bg-[#0891B2]/15" />
        <div className="mt-1 h-[5px] w-1/2 rounded-full bg-[#0891B2]/15" />
      </div>
      <AsdCharacter size={52} tone="cyan" accessory="music" ariaHidden className="nb-mascot-float absolute bottom-1 right-4" />
      {isFull && <AsdDecor className="absolute left-1 top-1 text-lg" label="a bubble">💬</AsdDecor>}
    </div>
  );
}

function FeatureCard({ card, count, index, reduced, gentle, style }) {
  const playful = style === "younger";
  const isDone = count > 0;
  const cta = playful ? card.ctaPlayful : card.cta;

  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      whileHover={reduced ? undefined : { y: -5 }}
      transition={{ duration: gentle ? 0.3 : 0.45, delay: reduced ? 0 : index * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <AsdCard
        to={card.to}
        tone={card.tone}
        className="group asd-card-expressive flex h-full flex-col overflow-hidden p-0"
        aria-label={`Open ${card.title}`}
      >
        <span
          aria-hidden="true"
          className="asd-card-rail absolute inset-x-0 top-0 z-10 h-1.5"
          style={{ background: `linear-gradient(90deg, ${card.rail}, ${card.rail2})`, opacity: 0.9 }}
        />
        <div className="flex h-full flex-col p-5 pb-2">
          <div className="relative flex items-start justify-between gap-3">
            <span
              className="grid h-12 w-12 place-items-center rounded-[14px] text-white shadow-[2px_2px_0_rgba(213,245,236,1)] transition-transform duration-300 group-hover:scale-110"
              style={{ background: card.iconBg }}
            >
              <card.icon size={22} strokeWidth={2} />
            </span>
            <div className="flex items-center gap-2">
              {isDone && (
                <AsdChip tone={card.tone} icon={CheckCircle2} className="!text-[11px]">
                  Practised
                </AsdChip>
              )}
              <AsdProgressRing
                value={count}
                max={count > 0 ? count + 1 : 1}
                size={44}
                stroke={4.5}
                tone={card.tone}
                center={count}
                label={`${count} ${card.progressLabel}`}
              />
            </div>
          </div>

          <div className="mt-3">
            <h3 className="text-lg font-black tracking-[-0.03em] text-[#134E4A]">{card.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#5F8A87]">{card.description}</p>
          </div>
        </div>

        <div className="mt-auto px-2 pb-2">
          <div className="relative overflow-hidden rounded-2xl border-2 border-white/70" style={{ background: card.strip }}>
            <FeatureArt art={card.art} illustration={style === "younger" ? 1 : style === "clear" ? 0.2 : 0.5} />
            <span className="absolute bottom-2 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-[#134E4A] shadow-sm transition-transform duration-300 group-hover:translate-x-0.5">
              {cta} <ArrowRight size={13} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
            <AsdDecor className="absolute left-2 top-2 text-xl" label={card.sticker === "⭐" ? "a star" : card.sticker}>
              {card.sticker}
            </AsdDecor>
          </div>
        </div>
      </AsdCard>
    </motion.div>
  );
}

export default function ASDPage() {
  const { loading: asdLoading, targetWardId, routines } = useASDData();
  const { counts } = useASDPracticeCounts(targetWardId);
  const [activeIntervention, setActiveIntervention] = useState(null);
  const { reduced, gentle } = useSensoryReducedMotion();
  const { style } = useASDVisualStyle();

  const nextRoutineTask = routines?.find((item) => !item.completed) || null;
  const totalPractised =
    counts.stories_completed + counts.emotions_solved + counts.scenarios_practised + counts.conversations_completed;
  const heroDensity = style === "younger" ? "full" : style === "clear" ? "minimal" : "light";

  const heroVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduced ? 0 : 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: reduced ? 0 : 14 },
    visible: { opacity: 1, y: 0, transition: { duration: gentle ? 0.3 : 0.48, ease: [0.25, 0.1, 0.25, 1] } },
  };

  const progressByKey = {
    stories: counts.stories_completed,
    emotion: counts.emotions_solved,
    scenarios: counts.scenarios_practised,
    conversation: counts.conversations_completed,
  };

  return (
    <SupportToolThemeProvider theme="asd_social">
      <AsdVisualRoot>
        <SupportToolLayout title="Social & Emotional Support" description="A friendly place to practise stories, feelings, situations and conversations.">
          <main className="min-h-screen bg-[#F4FBF9] text-[#134E4A]">
            <div className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">

              {/* ── Hero header with companions ── */}
              <motion.header
                variants={heroVariants}
                initial="hidden"
                animate="visible"
                className="relative overflow-hidden rounded-[24px] border-2 border-[#B2DFDB]/60 bg-gradient-to-br from-[#E9F8F3] via-white to-[#D8F5EC] p-6 sm:p-8 lg:p-10"
              >
                <HeroAmbience density={heroDensity} />
                <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="max-w-[680px]">
                    <motion.p variants={itemVariants} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#0D9488]">
                      <span className="nb-twinkle grid h-5 w-5 place-items-center rounded-full bg-[#0D9488] text-white"><Sparkles size={11} /></span>
                      Your friendly practice space
                    </motion.p>
                    <motion.h1 variants={itemVariants} className="mt-2 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-[#134E4A] sm:text-5xl lg:text-[56px]">
                      Feelings & <span className="nb-shimmer bg-gradient-to-r from-[#0D9488] via-[#2DD4A8] to-[#14B8A6] bg-clip-text text-transparent">Friends</span>
                    </motion.h1>
                    <motion.p variants={itemVariants} className="mt-3 text-base leading-relaxed text-[#5F8A87] sm:text-lg">
                      Four gentle tools to understand feelings, practise everyday situations, and build calm conversations — one small step at a time.
                    </motion.p>
                    <motion.div variants={itemVariants}>
                      <AdaptiveGreeting responseTier={0} seed={0} />
                    </motion.div>
                  </div>
                  <motion.div variants={itemVariants} className="hidden lg:flex items-end justify-end gap-4 pr-2">
                    <div className="relative">
                      <span className="nb-pulse-ring absolute inset-0 rounded-full bg-[#5EEAD4]/30" aria-hidden="true" />
                      <AsdCharacter size={112} tone="teal" accessory="leaf" name="Your friendly ASD companion" className="nb-mascot-float relative" />
                    </div>
                    <AsdCharacter size={72} tone="cyan" accessory="spark" ariaHidden className="nb-mascot-float -mb-10" style={{ animationDelay: "1.2s" }} />
                  </motion.div>
                </div>

                {!asdLoading && (
                  <motion.div variants={itemVariants} className="mt-6 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-[#5F8A87]">Your progress</span>
                    <AsdChip tone="teal">{counts.stories_completed} stories</AsdChip>
                    <AsdChip tone="amber">{counts.emotions_solved} feelings</AsdChip>
                    <AsdChip tone="violet">{counts.scenarios_practised} situations</AsdChip>
                    <AsdChip tone="cyan">{counts.conversations_completed} chats</AsdChip>
                  </motion.div>
                )}
              </motion.header>

              {/* ── Completion / journey strip ── */}
              {!asdLoading && (
                <motion.div
                  initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: gentle ? 0.3 : 0.48, ease: [0.25, 0.1, 0.25, 1] }}
                  className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[#D5F5EC] bg-white/85 p-4 shadow-[2px_2px_0_#D5F5EC]"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#E0F5EE] text-[#0D9488]" aria-hidden="true">
                    <PartyPopper size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-[#134E4A]">
                      {totalPractised > 0 ? (
                        <>You&apos;ve practised <span className="text-[#0D9488]">{totalPractised} {totalPractised === 1 ? "moment" : "moments"}</span> so far.</>
                      ) : (
                        "Everything is ready when you are — start with one small scene."
                      )}
                    </p>
                    <p className="text-xs text-[#5F8A87]">Keep going at your own pace; each small step counts.</p>
                  </div>
                  <span className="hidden sm:block rounded-full bg-[#F0FAF7] border border-[#B2DFDB] px-3 py-1 text-xs font-bold text-[#0D9488]">
                    {Math.min(4 + (totalPractised > 0 ? 1 : 0), 5)}/5 unlocked
                  </span>
                </motion.div>
              )}

              {/* ── Routine hint ── */}
              {nextRoutineTask && !asdLoading && (
                <motion.div
                  initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: gentle ? 0.3 : 0.48, ease: [0.25, 0.1, 0.25, 1] }}
                  className="mt-4 flex items-center gap-4 rounded-2xl border-2 border-l-4 border-[#B2DFDB] border-l-[#0D9488] bg-white p-4 shadow-[3px_3px_0_#D5F5EC]"
                >
                  <span className="nb-breathe grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[#0D9488] text-white">
                    <Clock size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#0D9488]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2DD4A8] nb-twinkle" aria-hidden="true" /> Coming up next
                    </p>
                    <p className="mt-0.5 truncate text-[15px] font-bold text-[#134E4A]">{nextRoutineTask.title || nextRoutineTask.name}</p>
                  </div>
                  <Link
                    to="/asd/stories"
                    className="asd-big-control shrink-0 inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#0D9488] px-5 text-sm font-black text-white shadow-[2px_2px_0_#B2DFDB] transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200"
                  >
                    Continue <ArrowRight size={16} />
                  </Link>
                </motion.div>
              )}

              {/* ── The four practice tools ── */}
              <motion.section
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.06 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="mt-8"
                aria-label="Practice tools"
              >
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-[#134E4A] sm:text-2xl">Pick a practice</h2>
                    <p className="mt-0.5 text-sm text-[#5F8A87]">Four different ways to learn — choose what fits right now.</p>
                  </div>
                </div>
                <div className="asd-roomy grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {featureCards.map((card, i) => (
                    <FeatureCard key={card.key} card={card} count={progressByKey[card.key]} index={i} reduced={reduced} gentle={gentle} style={style} />
                  ))}
                </div>
              </motion.section>

              {/* ── Quick calm (Role 3 interventions, kept) ── */}
              <motion.section
                initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: gentle ? 0.3 : 0.45, ease: "easeOut" }}
                className="mt-8 rounded-2xl border-2 border-[#B2DFDB] bg-white/80 p-5 shadow-[3px_3px_0_#D5F5EC]"
                aria-label="Quick calm support"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-[#134E4A]">Need a quick calm?</h2>
                    <p className="text-sm text-[#5F8A87]">These run quietly in the background too — open one anytime you want.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickCalm.map((item) => (
                      <motion.button
                        key={item.id}
                        type="button"
                        whileHover={reduced ? undefined : { y: -3, scale: 1.02 }}
                        whileTap={reduced ? undefined : { scale: 0.97 }}
                        onClick={() => setActiveIntervention(item.id)}
                        className="inline-flex items-center gap-2.5 rounded-[12px] border-2 border-[#B2DFDB] bg-white px-4 py-2.5 text-left shadow-[2px_2px_0_#D5F5EC] transition-colors hover:border-[#0D9488] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200"
                      >
                        <span className={`grid h-8 w-8 place-items-center rounded-[10px] ${item.tile}`}>
                          <item.icon size={16} />
                        </span>
                        <span>
                          <span className="block text-sm font-black text-[#134E4A]">{item.label}</span>
                          <span className="block text-[11px] font-semibold text-[#5F8A87]">{item.hint}</span>
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.section>

              {/* ── Settings: sensory + look & tone ── */}
              <motion.div
                initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: gentle ? 0.3 : 0.45, ease: "easeOut" }}
                className="mt-6 grid gap-4 md:grid-cols-2"
              >
                <SensorySettings moduleKey="asd" />
                <AsdVisualStyleSelector />
              </motion.div>

              {/* ── Footer ── */}
              <motion.footer
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="mt-6 flex min-h-[68px] items-center justify-center gap-3 rounded-2xl border-2 border-l-4 border-[#B2DFDB] border-l-[#0D9488] bg-white px-5 text-center text-sm text-[#5F8A87] shadow-[3px_3px_0_#D5F5EC] sm:text-base"
              >
                <CheckCircle2 size={18} className="nb-breathe shrink-0 text-[#0D9488]" />
                <span>You don&apos;t need to have it all figured out — just the <strong className="font-black text-[#0D9488]">next small step.</strong></span>
              </motion.footer>
            </div>
          </main>

          {/* Role 3 active intervention modal (unchanged) */}
          <InterventionModal
            isOpen={Boolean(activeIntervention)}
            recommendationId={activeIntervention}
            onClose={() => setActiveIntervention(null)}
            onComplete={() => setActiveIntervention(null)}
          />
        </SupportToolLayout>
      </AsdVisualRoot>
    </SupportToolThemeProvider>
  );
}