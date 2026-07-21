'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Compass,
  Wind,
  Brain,
  AlertTriangle,
  Zap,
  Moon,
  Coffee,
  Sparkles,
  ChevronRight,
  BarChart2,
  History,
  Lightbulb,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const moods = [
  {
    id: 'calm',
    label: 'Calm',
    icon: Wind,
    color: 'from-emerald-300/30 to-emerald-500/30',
    border: 'border-emerald-300/60',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
  },
  {
    id: 'focused',
    label: 'Focused',
    icon: Brain,
    color: 'from-teal-400/30 to-emerald-500/30',
    border: 'border-teal-400/60',
    text: 'text-teal-700',
    bg: 'bg-teal-50',
  },
  {
    id: 'stressed',
    label: 'Stressed',
    icon: AlertTriangle,
    color: 'from-amber-300/25 to-amber-500/25',
    border: 'border-amber-300/60',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
  },
  {
    id: 'overwhelmed',
    label: 'Overwhelmed',
    icon: Zap,
    color: 'from-rose-300/25 to-rose-500/25',
    border: 'border-rose-300/60',
    text: 'text-rose-700',
    bg: 'bg-rose-50',
  },
  {
    id: 'bored',
    label: 'Bored',
    icon: Moon,
    color: 'from-slate-300/25 to-slate-500/25',
    border: 'border-slate-300/60',
    text: 'text-slate-700',
    bg: 'bg-slate-50',
  },
];

const suggestionsByMood = {
  calm: [
    {
      title: 'Lock In',
      text: 'Start a 25-minute focus block on one clear task while the mental waters are still.',
      icon: Brain,
    },
    {
      title: 'Anchor It',
      text: 'Note down one sensory detail of this calm to recall it when stressed.',
      icon: Lightbulb,
    },
  ],
  focused: [
    {
      title: 'Shield Mode',
      text: 'Silence all non-urgent notifications. This state is fragile; protect it.',
      icon: Zap,
    },
    {
      title: 'Deep Work',
      text: 'Avoid task-switching for the next 20 minutes. Pick ONE specific output.',
      icon: Compass,
    },
  ],
  stressed: [
    {
      title: 'Reset Breath',
      text: 'Try 4-7-8 breathing: Inhale 4s, Hold 7s, Exhale 8s. Repeat 3 times.',
      icon: Wind,
    },
    {
      title: 'Externalize',
      text: 'Brain dump every stressor into a list. Get them out of your head.',
      icon: BarChart2,
    },
  ],
  overwhelmed: [
    {
      title: 'The 5-Min Rule',
      text: 'Pick a task so small it takes 5 mins. Ignore everything else for now.',
      icon: Zap,
    },
    {
      title: 'Micro-Goal',
      text: 'Ask: "What is the single next physical action?" Do only that.',
      icon: Coffee,
    },
  ],
  bored: [
    {
      title: 'Dopamine Race',
      text: 'Set a timer for 10 minutes. Can you finish the task before it beeps?',
      icon: Zap,
    },
    {
      title: 'Remix Surroundings',
      text: 'Switch to a high-tempo soundscape or move to a different chair.',
      icon: Sparkles,
    },
  ],
};

// very lightweight pattern extractor – local only, no backend
const extractPatternTags = (text) => {
  const t = text.toLowerCase();
  const tags = [];

  if (/(sleep|slept|4h|5h|6h|hours)/.test(t)) tags.push('Sleep debt');
  if (/(coffee|caffeine|tea|energy drink)/.test(t)) tags.push('High caffeine');
  if (/(noise|loud|construction|traffic|crowd)/.test(t)) tags.push('Noisy environment');
  if (/(phone|scroll|instagram|youtube|twitter|doomscroll)/.test(t)) tags.push('Digital pull');
  if (/(deadline|exam|assignment|workload|backlog)/.test(t)) tags.push('Load spike');
  if (/(gym|walk|movement|exercise)/.test(t)) tags.push('Movement change');
  if (/(routine|schedule|plan|structure)/.test(t)) tags.push('Routine shift');

  if (!tags.length && text.trim().length > 0) tags.push('Context logged');

  return Array.from(new Set(tags)).slice(0, 3);
};

