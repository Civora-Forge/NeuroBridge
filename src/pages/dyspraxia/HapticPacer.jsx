import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, Pause, Minus, Plus } from "lucide-react";
export default function HapticPacer() {
    const [bpm, setBpm] = useState(60);
    const [isPlaying, setIsPlaying] = useState(false);
    const [beat, setBeat] = useState(false);
    const audioCtx = useRef(null);
    const intervalRef = useRef(null);
    const playClick = useCallback(() => {
        if (!audioCtx.current) {
            audioCtx.current = new AudioContext();
        }
        const ctx = audioCtx.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.3;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.stop(ctx.currentTime + 0.1);
        setBeat(true);
        setTimeout(() => setBeat(false), 150);
    }, []);
    useEffect(() => {
        if (isPlaying) {
            const ms = (60 / bpm) * 1000;
            playClick();
            intervalRef.current = setInterval(playClick, ms);
        }
        return () => {
            if (intervalRef.current)
                clearInterval(intervalRef.current);
        };
    }, [isPlaying, bpm, playClick]);
    return (<div className="animate-fade-in">
      <Link to="/dyspraxia" className="dyspraxia-btn min-h-[56px] bg-transparent border-2 border-border text-sm mb-6 gap-2 inline-flex px-4">
        <ArrowLeft className="w-5 h-5"/>
        Back to CoordiMate
      </Link>

      <h1 className="section-title mb-1">Haptic Rhythmic Pacer</h1>
      <p className="section-subtitle mb-8">A visual and audio metronome to help maintain steady rhythm.</p>

      <div className="max-w-sm mx-auto text-center">
        {/* Visual beat indicator */}
        <div className="mb-8">
          <div className={`w-32 h-32 rounded-full mx-auto transition-all duration-150 flex items-center justify-center ${beat ? "bg-mode-dyspraxia scale-110" : "bg-secondary scale-100"}`}>
            <span className={`text-4xl font-bold transition-colors ${beat ? "text-primary-foreground" : "text-muted-foreground"}`}>
              ♩
            </span>
          </div>
        </div>

        {/* BPM control */}
        <div className="neuro-card mb-6">
          <p className="text-sm text-muted-foreground mb-2">Tempo</p>
          <div className="flex items-center justify-center gap-4">
            <button className="dyspraxia-btn min-h-[64px] w-16 flex items-center justify-center bg-secondary" onClick={() => setBpm((b) => Math.max(20, b - 5))}>
              <Minus className="w-6 h-6"/>
            </button>
            <span className="text-5xl font-bold w-24">{bpm}</span>
            <button className="dyspraxia-btn min-h-[64px] w-16 flex items-center justify-center bg-secondary" onClick={() => setBpm((b) => Math.min(200, b + 5))}>
              <Plus className="w-6 h-6"/>
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">BPM</p>
        </div>

        {/* Presets */}
        <div className="flex gap-2 justify-center mb-6 flex-wrap">
          {[
            { label: "Walking", bpm: 60 },
            { label: "Brushing", bpm: 80 },
            { label: "Clapping", bpm: 100 },
        ].map((p) => (<button key={p.label} className={`dyspraxia-btn min-h-[56px] px-5 text-sm ${bpm === p.bpm ? "bg-mode-dyspraxia text-primary-foreground" : "bg-secondary"}`} onClick={() => setBpm(p.bpm)}>
              {p.label} ({p.bpm})
            </button>))}
        </div>

        {/* Play/Pause */}
        <button className="dyspraxia-btn w-full bg-mode-dyspraxia text-primary-foreground text-lg gap-3" onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <Pause className="w-6 h-6"/> : <Play className="w-6 h-6"/>}
          {isPlaying ? "Pause" : "Start"}
        </button>
      </div>
    </div>);
}
