import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { ArrowRight, Heart, Sparkles, Wind, Leaf, Sun } from "lucide-react";
import { motion } from "framer-motion";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";
import AdaptiveGreeting from "@/components/neurobridge/AdaptiveGreeting";
import SensorySettings from "@/components/neurobridge/SensorySettings";
import AdaptiveAnxietyEngine from "@/components/anxiety/AdaptiveAnxietyEngine";
import InterventionModal from "@/components/interventions/InterventionModal";
import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";
import { useFeatureAdaptation } from "@/hooks/useFeatureAdaptation";
import { useContextStateOptional } from "@/context/ContextProvider";
import { useAuth } from "@/context/AuthContext";
import AdaptationExplanation from "@/components/adaptive/AdaptationExplanation";
import { buildAdaptationExplanation } from "@/adaptive/presentation/adaptationPresentation";

const anxietyInterventions = [
  {
    id: "guided_breathing",
    label: "Guided Breathing",
    description: "4-4-4-4 Box Breathing with an expanding visual orb to center your body.",
    icon: Wind,
    badge: "Box & 4-7-8",
    color: "from-[#93C5FD] to-[#60A5FA]",
    border: "border-[#bfdbfe]",
    bg: "from-white via-[#f0f7ff] to-[#e8f1ff]",
    accent: "text-[#3B82F6]",
    hint: "1 minute can help",
  },
  {
    id: "grounding_exercise",
    label: "5-4-3-2-1 Grounding",
    description: "Engage your 5 senses with quick-tap cards to anchor in the present.",
    icon: Leaf,
    badge: "Senses Check",
    color: "from-[#86EFAC] to-[#34D399]",
    border: "border-[#bbf7d0]",
    bg: "from-white via-[#f0fdf4] to-[#e8faf0]",
    accent: "text-[#10B981]",
    hint: "Body knows the way",
  },
  {
    id: "calm_space",
    label: "Calm Space",
    description: "A minimal, peaceful pause sanctuary with soft tone and no expectations.",
    icon: Sun,
    badge: "Sanctuary",
    color: "from-[#C4B5FD] to-[#A78BFA]",
    border: "border-[#ddd6fe]",
    bg: "from-white via-[#f5f3ff] to-[#ede9fe]",
    accent: "text-[#7C3AED]",
    hint: "Zero pressure",
  },
];

/* Calm-by-default: a single quiet accent per card, not a moving bubble field.
 * The earlier version rendered ~9 independently-animating decorative
 * elements per card (a 4-bubble field, 3 blurred circles, 2 pulse rings) —
 * three of those cards side by side meant ~27 simultaneous moving elements
 * on the one page whose whole job is to feel calm. Research on anxiety/ASD
 * sensory load says multiple simultaneous motion sources read as clutter
 * even when each one, alone, is slow — so this keeps one soft corner glow
 * and drops the rest, independent of the user's reduced-motion setting
 * (which still fully disables what's left). */
function CalmCornerGlow({ bg }) {
  return <div aria-hidden="true" className={`pointer-events-none absolute -right-8 -top-8 h-[110px] w-[110px] rounded-full opacity-20 blur-2xl bg-gradient-to-br ${bg}`} />;
}

function CalmMiniCard({ id, icon: Icon, label, description, color, border, bg, accent, hint, badge, onLaunch, index, reduced, gentle, recommended }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: gentle ? 0.35 : 0.5, delay: reduced ? 0 : index * 0.09, ease: "easeOut" }}
      whileHover={reduced ? undefined : { y: -6 }}
      onClick={() => onLaunch(id)}
      className={`group relative overflow-hidden rounded-[28px] border ${border} bg-gradient-to-br ${bg} p-5 shadow-[3px_3px_0_#e0e7ff] transition-shadow duration-200 hover:shadow-[5px_5px_0_#ddd6fe] cursor-pointer flex flex-col justify-between`}
    >
      <CalmCornerGlow bg={color} />
      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className={`grid h-[44px] w-[44px] place-items-center rounded-full text-white shadow-[0_5px_12px_rgba(50,50,100,.14)] bg-gradient-to-br ${color}`}>
            <Icon size={22} strokeWidth={2.2} className="relative z-10" />
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/80 text-[#1E2A5E] border border-[#C7D2FE]">
            {recommended ? "Recommended" : badge}
          </span>
        </div>
        <div>
          <h3 className="text-[18px] font-black tracking-[-0.03em] text-[#1E2A5E]">{label}</h3>
          <p className="mt-1 text-[13px] leading-[1.5] text-[#6B7BA8]">{description}</p>
        </div>
      </div>
      <div className="relative z-10 mt-4 pt-3 border-t border-black/5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-[#8B95B8]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#4F6BF6]" />
          {hint}
        </p>
        <span className={`text-xs font-bold ${accent} flex items-center gap-1 group-hover:gap-1.5 transition-all`}>
          Start <ArrowRight size={13} />
        </span>
      </div>
    </motion.div>
  );
}

