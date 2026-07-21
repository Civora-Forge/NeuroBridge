'use client';

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const cognitiveDistortions = {
  "all or nothing": {
    original: "All-or-nothing thinking",
    explanation: "Seeing things in black-and-white categories. If your performance falls short of perfect, you see yourself as a total failure.",
    questions: [
      "Is there middle ground between success/failure?",
      "What evidence supports a balanced view?",
      "Have I ever succeeded without being perfect?"
    ],
    reframe: "I'm making progress, even if imperfect"
  },
  "overgeneralizing": {
    original: "Overgeneralizing", 
    explanation: "Seeing a single negative event as a never-ending pattern.",
    questions: [
      "Is this always true, or just this once?",
      "What are counterexamples from my life?",
      "Does one setback define my entire ability?"
    ],
    reframe: "This is one instance, not my whole story"
  },
  "mental filter": {
    original: "Mental filter",
    explanation: "Picking out a single negative detail and dwelling on it exclusively.",
    questions: [
      "What positive aspects am I ignoring?",
      "Is this detail the whole picture?",
      "How would I view this if it happened to a friend?"
    ],
    reframe: "I'm focusing on the full picture now"
  },
  "disqualifying positive": {
    original: "Disqualifying the positive",
    explanation: "Rejecting positive experiences by insisting they 'don't count'.",
    questions: [
      "Why don't these positives count?",
      "What evidence supports accepting them?",
      "Am I holding myself to impossible standards?"
    ],
    reframe: "My achievements are real and valid"
  },
  "jumping conclusions": {
    original: "Jumping to conclusions",
    explanation: "Making negative interpretations without evidence (mind reading/fortune telling).",
    questions: [
      "What actual evidence do I have?",
      "Am I assuming others' thoughts?",
      "What's the most likely reality?"
    ],
    reframe: "I'll stick to what I actually know"
  },
  "magnification": {
    original: "Magnification & minimization",
    explanation: "Making problems bigger and successes smaller than they are.",
    questions: [
      "Am I blowing this out of proportion?",
      "How would I rate this on a 1-10 scale realistically?",
      "What's a balanced perspective?"
    ],
    reframe: "This challenge is manageable"
  },
  "emotional reasoning": {
    original: "Emotional reasoning",
    explanation: "Believing feelings are evidence of truth.",
    questions: [
      "Are my feelings facts?",
      "What evidence contradicts my emotions?",
      "Can I feel this way AND be wrong?"
    ],
    reframe: "Feelings aren't always reality"
  },
  "should statements": {
    original: "Should statements",
    explanation: "Motivating with 'shoulds', creating guilt and frustration.",
    questions: [
      "What would 'want to' sound like instead?",
      "Is this expectation realistic?",
      "How can I be kinder to myself?"
    ],
    reframe: "I'll aim for progress, not perfection"
  },
  "labeling": {
    original: "Labeling & mislabeling",
    explanation: "Identifying with a behavior instead of the specific action.",
    questions: [
      "Am I human with flaws, or defined by one mistake?",
      "What specific behavior occurred?",
      "How would I describe a friend in this situation?"
    ],
    reframe: "I made a mistake, I'm not a mistake"
  },
  "personalization": {
    original: "Personalization",
    explanation: "Holding yourself responsible for events outside your control.",
    questions: [
      "What was actually in my control?",
      "Am I taking more responsibility than needed?",
      "What factors contributed besides me?"
    ],
    reframe: "I control my response, not everything"
  }
};

