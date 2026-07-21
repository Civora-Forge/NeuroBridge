'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';

// ── Sound Library ─────────────────────────────────────────────

const SOUNDS = [
  { id: 'rain', label: 'Rain', emoji: '🌧️', description: 'Soft rainfall for deep work', category: 'nature', color: 'from-blue-500/20 to-blue-600/5' },
  { id: 'thunder', label: 'Thunder', emoji: '⛈️', description: 'Distant rumbling storms', category: 'nature', color: 'from-slate-500/20 to-purple-600/5' },
  { id: 'ocean', label: 'Ocean', emoji: '🌊', description: 'Rolling waves, endless calm', category: 'nature', color: 'from-cyan-500/20 to-teal-600/5' },
  { id: 'wind', label: 'Wind', emoji: '💨', description: 'Gentle breeze through valleys', category: 'nature', color: 'from-sky-400/20 to-gray-500/5' },
  { id: 'fire', label: 'Fireplace', emoji: '🔥', description: 'Crackling warmth & comfort', category: 'nature', color: 'from-orange-500/20 to-red-600/5' },
  { id: 'forest', label: 'Forest', emoji: '🌲', description: 'Birds & rustling leaves', category: 'nature', color: 'from-emerald-500/20 to-green-600/5' },
  { id: 'brown-noise', label: 'Brown Noise', emoji: '🟤', description: 'Deep, warm, calming hum', category: 'noise', color: 'from-amber-700/20 to-amber-800/5' },
  { id: 'white-noise', label: 'White Noise', emoji: '⚪', description: 'Uniform masking frequency', category: 'noise', color: 'from-gray-300/20 to-gray-400/5' },
  { id: 'binaural-focus', label: 'Focus Beats', emoji: '🧠', description: '14Hz beta binaural beats', category: 'neural', color: 'from-violet-500/20 to-indigo-600/5' },
  { id: 'binaural-relax', label: 'Relax Beats', emoji: '🧘', description: '6Hz theta binaural waves', category: 'neural', color: 'from-pink-400/20 to-rose-500/5' },
];

const CATEGORIES = [
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'noise', label: 'Noise', emoji: '〰️' },
  { id: 'neural', label: 'Neural', emoji: '🧠' },
];

const PRESETS = [
  { label: 'Deep Focus', emoji: '🎯', layers: ['rain', 'brown-noise', 'binaural-focus'] },
  { label: 'Calm Storm', emoji: '⛈️', layers: ['rain', 'thunder', 'wind'] },
  { label: 'Sleep Mode', emoji: '🌙', layers: ['ocean', 'binaural-relax'] },
  { label: 'Cozy Cabin', emoji: '🏔️', layers: ['fire', 'rain', 'wind'] },
];

const TIMER_OPTIONS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '60m', minutes: 60 },
  { label: '∞', minutes: 0 },
];

// map sound id -> audio file URL (you need to provide real files later)
const SOUND_URLS = {
  rain: '/sounds/rain.mp3',
  thunder: '/sounds/thunder.mp3',
  ocean: '/sounds/ocean.mp3',
  wind: '/sounds/wind.mp3',
  fire: '/sounds/fireplace.mp3',
  forest: '/sounds/forest.mp3',
  'brown-noise': '/sounds/brown-noise.mp3',
  'white-noise': '/sounds/white-noise.mp3',
  'binaural-focus': '/sounds/binaural-focus.mp3',
  'binaural-relax': '/sounds/binaural-relax.mp3',
};

// ── Simple audio engine inside this component ──────────────────
// Each active layer: { id, audio, volume }

const useSimpleAudioEngine = () => {
  const [layers, setLayers] = useState([]); // [{id, audio, volume}]
  const [masterVolume, setMasterVolume] = useState(0.8);
  const layersRef = useRef([]);

  // keep ref in sync
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  // stop all on unmount
  useEffect(() => {
    return () => {
      layersRef.current.forEach((l) => {
        l.audio.pause();
        l.audio.currentTime = 0;
      });
    };
  }, []);

  const createAudio = (id) => {
    const url = SOUND_URLS[id];
    if (!url) return null;
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = masterVolume * 0.7; // default 70% of master
    return audio;
  };

  const toggleLayer = (id) => {
    setLayers((prev) => {
      const existing = prev.find((l) => l.id === id);
      if (existing) {
        // stop and remove
        existing.audio.pause();
        existing.audio.currentTime = 0;
        return prev.filter((l) => l.id !== id);
      }
      // create and start
      const audio = createAudio(id);
      if (!audio) return prev;
      audio.play().catch(() => {});
      return [...prev, { id, audio, volume: 0.7 }];
    });
  };

  const setLayerVolume = (id, v) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const newAudio = l.audio;
        newAudio.volume = v * masterVolume;
        return { ...l, volume: v };
      })
    );
  };

  const updateMasterVolume = (v) => {
    setMasterVolume(v);
    setLayers((prev) =>
      prev.map((l) => {
        l.audio.volume = l.volume * v;
        return l;
      })
    );
  };

  const stopAll = () => {
    setLayers((prev) => {
      prev.forEach((l) => {
        l.audio.pause();
        l.audio.currentTime = 0;
      });
      return [];
    });
  };

  return {
    layers,
    masterVolume,
    toggleLayer,
    setLayerVolume,
    setMasterVolume: updateMasterVolume,
    stopAll,
  };
};

