import { useState } from "react";
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
  AsdProgressRing,
  AsdVisualStyleSelector,
  useASDPracticeCounts,
} from "@/components/asd/ui";
import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";

const featureCards = [
  {
    key: "stories",
    to: "/asd/stories",
    title: "Social Stories",
    description: "Play gentle, illustrated story cards one scene at a time — for everyday situations like school, travel and changes.",
    tone: "teal",
    icon: BookOpen,
    iconColor: "bg-gradient-to-br from-[#2DD4A8] to-[#0D9488] text-white",
    progressLabel: "stories completed",
    accessory: "leaf",
    character: "cloud",
    art: "stories",
  },
  {
    key: "emotion",
    to: "/asd/emotion",
    title: "Emotion Decoder",
    description: "Read a real little situation and figure out what someone is feeling from their words, voice and body.",
    tone: "amber",
    icon: ScanFace,
    iconColor: "bg-gradient-to-br from-[#FCD34D] to-[#F59E0B] text-white",
    progressLabel: "emotions solved",
    accessory: "spark",
    character: "star",
    art: "emotion",
  },
  {
    key: "scenarios",
    to: "/asd/social-scenarios",
    title: "Social Scenario Simulator",
    description: "Step into one situation, meet a character, and say or type how you would respond — with kind feedback.",
    tone: "violet",
    icon: MessagesSquare,
    iconColor: "bg-gradient-to-br from-[#C4B5FD] to-[#7C3AED] text-white",
    progressLabel: "situations practised",
    accessory: "hand",
    character: "wave",
    art: "simulator",
  },
  {
    key: "conversation",
    to: "/communication",
    title: "Conversation Practice",
    description: "Rehearse a real, guided back-and-forth chat — speak or type, and see how the conversation flows.",
    tone: "cyan",
    icon: MessageCircle,
    iconColor: "bg-gradient-to-br from-[#67E8F9] to-[#0891B2] text-white",
    progressLabel: "conversations completed",
    accessory: "music",
    character: "chat",
    art: "conversation",
  },
];

const quickCalm = [
  { id: "sensory_reset", icon: Moon, label: "Sensory Reset", hint: "A quiet pause" },
  { id: "grounding_activity", icon: Hand, label: "Grounding", hint: "5 gentle steps" },
  { id: "transition_support", icon: RefreshCcw, label: "Transition", hint: "Now · Next · Then" },
];

