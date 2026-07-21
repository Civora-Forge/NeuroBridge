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

const BodyDoubling = () => {
  const [isLive, setIsLive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [commitment, setCommitment] = useState('');
  const [activePeers, setActivePeers] = useState(12);
  const [showCommitmentToast, setShowCommitmentToast] = useState(false);

  const [recentActions] = useState([
    'Sarah just crushed a 25m session!',
    'Alex is focusing on "Design Specs"',
    '4 people just joined the flow state',
  ]);

  useEffect(() => {
    let interval;
    if (isLive) {
      interval = setInterval(() => {
        setSessionSeconds((s) => s + 1);
        if (Math.random() > 0.8) {
          setActivePeers((prev) =>
            Math.max(5, prev + (Math.random() > 0.5 ? 1 : -1))
          );
        }
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
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Header with Live Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-3 bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent">
            <Users className="text-teal-500 h-8 w-8" />
            Body Doubling
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Flow better together. Join {activePeers} others in the zone.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-teal-500/5 px-4 py-2 rounded-full border border-teal-500/30 shadow-sm">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider">
            {activePeers} Active Now
          </span>
        </div>
      </div>

      {/* Main Interaction Card */}
      <Card className="relative overflow-hidden border-2 border-teal-500/10 bg-gradient-to-b from-white/80 via-teal-50/40 to-cyan-50/40 backdrop-blur-xl shadow-2xl transition-all duration-500 hover:border-teal-500/25">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-teal-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none" />

        <div className="p-6 md:p-8 space-y-8 relative z-10">
          {/* Timer Visual */}
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">
              Current Sprint
            </div>
            <div
              className={`text-7xl md:text-8xl font-black tabular-nums transition-colors duration-500 ${
                isLive ? 'text-teal-500' : 'text-muted-foreground/30'
              }`}
            >
              {minutes}
              <span className="animate-pulse">:</span>
              {seconds}
            </div>
            {isLive && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-teal-600 font-medium text-sm"
              >
                <Activity className="h-4 w-4 animate-pulse" />
                In the flow state
              </motion.div>
            )}
          </div>

          {/* Commitment Ritual */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-500" />
                My Commitment
              </label>
              <Badge
                variant="outline"
                className="bg-teal-500/5 border-teal-500/30 text-teal-600 px-2 py-0"
              >
                ADHD-Friendly Ritual
              </Badge>
            </div>

            <div className="relative group">
              <Textarea
                value={commitment}
                onChange={(e) => setCommitment(e.target.value)}
                disabled={isLive}
                className="min-h-[100px] rounded-2xl border-2 border-border bg-white/70 focus:border-teal-500/70 focus:ring-2 focus:ring-teal-500/20 transition-all resize-none p-4 text-base shadow-inner"
                placeholder="What is your one focus? Example: “Finish the OS assignment draft, phone in the other room.”"
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
                  ⚠ Please set a commitment before starting!
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
                className="h-14 rounded-2xl text-lg font-bold shadow-lg shadow-teal-500/30 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 hover:brightness-105 hover:shadow-2xl transition-all"
              >
                <Flame className="mr-2 h-5 w-5" />
                Enter Focus Room
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
              size="lg"
              className="h-14 rounded-2xl text-lg font-bold bg-white/70 hover:bg-white border border-teal-500/20 shadow-sm flex items-center justify-center"
            >
              <Users className="mr-2 h-5 w-5 text-teal-500" />
              Invite Doubler
            </Button>
          </div>
        </div>
      </Card>

      {/* Ambient Social Presence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 bg-teal-500/5 border border-teal-100 shadow-sm space-y-3 rounded-2xl">
          <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-teal-600">
            <Zap className="h-3 w-3 text-teal-500" />
            Live Pulse
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

        <Card className="p-4 bg-cyan-500/5 border border-cyan-100 shadow-sm space-y-3 rounded-2xl">
          <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-cyan-700">
            <Trophy className="h-3 w-3 text-cyan-600" />
            Community Milestones
          </h3>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-white text-[10px] py-0 px-2 border border-cyan-200 text-cyan-700">
              1.2k Focus Hours Today
            </Badge>
            <Badge className="bg-white text-[10px] py-0 px-2 border border-cyan-200 text-cyan-700">
              89% Goal Success Rate
            </Badge>
            <Badge className="bg-white text-[10px] py-0 px-2 border border-cyan-200 text-cyan-700">
              New: "Night Owl" Badge
            </Badge>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-6 w-6 rounded-full border-2 border-background bg-slate-100 flex items-center justify-center text-[8px] font-bold"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground ml-2 font-medium">
              Joined by 840+ doublers this week
            </span>
          </div>
        </Card>
      </div>

      {/* Footer Meta */}
      <p className="text-center text-[10px] text-muted-foreground/70 font-medium px-8 leading-relaxed">
        Body doubling is an ADHD coping mechanism where a person works more effectively while
        another person is present. FocusForge mimics this ambient social presence to trigger your
        brain&apos;s &quot;get to work&quot; response.
      </p>
    </div>
  );
};

export default BodyDoubling;
