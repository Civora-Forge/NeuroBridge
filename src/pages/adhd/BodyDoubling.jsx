'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Flame,
  Zap,
  Sparkles,
  ShieldCheck,
  Trophy,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";

const BodyDoubling = () => {
  const [isLive, setIsLive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [commitment, setCommitment] = useState('');
  const [showCommitmentToast, setShowCommitmentToast] = useState(false);
  const [showCommitmentReview, setShowCommitmentReview] = useState(false);

  const [recentActions] = useState([
    'Choose one task before starting.',
    'Keep your next step visible.',
    'Pause or end the session when needed.',
  ]);

  useEffect(() => {
    let interval;
    if (isLive) {
      interval = setInterval(() => {
        setSessionSeconds((s) => s + 1);
      }, 1000);
    }
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

  const stopSession = () => {
    setIsLive(false);
  };

  const minutes = Math.floor(sessionSeconds / 60).toString().padStart(2, '0');
  const seconds = (sessionSeconds % 60).toString().padStart(2, '0');

  return (
    <SupportToolThemeProvider theme="adhd_focus">
    <SupportToolLayout>
      {/* Header with Live Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex rounded-full bg-[#cce8e3] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#1f5e58]">One task. One visible timer.</div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-3 text-stone-900">
            <Users className="text-[#287d74] h-8 w-8" />
             Accountability Session
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
             Set one commitment and use a guided timer to stay with it.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#e8f4f1] px-4 py-2 rounded-full border border-[#a8d5ce] shadow-sm">
          <span className="relative flex h-3 w-3">
             <span className="relative inline-flex rounded-full h-3 w-3 bg-[#287d74]" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider">
             Personal timer
          </span>
        </div>
      </div>

      {/* Main Interaction Card */}
       <Card className="relative overflow-hidden border border-[#e7d7bf] bg-gradient-to-b from-[#fffdf7] via-[#f4fbf9] to-[#edf6ee] shadow-lg">
         <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#5fa89e]/10 rounded-full blur-3xl pointer-events-none" />
         <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-[#dceadf] rounded-full blur-3xl pointer-events-none" />

        <div className="p-6 md:p-8 space-y-8 relative z-10">
          {/* Timer Visual */}
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">
               Current session
            </div>
            <div
              className={`text-7xl md:text-8xl font-black tabular-nums transition-colors duration-500 ${
                 isLive ? 'text-[#287d74]' : 'text-muted-foreground/30'
              }`}
            >
              {minutes}
              <span>:</span>
              {seconds}
            </div>
            {isLive && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-[#287d74] font-bold text-sm"
              >
                <Activity className="h-4 w-4 animate-pulse" />
                 Session in progress
              </motion.div>
            )}
          </div>

          {/* Commitment Ritual */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold flex items-center gap-2">
                 <ShieldCheck className="h-4 w-4 text-[#287d74]" />
                My Commitment
              </label>
              <Badge
                variant="outline"
                 className="bg-[#cce8e3] border-[#a8d5ce] text-[#1f5e58] px-2 py-0"
              >
                 Keep it concrete
              </Badge>
            </div>

            <div className="relative group">
              <Textarea
                value={commitment}
                onChange={(e) => setCommitment(e.target.value)}
                disabled={isLive}
                className="min-h-[100px] rounded-2xl border border-[#e7d7bf] bg-[#fffdf7] focus:border-[#285943] focus:ring-2 focus:ring-[#dceadf] transition-colors resize-none p-4 text-base shadow-inner"
                placeholder="What is your one focus? Example: Finish the assignment draft."
              />
              {!isLive && (
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground font-medium italic">
                  Clear goals prevent distraction
                </div>
              )}
            </div>

            <AnimatePresence>
              {showCommitmentToast && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-500 text-xs font-bold text-center"
                >
                  Please set a commitment before starting.
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Action Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {!isLive ? (
              <Button
                onClick={startSession}
                size="lg"
                className="h-14 rounded-2xl text-lg font-bold shadow-lg shadow-[#285943]/20 bg-[#285943] hover:bg-[#1d4332] transition-colors"
              >
                <Flame className="mr-2 h-5 w-5" />
                 Start session
              </Button>
            ) : (
              <Button
                onClick={stopSession}
                variant="outline"
                size="lg"
                className="h-14 rounded-2xl text-lg font-bold border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all"
              >
                End Session
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={() => setShowCommitmentReview((visible) => !visible)}
              size="lg"
               className="h-14 rounded-2xl text-lg font-bold bg-[#cce8e3] hover:bg-[#b8ddd6] border border-[#a8d5ce] shadow-sm flex items-center justify-center text-[#174740]"
            >
                <Users className="mr-2 h-5 w-5 text-slate-950" />
                {showCommitmentReview ? 'Hide commitment' : 'Review commitment'}
            </Button>
          </div>
        </div>
      </Card>

      {showCommitmentReview && (
         <div className="rounded-2xl border border-[#a8d5ce] bg-[#e8f4f1] px-4 py-3 text-sm text-[#174740]">
           <span className="font-black uppercase tracking-wider text-[10px] text-[#287d74]">Your focus</span>
          <p className="mt-1 font-medium">{commitment.trim() || 'Add a commitment before you begin.'}</p>
        </div>
      )}

      {/* Ambient Social Presence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <Card className="p-4 bg-[#f4fbf9] border border-[#cce8e3] shadow-sm space-y-3 rounded-2xl">
           <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-[#287d74]">
             <Zap className="h-3 w-3 text-[#287d74]" />
             Session notes
          </h3>
          <div className="space-y-2 overflow-hidden h-24 relative">
            <AnimatePresence mode="popLayout">
              {recentActions.map((action) => (
                <motion.div
                  key={action}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-xs text-muted-foreground py-1 border-l-2 border-teal-400/40 pl-3 flex items-center gap-2 bg-white/60 rounded-r-md"
                >
                  <Sparkles className="h-3 w-3 text-yellow-400" />
                  {action}
                </motion.div>
              ))}
            </AnimatePresence>
            <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-background/0 to-transparent pointer-events-none" />
          </div>
        </Card>

         <Card className="p-4 bg-[#edf6ee] border border-[#dceadf] shadow-sm space-y-3 rounded-2xl">
           <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-[#285943]">
             <Trophy className="h-3 w-3 text-[#285943]" />
             Session reminders
          </h3>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-white text-[10px] py-0 px-2 border border-cyan-200 text-cyan-700">
               Keep the next step small
            </Badge>
            <Badge className="bg-white text-[10px] py-0 px-2 border border-cyan-200 text-cyan-700">
               Pause when you need to
            </Badge>
            <Badge className="bg-white text-[10px] py-0 px-2 border border-cyan-200 text-cyan-700">
               Return when you are ready
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground font-medium">This is a private, local timer. No one else joins this session.</p>
        </Card>
      </div>

      {/* Footer Meta */}
      <p className="text-center text-[10px] text-muted-foreground/70 font-medium px-8 leading-relaxed">
         Use this manual timer and commitment prompt as a personal accountability aid.
      </p>
    </SupportToolLayout>
    </SupportToolThemeProvider>
  );
};

export default BodyDoubling;