function FeatureArt({ art }) {
  if (art === "stories") {
    return (
      <div className="pointer-events-none relative h-[110px] w-[150px]" aria-hidden="true">
        <div className="absolute left-8 top-3 h-[80px] w-[64px] rounded-xl border-2 border-[#B2DFDB] bg-white p-2.5 shadow-[2px_2px_0_#D5F5EC]">
          <div className="mb-1.5 h-[5px] w-8 rounded-full bg-[#0D9488]/15" />
          <div className="mb-1.5 h-[5px] w-10 rounded-full bg-[#0D9488]/10" />
          <div className="h-[5px] w-7 rounded-full bg-[#0D9488]/15" />
        </div>
        <div className="absolute right-2 top-8 h-[80px] w-[64px] rounded-xl border-2 border-[#A7F3D0] bg-[#F0FDF4] p-2.5 shadow-[2px_2px_0_#D1FAE5]">
          <div className="mb-1.5 h-[5px] w-9 rounded-full bg-[#059669]/15" />
          <div className="mb-1.5 h-[5px] w-7 rounded-full bg-[#059669]/10" />
          <div className="h-[5px] w-10 rounded-full bg-[#059669]/15" />
        </div>
        <AsdCharacter size={56} tone="sky" accessory="leaf" ariaHidden />
      </div>
    );
  }
  if (art === "emotion") {
    return (
      <div className="pointer-events-none relative flex h-[110px] w-[150px] items-center justify-center gap-1.5" aria-hidden="true">
        {[
          { face: "😊", ring: "#FDE68A" },
          { face: "😐", ring: "#E0E7FF" },
          { face: "😟", ring: "#FECDD3" },
        ].map((item, i) => (
          <span key={i} className="grid h-11 w-11 place-items-center rounded-full border-2 bg-white text-xl" style={{ borderColor: item.ring }}>
            {item.face}
          </span>
        ))}
        <AsdCharacter size={54} tone="amber" accessory="spark" ariaHidden className="absolute -right-1 bottom-0" />
      </div>
    );
  }
  if (art === "simulator") {
    return (
      <div className="pointer-events-none relative h-[110px] w-[150px]" aria-hidden="true">
        <div className="absolute right-1 top-1 w-[112px] rounded-2xl border border-[#DDD6FE] bg-white p-3 shadow-[2px_2px_0_#EDE9FE]">
          <div className="mb-1 h-[5px] w-2/3 rounded-full bg-[#7C3AED]/15" />
          <div className="h-[5px] w-1/2 rounded-full bg-[#7C3AED]/15" />
        </div>
        <div className="absolute left-1 bottom-0 w-[112px] rounded-2xl border border-[#B2DFDB] bg-[#F5F3FF] p-3 shadow-sm">
          <div className="mb-1 h-[5px] w-3/4 rounded-full bg-[#4C1D95]/15" />
          <div className="h-[5px] w-1/2 rounded-full bg-[#4C1D95]/15" />
        </div>
        <AsdCharacter size={52} tone="violet" accessory="hand" ariaHidden className="absolute right-0 bottom-0" />
      </div>
    );
  }
  return (
    <div className="pointer-events-none relative h-[110px] w-[150px]" aria-hidden="true">
      <div className="absolute left-2 top-4 w-[104px] rounded-2xl rounded-bl-sm border border-[#A5F3FC] bg-white px-3 py-2 shadow-[2px_2px_0_#CFFAFE]">
        <div className="h-[5px] w-full rounded-full bg-[#0891B2]/15" />
        <div className="mt-1 h-[5px] w-3/4 rounded-full bg-[#0891B2]/15" />
      </div>
      <div className="absolute right-2 top-8 w-[104px] rounded-2xl rounded-br-sm border border-[#0D9488]/30 bg-[#E0F5EE] px-3 py-2 shadow-sm">
        <div className="h-[5px] w-3/4 rounded-full bg-[#0D9488]/20" />
        <div className="mt-1 h-[5px] w-1/2 rounded-full bg-[#0D9488]/20" />
      </div>
      <AsdCharacter size={50} tone="cyan" accessory="music" ariaHidden className="absolute right-2 bottom-0" />
    </div>
  );
}