export default function CognitiveReframer() {
  const [thought, setThought] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [showReframe, setShowReframe] = useState(false);
  const textareaRef = React.useRef(null);

  const analyzeThought = () => {
    if (!thought.trim()) return;
    
    const lowerThought = thought.toLowerCase();
    let bestMatch = null;
    let highestScore = 0;

    Object.entries(cognitiveDistortions).forEach(([key, distortion]) => {
      const score = lowerThought.split(' ').filter(word => 
        key.includes(word) || distortion.original.toLowerCase().includes(word)
      ).length;
      
      if (score > highestScore) {
        highestScore = score;
        bestMatch = distortion;
      }
    });

    setAnalysis(bestMatch || {
      original: "Unidentified Pattern",
      explanation: "Your thought doesn't match classic distortions, but the reframing process still applies.",
      questions: ["What's the evidence for/against this?", "What's a more balanced view?", "How would I advise a friend?"],
      reframe: "I'm practicing clearer thinking"
    });
    setShowReframe(true);
    textareaRef.current?.blur();
  };

  const clearAnalysis = () => {
    setAnalysis(null);
    setShowReframe(false);
    setThought("");
    textareaRef.current?.focus();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-6 md:p-8">
      
      {/* Header */}
      <motion.div 
        className="text-center mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white px-8 py-4 rounded-3xl font-bold text-xl shadow-2xl mb-6">
          ðŸ§  Reality Filter
        </div>
        <h1 className="text-4xl font-black bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent tracking-tight">
          Cognitive Distortion Detector
        </h1>
        <p className="text-lg text-gray-600 mt-2 font-medium max-w-md mx-auto">
          Write your anxious thought. AI detects distortions & provides evidence-based reframes.
        </p>
      </motion.div>

      {/* Input */}
      <motion.div className="relative" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <textarea
          ref={textareaRef}
          className="w-full fieldTextarea resize-none p-8 rounded-3xl bg-white/80 backdrop-blur-sm border-2 border-[hsl(142_72%_36%)]/20 focus:border-[hsl(142_72%_36%)]/40 focus:ring-4 focus:ring-[hsl(142_72%_36%)]/10 transition-all duration-300 text-lg placeholder-gray-500 min-h-[120px] shadow-xl hover:shadow-2xl"
          value={thought}
          onChange={(e) => {
            setThought(e.target.value);
            setShowReframe(false);
          }}
          placeholder="I'm such a failure... I'll never succeed... Everyone hates me..."
          rows={3}
        />
        <motion.button
          onClick={analyzeThought}
          className="absolute bottom-4 right-4 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white px-8 py-3 rounded-2xl font-bold shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 border border-[hsl(142_72%_36%)]/50"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          ðŸ” Analyze Thought
        </motion.button>
      </motion.div>

      {/* Analysis Results */}
      <AnimatePresence>
        {showReframe && analysis && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: 20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Detected Distortion */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-3xl p-8 backdrop-blur-sm shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl flex items-center justify-center shadow-xl">
                  <span className="text-2xl">âš ï¸</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900">{analysis.original}</h3>
                  <p className="text-gray-700 font-medium mt-1">Detected cognitive distortion</p>
                </div>
              </div>
              <p className="text-lg text-gray-700 leading-relaxed">{analysis.explanation}</p>
            </motion.div>

            {/* Evidence Questions */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-[hsl(142_72%_36%)]/20"
            >
              <h4 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <span className="w-10 h-10 bg-[hsl(142_72%_36%)] text-white rounded-xl flex items-center justify-center font-bold shadow-lg">?</span>
                Challenge with evidence:
              </h4>
              <div className="space-y-4">
                {analysis.questions.map((question, idx) => (
                  <motion.div
                    key={idx}
                    className="flex items-start gap-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border-l-4 border-blue-400 hover:shadow-md transition-all"
                    whileHover={{ x: 4 }}
                  >
                    <span className="text-blue-600 font-bold mt-1">Q{idx + 1}</span>
                    <p className="text-gray-800 leading-relaxed">{question}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Healthy Reframe */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-3xl p-8 backdrop-blur-sm shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                <span className="text-3xl">âœ…</span>
              </div>
              <h3 className="text-2xl font-black text-emerald-800 mb-4">Healthy Reframe</h3>
              <blockquote className="text-xl font-semibold text-gray-800 italic bg-white/60 px-6 py-4 rounded-2xl shadow-inner">
                "{analysis.reframe}"
              </blockquote>
            </motion.div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <motion.button
                onClick={clearAnalysis}
                className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 text-white py-4 px-8 rounded-2xl font-bold shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                âœï¸ New Thought
              </motion.button>
              <motion.button
                onClick={() => {
                  navigator.clipboard.writeText(`"${thought}" â†’ ${analysis.original} â†’ "${analysis.reframe}"`);
                }}
                className="px-8 py-4 bg-white/90 hover:bg-white text-gray-800 backdrop-blur-sm rounded-2xl font-bold shadow-xl border border-gray-200 hover:border-[hsl(142_72%_36%)]/30 hover:shadow-2xl hover:scale-105 transition-all duration-300"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                ðŸ“‹ Copy Reframe
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showReframe && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 text-gray-500"
        >
          <div className="w-24 h-24 bg-gradient-to-r from-[hsl(142_72%_36%)]/10 to-[hsl(142_66%_42%)]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <span className="text-3xl">ðŸ”</span>
          </div>
          <p className="text-lg font-medium">Write any anxious or negative thought above â†’ Get instant CBT analysis & healthy reframes</p>
        </motion.div>
      )}
    </div>
  );
}
