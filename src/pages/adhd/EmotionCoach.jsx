'use client';

import React, { useState } from 'react';
import {
  AlertTriangle, BarChart2, Brain, CircleGauge, ClipboardList, Compass,
  Frown, Heart, Lightbulb, Moon, Pencil, Send, Smile,
  Sparkles, Wind, Zap,
} from 'lucide-react';
import SupportToolThemeProvider from '@/theme/SupportToolThemeProvider';
import SupportToolLayout from '@/components/support/SupportToolLayout';

const moods = [
  { id: 'calm', label: 'Calm', caption: 'I feel at ease', icon: Wind, card: 'border-[#d6efdc] bg-[#fcfffb]', color: 'text-[#4cac70]', pill: 'border-[#d6efdc] text-[#438d5d]', art: '✣' },
  { id: 'focused', label: 'Focused', caption: "I'm in the zone", icon: Brain, card: 'border-[#e6d7ff] bg-[#fcfaff]', color: 'text-[#8455e6]', pill: 'border-[#e1d2ff] text-[#7746d9]', art: '✧' },
  { id: 'stressed', label: 'Stressed', caption: 'A lot on my mind', icon: AlertTriangle, card: 'border-[#f5e5b6] bg-[#fffdf6]', color: 'text-[#eba931]', pill: 'border-[#f4dfa1] text-[#a8751d]', art: '⋮' },
  { id: 'overwhelmed', label: 'Overwhelmed', caption: 'Too much at once', icon: Zap, card: 'border-[#f7d5e5] bg-[#fffaff]', color: 'text-[#e94a96]', pill: 'border-[#f4c6dd] text-[#ce347c]', art: '✦' },
  { id: 'bored', label: 'Bored', caption: 'Nothing feels fun', icon: Moon, card: 'border-[#dbe5ff] bg-[#fbfcff]', color: 'text-[#5480ed]', pill: 'border-[#cedcff] text-[#4a73d6]', art: 'zᶻ' },
];

const suggestionsByMood = {
  calm: [{ title: 'Lock in', text: 'Start one clear focus block while things feel settled.', icon: Brain }, { title: 'Anchor it', text: 'Notice one detail that helps you feel this calm.', icon: Lightbulb }],
  focused: [{ title: 'Shield mode', text: 'Silence non-urgent notifications for the next 20 minutes.', icon: Zap }, { title: 'Deep work', text: 'Choose one specific output and avoid task-switching.', icon: Compass }],
  stressed: [{ title: 'Reset breath', text: 'Try a slow 4-7-8 breath three times.', icon: Wind }, { title: 'Externalize', text: 'Write every stressor down before picking one next move.', icon: ClipboardList }],
  overwhelmed: [{ title: 'The 5-minute rule', text: 'Pick a task small enough to take five minutes.', icon: Zap }, { title: 'Micro-goal', text: 'Name the next physical action, not the whole outcome.', icon: CircleGauge }],
  bored: [{ title: 'Dopamine race', text: 'Set a 10-minute timer and make it a small challenge.', icon: Zap }, { title: 'Remix surroundings', text: 'Change chairs, music, or where you start.', icon: Sparkles }],
};

const extractPatternTags = (text) => {
  const value = text.toLowerCase();
  const tags = [];
  if (/(sleep|slept|4h|5h|6h|hours)/.test(value)) tags.push('Sleep debt');
  if (/(coffee|caffeine|tea|energy drink)/.test(value)) tags.push('High caffeine');
  if (/(noise|loud|construction|traffic|crowd)/.test(value)) tags.push('Noisy environment');
  if (/(phone|scroll|instagram|youtube|twitter|doomscroll)/.test(value)) tags.push('Digital pull');
  if (/(deadline|exam|assignment|workload|backlog)/.test(value)) tags.push('Load spike');
  if (/(gym|walk|movement|exercise)/.test(value)) tags.push('Movement change');
  if (/(routine|schedule|plan|structure)/.test(value)) tags.push('Routine shift');
  if (!tags.length && value.trim()) tags.push('Context logged');
  return [...new Set(tags)].slice(0, 3);
};

