"use client";

import React from "react";
import {
  ArrowRight,
  Cloud,
  Compass,
  Heart,
  Leaf,
  NotebookPen,
  Sparkles,
  Sprout,
  Star,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import SupportToolLayout from "@/components/support/SupportToolLayout";
import { FEATURES } from "@/lib/featureRegistry";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";

export const DEPRESSION_LANDING_TOOLS = [
  {
    moduleId: "support.gentle_activity",
    feature: FEATURES.DEPRESSION_MVH,
    title: "Gentle Activity",
    description: "Choose a small movement that meets you where you are.",
    tone: "sunshine",
    Icon: Sprout,
    to: "/depression/mvh",
  },
  {
    moduleId: "support.grounding",
    feature: FEATURES.DEPRESSION_ANXIETY_DISSOLVER,
    title: "Grounding",
    description: "Simple exercises to help you feel more present.",
    tone: "sage",
    Icon: Leaf,
    to: "/depression/anxietydissolver",
  },
  {
    moduleId: "support.social_connection",
    feature: FEATURES.DEPRESSION_SOCIAL,
    title: "Social Connection",
    description: "Send a kind message or just stay connected.",
    tone: "peach",
    Icon: Heart,
    to: "/depression/social",
  },
  {
    moduleId: "support.cognitive_reframing",
    feature: FEATURES.DEPRESSION_REALITY,
    title: "Cognitive Reframing",
    description: "Give a heavy thought a little space to breathe.",
    tone: "lavender",
    Icon: Cloud,
    to: "/depression/reality",
  },
  {
    moduleId: "support.evidence_journal",
    feature: FEATURES.DEPRESSION_PROOF,
    title: "Evidence Journal",
    description: "Capture small moments that matter.",
    tone: "blue",
    Icon: NotebookPen,
    to: "/depression/evidence",
  },
];

const supportStyles = {
  sage: {
    border: "border-emerald-200/80 hover:border-emerald-400/80",
    accent: "text-emerald-700",
    badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
    iconBg: "bg-emerald-100/80 text-emerald-700",
    arrowBg: "bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white",
    cardGradient: "from-white via-slate-50/50 to-emerald-50/30",
  },
  lavender: {
    border: "border-indigo-200/80 hover:border-indigo-400/80",
    accent: "text-indigo-700",
    badgeBg: "bg-indigo-50 text-indigo-800 border-indigo-200",
    iconBg: "bg-indigo-100/80 text-indigo-700",
    arrowBg: "bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white",
    cardGradient: "from-white via-slate-50/50 to-indigo-50/30",
  },
  peach: {
    border: "border-rose-200/80 hover:border-rose-400/80",
    accent: "text-rose-700",
    badgeBg: "bg-rose-50 text-rose-800 border-rose-200",
    iconBg: "bg-rose-100/80 text-rose-700",
    arrowBg: "bg-rose-50 group-hover:bg-rose-600 group-hover:text-white",
    cardGradient: "from-white via-slate-50/50 to-rose-50/30",
  },
  blue: {
    border: "border-sky-200/80 hover:border-sky-400/80",
    accent: "text-sky-700",
    badgeBg: "bg-sky-50 text-sky-800 border-sky-200",
    iconBg: "bg-sky-100/80 text-sky-700",
    arrowBg: "bg-sky-50 group-hover:bg-sky-600 group-hover:text-white",
    cardGradient: "from-white via-slate-50/50 to-sky-50/30",
  },
};

const visibleCards = [
  {
    moduleId: "support.grounding",
    visibleTitle: "Ground me",
    visibleDescription: "Simple exercises to help you feel more present.",
  },
  {
    moduleId: "support.cognitive_reframing",
    visibleTitle: "Work through a thought",
    visibleDescription: "Give a heavy thought a little space to breathe.",
  },
  {
    moduleId: "support.social_connection",
    visibleTitle: "Reach out",
    visibleDescription: "Send a kind message or just stay connected.",
  },
  {
    moduleId: "support.evidence_journal",
    visibleTitle: "Notice the good",
    visibleDescription: "Capture small moments that matter.",
  },
].map((card) => ({
  ...DEPRESSION_LANDING_TOOLS.find((tool) => tool.moduleId === card.moduleId),
  ...card,
}));

function TinyStepCard() {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-amber-200/80 bg-gradient-to-br from-white via-amber-50/40 to-orange-50/30 p-6 shadow-lg shadow-amber-950/[0.03] backdrop-blur-sm sm:p-8 lg:p-10">
      <div className="relative z-10 max-w-[540px]">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100/80 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-900 shadow-sm">
          <Sparkles size={14} className="text-amber-600" />
          Recommended Starting Point
        </span>
        <h2 className="mt-4 text-[30px] font-black tracking-[-.035em] text-slate-900 sm:text-[38px]">
          One tiny step
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600 sm:text-[16px]">
          When energy is low, starting small is enough. Let&apos;s find one gentle action that feels doable right now.
        </p>
        <button
          type="button"
          onClick={() => navigate("/depression/mvh")}
          className="mt-6 inline-flex min-h-[52px] items-center gap-4 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 px-6 text-[15px] font-black text-white shadow-lg shadow-orange-950/10 transition-all duration-200 hover:brightness-110 active:scale-[0.99]"
        >
          <span>Suggest a next step</span>
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Hero Illustration & Accent Element */}
      <div className="pointer-events-none absolute -bottom-10 -right-10 hidden sm:block">
        <div className="relative h-[220px] w-[260px] opacity-85 transition-transform duration-300 hover:scale-105">
          <img
            src="/flower-pot.png"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain"
          />
        </div>
      </div>
    </section>
  );
}

