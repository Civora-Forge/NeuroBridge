'use client';

import React, { useRef, useState } from "react";
import { Share2, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
    Red: {
      label: "Red: No social energy",
      message:
        "Status: RED\n\nI am low on energy and may not be able to talk or respond right now. It is not about you. I will reply when I can.",
      explain: "You may need to rest without giving a detailed explanation.",
      suggestion: "Set an auto-response, silence notifications, choose one person you might update later."
    },
    Yellow: {
      label: "Yellow: Limited energy",
      message:
        "Status: YELLOW\n\nMy replies may be slow and short today. I still care. There is no need to fix anything.",
      explain: "You may be able to talk a little while keeping expectations low.",
      suggestion: "Reply with short check-ins, avoid big emotional conversations, schedule longer chats for another day."
    },
    Green: {
      label: "Green: Available",
      message:
        "Status: GREEN\n\nI can chat and respond today. Feel free to message or call. If I get tired, I will let you know.",
      explain: "Relatively steady energy. You can engage more, with permission to still set limits.",
      suggestion: "Use this time for light connection, planning, or asking for support you have been postponing."
    }
  };

  const palette = {
    Red: {
      bg: "from-rose-500/90 to-red-500/90",
      chip: "bg-rose-100 text-rose-800 border border-rose-200"
    },
    Yellow: {
      bg: "from-amber-400/90 to-orange-400/90",
      chip: "bg-amber-100 text-amber-800 border border-amber-200"
    },
    Green: {
      bg: "from-[hsl(142_72%_36%)]/90 to-[hsl(142_66%_42%)]/90",
      chip: "bg-emerald-100 text-emerald-800 border border-emerald-200"
    }
  };

  const handleCopy = async () => {
    if (!await start()) return;
    try {
      await navigator.clipboard.writeText(codes[status].message);
    } catch {
      return;
    }
    setCopied(true);
    setPrepared(true);
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.progress({ progressType: 'social_connection_prepared', completedUnits: 1, totalUnits: 2, progressRatio: 0.5 });
    setTimeout(() => setCopied(false), 1500);
  };
  const confirmReady = async () => { if (!prepared || complete || !await start()) return; if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.complete(buildSocialConnectionOutcome({ configuration, prepared: true, confirmed: true, startedAt: startedAtRef.current })); setComplete(true); };
  const reset = async () => { if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.abandon('user_discard', {}, buildSocialConnectionOutcome({ configuration, prepared, startedAt: startedAtRef.current })); lifecycle.reset(); setPrepared(false); setComplete(false); setCopied(false); };

  const shortBubble = {
    Red: "Low power: resting. Responses may be very slow.",
    Yellow: "Slow replies today. Please do not take it personally.",
    Green: "Available to chat, with breaks if I get tired."
  };

  return (
    <SupportToolThemeProvider theme="depression_gentle">
    <SupportToolLayout>
      {/* Header */}
      <motion.div
        className="space-y-2 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white px-4 py-2 rounded-2xl text-xs font-semibold shadow-lg">
           Social Connection
        </div>
        <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          Share your energy status
        </h1>
        <p className="text-xs md:text-sm text-gray-600 max-w-md mx-auto">
           Choose a status and copy a short message for friends, family, or work chats.
        </p>
      </motion.div>

      {/* Mode chips */}
      <div className="grid grid-cols-3 gap-2">
        {["Red", "Yellow", "Green"].map((m) => (
          <button
            key={m}
            className={`chip text-xs md:text-sm px-3 py-2 rounded-2xl font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
              status === m
                ? `chipActive bg-gradient-to-r ${palette[m].bg} text-white shadow-lg border-none`
                : `${palette[m].chip} hover:shadow-md`
            }`}
            onClick={async () => { if (!await start()) return; setStatus(m); if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.progress({ progressType: 'social_connection_selection', completedUnits: 0, totalUnits: 2, progressRatio: 0 }); }}
          >
            <span>{m}</span>
          </button>
        ))}
      </div>

      {/* Status card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="logCard rounded-3xl bg-white/95 border border-[hsl(142_72%_36%)]/10 shadow-xl p-5 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>{codes[status].label}</span>
          </div>

          <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-2xl p-3">
            {shortBubble[status]}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Info className="w-3 h-3" />
            <span>{codes[status].explain}</span>
          </div>

          <div className="text-[11px] text-gray-600 bg-[hsl(142_72%_36%)]/5 border border-[hsl(142_72%_36%)]/20 rounded-2xl p-3">
            <span className="font-semibold text-[hsl(142_72%_36%)] mr-1">Suggestion:</span>
            {codes[status].suggestion}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Preview of copied text */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-[11px] text-gray-700 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
        {codes[status].message}
      </div>

      {/* Copy button */}
      <motion.button
        className="secondaryButton w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[hsl(142_72%_36%)]/5 to-[hsl(142_66%_42%)]/5 border border-[hsl(142_72%_36%)]/40 rounded-2xl py-3 text-xs md:text-sm font-semibold text-[hsl(142_72%_36%)] hover:bg-white hover:shadow-xl"
        onClick={handleCopy}
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.97 }}
      >
        <Share2 size={16} />
        {copied ? "Copied!" : "Copy status message"}
      </motion.button>
      <button disabled={!prepared || complete} onClick={confirmReady} className="secondaryButton w-full rounded-2xl py-3 text-xs font-semibold disabled:opacity-50">Confirm connection plan is ready</button>
      <button onClick={reset} className="w-full text-xs text-gray-500">Discard and restart</button>
      {!user?.id && <p className="text-[11px] text-gray-500 text-center">You can prepare this locally. Sign in to save structured progress.</p>}

      <p className="text-[11px] text-gray-500 text-center">
         You can use these messages without adding a detailed explanation.
      </p>
    </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}
