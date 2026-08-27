import { useMemo } from "react";
import { Lightbulb, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ReframePanel({ thoughtInput, setThoughtInput, reframes, onGenerate }) {
  const latest = useMemo(() => (reframes.length ? reframes[0] : null), [reframes]);
  const pick = (value, fallback) => (value && String(value).trim() ? value : fallback);

  return (
    <Card className="overflow-hidden border-[#C7D2FE] shadow-[4px_4px_0_#DDE8FC]">
      <div className="h-2 bg-gradient-to-r from-[#4F6BF6] to-[#A5B4FC]" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xl text-[#1E2A5E]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DDE8FC] text-[#4F6BF6]">
            <Lightbulb size={18} />
          </div>
          Cognitive Reframe Assistant
        </CardTitle>
        <CardDescription className="text-[#6B7BA8]">
          Deterministic local reframing logic. Input stays on device only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={thoughtInput}
          onChange={(event) => setThoughtInput(event.target.value)}
          placeholder="I always mess up presentations"
          className="border-[#C7D2FE] text-[#1E2A5E] placeholder:text-[#6B7BA8]/60 focus:border-[#4F6BF6]"
        />
        <Button
          onClick={onGenerate}
          className="bg-[#4F6BF6] text-white hover:bg-[#3B51D4] shadow-[2px_2px_0_#C7D2FE] font-bold"
        >
          <Sparkles size={16} className="mr-1.5" /> Generate Reframe
        </Button>

        {latest && (
          <Card className="border-[#C7D2FE] shadow-[3px_3px_0_#DDE8FC] bg-[#F0F4FF]/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-[#1E2A5E]">Latest Reframe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="font-semibold text-[#1E2A5E]">Original:</span> <span className="text-[#6B7BA8]">{pick(latest.originalThought, "Not provided")}</span></p>
              <p><span className="font-semibold text-[#1E2A5E]">Distortion:</span> <span className="text-[#4F6BF6]">{pick(latest.distortionTag, "General anxiety narrative")}</span></p>
              <p><span className="font-semibold text-[#1E2A5E]">Matched Feeling:</span> <span className="text-[#6B7BA8]">{pick(latest.matchLabel, "No keyword match")}</span></p>
              <p><span className="font-semibold text-[#1E2A5E]">Counter:</span> <span className="text-[#065F46]">{pick(latest.counterStatement, "I can pause, check facts, and respond with a calmer thought.")}</span></p>
              <p><span className="font-semibold text-[#1E2A5E]">Action:</span> <span className="text-[#6B7BA8]">{pick(latest.actionStep, "Take 3 slow breaths, then write one helpful next step.")}</span></p>
              <p><span className="font-semibold text-[#1E2A5E]">Evidence Prompt:</span> <span className="text-[#6B7BA8]">{pick(latest.evidencePrompt, "What facts support this thought, and what facts support a more balanced view?")}</span></p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <p className="font-semibold text-[#1E2A5E]">History</p>
          <div className="max-h-72 overflow-auto space-y-2 pr-1">
            {reframes.length === 0 && <p className="text-sm text-[#6B7BA8]">No reframes yet.</p>}
            {reframes.map((entry) => (
              <Textarea
                key={entry.id}
                value={`[${new Date(entry.createdAt).toLocaleString()}]\nOriginal: ${pick(entry.originalThought, "Not provided")}\nDistortion: ${pick(entry.distortionTag, "General anxiety narrative")}\nMatched Feeling: ${pick(entry.matchLabel, "No keyword match")}\nCounter: ${pick(entry.counterStatement, "I can pause, check facts, and respond with a calmer thought.")}\nAction: ${pick(entry.actionStep, "Take 3 slow breaths, then write one helpful next step.")}\nEvidence: ${pick(entry.evidencePrompt, "What facts support this thought, and what facts support a more balanced view?")}`}
                readOnly
                className="min-h-28 border-[#C7D2FE] text-[#1E2A5E] bg-white focus:border-[#4F6BF6]"
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
