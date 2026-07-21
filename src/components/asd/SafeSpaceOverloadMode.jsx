import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, MoonStar } from "lucide-react";

export default function SafeSpaceOverloadMode({ currentStress = 0, stressThreshold = 8, onLogOverload }) {
  const [isActive, setIsActive] = useState(false);
  const [softSoundEnabled, setSoftSoundEnabled] = useState(false);
  const [exitDelay, setExitDelay] = useState(5);
  const audioRef = useRef(null);

  const activate = async (source) => {
    setIsActive(true);
    setExitDelay(5);
    await onLogOverload?.({ trigger_source: source, timestamp: new Date().toISOString() });
  };

  useEffect(() => {
    if (isActive || currentStress < stressThreshold) {
      return;
    }
    activate("threshold");
  }, [currentStress, stressThreshold, isActive]);

  useEffect(() => {
    if (!isActive || exitDelay <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setExitDelay((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, exitDelay]);

  useEffect(() => {
    if (!softSoundEnabled) {
      if (audioRef.current) {
        audioRef.current.oscillator.stop();
        audioRef.current.context.close();
      }
      audioRef.current = null;
      return;
    }

    try {
      const context = new window.AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 174;
      gain.gain.value = 0.015;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      audioRef.current = { context, oscillator };
    } catch {
      setSoftSoundEnabled(false);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.oscillator.stop();
        audioRef.current.context.close();
        audioRef.current = null;
      }
    };
  }, [softSoundEnabled]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl"><MoonStar size={20} /> Safe Space Overload Mode</CardTitle>
          <CardDescription className="text-base">
            Immediate low-stimulation mode with breathing support.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-base text-muted-foreground">Auto activation threshold: stress level {stressThreshold}/10</p>
          <div className="flex items-center gap-2">
            <Button className="text-base" onClick={() => activate("manual")}>Activate Safe Space</Button>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Switch checked={softSoundEnabled} onCheckedChange={setSoftSoundEnabled} />
              <span className="text-sm">Soft background sound</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {isActive && (
        <div className="fixed inset-0 z-50 bg-black/90 text-white flex flex-col items-center justify-center p-8 text-center">
          <div className="w-44 h-44 rounded-full border-4 border-white/70 animate-pulse flex items-center justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-white/20" />
          </div>
          <p className="text-3xl md:text-4xl font-semibold">You are safe.</p>
          <p className="mt-3 text-xl md:text-2xl text-white/80">Breathe in for 4, hold for 4, breathe out for 6.</p>

          {exitDelay > 0 ? (
            <p className="mt-6 text-lg text-white/80 flex items-center gap-2"><AlertCircle size={18} /> Exit available in {exitDelay}s</p>
          ) : (
            <Button
              variant="secondary"
              className="mt-6 text-lg px-8 py-6"
              onClick={() => {
                setIsActive(false);
                setSoftSoundEnabled(false);
              }}
            >
              Exit Safe Space
            </Button>
          )}
        </div>
      )}
    </>
  );
}