// The agent's start_grounding_activity tool already picked and started a
// real exercise (by anxiety level) before navigating here — map its result
// onto the matching local intervention card so the modal opens automatically
// instead of dropping the user on the hub as if nothing had happened yet.
const AGENT_EXERCISE_TO_INTERVENTION_ID = {
  "Box Breathing": "guided_breathing",
  "5-4-3-2-1 Senses": "grounding_exercise",
};

export default function AnxietyPage() {
  const [activeIntervention, setActiveIntervention] = useState(null);
  const { reduced, gentle } = useSensoryReducedMotion();
  const { user } = useAuth();
  const location = useLocation();
  const context = useContextStateOptional()?.context ?? null;
  const adaptation = useFeatureAdaptation("anxiety.hub", {
    getAppSnapshot: () => context,
    userId: user?.id ?? null,
  });
  const adaptiveConfig = adaptation.configuration;

  const appliedAgentExerciseRef = useRef(false);
  useEffect(() => {
    const exerciseType = location.state?.exercise_type;
    if (!exerciseType || appliedAgentExerciseRef.current) return;
    appliedAgentExerciseRef.current = true;
    const interventionId = AGENT_EXERCISE_TO_INTERVENTION_ID[exerciseType];
    if (interventionId) setActiveIntervention(interventionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the engine decision promotes a strategy (Tier 9 learned preference)
  // or legacy guidance, bring the matching card to the front of the support
  // grid without removing the other options. Deprioritized strategies move to
  // the back.
  const preferredCardId =
    adaptation.signals?.preferredStrategyId?.split(":")[1] ?? null;
  const deprioritizedCardId =
    adaptation.signals?.deprioritizedStrategyId?.split(":")[1] ?? null;

  const orderedInterventions =
    preferredCardId || deprioritizedCardId || adaptiveConfig?.promoteBreathing
      ? [...anxietyInterventions].sort((a, b) => {
          if (preferredCardId && a.id === preferredCardId) return -1;
          if (preferredCardId && b.id === preferredCardId) return 1;
          if (deprioritizedCardId && a.id === deprioritizedCardId) return 1;
          if (deprioritizedCardId && b.id === deprioritizedCardId) return -1;
          if (adaptiveConfig?.promoteBreathing && a.id === "guided_breathing") return -1;
          if (adaptiveConfig?.promoteBreathing && b.id === "guided_breathing") return 1;
          return 0;
        })
      : anxietyInterventions;
  const adaptationExplanation = buildAdaptationExplanation({
    feature: "anxiety",
    baseline: { recommendations: anxietyInterventions.map((card) => card.label) },
    applied: { recommendations: orderedInterventions.map((card) => card.label) },
  });

  const heroVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduced ? 0 : 0.12 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: reduced ? 0 : 14 },
    visible: { opacity: 1, y: 0, transition: { duration: gentle ? 0.35 : 0.5, ease: "easeOut" } },
  };

  return (
    <SupportToolThemeProvider theme="anxiety_calm">
      <SupportToolLayout title="Calming Support" description="Gentle, adaptive anxiety support — zero pressure, just calm.">
        <main className="min-h-screen bg-[#f0f4ff] text-[#1E2A5E]">
          <div className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">

            {/* ── Hero Header with Mascot ── */}
            <motion.header
              variants={heroVariants}
              initial="hidden"
              animate="visible"
              className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_390px]"
            >
              <div>
                <motion.p variants={itemVariants} className="text-[11px] font-black uppercase tracking-[0.16em] text-[#4F6BF6] flex items-center gap-2">
                  <Sparkles size={15} className={reduced ? "" : "nb-twinkle"} /> Calming Support
                </motion.p>
                <motion.h1 variants={itemVariants} className="mt-3 max-w-[760px] text-[46px] font-black leading-[1] tracking-[-0.055em] text-[#1E2A5E] sm:text-[58px] lg:text-[64px]">
                  Calm & <span className="bg-gradient-to-r from-[#4F6BF6] to-[#A5B4FC] bg-clip-text text-transparent">Kind</span>
                </motion.h1>
                <span className="sr-only">Calm and Kind</span>
                <motion.p variants={itemVariants} className="mt-5 max-w-[610px] text-[17px] leading-[1.55] text-[#6B7BA8] sm:text-[19px]">
                  A gentle space that adapts to how you're doing — always kind, never in the way.
                </motion.p>
                <motion.div variants={itemVariants}>
                  <AdaptiveGreeting responseTier={0} seed={3} />
                </motion.div>
              </div>
              <motion.div
                variants={itemVariants}
                className="relative hidden min-h-[260px] lg:block overflow-visible"
              >
                <div aria-hidden="true" className="nb-breath-orb absolute left-6 top-6 h-[140px] w-[140px] rounded-full bg-gradient-to-br from-[#C7D2FE]/30 to-[#A5B4FC]/20 blur-[1px]" />
                <img src="/anxiety-mascot.svg" alt="A gentle crescent moon with small star friends" className="absolute bottom-0 left-0 h-[220px] w-[270px] object-contain nb-mascot-float" />
                <div className="absolute right-0 top-4 rounded-[24px] border border-[#c7d2fe] bg-[#f0f4ff] px-6 py-4 text-center text-[15px] font-bold leading-6 text-[#1E2A5E] shadow-sm">
                  You are safe here.<br />Take your time. <Heart size={15} className="inline fill-[#818CF8] text-[#818CF8]" />
                </div>
              </motion.div>
            </motion.header>

            {/* ── Calm reassurance banner ──
                Copy was "quietly watching for signs of tension" — for an
                anxiety-focused page, being told something is watching you
                for tension reads as surveillance, not reassurance. Also
                dropped the shimmering background sweep: decorative-only
                motion with no feedback purpose, on the one page whose job
                is to feel calm by default. */}
            <motion.div
              initial={{ opacity: 0, y: reduced ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: gentle ? 0.35 : 0.55, ease: "easeOut", delay: 0.15 }}
              className="mt-8 rounded-[22px] border border-[#c7d2fe] bg-[#f0f4ff] p-5 shadow-[3px_3px_0_#dde8fc] flex items-center gap-4"
            >
              <div className="grid h-[44px] w-[44px] place-items-center rounded-full bg-[#4F6BF6]/10 text-[#4F6BF6] shrink-0">
                <Heart size={22} />
              </div>
              <p className="text-[15px] font-bold text-[#1E2A5E] flex-1">
                Support adjusts quietly to how you're doing. It's always ready — <strong className="font-black text-[#4F6BF6]">never in the way, always kind.</strong>
              </p>
            </motion.div>

            <AdaptationExplanation explanation={adaptationExplanation} className="mt-5" />

            {/* ── Interactive Anxiety Support (Role 3 Interventions) ── */}
            <motion.section
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: gentle ? 0.35 : 0.5, ease: "easeOut" }}
              className="mt-10"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E2A5E] flex items-center gap-2">
                    <Sparkles className="text-[#4F6BF6]" size={22} /> Interactive Anxiety Support
                  </h2>
                  <p className="text-xs sm:text-sm text-[#6B7BA8] mt-0.5">
                    Direct interactive grounding and breathing interventions.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                {orderedInterventions.map((card, i) => (
                  <CalmMiniCard
                    key={card.id}
                    {...card}
                    index={i}
                    reduced={reduced}
                    gentle={gentle}
                    recommended={Boolean(adaptationExplanation) && i === 0}
                    onLaunch={(id) => setActiveIntervention(id)}
                  />
                ))}
              </div>
            </motion.section>

            {/* ── Adaptive Anxiety Engine & Evaluator Tools ── */}
            <motion.section
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              transition={{ duration: gentle ? 0.35 : 0.5, ease: "easeOut", delay: 0.08 }}
              className="mt-10"
            >
              <AdaptiveAnxietyEngine />
            </motion.section>

            {/* ── Sensory Settings ── */}
            <div className="mt-8">
              <SensorySettings moduleKey="anxiety" />
            </div>

            {/* ── Footer ── */}
            <motion.footer
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mt-6 flex min-h-[68px] items-center justify-center gap-3 rounded-[24px] bg-gradient-to-r from-[#e8edfa] via-[#f0f4ff] to-[#e8f1ff] px-5 text-center text-[14px] text-[#6B7BA8] sm:text-[16px]"
            >
              <Heart size={23} strokeWidth={2} className="shrink-0 text-[#818CF8]" />
              <span>You don&apos;t need to feel perfect — just the <strong className="font-black text-[#4F6BF6]">next gentle breath.</strong></span>
              <Sparkles size={21} className="shrink-0 text-[#A5B4FC] nb-twinkle" />
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
