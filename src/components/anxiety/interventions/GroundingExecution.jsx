/**
 * GroundingExecution.jsx — 5-4-3-2-1 Sensory Grounding interactive execution component
 */

import { useState, useRef } from "react";
import { CheckCircle2, ListChecks, Eye, Hand, Volume2, Sparkles, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const SENSORY_STEPS = [
  { count: 5, label: "5 things you can SEE", hint: "Notice colors, shapes, light reflections, or objects around you.", icon: Eye },
  { count: 4, label: "4 things you can physically TOUCH / FEEL", hint: "Notice feet on the floor, texture of your clothing, or cool air.", icon: Hand },
  { count: 3, label: "3 things you can HEAR", hint: "Notice distant traffic, air conditioning, breathing, or birds.", icon: Volume2 },
  { count: 2, label: "2 things you can SMELL", hint: "Notice ambient room scent, clothing, tea/coffee, or fresh air.", icon: Coffee },
  { count: 1, label: "1 thing you can TASTE", hint: "Notice current taste, sip of water, or take a deep grounding breath.", icon: Sparkles },
];

export default function GroundingExecution({ onComplete, onCancel }) {
  const [checkedSteps, setCheckedSteps] = useState([]);
  const startedAtRef = useRef(Date.now());

  const toggleStep = (index) => {
    setCheckedSteps((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const progressPercent = Math.round((checkedSteps.length / SENSORY_STEPS.length) * 100);

  const handleFinish = () => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    onComplete?.({ durationSeconds, completed: true, stepsCompleted: checkedSteps.length });
  };

  const handleAbandon = () => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    onCancel?.({ durationSeconds, completed: false, abandoned: true });
  };

  return (
    <Card className="border-[#C7D2FE] shadow-[6px_6px_0_#DDE8FC] rounded-2xl overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-[#4F6BF6] to-[#A5B4FC]" />
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#DDE8FC] text-[#4F6BF6] flex items-center justify-center mb-2">
          <ListChecks size={24} />
        </div>
        <CardTitle className="text-xl text-[#1E2A5E]">5-4-3-2-1 Sensory Grounding</CardTitle>
        <CardDescription className="text-[#6B7BA8]">
          Engage your five senses sequentially to anchor attention in the physical present.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-[#6B7BA8] font-medium">
            <span>Sensory Progress</span>
            <span className="text-[#1E2A5E]">{checkedSteps.length}/{SENSORY_STEPS.length} senses ({progressPercent}%)</span>
          </div>
          <Progress value={progressPercent} className="h-2 bg-[#C7D2FE] [&>[role=progressbar]]:bg-[#4F6BF6]" />
        </div>

        <div className="space-y-2.5">
          {SENSORY_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isDone = checkedSteps.includes(index);
            return (
              <div
                key={step.count}
                onClick={() => toggleStep(index)}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 select-none ${
                  isDone
                    ? "bg-[#DDE8FC] border-[#4F6BF6] shadow-[2px_2px_0_#C7D2FE]"
                    : "bg-white border-[#C7D2FE] hover:border-[#4F6BF6] hover:bg-[#F0F4FF]"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isDone ? "bg-[#4F6BF6] text-white" : "bg-[#E2E8F0] text-[#6B7BA8]"
                  }`}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${isDone ? "text-[#4F6BF6]" : "text-[#1E2A5E]"}`}>
                      {step.label}
                    </p>
                    <CheckCircle2
                      size={18}
                      className={isDone ? "text-[#4F6BF6]" : "text-[#C7D2FE]"}
                    />
                  </div>
                  <p className="text-xs text-[#6B7BA8] mt-0.5">{step.hint}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            variant="outline"
            className="border-[#C7D2FE] text-[#6B7BA8] hover:text-[#4F6BF6] hover:border-[#4F6BF6]"
            onClick={handleAbandon}
          >
            Cancel
          </Button>
          <Button
            onClick={handleFinish}
            disabled={checkedSteps.length === 0}
            className="gap-2 bg-[#4F6BF6] text-white hover:bg-[#3B51D4] shadow-[2px_2px_0_#C7D2FE] font-bold"
          >
            <CheckCircle2 size={16} />
            Complete ({checkedSteps.length}/5)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
