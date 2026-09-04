'use client';

import React, { useState, useEffect, useRef } from "react";
import { Shield, Star, TrendingUp, Award, Heart, ChevronDown, Search, Sparkles, Sprout, Trash2, CheckCircle2, RotateCcw } from "lucide-react";
import { useAuth } from '@/context/AuthContext';
import { useContextStateOptional } from '@/context/ContextProvider';
import { useFeatureAdaptation } from '@/hooks/useFeatureAdaptation';
import { useInterventionLifecycle } from '@/support/execution';
import { assessSupportInput } from '@/support/safety';
import { clearEvidenceJournalEntries, deleteEvidenceJournalEntry, listEvidenceJournalEntries, saveEvidenceJournalEntry } from '@/support/persistence/evidenceJournalStore';
import { buildEvidenceJournalOutcome, canSaveEvidenceEntry, normalizeEvidenceCategory } from '@/support/modules/evidenceJournal/evidenceJournalService';
import { EVIDENCE_JOURNAL_MODULE_ID } from '@/support/modules/evidenceJournal/evidenceJournalTypes';
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";

const evidenceCategories = {
  survival: { icon: <Shield className="w-4 h-4" />, label: "Survival", hint: "I got through something hard" },
  growth: { icon: <TrendingUp className="w-4 h-4" />, label: "Growth", hint: "I learned / improved" },
  social: { icon: <Heart className="w-4 h-4" />, label: "Connection", hint: "Someone cared / responded" },
  achievement: { icon: <Award className="w-4 h-4" />, label: "Achievement", hint: "I finished or started something" },
  selfworth: { icon: <Star className="w-4 h-4" />, label: "Self-worth", hint: "I showed kindness to myself" }
};

function EvidenceCornerArt() {
  return <img aria-hidden="true" src="/image.svg" alt="" className="pointer-events-none h-full w-full object-contain transition-transform duration-500 hover:scale-105" />;
}

