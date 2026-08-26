import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { HeartPulse, Sparkles } from "lucide-react";

export default function AdaptiveCheckInPanel({ onSubmitCheckin, frequentMode = false }) {
  const [intensity, setIntensity] = useState(frequentMode ? 6 : 4);
  const [beforeEvent, setBeforeEvent] = useState(false);
  const [context, setContext] = useState("");

  const intensityLabel = intensity <= 3 ? "Calm" : intensity <= 6 ? "Moderate" : "Intense";
  const intensityColor = intensity <= 3 ? "text-[#10B981]" : intensity <= 6 ? "text-[#F59E0B]" : "text-[#EF4444]";

  return (
    <Card className="overflow-hidden border-[#B2DFDB] shadow-[4px_4px_0_#D5F5EC]">
      <div className="h-2 bg-gradient-to-r from-[#0D9488] to-[#5EEAD4]" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xl text-[#134E4A]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D5F5EC] text-[#0D9488]">
            <HeartPulse size={18} />
          </div>
          Anxiety Check-in
        </CardTitle>
        <CardDescription className="text-[#5F8A87]">
          Quick check-in to help the app adjust support in real time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#134E4A]">How intense is it right now?</p>
            <span className={`text-sm font-bold ${intensityColor}`}>{intensityLabel}</span>
          </div>
          <div className="px-1">
            <Slider
              value={[intensity]}
              min={0}
              max={10}
              step={1}
              onValueChange={(value) => setIntensity(value[0])}
              className="[&_[role=slider]]:h-6 [&_[role=slider]]:w-6 [&_[role=slider]]:border-2 [&_[role=slider]]:border-[#0D9488] [&_[role=slider]]:bg-[#0D9488]"
            />
          </div>
          <div className="flex justify-between text-[11px] text-[#5F8A87]">
            <span>0 — Calm</span>
            <span className="font-bold text-[#134E4A] text-sm">{intensity}/10</span>
            <span>10 — Intense</span>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-[#B2DFDB] bg-[#F0FAF7] px-4 py-3 text-sm font-medium text-[#134E4A] cursor-pointer hover:bg-[#D5F5EC] transition-colors">
          <input
            type="checkbox"
            checked={beforeEvent}
            onChange={(event) => setBeforeEvent(event.target.checked)}
            className="h-4 w-4 rounded border-[#B2DFDB] text-[#0D9488] accent-[#0D9488]"
          />
          This is about an upcoming event
        </label>

        <Input
          value={context}
          onChange={(event) => setContext(event.target.value)}
          placeholder="What's going on? (optional)"
          className="border-[#B2DFDB] text-[#134E4A] placeholder:text-[#5F8A87]/60 focus:border-[#0D9488] focus:ring-[#D5F5EC]"
        />

        <Button
          className="w-full bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-[2px_2px_0_#B2DFDB] font-bold"
          onClick={() => {
            onSubmitCheckin?.({
              intensity,
              context: `${beforeEvent ? "before-event" : "current"}${context ? `: ${context}` : ""}`,
            });
            setContext("");
          }}
        >
          <Sparkles size={16} className="mr-1.5" />
          Save Check-in
        </Button>
      </CardContent>
    </Card>
  );
}
