'use client';

import React, { useEffect, useState } from 'react';
import {
  Bell, CheckCircle2, ClipboardList, Heart, Lightbulb, Pencil, Play,
  ShieldCheck, Sparkles, Target, Users,
} from 'lucide-react';
import SupportToolThemeProvider from '@/theme/SupportToolThemeProvider';
import SupportToolLayout from '@/components/support/SupportToolLayout';

const notes = [
  'Choose one task before starting.',
  'Keep your next step visible.',
  'Pause or end the session when needed.',
];

export default function BodyDoubling() {
  const [isLive, setIsLive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [commitment, setCommitment] = useState('');
  const [showCommitmentToast, setShowCommitmentToast] = useState(false);
  const [showCommitmentReview, setShowCommitmentReview] = useState(false);

  useEffect(() => {
    if (!isLive) return undefined;
    const interval = setInterval(() => setSessionSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  const startSession = () => {
    if (!commitment.trim()) {
      setShowCommitmentToast(true);
      setTimeout(() => setShowCommitmentToast(false), 3000);
      return;
    }
    setSessionSeconds(0);
    setIsLive(true);
  };

  const minutes = String(Math.floor(sessionSeconds / 60)).padStart(2, '0');
  const seconds = String(sessionSeconds % 60).padStart(2, '0');

  return <SupportToolThemeProvider theme="adhd_focus"><SupportToolLayout className="!m-0 !w-full !max-w-none !gap-0 !p-0"><main className="relative w-full bg-[#fffefa] px-4 py-4 text-[#202036] sm:px-8 sm:py-5 lg:px-[9vw]">
    <header className="relative mx-auto flex max-w-6xl items-start justify-between gap-5"><div><p className="inline-flex items-center gap-2 rounded-full bg-[#dff8d6] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-[#24743a]"><Target size={15} /> ONE TASK. ONE VISIBLE TIMER.</p><h1 className="mt-3 flex items-center gap-3 text-4xl font-black tracking-tight sm:text-5xl"><Users className="h-11 w-11 text-[#27a34b]" strokeWidth={1.8} /> Accountability <span className="text-[#20a34a]">Session</span></h1><p className="mt-1 text-sm text-slate-500">Set one commitment and use a <span className="font-bold underline decoration-[#a98aff] decoration-2 underline-offset-4">guided timer</span> to stay with it.</p></div><img src="/focus-mascot.svg" alt="Calm brain wearing green headphones" className="hidden h-28 w-36 object-contain lg:block" /></header>
    <section className="relative mx-auto mt-5 max-w-6xl overflow-hidden rounded-[2rem] border border-[#aae39b] bg-gradient-to-b from-white to-[#f2ffed] p-6 shadow-[0_5px_14px_rgba(32,163,74,.18)] sm:p-7"><div className="absolute left-1/2 top-20 h-44 w-[52%] -translate-x-1/2 rounded-t-full bg-[#ddf8d1]" /><div className="relative"><p className="text-center text-xs font-black uppercase tracking-[.16em] text-[#24963e]">Current session <Sparkles className="inline" size={14} /></p><p className="mt-1 text-center text-6xl font-black tracking-[.11em] text-[#151b34] sm:text-8xl">{minutes}:{seconds}</p><div className="mt-3 flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm font-black"><ShieldCheck className="text-[#20a34a]" size={21} /> My Commitment</p><span className="inline-flex items-center gap-2 rounded-full border border-[#b5e9a8] bg-[#eaffdf] px-3 py-1.5 text-xs font-medium text-[#218a3c]"><Lightbulb size={14} /> Keep it concrete</span></div><div className="relative mt-3"><Pencil className="absolute left-4 top-1/2 -translate-y-1/2 text-[#25ad50]" size={19} /><input value={commitment} onChange={(event) => setCommitment(event.target.value)} disabled={isLive} placeholder="What is your one focus? Example: Finish the assignment draft." className="w-full rounded-xl border border-[#78ca71] bg-white py-4 pl-12 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-[#20a34a] disabled:opacity-70" /></div>{showCommitmentToast && <p role="alert" className="mt-2 text-center text-xs font-bold text-rose-600">Please set a commitment before starting.</p>}<div className="mt-4 grid gap-4 sm:grid-cols-2">{isLive ? <button onClick={() => setIsLive(false)} className="rounded-xl bg-[#20a34a] py-3 text-base font-black text-white">End session</button> : <button onClick={startSession} className="rounded-xl bg-gradient-to-r from-[#55c85d] to-[#19a047] py-3 text-base font-black text-white shadow-[3px_3px_0_#b9edb3]"><Play className="mr-2 inline" size={18} fill="currentColor" /> Start session</button>}<button onClick={() => setShowCommitmentReview((visible) => !visible)} className="rounded-xl border border-[#78ca71] bg-white py-3 text-base font-black text-[#25263a]"><Users className="mr-2 inline text-[#20a34a]" size={18} /> {showCommitmentReview ? 'Hide commitment' : 'Review commitment'}</button></div>{showCommitmentReview && <p className="mt-3 rounded-xl bg-[#e9ffe2] px-4 py-3 text-sm text-slate-700">{commitment.trim() || 'Add a commitment before you begin.'}</p>}</div></section>
    <section className="mx-auto mt-5 grid max-w-6xl gap-4 md:grid-cols-2"><article className="relative rounded-2xl border border-[#c9b2ff] bg-[#fbf7ff] p-5 shadow-[0_4px_10px_rgba(130,77,232,.15)]"><h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[.15em] text-[#7745e5]"><ClipboardList size={21} /> Session notes <Sparkles size={15} /></h2><div className="mt-4 space-y-3">{notes.map((note, index) => <p key={note} className="flex items-center gap-3 border-b border-[#e8deff] pb-2 text-sm text-slate-700"><span className="grid h-6 w-6 place-items-center rounded-md bg-[#e9deff] text-xs font-black text-[#7745e5]">{index + 1}</span>{note}</p>)}</div></article><article className="relative rounded-2xl border border-[#b8d6ff] bg-[#f6faff] p-5 shadow-[0_4px_10px_rgba(49,118,239,.15)]"><h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[.15em] text-[#3479ef]"><Bell size={21} /> Session reminders <Sparkles size={15} /></h2><div className="mt-4 flex flex-wrap gap-3"><span className="rounded-full border border-[#c8ddff] bg-[#eaf3ff] px-4 py-2 text-xs text-[#2366ce]">Keep the next step small</span><span className="rounded-full border border-[#c8ddff] bg-[#eaf3ff] px-4 py-2 text-xs text-[#2366ce]">Pause when you need to</span><span className="rounded-full border border-[#c8ddff] bg-[#eaf3ff] px-4 py-2 text-xs text-[#2366ce]">Return when you are ready</span></div><p className="mt-4 text-[11px] text-slate-500">This is a private, local timer. No one else joins this session.</p></article></section>
    <div className="relative mx-auto mt-4 max-w-6xl"><img src="/focus-plant.svg" alt="Potted green plant" className="absolute -left-20 bottom-0 hidden h-24 w-20 lg:block" /><p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500"><Heart size={18} className="text-pink-500" /> Use this manual timer and commitment prompt as a personal accountability aid.</p></div>
  </main></SupportToolLayout></SupportToolThemeProvider>;
}
