'use client';

import React from "react";
import { Brain, Zap, Eye, Moon, ShieldCheck, Heart } from "lucide-react";
import { Link } from "react-router-dom";

const tools = [
  { to: "/depression/mvh", icon: <Zap className="w-12 h-12" />, title: "MVH Protocol", desc: "Minimum viable human recovery sequence" },
  { to: "/depression/anxietydissolver", icon: <Eye className="w-12 h-12" />, title: "Anxiety Dissolver", desc: "Clear sensory overwhelm" },
  { to: "/depression/social", icon: <Moon className="w-12 h-12" />, title: "Social Broadcaster", desc: "Share energy status guilt-free" },
  { to: "/depression/proof", icon: <ShieldCheck className="w-12 h-12" />, title: "Evidence Folder", desc: "Proof your brain is wrong" },
  { to: "/depression/reality", icon: <Brain className="w-12 h-12" />, title: "Reality Filter", desc: "Reframe cognitive distortions" },
  { to: "/depression/void", icon: <Heart className="w-12 h-12" />, title: "Void Whisper", desc: "Release heavy thoughts safely" },
];

export default function DepressionDashboard() {
  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-green-50 via-white to-teal-50">
      <div className="text-center mb-16 max-w-2xl mx-auto">
        <div className="w-24 h-24 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_60%_45%)] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
          <Brain className="w-12 h-12 text-white drop-shadow-lg"/>
        </div>
        <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-[hsl(142_72%_36%)] via-[hsl(142_66%_42%)] to-[hsl(142_72%_32%)] bg-clip-text text-transparent mb-4 leading-tight">
          MoodFlow
        </h1>
        <p className="text-xl text-gray-600 font-medium tracking-wide">
          Depression Support ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Low-Energy Operating Mode
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {tools.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group relative card bg-white/80 backdrop-blur-sm p-8 rounded-3xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 border border-white/50 hover:border-[hsl(142_72%_36%)]/20 hover:bg-white/100 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[hsl(142_72%_36%)]/5 to-[hsl(142_60%_45%)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative mb-6 p-4 bg-gradient-to-r from-[hsl(142_72%_36%)]/10 to-[hsl(142_60%_45%)]/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
              {t.icon}
            </div>
            <h3 className="relative font-black text-xl text-gray-900 mb-3 group-hover:text-[hsl(142_72%_36%)] transition-colors duration-300">
              {t.title}
            </h3>
            <p className="relative text-sm text-gray-600 leading-relaxed tracking-wide">
              {t.desc}
            </p>
            <div className="absolute -bottom-4 right-6 w-24 h-24 bg-gradient-to-r from-[hsl(142_72%_36%)]/20 to-[hsl(142_60%_45%)]/20 rounded-full blur-xl -z-10 group-hover:scale-110 transition-transform duration-500"></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