export default function EvidenceFolder() {
  const { user } = useAuth();
  const context = useContextStateOptional()?.context ?? null;
  const adaptation = useFeatureAdaptation("support.evidence_journal", {
    getAppSnapshot: () => context,
    userId: user?.id ?? null,
  });
  const adaptiveConfig = adaptation.configuration;

  const [items, setItems] = useState([]);
  const [input, setInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("survival");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [savedCount, setSavedCount] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);
  const [categoriesUsed, setCategoriesUsed] = useState([]);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [rated, setRated] = useState(false);
  const startedAtRef = useRef(null);
  
  const lifecycle = useInterventionLifecycle({ 
    userId: user?.id ?? null, 
    moduleId: EVIDENCE_JOURNAL_MODULE_ID, 
    planId: null, 
    contextSnapshotId: null, 
    triggerSource: 'manual', 
    selectionMode: 'explicit_request', 
    configuration: { 
      allowedCategories: Object.keys(evidenceCategories), 
      retentionMode: user?.id ? 'user_scoped' : 'ephemeral', 
      requiresSafetyCheck: true 
    } 
  });

  // load saved
  useEffect(() => {
    setItems(user?.id ? listEvidenceJournalEntries(user.id) : []);
  }, [user?.id]);

  const add = async () => {
    if (!input.trim()) return;
    const safety = assessSupportInput({ userId: user?.id, moduleId: EVIDENCE_JOURNAL_MODULE_ID, action: 'save_entry', inputType: 'free_text', text: input });
    if (!canSaveEvidenceEntry(safety)) return;
    if (!lifecycle.hasStarted && user?.id) { const started = await lifecycle.start(); if (!started.ok) return; startedAtRef.current = Date.now(); }
    const now = new Date().toISOString();
    const entry = {
      id: String(Date.now()), userId: user?.id,
      text: input.trim(),
      content: input.trim(), category: normalizeEvidenceCategory(selectedCategory),
      createdAt: now,
      updatedAt: now, starred: false, moduleId: EVIDENCE_JOURNAL_MODULE_ID, retentionMode: 'user_scoped', safetyLevel: 'sensitive'
    };
    const next = user?.id ? saveEvidenceJournalEntry(user.id, entry) : { ...entry, userId: null, retentionMode: 'ephemeral' };
    setItems([next, ...items]); setSavedCount((count) => count + 1); setCategoriesUsed((categories) => [...new Set([...categories, entry.category])]);
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.progress({ progressType: 'evidence_journal_saved', completedUnits: savedCount + 1, totalUnits: savedCount + 1, progressRatio: 1 });
    setInput("");
  };

  const toggleStar = (id) => {
    setItems(items.map(i => { const next = i.id === id ? { ...i, starred: !i.starred, updatedAt: new Date().toISOString() } : i; if (next.id === id && user?.id) saveEvidenceJournalEntry(user.id, next); return next; }));
  };

  const remove = (id) => {
    if (user?.id) deleteEvidenceJournalEntry(user.id, id);
    setItems(items.filter(i => i.id !== id)); setDeletedCount((count) => count + 1);
  };

  const outcome = (confirmed = false) => buildEvidenceJournalOutcome({ created: savedCount, saved: user?.id ? savedCount : 0, deleted: deletedCount, categories: categoriesUsed, confirmed, startedAt: startedAtRef.current });
  const completeSession = async () => { if (!savedCount || sessionComplete) return; if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.complete(outcome(true)); setSessionComplete(true); };
  const discardSession = async () => { if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.abandon('user_discard', {}, outcome(false)); lifecycle.reset(); setSavedCount(0); setDeletedCount(0); setCategoriesUsed([]); setSessionComplete(false); setRated(false); setInput(''); };
  const clearAll = async () => { if (!window.confirm('Clear all saved entries?')) return; const count = items.length; if (user?.id) clearEvidenceJournalEntries(user.id); setItems([]); setDeletedCount((value) => value + count); if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.progress({ progressType: 'evidence_journal_cleared', completedUnits: savedCount, totalUnits: savedCount, progressRatio: 1 }); };

  const filtered = items.filter(i => {
    const matchesText = i.content.toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCat === "all" || i.category === filterCat;
    return matchesText && matchesCat;
  });

  // When the low-mood REORDER decision is active, surface the user's starred
  // wins first — a native presentation change over existing entries only.
  const orderedItems = adaptiveConfig?.winsFirst
    ? [...filtered].sort((a, b) => Number(Boolean(b.starred)) - Number(Boolean(a.starred)))
    : filtered;

  const perCat = Object.keys(evidenceCategories).reduce((acc, key) => {
    acc[key] = items.filter(i => i.category === key).length;
    return acc;
  }, {});

  return (
    <SupportToolThemeProvider theme="depression_reflection" override="neutral">
      <SupportToolLayout className="!m-0 !w-full !max-w-none !gap-0 !p-0">
        <main className="relative min-h-screen w-full overflow-hidden bg-[#faf8f5] text-[#2c3242] antialiased selection:bg-rose-200">
          
          {/* Subtle Ambient Background Gradients */}
          <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-1/3 h-[400px] w-[400px] rounded-full bg-purple-300/20 blur-3xl" />

          <div className="relative mx-auto w-full max-w-[1200px] space-y-8 px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
            <div className="rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-slate-900/[0.03] backdrop-blur-md sm:p-10 lg:p-12">
              <div className="mx-auto max-w-[960px] space-y-8">
            {/* Header Section */}
            <header className="relative min-h-[145px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-200/60 bg-white/80 px-4 py-1.5 text-[12px] font-extrabold uppercase tracking-[.18em] text-purple-900 shadow-sm backdrop-blur-md">
                Evidence Journal <Sparkles size={14} className="animate-pulse text-amber-500" />
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
                <h1 className="text-[36px] font-black leading-tight tracking-[-.04em] text-slate-900 sm:text-[46px]">
                  Review the evidence
                </h1>
                <div className="hidden h-[100px] w-[190px] shrink-0 sm:block md:h-[120px] md:w-[230px] lg:h-[140px] lg:w-[270px]">
                  <EvidenceCornerArt />
                </div>
              </div>
              <p className="mt-3 max-w-[640px] text-[16px] leading-relaxed text-slate-600 sm:text-[18px]">
                Save moments of effort, support, or care that you may want to remember.
              </p>
            </header>

            {/* Main Input & Logging Card */}
            <section className="rounded-[24px] border border-sky-200/80 bg-sky-50/30 p-5 shadow-xl shadow-slate-900/[0.03] transition-all duration-300 hover:-translate-y-1 hover:shadow-md backdrop-blur-md sm:p-6">
              <label htmlFor="evidence-entry" className="block text-[18px] font-black tracking-tight text-slate-900">
                What would you like to keep?
              </label>

              {/* Textarea Container */}
              <div className="relative mt-4 overflow-hidden rounded-2xl border border-emerald-200/80 bg-white/90 shadow-inner transition-all focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10">
                <img 
                  src="/evidence-sprout.svg" 
                  alt="" 
                  aria-hidden="true" 
                  className="pointer-events-none absolute bottom-0 right-2 z-0 w-[115px] select-none object-contain object-bottom-right opacity-80 sm:w-[160px]" 
                />
                <textarea
                  id="evidence-entry"
                  className="relative z-10 min-h-[150px] w-full resize-none bg-transparent p-5 pb-[58px] pr-[135px] text-[16px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none sm:pb-[70px] sm:pr-[170px]"
                  rows={3}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="I attended class even though it felt difficult."
                />
              </div>

              {/* Category Selection */}
              <div className="mt-6">
                <p className="text-[15px] font-black tracking-tight text-slate-800">
                  Choose the closest category
                </p>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  {Object.entries(evidenceCategories).map(([key, cfg]) => {
                    const isSelected = selectedCategory === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedCategory(key)}
                        className={`flex min-h-[48px] items-center gap-2 rounded-xl border px-4 text-[14px] font-extrabold transition-all duration-200 active:scale-95 ${
                          isSelected
                            ? "border-emerald-600 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/10"
                            : "border-slate-200 bg-white/70 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {cfg.icon}
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={add}
                disabled={!input.trim()}
                className="mt-6 flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-[17px] font-black text-white shadow-lg shadow-emerald-950/10 transition-all duration-300 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                <Sprout size={20} />
                <span>Log evidence</span>
              </button>

              <p className="mt-3 text-[13px] font-medium leading-relaxed text-slate-500">
                Small details count. Add an entry only when it feels useful.
              </p>
              {!user?.id && (
                <p className="mt-1 text-[12px] font-semibold text-amber-700/80">
                  Entries are local and temporary. Sign in to retain them in this browser under your account.
                </p>
              )}

              {/* Session Controls */}
              <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-[13px]">
                <button 
                  type="button" 
                  onClick={completeSession} 
                  disabled={!savedCount || sessionComplete} 
                  className="font-extrabold text-emerald-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sessionComplete ? '✓ Journal session complete' : 'Complete journal session'}
                </button>
                <button 
                  type="button" 
                  onClick={discardSession} 
                  className="font-bold text-slate-500 hover:text-slate-800 hover:underline"
                >
                  Discard session
                </button>
                {items.length > 0 && (
                  <button 
                    type="button" 
                    onClick={clearAll} 
                    className="ml-auto font-bold text-rose-600 hover:text-rose-800 hover:underline"
                  >
                    Clear all saved entries
                  </button>
                )}
              </div>

              {/* Session Rating Sub-card */}
              {sessionComplete && !rated && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-[13px] font-bold text-emerald-950 backdrop-blur-sm">
                  <span>How helpful was this journal session?</span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={async () => {
                          if (user?.id) {
                            const result = await lifecycle.rate({ rating: value });
                            if (!result.ok) return;
                          }
                          setRated(true);
                        }}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-300 bg-white font-black text-emerald-800 shadow-sm transition-all hover:bg-emerald-600 hover:text-white"
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Filtering Controls */}
            <section className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-md">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterCat("all")}
                    className={`rounded-xl px-3.5 py-1.5 text-[12px] font-extrabold transition-all ${
                      filterCat === "all"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80"
                    }`}
                  >
                    All
                  </button>
                  {Object.entries(evidenceCategories).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilterCat(key)}
                      className={`rounded-xl px-3.5 py-1.5 text-[12px] font-extrabold transition-all ${
                        filterCat === key
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80"
                      }`}
                    >
                      {cfg.label} ({perCat[key] || 0})
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-[260px]">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200/80 bg-white pl-9 pr-4 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                    placeholder="Search entries..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Entries Display List */}
            {adaptiveConfig?.highlightWins && orderedItems.length > 0 && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-[13px] font-extrabold text-amber-900 backdrop-blur-sm">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                Your strongest pieces of evidence are shown first.
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="grid min-h-[200px] place-items-center rounded-[28px] border border-dashed border-emerald-200 bg-white/40 px-6 py-12 text-center backdrop-blur-sm">
                <div>
                  <Sprout className="mx-auto mb-3 text-emerald-600" size={28} />
                  <p className="mx-auto max-w-md text-[16px] font-extrabold text-slate-700">
                    Add an entry when you want to remember something meaningful or helpful.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {orderedItems.map((i) => {
                  const cfg = evidenceCategories[i.category];
                  return (
                    <article
                      key={i.id}
                      className="group relative rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm transition-all duration-200 hover:border-emerald-200 hover:shadow-md"
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 shrink-0">
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-4 ring-emerald-50/50">
                            {cfg?.icon}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
                              {cfg?.label}
                            </span>
                            <span className="text-[11px] font-medium text-slate-400">
                              • {new Date(i.createdAt).toLocaleDateString()} |{" "}
                              {new Date(i.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-[15px] leading-relaxed font-medium text-slate-800">
                            {i.content}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleStar(i.id)}
                            aria-label="Star entry"
                            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <Star
                              className={`h-4 w-4 transition-transform group-hover:scale-110 ${
                                i.starred ? "fill-amber-400 text-amber-400" : "text-slate-300"
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(i.id)}
                            aria-label="Delete entry"
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Urgent Support Accordion Footer */}
            <footer className="pt-4">
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
                  <p>
                    If you may act on thoughts of harming yourself or someone else, contact local emergency services now. If possible, also reach out to someone you trust and stay with them.
                  </p>
                </div>
              </details>
            </footer>

              </div>
            </div>
          </div>
        </main>
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}