// ── Animated Background ────────────────────────────────────────

const AnimatedBackground = ({ activeLayers }) => {
  const hasNature = activeLayers.some((id) => ['rain', 'ocean', 'forest', 'wind'].includes(id));
  const hasFire = activeLayers.includes('fire');
  const hasThunder = activeLayers.includes('thunder');
  const hasNeural = activeLayers.some((id) => String(id).startsWith('binaural'));

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden transition-colors duration-[2000ms]">
      <div
        className={`absolute inset-0 transition-all duration-[3000ms] ${
          activeLayers.length === 0
            ? 'bg-gradient-to-br from-background via-background to-background'
            : hasNeural
            ? 'bg-gradient-to-br from-violet-950/40 via-background to-indigo-950/30'
            : hasFire
            ? 'bg-gradient-to-br from-orange-950/30 via-background to-amber-950/20'
            : hasThunder
            ? 'bg-gradient-to-br from-slate-900/50 via-background to-purple-950/30'
            : hasNature
            ? 'bg-gradient-to-br from-cyan-950/30 via-background to-emerald-950/20'
            : 'bg-gradient-to-br from-background via-background to-background'
        }`}
      />
      {activeLayers.length > 0 && (
        <>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-[0.07] blur-3xl animate-[drift_20s_ease-in-out_infinite] bg-primary" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-[0.05] blur-3xl animate-[drift_25s_ease-in-out_infinite_reverse] bg-accent" />
          {hasNeural && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-[0.04] blur-3xl animate-[pulse-slow_4s_ease-in-out_infinite] bg-violet-500" />
          )}
        </>
      )}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  );
};

// ── Sound Card ──────────────────────────────────────────────────

const SoundCard = ({ sound, isActive, volume, onToggle, onVolumeChange }) => (
  <button
    onClick={onToggle}
    className={`group relative w-full text-left rounded-2xl p-4 transition-all duration-300 border overflow-hidden ${
      isActive
        ? 'border-primary/30 shadow-lg shadow-primary/5 scale-[1.02]'
        : 'border-border/50 hover:border-border hover:shadow-md hover:scale-[1.01]'
    }`}
  >
    <div
      className={`absolute inset-0 bg-gradient-to-br ${sound.color} transition-opacity duration-500 ${
        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
      }`}
    />
    <div
      className={`absolute inset-0 transition-opacity duration-500 ${
        isActive ? 'bg-card/60 backdrop-blur-sm' : 'bg-card/80'
      }`}
    />
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-lg transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
            {sound.emoji}
          </span>
          <span
            className={`text-sm font-semibold transition-colors ${
              isActive ? 'text-foreground' : 'text-foreground/80'
            }`}
          >
            {sound.label}
          </span>
        </div>
        <div
          className={`w-2 h-2 rounded-full transition-all duration-500 ${
            isActive
              ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)] scale-100'
              : 'bg-muted-foreground/20 scale-75'
          }`}
        />
      </div>
      <p
        className={`text-xs transition-colors ${
          isActive ? 'text-muted-foreground' : 'text-muted-foreground/60'
        }`}
      >
        {sound.description}
      </p>
      {isActive && (
        <div
          className="mt-3 flex items-center gap-2 animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] text-muted-foreground w-4">🔈</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
            className="flex-1 h-1 accent-primary cursor-pointer"
          />
          <span className="text-[10px] text-muted-foreground w-4">🔊</span>
        </div>
      )}
    </div>
  </button>
);

// ── Preset Pill ─────────────────────────────────────────────────

const PresetPill = ({ preset, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap ${
      isActive
        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105'
        : 'bg-secondary/80 text-secondary-foreground hover:bg-secondary hover:scale-[1.02]'
    }`}
  >
    {preset.emoji} {preset.label}
  </button>
);

// ── Timer Display ───────────────────────────────────────────────

const TimerDisplay = ({
  timerMinutes,
  secondsLeft,
  isTimerRunning,
  onSelectTimer,
  onToggleTimer,
}) => {
  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const ss = (secondsLeft % 60).toString().padStart(2, '0');

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Session Timer
        </p>
        {isTimerRunning && timerMinutes > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-[pulse-slow_2s_ease-in-out_infinite]" />
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 justify-center">
        {TIMER_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onSelectTimer(opt.minutes)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              timerMinutes === opt.minutes
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {timerMinutes > 0 && (
        <div className="text-center space-y-2">
          <div className="text-3xl font-bold timer-font text-foreground tracking-wider">
            {mm}:{ss}
          </div>
          <button
            onClick={onToggleTimer}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              isTimerRunning
                ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                : 'bg-primary text-primary-foreground hover:opacity-90'
            }`}
          >
            {isTimerRunning ? '⏸ Pause' : '▶ Start'}
          </button>
        </div>
      )}
    </div>
  );
};

