'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import SupportToolThemeProvider from '@/theme/SupportToolThemeProvider';
import SupportToolLayout from '@/components/support/SupportToolLayout';

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
  const [playbackErrors, setPlaybackErrors] = useState({});
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
    audio.addEventListener('error', () => {
      audio.pause();
      setLayers((prev) => prev.filter((layer) => layer.id !== id));
      setPlaybackErrors((prev) => ({
        ...prev,
        [id]: 'This audio file is unavailable or could not be played. Try another sound or check your connection.',
      }));
    });
    return audio;
  };

  const toggleLayer = (id) => {
    setPlaybackErrors((errors) => {
      const { [id]: _ignored, ...remaining } = errors;
      return remaining;
    });
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
      audio.play().catch(() => {
        audio.pause();
        setPlaybackErrors((errors) => ({
          ...errors,
          [id]: 'This audio could not start. Your browser may have blocked playback or the file is unavailable.',
        }));
        setLayers((currentLayers) => currentLayers.filter((layer) => layer.id !== id));
      });
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
    playbackErrors,
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
    <div className="fixed inset-0 -z-10 overflow-hidden transition-colors duration-500">
      <div
        className={`absolute inset-0 transition-all duration-[3000ms] ${
          activeLayers.length === 0
            ? 'bg-[#fffaf1]'
            : hasNeural
            ? 'bg-gradient-to-br from-[#edf7fb] via-[#fffaf1] to-[#e8f1f8]'
            : hasFire
            ? 'bg-gradient-to-br from-[#fbf0e5] via-[#fffaf1] to-[#f5e7d4]'
            : hasThunder
            ? 'bg-gradient-to-br from-[#eef3f5] via-[#fffaf1] to-[#e6edf4]'
            : hasNature
            ? 'bg-gradient-to-br from-[#edf7f4] via-[#fffaf1] to-[#e5f3f8]'
            : 'bg-[#fffaf1]'
        }`}
      />
      {activeLayers.length > 0 && (
        <>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-[0.07] blur-3xl bg-[#7bbbd2]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-[0.05] blur-3xl bg-[#285943]" />
          {hasNeural && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-[0.04] blur-3xl bg-[#7bbbd2]" />
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

const SoundCard = ({ sound, isActive, volume, error, onToggle, onVolumeChange }) => (
  <button
    onClick={onToggle}
    className={`group relative w-full text-left rounded-2xl p-4 transition-all duration-300 border overflow-hidden ${
      isActive
        ? 'border-[#7bbbd2] bg-[#edf7fb] shadow-md'
        : error
        ? 'border-red-300 bg-red-50 hover:border-red-400'
        : 'border-[#e7d7bf] bg-[#fffdf7] hover:border-[#aacfe0] hover:shadow-sm'
    }`}
  >
    <div
      className={`absolute inset-0 bg-gradient-to-br ${sound.color} transition-opacity duration-500 ${
        isActive ? 'opacity-70' : 'opacity-0 group-hover:opacity-40'
      }`}
    />
    <div
      className={`absolute inset-0 transition-opacity duration-500 ${
        isActive ? 'bg-[#fffdf7]/60 backdrop-blur-sm' : 'bg-[#fffdf7]/90'
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
      {error && <p className="mt-2 text-xs font-medium text-red-700">{error}</p>}
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
            className="flex-1 h-1 accent-[#285943] cursor-pointer"
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
        ? 'bg-[#285943] text-white shadow-md shadow-[#285943]/20'
        : 'bg-[#f1e5d4] text-stone-700 hover:bg-[#e7d7bf]'
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
    <div className="rounded-2xl border border-[#e7d7bf] bg-[#fffdf7]/95 p-5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Session Timer
        </p>
        {isTimerRunning && timerMinutes > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#285943]" />
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
                ? 'bg-[#285943] text-white shadow-sm'
                : 'bg-[#f1e5d4] text-stone-700 hover:bg-[#e7d7bf]'
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
                : 'bg-[#285943] text-white hover:bg-[#1d4332]'
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
  <div className="rounded-2xl border border-[#e7d7bf] bg-[#fffdf7]/95 p-4 space-y-3 shadow-sm">
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
        className="flex-1 h-1.5 accent-[#285943] cursor-pointer"
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
    playbackErrors,
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
    <SupportToolThemeProvider theme="adhd_focus">
    <div className="min-h-screen bg-[#fffaf1] relative overflow-hidden">
        <AnimatedBackground activeLayers={activeSoundIds} />
        <SupportToolLayout
          className="relative z-10 max-w-4xl"
          title="Soundscapes"
          description="Build a bright, distraction-light audio mix for your next focus block."
          status={<Link to="/adhd" className="font-semibold text-[#285943] hover:text-[#1d4332]">Back to Focus and Planning</Link>}
          notice="Audio starts only after you select a layer. If a file cannot play, the affected layer stays visible with a clear error."
        >
          <div className="rounded-3xl border border-[#b7d8e5] bg-[#f1f9fc] p-5 shadow-[0_18px_50px_rgba(63,128,151,0.15)] sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#3f8097]">Focus audio lab</p>
              <span className="rounded-full bg-[#285943] px-3 py-1 text-xs font-bold text-white">{layers.length} live layers</span>
            </div>
            {Object.keys(playbackErrors).length > 0 && (
              <div role="alert" className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                One or more selected sounds could not play. Each unavailable sound is marked below.
              </div>
            )}

          {/* Quick Presets */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-center text-[#3f8097]">
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
                   ? 'bg-[#285943] text-white'
                   : 'bg-white text-stone-700 hover:bg-[#e5f3f8]'
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
                   ? 'bg-[#285943] text-white'
                   : 'bg-white text-stone-700 hover:bg-[#e5f3f8]'
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
                  error={playbackErrors[sound.id]}
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
              <div className="text-center">
                <p className="text-xs text-muted-foreground/70 italic">
                  🎧 Binaural beats work best with stereo headphones.
                </p>
              </div>
            )}
          </div>
        </SupportToolLayout>
      </div>
    </SupportToolThemeProvider>
  );
};

export default Soundscapes;
