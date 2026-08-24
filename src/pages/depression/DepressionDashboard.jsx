'use client';

import React from "react";
import { Brain, Eye, MessageCircle, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { FEATURES } from "@/lib/featureRegistry";

export const DEPRESSION_LANDING_TOOLS = [
  { moduleId: "support.gentle_activity", feature: FEATURES.DEPRESSION_MVH, to: "/depression/mvh", icon: Zap, title: "Gentle Activity", desc: "Try one very small action. You can stop whenever you need to." },
  { moduleId: "support.grounding", feature: FEATURES.DEPRESSION_ANXIETY_DISSOLVER, to: "/depression/anxietydissolver", icon: Eye, title: "Grounding", desc: "A brief way to return your attention to the present." },
  { moduleId: "support.social_connection", feature: FEATURES.DEPRESSION_SOCIAL, to: "/depression/social", icon: MessageCircle, title: "Social Connection", desc: "Put together a low-pressure message for someone you trust." },
  { moduleId: "support.cognitive_reframing", feature: FEATURES.DEPRESSION_REALITY, to: "/depression/reality", icon: Brain, title: "Cognitive Reframing", desc: "Look at one difficult thought with a little more room around it." },
  { moduleId: "support.evidence_journal", feature: FEATURES.DEPRESSION, to: "/depression/evidence", icon: Sparkles, title: "Evidence Journal", desc: "Keep a private note of moments and support that matter." },
];

function ToolLink({ tool, primary = false }) {
  const Icon = tool.icon;

  return (
    <Link
      to={tool.to}
      className={primary
        ? "block rounded-2xl border border-[#bbd8c1] bg-white p-5 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3f7654] focus:ring-offset-2 sm:p-6"
        : "flex items-start gap-3 rounded-xl border border-[#d5e8d8] bg-white p-4 text-left focus:outline-none focus:ring-2 focus:ring-[#3f7654] focus:ring-offset-2"}
    >
      <span className={primary ? "mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#e1f0e4] text-[#3f7654]" : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#edf7ef] text-[#4e7657]"}>
        <Icon className={primary ? "h-5 w-5" : "h-4 w-4"} aria-hidden="true" />
      </span>
      <span className={primary ? "block" : "block min-w-0"}>
        <span className={primary ? "block text-lg font-semibold text-[#26372c]" : "block text-sm font-semibold text-[#26372c]"}>{tool.title}</span>
        <span className={primary ? "mt-1 block max-w-lg text-sm leading-6 text-[#526556]" : "mt-1 block text-xs leading-5 text-[#526556]"}>{tool.desc}</span>
        {primary && <span className="mt-4 inline-block text-sm font-medium text-[#3f7654]">Start with this</span>}
      </span>
    </Link>
  );
}

export default function DepressionDashboard() {
  const { hasFeature } = useAuth();
  const availableTools = DEPRESSION_LANDING_TOOLS.filter((tool) => hasFeature(tool.feature));
  const [gentleActivity, ...otherTools] = availableTools;

  return (
    <main className="min-h-screen bg-[#f4faf5] px-4 py-8 text-[#26372c] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="max-w-xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#5f7865]">A quiet place to begin</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Daily Momentum</h1>
          <p className="mt-3 text-sm leading-6 text-[#526556] sm:text-base">You do not need to solve everything today. Choose one small kind next step.</p>
        </header>

        <section className="mt-8" aria-label="Start here">
          {gentleActivity && <ToolLink tool={gentleActivity} primary />}
        </section>

        {otherTools.length > 0 && (
          <section className="mt-7" aria-label="Other support tools">
            <h2 className="text-sm font-medium text-[#4e473a]">Other ways to get support</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {otherTools.map((tool) => <ToolLink key={tool.moduleId} tool={tool} />)}
            </div>
          </section>
        )}

        <p className="mt-8 max-w-xl text-xs leading-5 text-[#766f61]">Private journaling and free-text release tools are unavailable until their privacy and safety protections are complete.</p>
      </div>
    </main>
  );
}
