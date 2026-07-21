import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ReframePanel({ thoughtInput, setThoughtInput, reframes, onGenerate }) {
  const latest = useMemo(() => (reframes.length ? reframes[0] : null), [reframes]);
  const pick = (value, fallback) => (value && String(value).trim() ? value : fallback);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Lightbulb size={18} /> Cognitive Reframe Assistant</CardTitle>
        <CardDescription>Deterministic local reframing logic. Input stays on device only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={thoughtInput}
          onChange={(event) => setThoughtInput(event.target.value)}
          placeholder="I always mess up presentations"
        />
        <Button onClick={onGenerate}>Generate Reframe</Button>

        {latest && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Latest Reframe</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="font-medium">Original:</span> {pick(latest.originalThought, "Not provided")}</p>
              <p><span className="font-medium">Distortion:</span> {pick(latest.distortionTag, "General anxiety narrative")}</p>
              <p><span className="font-medium">Matched Feeling:</span> {pick(latest.matchLabel, "No keyword match")}</p>
              <p><span className="font-medium">Counter:</span> {pick(latest.counterStatement, "I can pause, check facts, and respond with a calmer thought.")}</p>
              <p><span className="font-medium">Action:</span> {pick(latest.actionStep, "Take 3 slow breaths, then write one helpful next step.")}</p>
              <p><span className="font-medium">Evidence Prompt:</span> {pick(latest.evidencePrompt, "What facts support this thought, and what facts support a more balanced view?")}</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">History</p>
          <div className="max-h-72 overflow-auto space-y-2 pr-1">
            {reframes.length === 0 && <p className="text-sm text-muted-foreground">No reframes yet.</p>}
            {reframes.map((entry) => (
              <Textarea
                key={entry.id}
                value={`[${new Date(entry.createdAt).toLocaleString()}]\nOriginal: ${pick(entry.originalThought, "Not provided")}\nDistortion: ${pick(entry.distortionTag, "General anxiety narrative")}\nMatched Feeling: ${pick(entry.matchLabel, "No keyword match")}\nCounter: ${pick(entry.counterStatement, "I can pause, check facts, and respond with a calmer thought.")}\nAction: ${pick(entry.actionStep, "Take 3 slow breaths, then write one helpful next step.")}\nEvidence: ${pick(entry.evidencePrompt, "What facts support this thought, and what facts support a more balanced view?")}`}
                readOnly
                className="min-h-28"
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
