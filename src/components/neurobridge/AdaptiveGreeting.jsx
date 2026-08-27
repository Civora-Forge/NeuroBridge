/**
 * AdaptiveGreeting.jsx — State-aware greeting that changes based on adaptive context.
 *
 * Shows different messages depending on the user's current state:
 *   - Normal: friendly, colorful, encouraging greeting
 *   - Prolonged activity: gentle suggestion to pause
 *   - Overload: simplified, calming message
 *   - Recovery: encouraging but restrained
 *
 * Consumes the anxiety reasoner's responseTier to determine which message
 * to show. Falls back to normal greeting when no signals are present.
 */

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import CompanionSticker from "./CompanionSticker";

const GREETINGS = {
  normal: [
    { text: "Hey, you're here!", sticker: "calm-cloud", mood: "calm", sub: "Everything is ready for you." },
    { text: "Welcome back, friend.", sticker: "calm-star", mood: "calm", sub: "What would help right now?" },
    { text: "Nice to see you!", sticker: "calm-leaf", mood: "calm", sub: "Let's take things one step at a time." },
    { text: "You made it here.", sticker: "calm-moon", mood: "calm", sub: "That already counts." },
  ],
  prolonged: [
    { text: "You've been going for a while.", sticker: "calm-moon", mood: "calm", sub: "A short reset might help." },
    { text: "Still here — that's great.", sticker: "calm-cloud", mood: "calm", sub: "But maybe a tiny break?" },
  ],
  overload: [
    { text: "Let's make things simpler.", sticker: "concern", mood: "concern", sub: "Just one thing at a time." },
    { text: "Things feel a bit busy.", sticker: "concern", mood: "concern", sub: "We can slow down together." },
  ],
  highAnxiety: [
    { text: "Let's pause for a moment.", sticker: "breathing", mood: "breathing", sub: "You only need to breathe right now." },
  ],
  recovery: [
    { text: "Feeling a little steadier?", sticker: "relaxed", mood: "relaxed", sub: "That's real progress." },
    { text: "Things are settling down.", sticker: "recovery-sprout", mood: "recovery", sub: "You're doing well." },
  ],
};

function pickGreeting(stateKey, seed = 0) {
  const options = GREETINGS[stateKey] || GREETINGS.normal;
  return options[seed % options.length];
}

function stateKeyFromTier(responseTier, isRecovering = false) {
  if (isRecovering) return "recovery";
  if (responseTier >= 3) return "highAnxiety";
  if (responseTier === 2) return "overload";
  if (responseTier === 1) return "prolonged";
  return "normal";
}

export default function AdaptiveGreeting({
  responseTier = 0,
  isRecovering = false,
  isProlonged = false,
  seed = 0,
  className = "",
}) {
  const stateKey = useMemo(
    () => stateKeyFromTier(responseTier, isRecovering),
    [responseTier, isRecovering]
  );

  const greeting = useMemo(
    () => pickGreeting(stateKey, seed),
    [stateKey, seed]
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stateKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`flex items-start gap-4 ${className}`}
      >
        <CompanionSticker
          variant={greeting.sticker}
          mood={greeting.mood}
          size={48}
          animate={false}
        />
        <div className="space-y-1 pt-1">
          <h2 className="text-[22px] font-black tracking-[-0.03em] text-[#1E2A5E] sm:text-[26px]">
            {greeting.text}
          </h2>
          <p className="text-[14px] font-medium text-[#6B7BA8] flex items-center gap-1.5">
            {greeting.sub}
            {responseTier === 0 && !isRecovering && (
              <Heart size={14} className="fill-[#818CF8] text-[#818CF8]" />
            )}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export { stateKeyFromTier, GREETINGS };