function FeatureCard({ card, count, index, reduced, gentle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: gentle ? 0.3 : 0.45, delay: reduced ? 0 : index * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <AsdCard href={card.to} tone={card.tone} className="flex h-full flex-col p-6" actionLabel={`Open ${card.title}`}>
        <div className="flex items-start justify-between gap-3">
          <span className={`grid h-12 w-12 place-items-center rounded-[14px] ${card.iconColor} shadow-[2px_2px_0_#D5F5EC]`}>
            <card.icon size={22} strokeWidth={2} />
          </span>
          <div className="flex items-center gap-2 text-[#5F8A87]" aria-label={`${count} ${card.progressLabel}`}>
            <AsdProgressRing value={count} max={count > 0 ? count + 1 : 1} size={40} stroke={4.5} tone={card.tone} label={`${count} ${card.progressLabel}`} />
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-xl font-black tracking-[-0.03em] text-[#134E4A]">{card.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[#5F8A87]">{card.description}</p>
        </div>

        <div className="mt-auto pt-4">
          <div className="grid grid-cols-[minmax(0,1fr)_150px] items-end gap-3">
            <p className="text-xs font-semibold text-[#5F8A87]">
              {count === 0 ? "Ready when you are" : <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-[#0D9488]" /> {count} {card.progressLabel}</span>}
            </p>
            <FeatureArt art={card.art} />
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

  const nextRoutineTask = routines?.find((item) => !item.completed) || null;

  const heroVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduced ? 0 : 0.11 } },
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
      <SupportToolLayout title="Social & Emotional Support" description="A friendly place to practise stories, feelings, situations and conversations.">
        <main className="min-h-screen bg-[#F4FBF9] text-[#134E4A]">
          <div className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">

            {/* ── Hero header with character ── */}
            <motion.header
              variants={heroVariants}
              initial="hidden"
              animate="visible"
              className="relative overflow-hidden rounded-[24px] border-2 border-[#B2DFDB]/60 bg-gradient-to-br from-[#E9F8F3] via-white to-[#D8F5EC] p-6 sm:p-8 lg:p-10"
            >
              <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#5EEAD4]/10" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-[#A7F3D0]/15" aria-hidden="true" />
              <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="max-w-[680px]">
                  <motion.p variants={itemVariants} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#0D9488]">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0D9488] text-white"><Sparkles size={11} /></span>
                    Your friendly practice space
                  </motion.p>
                  <motion.h1 variants={itemVariants} className="mt-2 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-[#134E4A] sm:text-5xl lg:text-[56px]">
                    Feelings & <span className="bg-gradient-to-r from-[#0D9488] to-[#2DD4A8] bg-clip-text text-transparent">Friends</span>
                  </motion.h1>
                  <motion.p variants={itemVariants} className="mt-3 text-base leading-relaxed text-[#5F8A87] sm:text-lg">
                    Four gentle tools to understand feelings, practise everyday situations, and build calm conversations — one small step at a time.
                  </motion.p>
                  <motion.div variants={itemVariants}>
                    <AdaptiveGreeting responseTier={0} seed={0} />
                  </motion.div>
                </div>
                <motion.div variants={itemVariants} className="hidden lg:flex items-end justify-end gap-3 pr-4">
                  <AsdCharacter size={118} tone="teal" accessory="leaf" name="Your friendly ASD companion" />
                  <AsdCharacter size={72} tone="cyan" accessory="spark" ariaHidden className="mb-8" />
                </motion.div>
              </div>
            </motion.header>

            {/* ── Routine hint ── */}
            {nextRoutineTask && !asdLoading && (
              <motion.div
                initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: gentle ? 0.3 : 0.48, ease: [0.25, 0.1, 0.25, 1] }}
                className="mt-6 flex items-center gap-4 rounded-2xl border-2 border-l-4 border-[#B2DFDB] border-l-[#0D9488] bg-white p-4 shadow-[3px_3px_0_#D5F5EC]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[#0D9488] text-white">
                  <Clock size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#0D9488]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#2DD4A8]" aria-hidden="true" /> Coming up next
                  </p>
                  <p className="mt-0.5 truncate text-[15px] font-bold text-[#134E4A]">{nextRoutineTask.title || nextRoutineTask.name}</p>
                </div>
                <Link
                  to="/asd/stories"
                  className="shrink-0 inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[#0D9488] px-5 text-sm font-black text-white shadow-[2px_2px_0_#B2DFDB] transition-colors hover:bg-[#0F766E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200"
                >
                  Continue <ArrowRight size={16} />
                </Link>
              </motion.div>
            )}

            {/* ── The four practice tools ── */}
            <motion.section
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.08 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mt-8"
              aria-label="Practice tools"
            >
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-[#134E4A] sm:text-2xl">Pick a practice</h2>
                  <p className="mt-0.5 text-sm text-[#5F8A87]">Each one is a different way to learn — choose what fits right now.</p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {featureCards.map((card, i) => (
                  <FeatureCard key={card.key} card={card} count={progressByKey[card.key]} index={i} reduced={reduced} gentle={gentle} />
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
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveIntervention(item.id)}
                      className="inline-flex h-11 items-center gap-2 rounded-[10px] border-2 border-[#B2DFDB] bg-[#F0FAF7] px-4 text-sm font-black text-[#134E4A] shadow-[2px_2px_0_#D5F5EC] transition-all hover:border-[#0D9488] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200"
                    >
                      <item.icon size={16} className="text-[#0D9488]" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.section>

            {/* ── Settings: sensory + look & tone ── */}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <SensorySettings moduleKey="asd" />
              <AsdVisualStyleSelector />
            </div>

            {/* ── Footer ── */}
            <motion.footer
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mt-6 flex min-h-[68px] items-center justify-center gap-3 rounded-2xl border-2 border-l-4 border-[#B2DFDB] border-l-[#0D9488] bg-white px-5 text-center text-sm text-[#5F8A87] shadow-[3px_3px_0_#D5F5EC] sm:text-base"
            >
              <CheckCircle2 size={18} className="shrink-0 text-[#0D9488]" />
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
    </SupportToolThemeProvider>
  );
}