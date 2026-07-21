import { useEffect, useState } from "react";
import { getAnalyticsStreamUrl } from "@/lib/dyslexiaApi";

export function useDyslexiaRealtimeAnalytics(userId) {
  const [analytics, setAnalytics] = useState({
    weekReadingSessions: 0,
    weekPhonologyEvents: 0,
    latestComfortScore: 0,
    timestamp: null,
  });

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;

    const eventSource = new EventSource(getAnalyticsStreamUrl(userId));

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setAnalytics(data);
      } catch {
        setConnected(false);
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, [userId]);

  return { analytics, connected };
}

export default useDyslexiaRealtimeAnalytics;
