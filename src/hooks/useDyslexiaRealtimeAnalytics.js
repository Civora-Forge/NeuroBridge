import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export function useDyslexiaRealtimeAnalytics(userId) {
  const [analytics, setAnalytics] = useState({
    weekReadingSessions: 0,
    weekPhonologyEvents: 0,
    latestComfortScore: 0,
    timestamp: null,
  });

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return undefined;

    const fetchInitialData = async () => {
      try {
        const [sessionsRes, phonemeRes] = await Promise.all([
          supabase
            .from("reading_sessions")
            .select("reading_comfort_score")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("phoneme_errors")
            .select("error_count")
            .eq("user_id", userId),
        ]);

        const sessions = sessionsRes.data || [];
        const phonemes = phonemeRes.data || [];
        
        setAnalytics({
          weekReadingSessions: sessions.length,
          weekPhonologyEvents: phonemes.reduce((sum, p) => sum + (Number(p.error_count) || 0), 0),
          latestComfortScore: sessions[0]?.reading_comfort_score || 0,
          timestamp: Date.now(),
        });
        setConnected(true);
      } catch (err) {
        console.warn("Failed to load realtime analytics init", err);
      }
    };

    fetchInitialData();

    const channel = supabase
      .channel(`realtime-analytics-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reading_sessions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setAnalytics((prev) => ({
            ...prev,
            weekReadingSessions: prev.weekReadingSessions + 1,
            latestComfortScore: payload.new.reading_comfort_score || prev.latestComfortScore,
            timestamp: Date.now(),
          }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "phoneme_errors",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Simplistic count update
          fetchInitialData();
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setConnected(false);
    };
  }, [userId]);

  return { analytics, connected };
}

export default useDyslexiaRealtimeAnalytics;
