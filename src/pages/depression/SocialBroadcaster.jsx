'use client';

import React, { useRef, useState } from "react";
import { ChevronDown, Copy, Check, Heart, MessageCircle, Pencil, RotateCcw, Sparkles, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useAuth } from '@/context/AuthContext';
import { useInterventionLifecycle } from '@/support/execution';
import { buildSocialConnectionOutcome } from '@/support/modules/socialConnection/socialConnectionService';
import { SOCIAL_CONNECTION_MODULE_ID } from '@/support/modules/socialConnection/socialConnectionTypes';
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";

function ConnectionCornerArt() {
  return (
    <svg aria-hidden="true" viewBox="0 -32 360 237" className="pointer-events-none h-full w-full drop-shadow-sm transition-all duration-500 hover:scale-105 hover:opacity-100" fill="none">
      <path d="M132 7c84-25 181 15 181 99 0 55-44 80-106 75H77c34-17 48-42 55-76Z" fill="#fff1bd" opacity=".85"/>
      <path d="M75 167h250" stroke="#dfcca1" strokeWidth="10" strokeLinecap="round"/>
      <path d="M183 151c1-66 4-98-25-130m27 70c32-30 47-57 49-79m-46 45C159 37 145 19 146 0" stroke="#728852" strokeWidth="3" strokeLinecap="round"/>
      <path d="M153 31c-24-14-43-6-48 11 23 13 42 7 48-11Zm34 26c-21-17-17-39-3-53 21 16 23 37 3 53Zm13-44c2-28 20-39 39-39 0 27-15 41-39 39Zm-18 92c28-17 48-12 57 8-26 16-47 11-57-8Z" fill="#9eb77a"/>
      <path d="M163 130h61l-6 53c-1 8-7 13-15 13h-21c-8 0-14-5-15-13Z" fill="#e3ca99"/>
      <path d="M163 130c20 4 41 4 61 0" stroke="#c2a776" strokeWidth="2"/>
      <path d="M112 154c2-25-1-44-18-58m18 29c-15-11-27-8-33 3 16 10 29 7 33-3Zm4-12c3-15 14-23 27-22 0 15-10 24-27 22Z" stroke="#78935e" strokeWidth="2" fill="#aac582"/>
      <path d="M97 143h30l-3 32H100Z" fill="#e9a782"/>
      <path d="M260 144h50v38c0 9-6 14-14 14h-22c-8 0-14-5-14-14Z" fill="#e5986e"/>
      <path d="M310 154h13c13 0 14 22 0 22h-13" stroke="#cb825e" strokeWidth="5"/>
      <path d="M280 162c-10-12-22 5 0 19 22-14 10-31 0-19Z" fill="white"/>
      <path d="m58 40 5 5m0-5-5 5m19-24 4 4m0-4-4 4m209 4 4 4m0-4-4 4" stroke="#edc85e" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export default function SocialBroadcaster() {
  const { user } = useAuth();
  const [status, setStatus] = useState("Yellow");
  const [copied, setCopied] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [complete, setComplete] = useState(false);
  const startedAtRef = useRef(null);

  const configuration = { actionType: 'status_update', channelType: 'clipboard', requiresConfirmation: true };
  const lifecycle = useInterventionLifecycle({ 
    userId: user?.id ?? null, 
    moduleId: SOCIAL_CONNECTION_MODULE_ID, 
    planId: null, 
    contextSnapshotId: null, 
    triggerSource: 'manual', 
    selectionMode: 'explicit_request', 
    configuration 
  });

  const start = async () => { 
    if (!lifecycle.hasStarted && user?.id) { 
      const started = await lifecycle.start(); 
      if (!started.ok) return false; 
      startedAtRef.current = Date.now(); 
    } 
    return true; 
  };

  const codes = {
    Red: { 
      label: "Red: Low Energy", 
      message: "Status: RED\n\nI am low on energy and may not be able to talk or respond right now. It is not about you. I will reply when I can.", 
      explain: "You may need to rest without giving a detailed explanation.", 
      suggestion: "Set an auto-response, silence notifications, or choose one person to update later." 
    },
    Yellow: { 
      label: "Yellow: Limited Capacity", 
      message: "Status: YELLOW\n\nMy replies may be slow and short today. I still care. There is no need to fix anything.", 
      explain: "You may be able to talk a little while keeping expectations low.", 
      suggestion: "Keep check-ins short, avoid big conversations, or schedule a longer chat for another day." 
    },
    Green: { 
      label: "Green: Open & Available", 
      message: "Status: GREEN\n\nI can chat and respond today. Feel free to message or call. If I get tired, I will let you know.", 
      explain: "You have relatively steady energy, with permission to still set limits.", 
      suggestion: "Use this time for light connection, planning, or asking for support you have been postponing." 
    }
  };

  const visualStatus = {
    Red: { 
      glow: "bg-rose-500/10",
      selector: "border-rose-200 bg-white/70 text-rose-900 hover:bg-rose-50 hover:border-rose-300", 
      selected: "border-rose-400 bg-gradient-to-r from-rose-50 via-red-50/80 to-rose-100/60 ring-4 ring-rose-500/10 shadow-lg shadow-rose-950/5 text-rose-950 scale-[1.01]", 
      card: "border-rose-200/80 from-white via-rose-50/40 to-orange-50/30 shadow-rose-900/5", 
      accent: "border-rose-400 bg-rose-50/60 text-rose-950", 
      message: "border-rose-200 bg-white/90 shadow-sm shadow-rose-950/5", 
      icon: "bg-rose-100 text-rose-600 ring-4 ring-rose-50",
      dot: "bg-rose-500 shadow-sm shadow-rose-500/50"
    },
    Yellow: { 
      glow: "bg-amber-500/10",
      selector: "border-amber-200 bg-white/70 text-amber-900 hover:bg-amber-50 hover:border-amber-300", 
      selected: "border-amber-400 bg-gradient-to-r from-amber-50 via-yellow-50/80 to-amber-100/60 ring-4 ring-amber-500/10 shadow-lg shadow-amber-950/5 text-amber-950 scale-[1.01]", 
      card: "border-amber-200/80 from-white via-amber-50/40 to-yellow-50/30 shadow-amber-900/5", 
      accent: "border-amber-400 bg-amber-50/60 text-amber-950", 
      message: "border-amber-200 bg-white/90 shadow-sm shadow-amber-950/5", 
      icon: "bg-amber-100 text-amber-600 ring-4 ring-amber-50",
      dot: "bg-amber-500 shadow-sm shadow-amber-500/50"
    },
    Green: { 
      glow: "bg-emerald-500/10",
      selector: "border-emerald-200 bg-white/70 text-emerald-900 hover:bg-emerald-50 hover:border-emerald-300", 
      selected: "border-emerald-400 bg-gradient-to-r from-emerald-50 via-teal-50/80 to-emerald-100/60 ring-4 ring-emerald-500/10 shadow-lg shadow-emerald-950/5 text-emerald-950 scale-[1.01]", 
      card: "border-emerald-200/80 from-white via-emerald-50/40 to-teal-50/30 shadow-emerald-900/5", 
      accent: "border-emerald-400 bg-emerald-50/60 text-emerald-950", 
      message: "border-emerald-200 bg-white/90 shadow-sm shadow-emerald-950/5", 
      icon: "bg-emerald-100 text-emerald-600 ring-4 ring-emerald-50",
      dot: "bg-emerald-500 shadow-sm shadow-emerald-500/50"
    },
  }[status];

  const [messageStatus, messageBody] = codes[status].message.split("\n\n");

  const handleCopy = async () => {
    if (!await start()) return;
    try { await navigator.clipboard.writeText(codes[status].message); } catch { return; }
    setCopied(true); 
    setPrepared(true);
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) {
      await lifecycle.progress({ progressType: 'social_connection_prepared', completedUnits: 1, totalUnits: 2, progressRatio: 0.5 });
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmReady = async () => { 
    if (!prepared || complete || !await start()) return; 
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) {
      await lifecycle.complete(buildSocialConnectionOutcome({ configuration, prepared: true, confirmed: true, startedAt: startedAtRef.current }));
    } 
    setComplete(true); 
  };

  const reset = async () => { 
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) {
      await lifecycle.abandon('user_discard', {}, buildSocialConnectionOutcome({ configuration, prepared, startedAt: startedAtRef.current }));
    } 
    lifecycle.reset(); 
    setPrepared(false); 
    setComplete(false); 
    setCopied(false); 
  };

  return (
    <SupportToolThemeProvider theme="depression_gentle" override="neutral">
      <SupportToolLayout className="!m-0 !w-full !max-w-none !gap-0 !p-0">
        <main className="relative min-h-screen w-full overflow-hidden bg-[#faf8f5] text-[#2c3242] antialiased selection:bg-rose-200">
          
          {/* Dynamic Background Glow Effect */}
          <div className={`pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full blur-3xl transition-all duration-700 ${visualStatus.glow}`} />
          <div className="pointer-events-none absolute -right-20 top-1/3 h-[400px] w-[400px] rounded-full bg-purple-200/30 blur-3xl" />

          <div className="relative mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
            <div className="rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-slate-900/[0.03] backdrop-blur-md sm:p-10 lg:p-12">
              <div className="mx-auto max-w-[960px] space-y-8">
            {/* Header Section */}
            <header className="relative mb-10 min-h-[160px] pr-0 sm:min-h-[190px] md:pr-[280px] lg:pr-[360px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-200/60 bg-white/80 px-4 py-1.5 text-[12px] font-extrabold uppercase tracking-[.18em] text-purple-900 shadow-sm backdrop-blur-md">
                <Sparkles size={14} className="animate-pulse text-amber-500" />
                <span>A small connection step</span>
              </div>
              <h1 className="mt-4 max-w-[650px] text-[36px] font-black leading-tight tracking-[-.04em] text-slate-900 sm:text-[46px]">
                Share your capacity simply
              </h1>
              <p className="mt-3.5 max-w-[600px] text-[16px] leading-relaxed text-slate-600 sm:text-[18px]">
                Choose what fits today. You do not need to explain more than you want to.
              </p>
              <div className="absolute right-0 top-0 hidden h-[220px] w-[350px] pointer-events-none md:block">
                <ConnectionCornerArt />
              </div>
            </header>

            {/* Main Interactive Stack */}
            <div className="space-y-6">
              
              {/* Capacity Selector Card */}
              <fieldset className="rounded-[24px] border border-rose-200/80 bg-rose-50/30 p-5 shadow-xl shadow-slate-900/[0.03] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:p-6">
                <legend className="px-1 text-[16px] font-extrabold tracking-tight text-slate-800">
                  How available do you feel right now?
                </legend>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {["Red", "Yellow", "Green"].map((option) => {
                    const isSelected = status === option;
                    const optionStyle = visualStatus;

                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={async () => {
                          if (!await start()) return;
                          setStatus(option);
                          if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) {
                            await lifecycle.progress({ progressType: 'social_connection_selection', completedUnits: 0, totalUnits: 2, progressRatio: 0 });
                          }
                        }}
                        className={`group relative flex h-[64px] items-center justify-center gap-3.5 rounded-2xl border text-[15px] font-black transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-500/20 active:scale-[0.98] ${
                          isSelected ? optionStyle.selected : optionStyle.selector
                        }`}
                        aria-pressed={isSelected}
                      >
                        <span className={`relative flex h-3.5 w-3.5 items-center justify-center`}>
                          {isSelected && (
                            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${optionStyle.dot}`} />
                          )}
                          <span className={`relative inline-flex h-3 w-3 rounded-full transition-transform duration-300 group-hover:scale-125 ${
                            option === 'Red' ? 'bg-rose-500' : option === 'Yellow' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                        </span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Status Explanation Card */}
              <section 
                className={`rounded-[24px] border bg-gradient-to-br p-5 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-md backdrop-blur-md sm:p-6 ${visualStatus.card}`} 
                aria-labelledby="status-title"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${visualStatus.dot}`} />
                    <p className="text-[12px] font-extrabold uppercase tracking-widest text-slate-500">
                      Your selected status
                    </p>
                  </div>
                  <h2 id="status-title" className="mt-1.5 text-[24px] font-black tracking-tight text-slate-900 sm:text-[28px]">
                    {codes[status].label}
                  </h2>
                  <p className="mt-3 max-w-[680px] text-[15px] leading-relaxed text-slate-600 sm:text-[16px]">
                    {codes[status].explain}
                  </p>
                  <div className={`mt-5 max-w-[720px] rounded-2xl border-l-4 p-4 text-[14px] leading-relaxed backdrop-blur-sm shadow-sm ${visualStatus.accent}`}>
                    <span className="font-extrabold tracking-wide uppercase text-[12px] block mb-0.5 opacity-70">
                      Suggestion
                    </span>
                    {codes[status].suggestion}
                  </div>
                </div>
              </section>

              {/* Message Box Section */}
              <section className="rounded-[24px] border border-rose-200/80 bg-rose-50/30 p-5 shadow-xl shadow-slate-900/[0.03] transition-all duration-300 hover:-translate-y-1 hover:shadow-md backdrop-blur-md sm:p-6" aria-labelledby="message-title">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 id="message-title" className="text-[17px] font-extrabold text-slate-800">
                    Message to copy
                  </h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-3 py-1 text-[12px] font-bold text-purple-900">
                    <Pencil size={12} /> Edit after pasting if you wish
                  </span>
                </div>

                <div className={`relative flex items-start gap-4 rounded-2xl border p-5 transition-all duration-300 sm:p-6 ${visualStatus.message}`}>
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-all ${visualStatus.icon}`}>
                    <MessageCircle size={22} />
                  </span>
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-[12px] font-black uppercase tracking-wider text-slate-400">
                      {messageStatus}
                    </p>
                    <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-slate-800 sm:text-[16px]">
                      {messageBody}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label="Copy this message"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow active:scale-95"
                  >
                    {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                  </button>
                </div>

                {/* Primary Action Controls */}
                <div className="mt-6">
                  {!complete && (
                    prepared ? (
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={confirmReady}
                          className="group relative flex h-[60px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-[17px] font-black text-white shadow-lg shadow-emerald-950/10 transition-all duration-300 hover:brightness-110 active:scale-[0.99]"
                        >
                          <CheckCircle2 size={20} />
                          <span>I have my message ready</span>
                        </button>
                        <p className="text-center text-[13px] font-semibold text-slate-500">
                          {copied ? "Copied to clipboard. " : ""}Send it only if and when it feels right.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="group relative flex h-[60px] w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-[17px] font-black text-white shadow-lg shadow-emerald-950/10 transition-all duration-300 hover:brightness-110 active:scale-[0.99]"
                      >
                        {copied ? <Check size={20} /> : <Copy size={20} />}
                        <span>{copied ? "Copied to Clipboard" : "Copy Message"}</span>
                      </button>
                    )
                  )}

                  {complete && (
                    <div className="flex items-start gap-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-[15px] leading-relaxed text-emerald-950 shadow-sm backdrop-blur-sm">
                      <Sparkles className="mt-0.5 shrink-0 text-emerald-600" size={20} />
                      <div>
                        <p className="font-extrabold text-emerald-900">Your connection plan is ready.</p>
                        <p className="mt-0.5 text-[14px] text-emerald-800/90">
                          You can take the next step whenever you choose. Take all the time you need.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reset Action & Visitor Notice */}
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-bold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-800"
                  >
                    <RotateCcw size={14} /> Discard and start again
                  </button>
                  {!user?.id && (
                    <p className="mt-2 text-[12px] font-medium text-slate-400">
                      You can prepare this locally. Sign in to save structured progress.
                    </p>
                  )}
                </div>
              </section>

              {/* Emergency Accordion Footer */}
              <footer className="pt-2">
                <details className="group rounded-2xl border border-slate-200/80 bg-white/80 px-6 text-[14px] leading-relaxed text-slate-600 shadow-sm backdrop-blur-md transition-all">
                  <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between font-extrabold text-slate-800 select-none">
                    <span className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-rose-600">
                        <Heart size={18} />
                      </span>
                      Need urgent support?
                    </span>
                    <ChevronDown size={18} className="text-slate-400 transition-transform duration-300 group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-slate-100 pb-5 pt-4 text-[13px] leading-relaxed text-slate-600">
                    <div className="flex items-start gap-3 rounded-xl bg-rose-50/50 p-4 text-rose-950 border border-rose-100">
                      <ShieldAlert size={18} className="mt-0.5 shrink-0 text-rose-600" />
                      <p>
                        If you may be in immediate danger or unable to stay safe, contact local emergency services or a local crisis support service now. If possible, reach out to someone you trust and stay with them.
                      </p>
                    </div>
                  </div>
                </details>
              </footer>

              </div>
              </div>
            </div>
          </div>
        </main>
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}
