import { useState, useCallback } from "react";
import {
  calculateDynamicPhonemeErrors,
  identifyWeaknesses,
  calculatePhonologicalScore,
} from "@/lib/phonologicalAnalysis";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

/**
 * Hook for advanced phonological analysis
 */
export function usePhonologicalAnalysis(userId) {
  const [analysisResult, setAnalysisResult] = useState(null);
  const [score, setScore] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadHistoricalPhonemeErrors = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      return {};
    }

    const { data, error: historyError } = await supabase
      .from("phoneme_errors")
      .select("phoneme, error_count")
      .eq("user_id", userId);

    if (historyError) {
      console.warn("Unable to load historical phoneme errors:", historyError.message);
      return {};
    }

    return (data ?? []).reduce((acc, row) => {
      if (!row?.phoneme) return acc;
      acc[row.phoneme] = Number(row.error_count) || 0;
      return acc;
    }, {});
  }, [userId]);

  /**
   * Analyze text for phoneme weaknesses
   */
  const analyzeText = useCallback(
    async (text) => {
      if (!text || !text.trim()) {
        setError("Text cannot be empty");
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const words = text
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.match(/[a-z]/i));

        if (!words.length) {
          setError("No valid words found for analysis");
          return;
        }

        const historicalErrors = await loadHistoricalPhonemeErrors();
        const { phonemeFreq, phonemeErrors, metadata } =
          calculateDynamicPhonemeErrors(words, historicalErrors);

        const weaknesses = identifyWeaknesses(phonemeErrors);
        const phonScore = calculatePhonologicalScore(
          phonemeErrors,
          phonemeFreq,
          historicalErrors,
        );

        setAnalysisResult({
          words: words.length,
          phonemeFreq,
          phonemeErrors,
          weaknesses,
          metadata: {
            ...metadata,
            historicalPhonemesUsed: Object.keys(historicalErrors).length,
          },
        });

        setScore(phonScore);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed");
      } finally {
        setIsLoading(false);
      }
    },
    [loadHistoricalPhonemeErrors]
  );

  const reset = useCallback(() => {
    setAnalysisResult(null);
    setScore(null);
    setError(null);
  }, []);

  return {
    analysisResult,
    score,
    isLoading,
    error,
    analyzeText,
    reset,
  };
}

export default usePhonologicalAnalysis;