const EmotionCoach = () => {
  const [selectedMood, setSelectedMood] = useState(null);
  const [note, setNote] = useState('');
  const [patterns, setPatterns] = useState([]); // {id, moodId, moodLabel, note, tags, createdAt}
  const [insightTags, setInsightTags] = useState([]);

  const moodData = selectedMood ? moods.find((m) => m.id === selectedMood) : null;
  const suggestions = selectedMood ? suggestionsByMood[selectedMood] : [];

  const handleSavePattern = () => {
    const trimmed = note.trim();
    if (!trimmed) return;

    const tags = extractPatternTags(trimmed);
    setInsightTags(tags);

    const now = new Date();
    const entry = {
      id: now.getTime(),
      moodId: selectedMood,
      moodLabel: moodData ? moodData.label : 'Unknown',
      note: trimmed,
      tags,
      createdAt: now.toISOString(),
    };

    setPatterns((prev) => {
      const next = [entry, ...prev];
      return next.slice(0, 5); // keep last 5
    });

    // do not clear the note; feels like a journal – user can edit if they want
  };

  const latestPattern = patterns[0];

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-8">
      {/* Header Section */}
      <div className="space-y-2 text-center md:text-left">
        <h2 className="text-3xl font-extrabold tracking-tight flex items-center justify-center md:justify-start gap-3 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 bg-clip-text text-transparent">
          <Compass className="text-teal-500 h-8 w-8" />
          Emotion Navigator
        </h2>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto md:mx-0">
          Spot "emotional drift" before it becomes a crash. Get ADHD-specific intervention
          strategies tailored to your current state.
        </p>
      </div>

      {/* Mood Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {moods.map((m) => (
          <motion.button
            key={m.id}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedMood(m.id)}
            className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 ${
              selectedMood === m.id
                ? `${m.border} ${m.bg} shadow-lg ring-2 ring-teal-400/30`
                : 'border-transparent bg-slate-50/70 hover:bg-slate-100/80'
            }`}
          >
            <div className={`p-3 rounded-xl bg-gradient-to-br ${m.color}`}>
              <m.icon className={`h-6 w-6 ${m.text}`} />
            </div>
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                selectedMood === m.id ? m.text : 'text-muted-foreground'
              }`}
            >
              {m.label}
            </span>
            {selectedMood === m.id && (
              <motion.div
                layoutId="active-indicator"
                className="absolute -bottom-1 w-8 h-1 bg-teal-500 rounded-full"
              />
            )}
          </motion.button>
        ))}
      </div>

      {/* Intervention Engine */}
      <AnimatePresence mode="wait">
        {selectedMood ? (
          <motion.div
            key={selectedMood}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 px-1">
              <Sparkles className="h-4 w-4 text-teal-500" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Tactical Interventions
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((s, idx) => (
                <Card
                  key={idx}
                  className="group overflow-hidden border border-teal-500/10 bg-white/85 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl"
                >
                  <div className="p-5 flex gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                      <s.icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm">{s.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {s.text}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-32 flex items-center justify-center border-2 border-dashed border-teal-400/30 rounded-3xl text-muted-foreground/60 text-sm font-medium italic bg-teal-50/30"
          >
            Select your current state to generate interventions
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pattern Spotter */}
      <Card className="border-2 border-teal-500/10 bg-gradient-to-br from-white via-teal-50/40 to-teal-100/40 overflow-hidden shadow-xl rounded-3xl">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
              <History className="h-4 w-4" />
              Pattern Spotter
            </h3>
            <Badge
              variant="outline"
              className="text-[10px] font-bold opacity-80 border-teal-400/40 text-teal-700 bg-teal-50/60"
            >
              30s Ritual
            </Badge>
          </div>

          <div className="relative space-y-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Context: Slept 4h, noise outside, high caffeine..."
              className="min-h-[80px] rounded-2xl border-2 border-border focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/20 bg-white/80 transition-all resize-none p-4 text-sm"
            />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 px-1">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Write 1–2 lines about what might be shaping today.</span>
              </div>
            </div>
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-teal-500"
                type="button"
                onClick={handleSavePattern}
              >
                <Lightbulb className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Insight pill row */}
          {insightTags.length > 0 && (
            <div className="pt-1">
              <div className="flex items-center gap-2 mb-1 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-teal-500" />
                <span className="font-semibold">Today&apos;s signals:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {insightTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[10px] px-2 py-1 rounded-full border-teal-400/50 text-teal-800 bg-teal-50/60"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Recent patterns (local history) */}
          {patterns.length > 0 && (
            <div className="pt-3 border-t border-teal-100/60 mt-1 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BarChart2 className="h-3 w-3" />
                  <span>Recent entries</span>
                </span>
                {latestPattern && (
                  <span className="flex items-center gap-1 text-teal-700">
                    <Brain className="h-3 w-3" />
                    <span>{latestPattern.moodLabel}</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {patterns.map((p) => (
                  <Badge
                    key={p.id}
                    variant="outline"
                    className="text-[10px] px-2 py-1 rounded-full border-slate-300/70 bg-white/70 text-slate-700 max-w-[160px] truncate flex items-center gap-1"
                    title={p.note}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                    <span>{p.moodLabel}</span>
                    {p.tags[0] && (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="truncate">{p.tags[0]}</span>
                      </>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between text-[10px] text-muted-foreground/70 font-medium">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <BarChart2 className="h-3 w-3" />
                Data-driven tracking
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Dopamine-aligned
              </span>
            </div>
            <Button
              variant="link"
              className="h-auto p-0 text-[10px] font-bold text-teal-600"
              type="button"
            >
              View Analytics <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Footer */}
      <p className="text-center text-[10px] text-muted-foreground/70 font-medium px-8 leading-relaxed max-w-lg mx-auto">
        Standard ADHD apps wait for you to fail. Emotion Navigator uses "Proactive Interception"
        to help you adjust your strategy to match your biological state in real-time.
      </p>
    </div>
  );
};

export default EmotionCoach;
