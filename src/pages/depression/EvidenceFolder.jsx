'use client';

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Shield, Star, TrendingUp, Award, Heart } from "lucide-react";

const evidenceCategories = {
  survival: { icon: <Shield className="w-4 h-4" />, label: "Survival", hint: "I got through something hard" },
  growth: { icon: <TrendingUp className="w-4 h-4" />, label: "Growth", hint: "I learned / improved" },
  social: { icon: <Heart className="w-4 h-4" />, label: "Connection", hint: "Someone cared / responded" },
  achievement: { icon: <Award className="w-4 h-4" />, label: "Achievement", hint: "I finished or started something" },
  selfworth: { icon: <Star className="w-4 h-4" />, label: "Self-worth", hint: "I showed kindness to myself" }
};

export default function EvidenceFolder() {
  const [items, setItems] = useState([]);
  const [input, setInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("survival");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  // load saved
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("evidence-folder-v1") : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setItems(parsed);
      } catch {}
    }
  }, []);

  // persist
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("evidence-folder-v1", JSON.stringify(items));
    }
  }, [items]);

  const add = () => {
    if (!input.trim()) return;
    const now = new Date().toISOString();
    setItems([
      {
        id: Date.now(),
        text: input.trim(),
        category: selectedCategory,
        createdAt: now,
        starred: false
      },
      ...items
    ]);
    setInput("");
  };

  const toggleStar = (id) => {
    setItems(items.map(i => i.id === id ? { ...i, starred: !i.starred } : i));
  };

  const remove = (id) => {
    setItems(items.filter(i => i.id !== id));
  };

  const filtered = items.filter(i => {
    const matchesText = i.text.toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCat === "all" || i.category === filterCat;
    return matchesText && matchesCat;
  });

  const total = items.length;
  const perCat = Object.keys(evidenceCategories).reduce((acc, key) => {
    acc[key] = items.filter(i => i.category === key).length;
    return acc;
  }, {});
  const mostUsedCat = Object.entries(perCat).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-6 md:p-8">
      {/* Header */}
      <motion.div
        className="text-center space-y-4"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white px-7 py-3 rounded-3xl font-bold shadow-2xl">
          <Brain className="w-5 h-5" />
          Evidence Folder
        </div>
        <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          Proof your brain is lying
        </h1>
        <p className="text-gray-600 max-w-xl mx-auto text-sm md:text-base">
          When depression says â€œyou never do enoughâ€, open this folder and show it hundreds of receipts.
        </p>
      </motion.div>

      {/* Stats strip */}
      <motion.div
        className="grid md:grid-cols-3 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-white/60">
          <div className="text-xs font-semibold text-gray-500 mb-1">Total evidence</div>
          <div className="text-3xl font-black text-[hsl(142_72%_36%)]">{total}</div>
        </div>
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-5 shadow-lg border border-emerald-100">
          <div className="text-xs font-semibold text-emerald-700 mb-1">Strongest area</div>
          <div className="text-sm font-bold text-emerald-900">
            {mostUsedCat ? evidenceCategories[mostUsedCat].label : "Start logging"}
          </div>
        </div>
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-white/60">
          <div className="text-xs font-semibold text-gray-500 mb-1">Starred â€œgoâ€‘toâ€ proofs</div>
          <div className="text-3xl font-black text-yellow-500">
            {items.filter(i => i.starred).length}
          </div>
        </div>
      </motion.div>

      {/* Input + category */}
      <motion.div
        className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-2xl border border-[hsl(142_72%_36%)]/15 space-y-4"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-gray-500">
            Log one tiny piece of evidence that your brain is underestimating you.
          </span>
        </div>

        <textarea
          className="w-full fieldTextarea resize-none rounded-2xl border-2 border-gray-200 bg-white/90 p-4 text-sm md:text-base focus:border-[hsl(142_72%_36%)] focus:ring-4 focus:ring-[hsl(142_72%_36%)]/15 transition-all"
          rows={3}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="I still showed up to class even though I felt awfulâ€¦"
        />

        <div className="grid md:grid-cols-[2fr,1fr] gap-3 items-center">
          <div className="flex flex-wrap gap-2">
            {Object.entries(evidenceCategories).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedCategory(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs font-semibold transition-all ${
                  selectedCategory === key
                    ? "bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white border-[hsl(142_72%_36%)] shadow-lg"
                    : "bg-white/80 text-gray-700 border-gray-200 hover:border-[hsl(142_72%_36%)]/40"
                }`}
              >
                {cfg.icon}
                <span>{cfg.label}</span>
              </button>
            ))}
          </div>

          <motion.button
            type="button"
            onClick={add}
            disabled={!input.trim()}
            className="primaryButton w-full bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white rounded-2xl py-3 text-sm md:text-base font-bold shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={input.trim() ? { y: -2, scale: 1.01 } : {}}
            whileTap={input.trim() ? { scale: 0.97 } : {}}
          >
            Log evidence
          </motion.button>
        </div>

        <p className="text-[11px] text-gray-500">
          Tip: Aim for 1â€“3 logs per day, no matter how small. Futureâ€‘you will thank you.
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        className="flex flex-col md:flex-row md:items-center gap-3 justify-between"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterCat("all")}
            className={`px-3 py-1 rounded-2xl text-xs font-semibold border ${
              filterCat === "all"
                ? "bg-[hsl(142_72%_36%)] text-white border-[hsl(142_72%_36%)]"
                : "bg-white/80 text-gray-700 border-gray-200"
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
                  ? "bg-[hsl(142_72%_36%)] text-white border-[hsl(142_72%_36%)]"
                  : "bg-white/80 text-gray-700 border-gray-200"
              }`}
            >
              {cfg.label} ({perCat[key] || 0})
            </button>
          ))}
        </div>

        <input
          className="fieldInput w-full md:w-64 bg-white/90 border-2 border-gray-200 rounded-2xl px-3 py-2 text-xs md:text-sm focus:border-[hsl(142_72%_36%)] focus:ring-2 focus:ring-[hsl(142_72%_36%)]/20"
          placeholder="Search your receiptsâ€¦"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </motion.div>

      {/* List */}
      <AnimatePresence>
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            className="text-center py-16 bg-white/70 rounded-3xl border border-dashed border-[hsl(142_72%_36%)]/30"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[hsl(142_72%_36%)]/10 to-[hsl(142_66%_42%)]/10 flex items-center justify-center">
              <Shield className="w-10 h-10 text-[hsl(142_72%_36%)]" />
            </div>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              This folder will become your case against depression. Start by logging one tiny proof right now.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {filtered.map((i) => {
              const cfg = evidenceCategories[i.category];
              return (
                <motion.div
                  key={i.id}
                  className="group bg-white/95 backdrop-blur-sm rounded-3xl p-4 md:p-5 shadow-lg border border-white/70 hover:border-[hsl(142_72%_36%)]/35 hover:-translate-y-0.5 transition-all"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0">
                      <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-[hsl(142_72%_36%)]/15 to-[hsl(142_66%_42%)]/10 flex items-center justify-center text-[hsl(142_72%_36%)]">
                        {cfg?.icon}
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          {cfg?.label}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(i.createdAt).toLocaleDateString()} â€¢{" "}
                          {new Date(i.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm md:text-base text-gray-800 leading-relaxed">
                        {i.text}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => toggleStar(i.id)}
                        className="p-1 rounded-xl hover:bg-yellow-50"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            i.starred ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(i.id)}
                        className="text-[11px] text-red-400 hover:text-red-500"
                      >
                        delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
