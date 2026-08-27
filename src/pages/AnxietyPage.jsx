import { useState } from "react";
import { ArrowRight, Heart, Sparkles, Wind, Leaf, ShieldCheck, Sun } from "lucide-react";
import { motion } from "framer-motion";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";
import AdaptiveGreeting from "@/components/neurobridge/AdaptiveGreeting";
import SensorySettings from "@/components/neurobridge/SensorySettings";
import AdaptiveAnxietyEngine from "@/components/anxiety/AdaptiveAnxietyEngine";
import InterventionModal from "@/components/interventions/InterventionModal";

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

function CalmBubbles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
      <div className="absolute -left-8 -top-8 h-[120px] w-[120px] rounded-full bg-[#C7D2FE] opacity-15" />
      <div className="absolute -bottom-6 -right-6 h-[100px] w-[100px] rounded-full bg-[#BFDBFE] opacity-15" />
      <div className="absolute left-1/2 top-1/2 h-[80px] w-[80px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#DDD6FE] opacity-10" />
    </div>
  );
}

function CalmMiniCard({ id, icon: Icon, label, description, color, border, bg, accent, hint, badge, onLaunch }) {
  return (
    <div
      onClick={() => onLaunch(id)}
      className={`group relative overflow-hidden rounded-[22px] border ${border} bg-gradient-to-br ${bg} p-5 shadow-[3px_3px_0_#e0e7ff] transition-all duration-200 hover:-translate-y-1 hover:shadow-[5px_5px_0_#ddd6fe] cursor-pointer flex flex-col justify-between`}
    >
      <CalmBubbles />
      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className={`grid h-[44px] w-[44px] place-items-center rounded-[14px] bg-gradient-to-br ${color} text-white shadow-[0_5px_12px_rgba(50,50,100,.14)]`}>
            <Icon size={22} strokeWidth={2.2} />
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/80 text-[#1E2A5E] border border-[#C7D2FE]">
            {badge}
          </span>
        </div>
        <div>
          <h3 className="text-[18px] font-black tracking-[-0.03em] text-[#1E2A5E]">{label}</h3>
          <p className="mt-1 text-[13px] leading-[1.5] text-[#6B7BA8]">{description}</p>
        </div>
      </div>
      <div className="relative z-10 mt-4 pt-3 border-t border-black/5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-[#8B95B8]">
          <Sparkles size={13} className={accent} />{hint}
        </p>
        <span className={`text-xs font-bold ${accent} flex items-center gap-1 group-hover:gap-1.5 transition-all`}>
          Start <ArrowRight size={13} />
        </span>
      </div>
    </div>
  );
}

export default function AnxietyPage() {
  const [activeIntervention, setActiveIntervention] = useState(null);

  return (
    <SupportToolThemeProvider theme="anxiety_calm">
      <SupportToolLayout title="Calming Support" description="Gentle, adaptive anxiety support — zero pressure, just calm.">
        <main className="min-h-screen bg-[#f0f4ff] text-[#1E2A5E]">
          <div className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">

            {/* ── Hero Header with Mascot ── */}
            <header className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_390px]">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#4F6BF6] flex items-center gap-2">
                  <Sparkles size={15} /> Calming Support
                </p>
                <h1 className="mt-3 max-w-[760px] text-[46px] font-black leading-[1] tracking-[-0.055em] text-[#1E2A5E] sm:text-[58px] lg:text-[64px]">
                  Calm & <span className="bg-gradient-to-r from-[#4F6BF6] to-[#A5B4FC] bg-clip-text text-transparent">Kind</span>
                </h1>
                <span className="sr-only">Calm and Kind</span>
                <p className="mt-5 max-w-[610px] text-[17px] leading-[1.55] text-[#6B7BA8] sm:text-[19px]">
                  A gentle space where NeuroBridge quietly watches and supports you, always kind, never in the way.
                </p>
                <AdaptiveGreeting responseTier={0} seed={3} />
              </div>
              <div className="relative hidden min-h-[230px] lg:block">
                <img src="/anxiety-mascot.svg" alt="A gentle crescent moon with small star friends" className="absolute bottom-0 left-0 h-[220px] w-[270px] object-contain" />
                <div className="absolute right-0 top-4 rounded-[24px] border border-[#c7d2fe] bg-[#f0f4ff] px-6 py-4 text-center text-[15px] font-bold leading-6 text-[#1E2A5E] shadow-sm">
                  You are safe here.<br />Take your time. <Heart size={15} className="inline fill-[#818CF8] text-[#818CF8]" />
                </div>
                <Sparkles size={25} className="absolute bottom-3 right-[70px] text-[#818CF8]" />
              </div>
            </header>

            {/* ── Calm reassurance banner ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 rounded-[22px] border border-[#c7d2fe] bg-gradient-to-r from-white via-[#f0f4ff] to-[#e8edfa] p-5 shadow-[3px_3px_0_#dde8fc] flex items-center gap-4"
            >
              <div className="grid h-[44px] w-[44px] place-items-center rounded-full bg-[#4F6BF6]/10 text-[#4F6BF6]">
                <Heart size={22} />
              </div>
              <p className="text-[15px] font-bold text-[#1E2A5E] flex-1">
                NeuroBridge is quietly watching for signs of tension. Support is always ready — <strong className="font-black text-[#4F6BF6]">never in the way, always kind.</strong>
              </p>
              <Sparkles size={20} className="shrink-0 text-[#A5B4FC]" />
            </motion.div>

            {/* ── Interactive Anxiety Support (Role 3 Interventions) ── */}
            <section className="mt-10">
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
                {anxietyInterventions.map((card) => (
                  <CalmMiniCard
                    key={card.id}
                    {...card}
                    onLaunch={(id) => setActiveIntervention(id)}
                  />
                ))}
              </div>
            </section>

            {/* ── Adaptive Anxiety Engine & Evaluator Tools ── */}
            <section className="mt-10">
              <AdaptiveAnxietyEngine />
            </section>

            {/* ── Sensory Settings ── */}
            <div className="mt-8">
              <SensorySettings moduleKey="anxiety" />
            </div>

            {/* ── Footer ── */}
            <footer className="mt-6 flex min-h-[68px] items-center justify-center gap-3 rounded-[24px] bg-gradient-to-r from-[#e8edfa] via-[#f0f4ff] to-[#e8f1ff] px-5 text-center text-[14px] text-[#6B7BA8] sm:text-[16px]">
              <Heart size={23} strokeWidth={2} className="shrink-0 text-[#818CF8]" />
              <span>You don&apos;t need to feel perfect — just the <strong className="font-black text-[#4F6BF6]">next gentle breath.</strong></span>
              <Sparkles size={21} className="shrink-0 text-[#A5B4FC]" />
            </footer>
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
