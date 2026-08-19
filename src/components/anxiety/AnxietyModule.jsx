/**
 * AnxietyModule.jsx — Backward-compatible wrapper mounting the Adaptive Anxiety Engine
 * and integrating with guardian care synchronization.
 */

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import AdaptiveAnxietyEngine from "./AdaptiveAnxietyEngine";

export default function AnxietyModule() {
  const { user } = useAuth();
  const userId = user?.id || "anon";

  return (
    <div className="w-full">
      <AdaptiveAnxietyEngine />
    </div>
  );
}
