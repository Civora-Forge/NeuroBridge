import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, MoonStar, Shield } from "lucide-react";

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
    if (isActive || currentStress < stressThreshold) return;
    activate("threshold");
  }, [currentStress, stressThreshold, isActive]);

  useEffect(() => {
    if (!isActive || exitDelay <= 0) return;
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
      <Card className="overflow-hidden border-[#B2DFDB] shadow-[4px_4px_0_#D5F5EC]">
        <div className="h-2 bg-gradient-to-r from-[#0D9488] to-[#5EEAD4]" />
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xl text-[#134E4A]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D5F5EC] text-[#0D9488]">
              <MoonStar size={18} />
            </div>
            Safe Space Overload Mode
          </CardTitle>
          <CardDescription className="text-[#5F8A87]">
            Immediate low-stimulation mode with breathing support.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[#5F8A87]">Auto activation threshold: stress level {stressThreshold}/10</p>
          <div className="flex items-center gap-3">
            <Button
              className="bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-[2px_2px_0_#B2DFDB] font-bold"
              onClick={() => activate("manual")}
            >
              <Shield size={16} className="mr-1.5" /> Activate Safe Space
            </Button>
            <div className="flex items-center gap-2 rounded-xl border border-[#B2DFDB] bg-[#F0FAF7] px-3 py-2">
              <Switch checked={softSoundEnabled} onCheckedChange={setSoftSoundEnabled} />
              <span className="text-sm font-medium text-[#134E4A]">Soft background sound</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {isActive && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#1E2A5E] via-[#2D3A6E] to-[#1E2A5E] p-8 text-center">
          {/* Breathing Circle */}
          <div className="relative mb-8">
            <div className="w-48 h-48 rounded-full border-4 border-white/30 animate-pulse flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-sm" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Shield size={40} className="text-white/60" />
            </div>
          </div>

          <p className="text-3xl md:text-4xl font-bold text-white mb-3">You are safe.</p>
          <p className="text-xl md:text-2xl text-white/70 max-w-md">
            Breathe in for 4, hold for 4, breathe out for 6.
          </p>

          {exitDelay > 0 ? (
            <p className="mt-8 text-lg text-white/60 flex items-center gap-2">
              <AlertCircle size={18} /> Exit available in {exitDelay}s
            </p>
          ) : (
            <Button
              variant="secondary"
              className="mt-8 text-lg px-8 py-6 bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-sm"
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
