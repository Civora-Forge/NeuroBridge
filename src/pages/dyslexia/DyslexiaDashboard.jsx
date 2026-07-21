import React from "react";
import { Link } from "react-router-dom";
import {
  BrainCircuit,
  AudioLines,
  PenLine,
  Activity,
  Waves,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    to: "/dyslexia/adaptive-reading",
    title: "Adaptive Reading Intelligence Engine",
    description:
      "Real-time reading simplification with behavioral analytics and comfort scoring.",
    icon: BrainCircuit,
  },
  {
    to: "/dyslexia/phonology",
    title: "Phonological Weakness Detection",
    description: "AI-generated drills from live phoneme error patterns.",
    icon: AudioLines,
  },
  {
    to: "/dyslexia/reinforcement",
    title: "Multi-Sensory Reinforcement Mode",
    description:
      "Read → Hear → Build → Spell → Re-read cognitive reinforcement loop.",
    icon: Waves,
  },
  {
    to: "/dyslexia/writing-assistant",
    title: "Dyslexia-Aware Writing Assistant",
    description:
      "Gentle phonetic correction with confidence-focused explanations.",
    icon: PenLine,
  },
  {
    to: "/dyslexia/personal-profile",
    title: "AI Personal Learning Profile",
    description:
      "Weekly evolving cognitive scores and adaptive 7-day training plan.",
    icon: Activity,
  },
];

export default function DyslexiaDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-teal-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 text-center">
          <Badge className="bg-green-600 hover:bg-green-700 text-white mb-4">
            AI-Powered Neuroadaptive Dyslexia Intervention Platform
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-green-700 mb-3">
            Neuroadaptive Dyslexia Module
          </h1>
          <p className="text-slate-600 max-w-3xl mx-auto">
            Data-driven cognitive intervention with MongoDB analytics,
            Gemini-powered adaptations, and real-time behavior-aware learning
            loops.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <Link key={feature.to} to={feature.to} className="group">
              <Card className="h-full p-6 bg-white border-green-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="inline-flex p-3 rounded-xl bg-green-100 text-green-700 mb-4">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  {feature.title}
                </h2>
                <p className="text-slate-600 mb-5">{feature.description}</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-700">
                  Open Feature <ArrowRight className="w-4 h-4" />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
