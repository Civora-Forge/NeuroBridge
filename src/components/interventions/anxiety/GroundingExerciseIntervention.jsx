/**
 * GroundingExerciseIntervention.jsx — 5-4-3-2-1 Sensory Grounding for Anxiety
 *
 * Provides a low-cognitive-load, interactive senses check.
 * Senses:
 *   5 things you can see
 *   4 things you can feel
 *   3 things you can hear
 *   2 things you can smell
 *   1 thing you can taste / one slow breath
 */

import { useState, useRef } from "react";
import { Eye, Hand, Volume2, Coffee, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const GROUNDING_STEPS = [
  {
    step: 5,
    title: "5 things you can SEE",
    instruction: "Look around and tap 5 things you notice:",
    icon: Eye,
    chips: ["A bright color", "A window / light", "A pen or notebook", "A phone or screen", "The floor or ceiling", "A chair or desk"],
  },
  {
    step: 4,
    title: "4 things you can FEEL / TOUCH",
    instruction: "Notice 4 physical textures or contact points:",
    icon: Hand,
    chips: ["Feet flat on floor", "Fabric of your shirt", "Cool air on skin", "Hands resting on lap", "Texture of your chair"],
  },
  {
    step: 3,
    title: "3 things you can HEAR",
    instruction: "Listen quietly for 3 distinct sounds:",
    icon: Volume2,
    chips: ["Distant traffic / ambient", "Air conditioner / fan hum", "Your own breathing", "Keyboard or clock", "Birds outside"],
  },
  {
    step: 2,
    title: "2 things you can SMELL",
    instruction: "Notice 2 gentle scents around you:",
    icon: Coffee,
    chips: ["Fresh room air", "Warm tea / coffee", "Scent of your clothes", "Soap / lotion"],
  },
  {
    step: 1,
    title: "1 thing you can TASTE / 1 slow breath",
    instruction: "Take one slow grounding breath or a sip of water:",
    icon: Sparkles,
    chips: ["Take 1 deep slow breath", "Take a sip of water", "Notice current taste in mouth"],
  },
];

export default function GroundingExerciseIntervention({ onComplete, onCancel }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedChips, setSelectedChips] = useState({});
  const [completed, setCompleted] = useState(false);
  const startedAtRef = useRef(Date.now());

  const currentStep = GROUNDING_STEPS[currentStepIndex];
  const StepIcon = currentStep.icon;

  const currentSelected = selectedChips[currentStepIndex] || [];

  const toggleChip = (chip) => {
    setSelectedChips((prev) => {
      const list = prev[currentStepIndex] || [];
      const updated = list.includes(chip)
        ? list.filter((item) => item !== chip)
        : [...list, chip];
      return { ...prev, [currentStepIndex]: updated };
    });
  };

  const handleNext = () => {
    if (currentStepIndex < GROUNDING_STEPS.length - 1) {
      setCurrentStepIndex((idx) => idx + 1);
    } else {
      setCompleted(true);
    }
  };

  const handleFinish = () => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    onComplete?.({
      completed: true,
      durationSeconds,
      stepsCompleted: GROUNDING_STEPS.length,
    });
  };

  const totalProgress = Math.round(((currentStepIndex + (completed ? 1 : 0)) / GROUNDING_STEPS.length) * 100);

  if (completed) {
    return (
      <div className="rounded-2xl bg-white border border-[#C7D2FE] p-6 sm:p-8 text-center space-y-6 shadow-[6px_6px_0_#DDE8FC] animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-[#DDE8FC] text-[#4F6BF6] mx-auto flex items-center justify-center border border-[#C7D2FE]">
          <CheckCircle2 size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-[#1E2A5E]">
            Grounding complete.
          </h2>
          <p className="text-sm text-[#6B7BA8] max-w-md mx-auto leading-relaxed">
            You brought your attention back to the present moment through your senses. Take a deep breath and carry on calmly.
          </p>
        </div>
        <Button
          onClick={handleFinish}
          className="w-full max-w-xs h-12 rounded-xl bg-[#4F6BF6] hover:bg-[#3B51D4] text-white font-bold shadow-[2px_2px_0_#C7D2FE]"
        >
          Return to App
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-[#C7D2FE] p-6 sm:p-8 space-y-6 shadow-[6px_6px_0_#DDE8FC]">
      {/* Step Header & Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs border-[#C7D2FE] text-[#4F6BF6] bg-[#F0F4FF]">
            Step {currentStepIndex + 1} of 5
          </Badge>
          <span className="text-xs font-semibold text-[#6B7BA8]">{totalProgress}% Complete</span>
        </div>
        <Progress value={totalProgress} className="h-2 bg-[#C7D2FE] [&>[role=progressbar]]:bg-[#4F6BF6]" />
      </div>

      {/* Senses Prompt */}
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDE8FC] text-[#4F6BF6] flex items-center justify-center flex-shrink-0 mt-0.5">
            <StepIcon size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1E2A5E]">{currentStep.title}</h3>
            <p className="text-xs text-[#6B7BA8]">{currentStep.instruction}</p>
          </div>
        </div>

        {/* Quick Tap Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {currentStep.chips.map((chip) => {
            const isSelected = currentSelected.includes(chip);
            return (
              <button
                key={chip}
                type="button"
                onClick={() => toggleChip(chip)}
                className={`p-3 rounded-xl border text-xs font-medium text-left transition-all flex items-center justify-between select-none ${
                  isSelected
                    ? "bg-[#DDE8FC] border-[#4F6BF6] text-[#1E2A5E] font-bold shadow-sm"
                    : "bg-[#F0F4FF]/50 border-[#C7D2FE] text-[#6B7BA8] hover:border-[#4F6BF6]"
                }`}
              >
                <span>{chip}</span>
                <CheckCircle2 size={15} className={isSelected ? "text-[#4F6BF6]" : "text-[#C7D2FE]"} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <Button
          onClick={handleNext}
          className="w-full max-w-xs h-12 rounded-xl bg-[#4F6BF6] hover:bg-[#3B51D4] text-white font-bold text-sm shadow-[2px_2px_0_#C7D2FE] gap-2"
        >
          {currentStepIndex === GROUNDING_STEPS.length - 1 ? "Complete Grounding" : "Next Sense"}
          <ArrowRight size={16} />
        </Button>
        <button
          type="button"
          onClick={() => onCancel?.()}
          className="text-xs text-[#6B7BA8] hover:text-[#1E2A5E] underline underline-offset-4"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
