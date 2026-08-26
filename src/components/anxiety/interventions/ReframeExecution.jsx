/**
 * ReframeExecution.jsx — CBT Cognitive Restructuring execution component for 7 core distortions
 */

import { useState, useMemo, useRef } from "react";
import { Lightbulb, CheckCircle2, ArrowRight, HelpCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CORE_CBT_PATTERNS } from "../domain/anxietyTypes";

export default function ReframeExecution({ initialThought = "", onComplete, onCancel }) {
  const [thought, setThought] = useState(initialThought);
  const [selectedPatternId, setSelectedPatternId] = useState(() => {
    const lower = initialThought.toLowerCase();
    const matched = CORE_CBT_PATTERNS.find((p) => p.keywords.some((kw) => lower.includes(kw)));
    return matched ? matched.id : CORE_CBT_PATTERNS[0].id;
  });
  const [evidenceResponse, setEvidenceResponse] = useState("");
  const [step, setStep] = useState(1);
  const startedAtRef = useRef(Date.now());

  const activePattern = useMemo(
    () => CORE_CBT_PATTERNS.find((p) => p.id === selectedPatternId) || CORE_CBT_PATTERNS[0],
    [selectedPatternId]
  );

  const handleFinish = () => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    onComplete?.({
      durationSeconds,
      completed: true,
      reframeData: {
        originalThought: thought,
        distortion: activePattern.name,
        evidenceResponse,
        balancedThought: activePattern.balancedThought,
        actionStep: activePattern.actionStep,
      },
    });
  };

  const handleAbandon = () => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    onCancel?.({ durationSeconds, completed: false, abandoned: true });
  };

  return (
    <Card className="border-[#C7D2FE] shadow-[6px_6px_0_#DDE8FC] rounded-2xl overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-[#4F6BF6] to-[#A5B4FC]" />
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#FBBF24]/10 text-[#F59E0B] flex items-center justify-center mb-2">
          <Lightbulb size={24} />
        </div>
        <CardTitle className="text-xl text-[#1E2A5E]">Cognitive Reframe Assistant</CardTitle>
        <CardDescription className="text-[#6B7BA8]">
          Deconstruct anxious worry patterns and formulate evidence-based alternative thoughts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step Indicator */}
        <div className="flex items-center justify-between text-xs font-semibold px-1">
          <span className={step >= 1 ? "text-[#4F6BF6]" : "text-[#6B7BA8]"}>1. Worry Thought</span>
          <span className="text-[#C7D2FE]">→</span>
          <span className={step >= 2 ? "text-[#4F6BF6]" : "text-[#6B7BA8]"}>2. Distortion Trap</span>
          <span className="text-[#C7D2FE]">→</span>
          <span className={step >= 3 ? "text-[#4F6BF6]" : "text-[#6B7BA8]"}>3. Balanced View</span>
        </div>

        {/* Step 1: The Worry Thought */}
        {step === 1 && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-[#1E2A5E]">What is the anxious thought or worry?</label>
            <Input
              value={thought}
              onChange={(e) => setThought(e.target.value)}
              placeholder="e.g., Everyone will notice if I make a mistake and judge me."
              className="text-base border-[#C7D2FE] text-[#1E2A5E] placeholder:text-[#6B7BA8]/60 focus:border-[#4F6BF6]"
            />
            <Button
              className="w-full gap-2 mt-2 bg-[#4F6BF6] text-white hover:bg-[#3B51D4] shadow-[2px_2px_0_#C7D2FE] font-bold"
              disabled={!thought.trim()}
              onClick={() => setStep(2)}
            >
              Continue to Identify Distortion <ArrowRight size={16} />
            </Button>
          </div>
        )}

        {/* Step 2: Identify Distortion Trap */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-[#F0F4FF] border border-[#C7D2FE] text-sm">
              <span className="text-[#6B7BA8] font-medium">Your thought:</span> <span className="text-[#1E2A5E] font-medium">"{thought}"</span>
            </div>
            <label className="text-sm font-medium text-[#1E2A5E]">Select the matching cognitive thinking pattern:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {CORE_CBT_PATTERNS.map((pattern) => (
                <button
                  key={pattern.id}
                  type="button"
                  onClick={() => setSelectedPatternId(pattern.id)}
                  className={`p-2.5 text-left rounded-xl border-2 text-xs font-medium transition-all ${
                    selectedPatternId === pattern.id
                      ? "bg-[#DDE8FC] border-[#4F6BF6] text-[#4F6BF6] font-semibold shadow-[2px_2px_0_#C7D2FE]"
                      : "bg-white border-[#C7D2FE] hover:border-[#4F6BF6] text-[#1E2A5E]"
                  }`}
                >
                  {pattern.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" className="border-[#C7D2FE] text-[#6B7BA8]" onClick={() => setStep(1)}>Back</Button>
              <Button className="bg-[#4F6BF6] text-white hover:bg-[#3B51D4] shadow-[2px_2px_0_#C7D2FE]" onClick={() => setStep(3)}>
                Proceed to Evidence <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Evidence Check & Balanced Thought */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#FEF3C7] border border-[#FBBF24]/30 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[#D97706] font-semibold text-xs uppercase tracking-wider">
                <HelpCircle size={14} /> Evidence Check ({activePattern.name})
              </div>
              <p className="text-sm font-medium text-[#1E2A5E]">{activePattern.evidencePrompt}</p>
            </div>

            <Textarea
              value={evidenceResponse}
              onChange={(e) => setEvidenceResponse(e.target.value)}
              placeholder="Reflect on the evidence (e.g., Past experiences that went okay, realistic alternative outcomes)..."
              rows={2}
              className="text-sm border-[#C7D2FE] text-[#1E2A5E] placeholder:text-[#6B7BA8]/60 focus:border-[#4F6BF6]"
            />

            <div className="p-3.5 rounded-xl bg-[#DDE8FC] border border-[#C7D2FE] space-y-1">
              <p className="text-xs font-semibold text-[#4F6BF6] uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={14} /> Balanced Perspective
              </p>
              <p className="text-sm font-medium text-[#1E2A5E]">{activePattern.balancedThought}</p>
              <p className="text-xs text-[#6B7BA8] mt-1">
                <span className="font-semibold text-[#1E2A5E]">Micro-Action:</span> {activePattern.actionStep}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" className="border-[#C7D2FE] text-[#6B7BA8]" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleFinish} className="gap-2 bg-[#4F6BF6] text-white hover:bg-[#3B51D4] shadow-[2px_2px_0_#C7D2FE] font-bold">
                <CheckCircle2 size={16} /> Complete Reframe
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleAbandon}
            className="text-xs text-[#6B7BA8] hover:text-[#4F6BF6] underline underline-offset-4"
          >
            Cancel session
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
