import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { HeartPulse } from "lucide-react";

export default function AdaptiveCheckInPanel({ onSubmitCheckin, frequentMode = false }) {
  const [intensity, setIntensity] = useState(frequentMode ? 6 : 4);
  const [beforeEvent, setBeforeEvent] = useState(false);
  const [context, setContext] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl"><HeartPulse size={20} /> Anxiety Check-in</CardTitle>
        <CardDescription className="text-base">
          Quick check-in to help the app adjust support in real time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">How intense is it right now? (0-10)</p>
          <Slider value={[intensity]} min={0} max={10} step={1} onValueChange={(value) => setIntensity(value[0])} />
          <p className="text-xs text-muted-foreground">{intensity}</p>
        </div>

        <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <input type="checkbox" checked={beforeEvent} onChange={(event) => setBeforeEvent(event.target.checked)} />
          This is about an upcoming event
        </label>

        <Input
          value={context}
          onChange={(event) => setContext(event.target.value)}
          placeholder="Context (optional)"
          className="text-base"
        />

        <Button
          className="text-base"
          onClick={() => {
            onSubmitCheckin?.({
              intensity,
              context: `${beforeEvent ? "before-event" : "current"}${context ? `: ${context}` : ""}`,
            });
            setContext("");
          }}
        >
          Save Check-in
        </Button>
      </CardContent>
    </Card>
  );
}
