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
  BarChart2,
  History,
  Lightbulb,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";

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
    <SupportToolThemeProvider theme="adhd_focus">
    <SupportToolLayout>
      {/* Header Section */}
      <div className="space-y-2 text-center md:text-left">
        <div className="mb-2 inline-flex rounded-full bg-[#ead9e9] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#583554]">Name it. Then nudge it.</div>
        <h2 className="text-3xl font-black tracking-tight flex items-center justify-center md:justify-start gap-3 text-stone-900">
          <Compass className="text-[#79506f] h-8 w-8" />
           Mood Check-in
        </h2>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto md:mx-0">
           Notice your current state and choose a small support prompt.
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
                ? `border-[#79506f] bg-[#faf2f8] shadow-md ring-2 ring-[#ead9e9]`
                : 'border-[#e7d7bf] bg-[#fffdf7] hover:border-[#b58aab] hover:bg-[#faf2f8]'
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
                className="absolute -bottom-1 w-8 h-1 bg-[#79506f] rounded-full"
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
              <Sparkles className="h-4 w-4 text-[#79506f]" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                 Support Prompts
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((s, idx) => (
                <Card
                  key={idx}
                  className="group overflow-hidden border border-[#e7d7bf] bg-[#fffdf7] shadow-sm hover:border-[#b58aab] hover:shadow-md transition-colors rounded-2xl"
                >
                  <div className="p-5 flex gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-[#ead9e9] flex items-center justify-center text-[#79506f] group-hover:bg-[#79506f] group-hover:text-white transition-colors">
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
            className="h-32 flex items-center justify-center border-2 border-dashed border-[#d9bdd3] rounded-3xl text-muted-foreground text-sm font-medium italic bg-[#faf2f8]"
          >
            Select your current state to see support prompts.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pattern Spotter */}
      <Card className="border border-[#e7d7bf] bg-gradient-to-br from-[#fffdf7] via-[#faf2f8] to-[#f5eee2] overflow-hidden shadow-md rounded-3xl">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
              <History className="h-4 w-4" />
               Pattern Notes
            </h3>
            <Badge
              variant="outline"
               className="text-[10px] font-bold border-[#d9bdd3] text-[#583554] bg-[#ead9e9]"
            >
               Quick check-in
            </Badge>
          </div>

          <div className="relative space-y-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Context: Slept 4h, noise outside, high caffeine..."
              className="min-h-[80px] rounded-2xl border border-[#e7d7bf] focus:border-[#285943] focus:ring-2 focus:ring-[#dceadf] bg-[#fffdf7] transition-colors resize-none p-4 text-sm"
            />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 px-1">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Write one or two lines about what might be shaping today.</span>
              </div>
            </div>
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <Button
                size="sm"
                className="h-8 rounded-lg bg-[#285943] px-3 text-xs font-bold text-white hover:bg-[#1d4332]"
                type="button"
                onClick={handleSavePattern}
              >
                <Lightbulb className="mr-1 h-3 w-3" /> Save check-in
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
             <div className="pt-3 border-t border-[#e7d7bf] mt-1 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BarChart2 className="h-3 w-3" />
                  <span>Recent entries</span>
                </span>
                {latestPattern && (
                  <span className="flex items-center gap-1 text-[#79506f]">
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
                        <span className="text-slate-400">|</span>
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
                Local check-ins
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Dopamine-aligned
              </span>
            </div>
            <span>Last 5 notes shown</span>
          </div>
        </div>
      </Card>

      {/* Footer */}
      <p className="text-center text-[10px] text-muted-foreground/70 font-medium px-8 leading-relaxed max-w-lg mx-auto">
         Use these prompts to pause, notice what is happening, and choose a next step.
      </p>
    </SupportToolLayout>
    </SupportToolThemeProvider>
  );
};

export default EmotionCoach;
