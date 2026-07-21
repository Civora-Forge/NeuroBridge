'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const tools = [
  { to: '/adhd/timeline', title: 'ðŸ• Visual Timeline', desc: 'Icon schedules beat time blindness' },
  { to: '/adhd/breakdown', title: 'âœ¨ Task Breakdown', desc: 'AI splits overwhelming tasks' },
  { to: '/adhd/focus', title: 'ðŸŒ³ Focus Sessions', desc: 'Gamified Pomodoro with rewards' },
  { to: '/adhd/sounds', title: 'ðŸŽ§ Soundscapes', desc: 'Adaptive audio for focus/sleep' },
  { to: '/adhd/doubling', title: 'ðŸ‘¥ Body Doubling', desc: 'Accountability timers' },
  { to: '/adhd/emotion-coach', title: 'ðŸ§­ Emotion Coach', desc: 'Mood check-ins with tiny coping steps' },
];

export default function ADHDDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-[hsl(142_72%_36%)]/5 to-blue-50 p-8">
      <div className="max-w-5xl mx-auto text-center mb-16">
        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] flex items-center justify-center shadow-2xl">
          <Zap className="w-12 h-12 text-white drop-shadow-lg" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-[hsl(142_72%_36%)] via-[hsl(142_66%_42%)] to-blue-600 bg-clip-text text-transparent mb-3">
          ADHD Hub
        </h1>
        <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
          6 neurodivergent supertools to outsource executive function and make focus, time, and emotion feel less hostile.
        </p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map(({ to, title, desc }) => {
          const emoji = title.split(' ')[0];
          const label = title.split(' ').slice(1).join(' ');
          return (
            <Link
              key={to}
              to={to}
              className="group relative bg-white/80 backdrop-blur-md border border-white/70 rounded-3xl p-7 flex flex-col items-start gap-4 shadow-lg hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.01] transition-all duration-300 overflow-hidden"
            >
              <div className="absolute -top-10 -right-10 w-28 h-28 bg-[hsl(142_72%_36%)]/10 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(142_72%_36%)]/15 to-[hsl(142_66%_42%)]/10 flex items-center justify-center text-2xl">
                {emoji}
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-[hsl(142_72%_36%)] transition-colors">
                  {label}
                </h3>
                <p className="text-sm text-gray-600">
                  {desc}
                </p>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white px-4 py-2 rounded-2xl text-xs font-semibold tracking-wide shadow-md group-hover:shadow-lg group-hover:translate-y-[-1px] transition-all">
                Launch Tool â†’
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
