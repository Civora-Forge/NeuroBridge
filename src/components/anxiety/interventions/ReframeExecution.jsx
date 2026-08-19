/**
 * ReframeExecution.jsx — CBT Cognitive Restructuring execution component for 7 core distortions
 */

import { useState, useMemo, useRef } from "react";
import { Lightbulb, CheckCircle2, ArrowRight, HelpCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CORE_CBT_PATTERNS } from "../domain/anxietyTypes";

export default function ReframeExecution({ initialThought = "", onComplete, onCancel }) {
  const [thought, setThought] = useState(initialThought);
  const [selectedPatternId, setSelectedPatternId] = useState(() => {
    // Attempt auto-match based on keywords in initialThought
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
    onCancel?.({
      durationSeconds,
      completed: false,
      abandoned: true,
    });
  };

  return (
    <Card className="border-primary/30 shadow-md">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-2">
          <Lightbulb size={24} />
        </div>
        <CardTitle className="text-xl">Cognitive Reframe Assistant</CardTitle>
        <CardDescription>
          Deconstruct anxious worry patterns and formulate evidence-based alternative thoughts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step Indicator */}
        <div className="flex items-center justify-between text-xs font-semibold px-1">
          <span className={step >= 1 ? "text-primary" : "text-muted-foreground"}>1. Worry Thought</span>
          <span>→</span>
          <span className={step >= 2 ? "text-primary" : "text-muted-foreground"}>2. Distortion Trap</span>
          <span>→</span>
          <span className={step >= 3 ? "text-primary" : "text-muted-foreground"}>3. Balanced View</span>
        </div>

        {/* Step 1: The Worry Thought */}
        {step === 1 && (
          <div className="space-y-3">
            <label className="text-sm font-medium">What is the anxious thought or worry?</label>
            <Input
              value={thought}
              onChange={(e) => setThought(e.target.value)}
              placeholder="e.g., Everyone will notice if I make a mistake and judge me."
              className="text-base"
            />
            <Button
              className="w-full gap-2 mt-2"
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
            <div className="p-3 rounded-xl bg-muted/50 text-sm">
              <span className="text-muted-foreground font-medium">Your thought:</span> "{thought}"
            </div>
            <label className="text-sm font-medium">Select the matching cognitive thinking pattern:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {CORE_CBT_PATTERNS.map((pattern) => (
                <button
                  key={pattern.id}
                  type="button"
                  onClick={() => setSelectedPatternId(pattern.id)}
                  className={`p-2.5 text-left rounded-xl border text-xs font-medium transition-all ${
                    selectedPatternId === pattern.id
                      ? "bg-primary/10 border-primary text-primary font-semibold shadow-sm"
                      : "bg-background hover:bg-muted/50 border-border"
                  }`}
                >
                  {pattern.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Proceed to Evidence <ArrowRight size={16} /></Button>
            </div>
          </div>
        )}

        {/* Step 3: Evidence Check & Balanced Thought */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-xs uppercase tracking-wider">
                <HelpCircle size={14} /> Evidence Check ({activePattern.name})
              </div>
              <p className="text-sm font-medium text-foreground">{activePattern.evidencePrompt}</p>
            </div>

            <Textarea
              value={evidenceResponse}
              onChange={(e) => setEvidenceResponse(e.target.value)}
              placeholder="Reflect on the evidence (e.g., Past experiences that went okay, realistic alternative outcomes)..."
              rows={2}
              className="text-sm"
            />

            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 space-y-1">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={14} /> Balanced Perspective
              </p>
              <p className="text-sm font-medium text-foreground">{activePattern.balancedThought}</p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-semibold">Micro-Action:</span> {activePattern.actionStep}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleFinish} className="gap-2">
                <CheckCircle2 size={16} /> Complete Reframe
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleAbandon}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            Cancel session
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
