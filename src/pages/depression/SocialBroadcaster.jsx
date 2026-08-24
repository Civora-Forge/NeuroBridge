'use client';

import React, { useRef, useState } from "react";
import { useAuth } from '@/context/AuthContext';
import { useInterventionLifecycle } from '@/support/execution';
import { buildSocialConnectionOutcome } from '@/support/modules/socialConnection/socialConnectionService';
import { SOCIAL_CONNECTION_MODULE_ID } from '@/support/modules/socialConnection/socialConnectionTypes';
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";

export default function SocialBroadcaster() {
  const { user } = useAuth();
  const [status, setStatus] = useState("Yellow");
  const [copied, setCopied] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [complete, setComplete] = useState(false);
  const startedAtRef = useRef(null);
  const configuration = { actionType: 'status_update', channelType: 'clipboard', requiresConfirmation: true };
  const lifecycle = useInterventionLifecycle({ userId: user?.id ?? null, moduleId: SOCIAL_CONNECTION_MODULE_ID, planId: null, contextSnapshotId: null, triggerSource: 'manual', selectionMode: 'explicit_request', configuration });
  const start = async () => { if (!lifecycle.hasStarted && user?.id) { const started = await lifecycle.start(); if (!started.ok) return false; startedAtRef.current = Date.now(); } return true; };

  const codes = {
    Red: { label: "Red: no social energy", message: "Status: RED\n\nI am low on energy and may not be able to talk or respond right now. It is not about you. I will reply when I can.", explain: "You may need to rest without giving a detailed explanation.", suggestion: "Set an auto-response, silence notifications, or choose one person to update later." },
    Yellow: { label: "Yellow: limited energy", message: "Status: YELLOW\n\nMy replies may be slow and short today. I still care. There is no need to fix anything.", explain: "You may be able to talk a little while keeping expectations low.", suggestion: "Keep check-ins short, avoid big conversations, or schedule a longer chat for another day." },
    Green: { label: "Green: available", message: "Status: GREEN\n\nI can chat and respond today. Feel free to message or call. If I get tired, I will let you know.", explain: "You have relatively steady energy, with permission to still set limits.", suggestion: "Use this time for light connection, planning, or asking for support you have been postponing." }
  };

  const handleCopy = async () => {
    if (!await start()) return;
    try { await navigator.clipboard.writeText(codes[status].message); } catch { return; }
    setCopied(true); setPrepared(true);
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.progress({ progressType: 'social_connection_prepared', completedUnits: 1, totalUnits: 2, progressRatio: 0.5 });
    setTimeout(() => setCopied(false), 1500);
  };
  const confirmReady = async () => { if (!prepared || complete || !await start()) return; if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.complete(buildSocialConnectionOutcome({ configuration, prepared: true, confirmed: true, startedAt: startedAtRef.current })); setComplete(true); };
  const reset = async () => { if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.abandon('user_discard', {}, buildSocialConnectionOutcome({ configuration, prepared, startedAt: startedAtRef.current })); lifecycle.reset(); setPrepared(false); setComplete(false); setCopied(false); };

  return (
    <SupportToolThemeProvider theme="depression_gentle">
      <SupportToolLayout>
        <main className="mx-auto w-full max-w-xl space-y-5 px-1 py-3 text-[#173d26]">
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">A small connection step</p>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Share your capacity simply</h1>
            <p className="max-w-lg text-sm leading-6 text-stone-600">Choose what fits today. You do not need to explain more than you want to.</p>
          </header>

          <fieldset className="rounded-2xl border border-[#bdecc8] bg-white p-4 shadow-sm">
            <legend className="px-1 text-sm font-medium text-stone-700">How available do you feel?</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {["Red", "Yellow", "Green"].map((option) => (
                <button key={option} onClick={async () => { if (!await start()) return; setStatus(option); if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.progress({ progressType: 'social_connection_selection', completedUnits: 0, totalUnits: 2, progressRatio: 0 }); }} className={`rounded-xl border px-2 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#15803d] focus:ring-offset-2 ${status === option ? 'border-[#15803d] bg-[#15803d] text-white' : 'border-[#bdecc8] bg-white text-[#246b3d] hover:bg-[#ecfdf3]'}`} aria-pressed={status === option}>{option}</button>
              ))}
            </div>
          </fieldset>

          <section className="rounded-2xl border border-[#bdecc8] bg-white p-5 shadow-sm" aria-labelledby="status-title">
            <p className="text-xs font-medium text-stone-500">Your selected status</p>
            <h2 id="status-title" className="mt-1 text-lg font-semibold text-stone-900">{codes[status].label}</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">{codes[status].explain}</p>
            <p className="mt-3 border-l-2 border-[#86d89a] pl-3 text-sm leading-6 text-stone-600">{codes[status].suggestion}</p>
          </section>

          <section aria-labelledby="message-title">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 id="message-title" className="text-sm font-medium text-stone-700">Message to copy</h2>
              <span className="text-xs text-stone-500">Edit after pasting if you wish</span>
            </div>
            <pre className="whitespace-pre-wrap rounded-xl border border-[#bdecc8] bg-[#ecfdf3] p-4 font-sans text-sm leading-6 text-stone-700">{codes[status].message}</pre>
          </section>

          {!complete && (prepared ? (
            <section className="space-y-3">
              <button onClick={confirmReady} className="w-full rounded-xl bg-[#15803d] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#166534] focus:outline-none focus:ring-2 focus:ring-[#15803d] focus:ring-offset-2">I have my message ready</button>
              <p className="text-center text-xs text-stone-600">{copied ? "Copied. " : ""}Send it only if and when it feels right.</p>
            </section>
          ) : (
            <button onClick={handleCopy} className="w-full rounded-xl bg-[#15803d] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#166534] focus:outline-none focus:ring-2 focus:ring-[#15803d] focus:ring-offset-2">{copied ? "Copied" : "Copy this message"}</button>
          ))}

          {complete && <p className="rounded-xl border border-[#d8dfd0] bg-[#f4f7f0] px-4 py-3 text-sm leading-6 text-stone-700">Your connection plan is ready. You can take the next step whenever you choose.</p>}
          <div className="space-y-2 text-center">
            <button onClick={reset} className="text-xs text-stone-500 underline underline-offset-2 hover:text-stone-800">Discard and start again</button>
            {!user?.id && <p className="text-xs leading-5 text-stone-500">You can prepare this locally. Sign in to save structured progress.</p>}
          </div>

          <footer className="border-t border-stone-200 pt-4">
            <details className="text-xs leading-5 text-stone-600">
              <summary className="cursor-pointer font-medium text-stone-700">Need urgent support?</summary>
              <p className="mt-2">If you may be in immediate danger or unable to stay safe, contact local emergency services or a local crisis support service now. If possible, reach out to someone you trust and stay with them.</p>
            </details>
          </footer>
        </main>
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}