// ── Master Controls ─────────────────────────────────────────────

const MasterControls = ({
  masterVolume,
  onMasterVolumeChange,
  activeCount,
  onStopAll,
}) => (
  <div className="glass-card rounded-2xl p-4 space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">Master</span>
        {activeCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
            {activeCount} active
          </span>
        )}
      </div>
      {activeCount > 0 && (
        <button
          onClick={onStopAll}
          className="text-xs font-medium text-destructive/70 hover:text-destructive transition-colors"
        >
          Stop All
        </button>
      )}
    </div>
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground">🔇</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(masterVolume * 100)}
        onChange={(e) => onMasterVolumeChange(Number(e.target.value) / 100)}
        className="flex-1 h-1.5 accent-primary cursor-pointer"
      />
      <span className="text-xs text-muted-foreground">🔊</span>
      <span className="text-xs font-semibold timer-font text-muted-foreground w-8 text-right">
        {Math.round(masterVolume * 100)}%
      </span>
    </div>
  </div>
);

// ── Main Page ───────────────────────────────────────────────────

const Soundscapes = () => {
  const {
    layers,
    masterVolume,
    toggleLayer,
    setLayerVolume,
    setMasterVolume,
    stopAll,
  } = useSimpleAudioEngine();

  const [activeCategory, setActiveCategory] = useState('all');
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Timer logic
  useEffect(() => {
    if (!isTimerRunning || timerMinutes === 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsTimerRunning(false);
          stopAll();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, timerMinutes, stopAll]);

  const selectTimer = useCallback((m) => {
    setTimerMinutes(m);
    setSecondsLeft(m * 60);
    setIsTimerRunning(false);
  }, []);

  const toggleTimer = useCallback(() => {
    if (!isTimerRunning && secondsLeft === 0 && timerMinutes > 0) {
      setSecondsLeft(timerMinutes * 60);
    }
    setIsTimerRunning((prev) => !prev);
  }, [isTimerRunning, secondsLeft, timerMinutes]);

  const activeSoundIds = layers.map((l) => l.id);

  const filteredSounds =
    activeCategory === 'all'
      ? SOUNDS
      : SOUNDS.filter((s) => s.category === activeCategory);

  const applyPreset = useCallback(
    (preset) => {
      stopAll();
      setTimeout(() => {
        preset.layers.forEach((id) => toggleLayer(id));
      }, 100);
    },
    [stopAll, toggleLayer]
  );

  const isPresetActive = (preset) =>
    preset.layers.length === activeSoundIds.length &&
    preset.layers.every((id) => activeSoundIds.includes(id));

  return (
    <>
      <AnimatedBackground activeLayers={activeSoundIds} />
      <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-2xl space-y-6 py-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <Link
              to="/"
              className="inline-block text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              ← Back to Focus
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              🎧 Soundscapes
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Mix immersive sound layers to create your perfect focus, calm, or sleep environment.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">
              Quick Mixes
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              {PRESETS.map((p) => (
                <PresetPill
                  key={p.label}
                  preset={p}
                  isActive={isPresetActive(p)}
                  onClick={() => applyPreset(p)}
                />
              ))}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1.5 justify-center">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCategory === 'all'
                  ? 'bg-foreground text-background'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCategory === cat.id
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          {/* Sound Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredSounds.map((sound) => {
              const layer = layers.find((l) => l.id === sound.id);
              return (
                <SoundCard
                  key={sound.id}
                  sound={sound}
                  isActive={!!layer}
                  volume={layer?.volume ?? 0.7}
                  onToggle={() => toggleLayer(sound.id)}
                  onVolumeChange={(v) => setLayerVolume(sound.id, v)}
                />
              );
            })}
          </div>

          {/* Master + Timer */}
          <div className="space-y-3">
            <MasterControls
              masterVolume={masterVolume}
              onMasterVolumeChange={setMasterVolume}
              activeCount={layers.length}
              onStopAll={stopAll}
            />
            <TimerDisplay
              timerMinutes={timerMinutes}
              secondsLeft={secondsLeft}
              isTimerRunning={isTimerRunning}
              onSelectTimer={selectTimer}
              onToggleTimer={toggleTimer}
            />
          </div>

          {/* Headphones hint */}
          {layers.length > 0 &&
            layers.some((l) => String(l.id).startsWith('binaural')) && (
              <div className="text-center animate-slide-up">
                <p className="text-xs text-muted-foreground/70 italic">
                  🎧 Binaural beats work best with stereo headphones.
                </p>
              </div>
            )}
        </div>
      </div>
    </>
  );
};

export default Soundscapes;
