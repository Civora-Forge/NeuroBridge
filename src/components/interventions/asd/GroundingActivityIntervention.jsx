/**
 * GroundingActivityIntervention.jsx — 5-Step Low-Cognitive-Load ASD Regulation Activity
 *
 * Sequence:
 *   1. Pause ("Stop what you're doing for a moment.")
 *   2. Look around ("Gently look around your space.")
 *   3. Notice one thing (Selectable chips, no typing)
 *   4. Take a slow breath (Visual gentle breath cycle)
 *   5. Continue ("You're grounded and ready.")
 */

import { useState, useRef } from "react";
import { Hand, Eye, Sparkles, Wind, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NOTICE_CHIPS = [
  { id: "color", label: "A bright color", emoji: "🎨" },
  { id: "texture", label: "A soft texture", emoji: "🧸" },
  { id: "object", label: "A quiet object", emoji: "🪴" },
  { id: "light", label: "A spot of warm light", emoji: "☀️" },
];

export default function GroundingActivityIntervention({ onComplete, onCancel }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedChip, setSelectedChip] = useState("color");
  const [breathPhase, setBreathPhase] = useState(0);
  const startedAtRef = useRef(Date.now());

  const handleNextStep = () => {
    if (currentStep < 5) {
      setCurrentStep((s) => s + 1);
    } else {
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      onComplete?.({ completed: true, durationSeconds, selectedChip });
    }
  };

  if (currentStep === 5) {
    return (
      <div className="rounded-2xl bg-white border border-[#B2DFDB] p-6 sm:p-8 text-center space-y-6 shadow-[4px_4px_0_#D5F5EC] animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-[#D5F5EC] text-[#0D9488] mx-auto flex items-center justify-center border border-[#B2DFDB]">
          <CheckCircle2 size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-[#134E4A]">
            Well done! You grounded your attention.
          </h2>
          <p className="text-sm text-[#5F8A87] max-w-md mx-auto leading-relaxed">
            You paused, looked around, noticed your surroundings, and took a gentle breath. You're ready to continue.
          </p>
        </div>
        <Button
          onClick={handleNextStep}
          className="w-full max-w-xs h-12 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold shadow-[2px_2px_0_#B2DFDB]"
        >
          Return to App
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-[#B2DFDB] p-6 sm:p-8 space-y-6 shadow-[4px_4px_0_#D5F5EC]">
      {/* Progress Bar */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs border-[#B2DFDB] text-[#0D9488] bg-[#F0FAF7]">
          Step {currentStep} of 4
        </Badge>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`h-2 rounded-full transition-all duration-300 ${
                step <= currentStep ? "w-6 bg-[#0D9488]" : "w-2 bg-[#D5F5EC]"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[180px] flex flex-col justify-center items-center text-center space-y-4">
        {currentStep === 1 && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-[#D5F5EC] text-[#0D9488] mx-auto flex items-center justify-center">
              <Hand size={28} />
            </div>
            <h3 className="text-2xl font-bold text-[#134E4A]">1. Pause</h3>
            <p className="text-sm text-[#5F8A87] max-w-sm">
              Stop what you're doing for a moment. You are in a safe, quiet space.
            </p>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-[#D5F5EC] text-[#0D9488] mx-auto flex items-center justify-center">
              <Eye size={28} />
            </div>
            <h3 className="text-2xl font-bold text-[#134E4A]">2. Look around</h3>
            <p className="text-sm text-[#5F8A87] max-w-sm">
              Gently look around your space. Let your eyes wander without pressure.
            </p>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4 animate-in fade-in duration-200 w-full max-w-md">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-[#134E4A]">3. Notice one thing</h3>
              <p className="text-xs text-[#5F8A87]">Select what caught your attention:</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {NOTICE_CHIPS.map((chip) => {
                const isSelected = selectedChip === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setSelectedChip(chip.id)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 ${
                      isSelected
                        ? "bg-[#D5F5EC] border-[#0D9488] text-[#134E4A] shadow-sm font-bold"
                        : "bg-[#F0FAF7] border-[#B2DFDB] text-[#5F8A87] hover:border-[#0D9488]"
                    }`}
                  >
                    <span>{chip.emoji}</span>
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-full border-4 border-[#5EEAD4] bg-[#F0FAF7] flex items-center justify-center mx-auto shadow-inner animate-pulse">
              <Wind size={26} className="text-[#0D9488]" />
            </div>
            <h3 className="text-2xl font-bold text-[#134E4A]">4. Take a slow breath</h3>
            <p className="text-sm text-[#5F8A87] max-w-sm">
              Inhale gently... hold... and let it all go.
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <Button
          onClick={handleNextStep}
          className="w-full max-w-xs h-12 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-sm shadow-[2px_2px_0_#B2DFDB] gap-2"
        >
          {currentStep === 4 ? "Complete Grounding" : "Next Step"}
          <ArrowRight size={16} />
        </Button>
        <button
          type="button"
          onClick={() => onCancel?.()}
          className="text-xs text-[#5F8A87] hover:text-[#134E4A] underline underline-offset-4"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
