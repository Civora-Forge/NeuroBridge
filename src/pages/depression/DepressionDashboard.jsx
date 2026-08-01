'use client';

import React from "react";
import { Brain, Eye, MessageCircle, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export const DEPRESSION_LANDING_TOOLS = [
  { moduleId: "support.gentle_activity", to: "/depression/mvh", icon: Zap, title: "Gentle Activity", desc: "Try a short sequence of low-energy actions." },
  { moduleId: "support.grounding", to: "/depression/anxietydissolver", icon: Eye, title: "Grounding", desc: "Use a timed technique to reduce anxious intensity." },
  { moduleId: "support.social_connection", to: "/depression/social", icon: MessageCircle, title: "Social Connection", desc: "Choose a low-pressure message for someone you trust." },
  { moduleId: "support.cognitive_reframing", to: "/depression/reality", icon: Brain, title: "Cognitive Reframing", desc: "Use structured questions to explore a difficult thought." },
];

export default function DepressionDashboard() {
  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-green-50 via-white to-teal-50">
      <div className="text-center mb-16 max-w-2xl mx-auto">
        <div className="w-24 h-24 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_60%_45%)] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
          <Brain className="w-12 h-12 text-white drop-shadow-lg"/>
        </div>
        <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-[hsl(142_72%_36%)] via-[hsl(142_66%_42%)] to-[hsl(142_72%_32%)] bg-clip-text text-transparent mb-4 leading-tight">
          Daily Momentum
        </h1>
        <p className="text-xl text-gray-600 font-medium tracking-wide">
          Low-energy support tools for small, manageable next steps.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {DEPRESSION_LANDING_TOOLS.map(({ moduleId, to, icon: Icon, title, desc }) => (
          <Link
            key={moduleId}
            to={to}
            className="group relative card bg-white/80 backdrop-blur-sm p-8 rounded-3xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 border border-white/50 hover:border-[hsl(142_72%_36%)]/20 hover:bg-white/100 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[hsl(142_72%_36%)]/5 to-[hsl(142_60%_45%)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative mb-6 p-4 bg-gradient-to-r from-[hsl(142_72%_36%)]/10 to-[hsl(142_60%_45%)]/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
              <Icon className="w-12 h-12" />
            </div>
            <h3 className="relative font-black text-xl text-gray-900 mb-3 group-hover:text-[hsl(142_72%_36%)] transition-colors duration-300">
              {title}
            </h3>
            <p className="relative text-sm text-gray-600 leading-relaxed tracking-wide">
              {desc}
            </p>
            <div className="absolute -bottom-4 right-6 w-24 h-24 bg-gradient-to-r from-[hsl(142_72%_36%)]/20 to-[hsl(142_60%_45%)]/20 rounded-full blur-xl -z-10 group-hover:scale-110 transition-transform duration-500"></div>
          </Link>
        ))}
      </div>
      <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-gray-500">
        Private journaling and free-text release tools are unavailable until their privacy and safety protections are complete.
      </p>
    </div>
  );
}