export default function EmotionCoach() {
  const [selectedMood, setSelectedMood] = useState(null);
  const [note, setNote] = useState('');
  const [patterns, setPatterns] = useState([]);
  const [insightTags, setInsightTags] = useState([]);
  const [activePrompt, setActivePrompt] = useState(null);
  const selected = moods.find((mood) => mood.id === selectedMood);
  const suggestions = selectedMood ? suggestionsByMood[selectedMood] : [];

  const savePattern = () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    const tags = extractPatternTags(trimmed);
    setInsightTags(tags);
    setPatterns((items) => [{ id: Date.now(), moodLabel: selected?.label || 'Unknown', note: trimmed, tags }, ...items].slice(0, 5));
  };

  return <SupportToolThemeProvider theme="adhd_focus"><SupportToolLayout className="!m-0 !w-full !max-w-none !gap-0 !p-0"><main className="w-full bg-[#fffefa] px-4 py-5 text-[#202036] sm:px-8 sm:py-6 lg:px-[7vw]">
    <header className="relative mx-auto max-w-7xl"><div className="max-w-3xl"><p className="inline-flex items-center gap-1 rounded-full bg-[#fff0bd] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.15em] text-[#9b7631]"><Sparkles size={13} className="text-pink-400" /> NAME IT. THEN NUDGE IT.</p><h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Mood <span className="text-[#7250e5]">Check</span><span className="text-[#c65cc4]">-in</span></h1><p className="mt-3 text-sm font-medium text-slate-500 sm:text-base">Notice your current state and choose a <span className="font-bold text-slate-800 underline decoration-pink-300 decoration-2 underline-offset-4">small support prompt.</span></p></div><div className="absolute right-[12%] top-0 hidden lg:block"><Brain className="h-28 w-28 text-pink-400" strokeWidth={1.5} /><Heart className="absolute -left-8 bottom-4 text-violet-400" size={26} /><Sparkles className="absolute -right-6 top-1 text-pink-400" size={20} /><div className="absolute -right-40 top-4 w-28 rounded-2xl border border-[#f0dec8] bg-white px-3 py-2 text-center text-[10px] font-bold shadow-sm">Checking in<br />is <span className="text-[#7653df]">self-care</span> ✨</div></div></header>
    <section className="mx-auto mt-6 grid max-w-7xl grid-cols-1 gap-3 sm:grid-cols-5">{moods.map((mood) => { const Icon = mood.icon; const active = selectedMood === mood.id; return <button key={mood.id} onClick={() => { setSelectedMood(mood.id); setActivePrompt(null); }} className={`relative min-h-36 rounded-2xl border p-4 text-center transition hover:-translate-y-0.5 ${mood.card} ${active ? 'ring-2 ring-violet-400 ring-offset-2' : ''}`}><span className={`absolute right-4 top-3 text-lg ${mood.color}`}>{mood.art}</span><Icon className={`mx-auto h-10 w-10 ${mood.color}`} strokeWidth={1.8} /><p className={`mt-3 text-sm font-black uppercase ${mood.color}`}>{mood.label}</p><span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[10px] font-bold ${mood.pill}`}>{mood.caption} {mood.id === 'overwhelmed' ? <Frown size={14} className="ml-2" /> : <Smile size={14} className="ml-2" />}</span></button>; })}</section>
    <section className="mx-auto mt-6 max-w-7xl overflow-hidden rounded-2xl border border-dashed border-[#f0c465] bg-[#fffdf8] px-6 py-5"><div className="grid min-h-12 items-center gap-4 sm:grid-cols-[64px_1fr_160px]"><Lightbulb className="mx-auto h-11 w-11 text-[#f2bf3d]" />{selected ? <div><p className="font-black">Support prompts for <span className={selected.color}>{selected.label.toLowerCase()}</span></p><div className="mt-2 flex flex-wrap gap-2">{suggestions.map((suggestion) => <button key={suggestion.title} onClick={() => setActivePrompt(suggestion)} className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-sm transition ${activePrompt?.title === suggestion.title ? 'bg-[#7045e2] text-white' : 'bg-white text-slate-700 hover:bg-[#f1ebff]'}`}><suggestion.icon className="mr-1 inline h-3.5 w-3.5" />{suggestion.title}</button>)}</div></div> : <div><p className="font-black">Select your current state above <Sparkles className="ml-2 inline text-violet-500" size={19} /></p><p className="mt-1 text-sm text-slate-500">You&apos;ll see personalized support prompts here.</p></div>}<Sparkles className="mx-auto hidden h-12 w-12 text-[#f1c13e] sm:block" /></div>{activePrompt && <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-white px-4 py-3"><p className="text-sm text-slate-700"><strong className="text-[#7045e2]">{activePrompt.title}:</strong> {activePrompt.text}</p><button onClick={() => setActivePrompt(null)} className="rounded-lg bg-[#7045e2] px-3 py-1.5 text-xs font-bold text-white">Done</button></div>}</section>
    <section className="mx-auto mt-6 max-w-7xl rounded-2xl border border-[#eee9f7] bg-white p-5 shadow-[0_5px_15px_rgba(48,36,92,.08)]"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide"><span className="rounded-lg bg-[#eee6ff] p-2 text-[#7653df]"><ClipboardList size={16} /></span> Pattern notes <Sparkles className="text-violet-500" size={16} /></h2><span className="rounded-full bg-[#f1ebff] px-3 py-1.5 text-xs font-bold text-[#7045d7]"><Zap className="mr-1 inline" size={13} /> Quick check-in</span></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><div className="relative"><Pencil className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7653df]" size={17} /><input value={note} onChange={(event) => setNote(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && savePattern()} placeholder="Write one or two lines about what might be shaping today..." className="w-full rounded-2xl border border-[#ded8ef] bg-white py-4 pl-11 pr-12 text-sm outline-none focus:border-violet-400" /><Send className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-[#7653df] p-2 text-white" size={32} /></div><button onClick={savePattern} className="rounded-2xl bg-[#7045e2] px-5 py-3 text-sm font-black text-white shadow-sm"><Lightbulb className="mr-2 inline" size={16} /> Save check-in</button></div>{insightTags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{insightTags.map((tag) => <span key={tag} className="rounded-full bg-[#f1ebff] px-3 py-1 text-xs font-bold text-[#7045d7]">{tag}</span>)}</div>}{patterns.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{patterns.map((pattern) => <span key={pattern.id} title={pattern.note} className="rounded-full border border-slate-100 px-3 py-1 text-xs text-slate-600">{pattern.moodLabel} · {pattern.tags[0]}</span>)}</div>}<footer className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[10px] font-medium text-slate-500"><span><BarChart2 className="mr-1 inline text-violet-500" size={14} /> Local check-ins</span><span><Zap className="mr-1 inline text-violet-500" size={14} /> Dopamine-aligned</span><span>Last 5 notes shown</span></footer></section>
    <p className="mx-auto mt-5 flex max-w-7xl items-center justify-center gap-1 text-center text-xs text-slate-500"><Heart size={16} className="text-pink-400" /> Use these prompts to <strong className="text-[#7653df]">pause</strong>, notice what is happening, and choose a <strong className="text-[#7653df]">next step.</strong></p>
  </main></SupportToolLayout></SupportToolThemeProvider>;
}
