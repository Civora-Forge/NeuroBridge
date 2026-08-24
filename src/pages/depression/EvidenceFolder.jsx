'use client';

import React, { useState, useEffect, useRef } from "react";
import { Shield, Star, TrendingUp, Award, Heart } from "lucide-react";
import { useAuth } from '@/context/AuthContext';
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

export default function EvidenceFolder() {
  const { user } = useAuth();
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
  const lifecycle = useInterventionLifecycle({ userId: user?.id ?? null, moduleId: EVIDENCE_JOURNAL_MODULE_ID, planId: null, contextSnapshotId: null, triggerSource: 'manual', selectionMode: 'explicit_request', configuration: { allowedCategories: Object.keys(evidenceCategories), retentionMode: user?.id ? 'user_scoped' : 'ephemeral', requiresSafetyCheck: true } });

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

  const perCat = Object.keys(evidenceCategories).reduce((acc, key) => {
    acc[key] = items.filter(i => i.category === key).length;
    return acc;
  }, {});
  return (
    <SupportToolThemeProvider theme="depression_reflection">
    <SupportToolLayout>
      <div className="mx-auto max-w-2xl space-y-5 pb-4 text-stone-800">
      <header className="border-b border-stone-300 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Evidence Journal</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">Review the evidence</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">Save moments of effort, support, or care that you may want to remember.</p>
      </header>

      <section className="rounded-xl border border-[#bdecc8] bg-white p-4 shadow-sm">
        <label htmlFor="evidence-entry" className="block text-sm font-medium text-stone-800">What would you like to keep?</label>

        <textarea
          id="evidence-entry"
          className="mt-2 w-full resize-none rounded-lg border border-[#bdecc8] bg-white p-3 text-sm leading-6 text-stone-800 placeholder:text-stone-400 focus:border-[#15803d] focus:outline-none focus:ring-2 focus:ring-[#d1fadf]"
          rows={3}
          value={input}
          onChange={e => setInput(e.target.value)}
           placeholder="I attended class even though it felt difficult."
        />

        <div className="mt-3">
          <p className="text-xs font-medium text-stone-600">Choose the closest category</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(evidenceCategories).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedCategory(key)}
                className={`mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                  selectedCategory === key
                    ? "border-[#15803d] bg-[#15803d] text-white"
                    : "border-[#bdecc8] bg-white text-stone-700 hover:bg-[#ecfdf3]"
                }`}
              >
                {cfg.icon}
                <span>{cfg.label}</span>
              </button>
            ))}
          </div></div>
          <button
            type="button"
            onClick={add}
            disabled={!input.trim()}
            className="mt-4 w-full rounded-lg bg-[#15803d] py-2.5 text-sm font-semibold text-white hover:bg-[#166534] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Log evidence
          </button>

        <p className="mt-3 text-xs leading-5 text-stone-500">
           Small details count. Add an entry only when it feels useful.
        </p>
        {!user?.id && <p className="text-[11px] text-gray-500">Entries are local and temporary. Sign in to retain them in this browser under your account.</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={completeSession} disabled={!savedCount || sessionComplete} className="text-xs font-medium text-stone-700 underline underline-offset-4 disabled:opacity-50">{sessionComplete ? 'Journal session complete' : 'Complete journal session'}</button><button type="button" onClick={discardSession} className="text-xs text-stone-500 underline underline-offset-4">Discard session</button>{items.length > 0 && <button type="button" onClick={clearAll} className="text-xs text-stone-500 underline underline-offset-4">Clear all saved entries</button>}</div>
        {sessionComplete && !rated && <div className="mt-3 text-xs text-stone-600">How helpful was this journal session? {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={async () => { if (user?.id) { const result = await lifecycle.rate({ rating: value }); if (!result.ok) return; } setRated(true); }} className="ml-2 rounded border border-stone-300 px-2 py-1 hover:bg-stone-100">{value}</button>)}</div>}
      </section>

      {/* Filters */}
      <section className="border-t border-stone-300 pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterCat("all")}
            className={`px-3 py-1 rounded-2xl text-xs font-semibold border ${
              filterCat === "all"
                ? "bg-[#15803d] text-white border-[#15803d]"
                : "bg-white text-stone-700 border-[#bdecc8]"
            }`}
          >
            All
          </button>
          {Object.entries(evidenceCategories).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterCat(key)}
              className={`px-3 py-1 rounded-2xl text-xs font-semibold border ${
                filterCat === key
                ? "bg-[#15803d] text-white border-[#15803d]"
                : "bg-white text-stone-700 border-[#bdecc8]"
              }`}
            >
              {cfg.label} ({perCat[key] || 0})
            </button>
          ))}
        </div>

        <input
          className="w-full rounded-lg border border-[#bdecc8] bg-white px-3 py-2 text-xs text-stone-800 placeholder:text-stone-400 focus:border-[#15803d] focus:outline-none focus:ring-2 focus:ring-[#d1fadf] sm:w-52"
           placeholder="Search entries"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        </div>
      </section>

      {/* List */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#bdecc8] bg-[#ecfdf3] px-4 py-10 text-center">
            <p className="mx-auto max-w-md text-sm leading-6 text-stone-600">Add an entry when you want to remember something meaningful or helpful.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((i) => {
              const cfg = evidenceCategories[i.category];
              return (
                <article
                  key={i.id}
                  className="rounded-xl border border-[#bdecc8] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                        {cfg?.icon}
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                          {cfg?.label}
                        </span>
                        <span className="text-[10px] text-stone-400">
                           {new Date(i.createdAt).toLocaleDateString()} |{" "}
                          {new Date(i.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-stone-800">
                         {i.content}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleStar(i.id)}
                        className="rounded p-1 hover:bg-stone-100"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            i.starred ? "fill-stone-600 text-stone-600" : "text-stone-300"
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(i.id)}
                        className="text-[11px] text-stone-500 underline underline-offset-2 hover:text-stone-800"
                      >
                        delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      <details className="border-t border-stone-300 pt-4 text-xs leading-5 text-stone-600"><summary className="cursor-pointer font-medium text-stone-700">Need urgent support?</summary><p className="mt-2">If you may act on thoughts of harming yourself or someone else, contact local emergency services now. If possible, also reach out to someone you trust and stay with them.</p></details>
      </div>
    </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}