function SupportCard({ visibleTitle, visibleDescription, title, tone, Icon, to }) {
  const style = supportStyles[tone];
  return (
    <Link
      to={to}
      aria-label={title}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[24px] border bg-gradient-to-br ${style.cardGradient} ${style.border} p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:p-6`}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className={`grid h-12 w-12 place-items-center rounded-2xl ${style.iconBg} shadow-sm transition-transform duration-300 group-hover:scale-110`}>
            {tone === "sage" ? (
              <img src="/leaf.png" alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
            ) : tone === "lavender" ? (
              <img src="/nature.png" alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
            ) : tone === "peach" ? (
              <img src="/love.png" alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
            ) : tone === "blue" ? (
              <img src="/note.png" alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
            ) : (
              <Icon size={24} strokeWidth={1.8} />
            )}
          </span>

          <span
            aria-hidden="true"
            className={`grid h-9 w-9 place-items-center rounded-xl transition-all duration-200 ${style.arrowBg}`}
          >
            <ArrowRight size={16} strokeWidth={2.2} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>

        <div className="mt-5">
          <h3 className={`text-[17px] font-black tracking-tight ${style.accent}`}>
            {visibleTitle}
          </h3>
          <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-slate-600">
            {visibleDescription}
          </p>
        </div>
      </div>
    </Link>
  );
}

function Footer() {
  return (
    <footer className="relative mt-8 overflow-hidden rounded-[24px] border border-amber-200/70 bg-gradient-to-r from-amber-50/60 via-white to-orange-50/40 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 shadow-sm">
            <Star size={20} className="fill-amber-400 text-amber-500" />
          </span>
          <div>
            <p className="text-[15px] font-black text-slate-800">
              You&apos;re doing better than you think.
            </p>
            <p className="text-[12px] font-medium text-slate-500">
              Even showing up here is a genuine act of care.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function DepressionDashboard() {
  return (
    <SupportToolThemeProvider theme="depression_support">
      <SupportToolLayout className="!m-0 !w-full !max-w-none !gap-0 !p-0">
        <main className="relative min-h-screen w-full overflow-hidden bg-[#faf8f5] text-[#2c3242] antialiased selection:bg-rose-200">
          
          {/* Ambient Lighting Accents */}
          <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-orange-200/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-1/3 h-[400px] w-[400px] rounded-full bg-emerald-200/20 blur-3xl" />

          <div className="relative mx-auto w-full max-w-[1200px] space-y-8 px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
            
            {/* Outer Dashboard Card */}
            <div className="rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-slate-900/[0.03] backdrop-blur-md sm:p-10 lg:p-12">
              <div className="mx-auto max-w-[960px] space-y-8">
                
                {/* Header Section */}
                <header>
                  <div className="max-w-[620px] space-y-3">
                    <p className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-rose-800 shadow-sm">
                      <Heart size={14} className="text-rose-600" />
                      Good to see you here
                    </p>
                    <h1 className="text-[36px] font-black leading-tight tracking-[-.04em] text-slate-900 sm:text-[46px]">
                      Daily Momentum
                    </h1>
                    <p className="border-l-2 border-rose-300 pl-4 text-[15px] leading-relaxed text-slate-600 sm:text-[16px]">
                      You don&apos;t have to solve everything today. Choose <span className="font-bold text-rose-700">one small next step.</span>
                    </p>
                  </div>
                </header>

                {/* Main Feature Highlight */}
                <TinyStepCard />

                {/* Secondary Feature Grid */}
                <section aria-labelledby="depression-care-heading" className="space-y-4">
                  <div className="flex items-center gap-2.5 pt-2">
                    <Compass size={18} className="text-emerald-700" />
                    <h2
                      id="depression-care-heading"
                      className="text-[18px] font-black tracking-tight text-slate-800"
                    >
                      Other ways to care for yourself
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
                    {visibleCards.map((tool) => (
                      <SupportCard key={tool.moduleId} {...tool} />
                    ))}
                  </div>
                </section>

                {/* Encouragement Footer */}
                <Footer />

              </div>
            </div>

          </div>
        </main>
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}