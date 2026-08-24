import "./supportToolThemes.css";
import { useEffect, useState } from "react";
import { SUPPORT_TOOL_THEMES, resolveSupportToolTheme } from "./supportToolThemes";

const ADHD_PREFERENCES_KEY = "neurobridge-adhd-display-preferences";

function getAdhdPreferences() {
  try {
    return JSON.parse(localStorage.getItem(ADHD_PREFERENCES_KEY)) || { lowStimulation: false, reducedMotion: false, softColors: false };
  } catch {
    return { lowStimulation: false, reducedMotion: false, softColors: false };
  }
}

export default function SupportToolThemeProvider({ theme, override, children }) {
  const resolvedTheme = resolveSupportToolTheme(theme, override);
  const [adhdPreferences, setAdhdPreferences] = useState(getAdhdPreferences);
  const tokens = resolvedTheme ? SUPPORT_TOOL_THEMES[resolvedTheme] : null;
  const style = tokens ? {
    "--tool-background": tokens.background,
    "--tool-surface": tokens.surface,
    "--tool-surface-strong": tokens.surfaceStrong,
    "--tool-primary": tokens.primary,
    "--tool-primary-hover": tokens.primaryHover,
    "--tool-accent": tokens.accent,
    "--tool-text": tokens.text,
    "--tool-text-muted": tokens.textMuted,
    "--tool-border": tokens.border,
    "--tool-focus-ring": tokens.focusRing,
    "--tool-success": tokens.success,
    "--tool-warning": tokens.warning,
    "--tool-danger": tokens.danger,
  } : undefined;
  const updateAdhdPreference = (key) => {
    setAdhdPreferences((current) => {
      const next = { ...current, [key]: !current[key] };
      localStorage.setItem(ADHD_PREFERENCES_KEY, JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    if (resolvedTheme !== "adhd_focus") return undefined;
    document.documentElement.dataset.adhdReducedMotion = adhdPreferences.reducedMotion ? "true" : "false";
    return () => { delete document.documentElement.dataset.adhdReducedMotion; };
  }, [adhdPreferences.reducedMotion, resolvedTheme]);

  return (
    <div
      data-support-theme={resolvedTheme ?? "neutral"}
      data-adhd-low-stimulation={resolvedTheme === "adhd_focus" && adhdPreferences.lowStimulation ? "true" : "false"}
      data-adhd-soft-colors={resolvedTheme === "adhd_focus" && adhdPreferences.softColors ? "true" : "false"}
      className="support-tool-theme"
      style={style}
    >
      {resolvedTheme === "adhd_focus" && (
        <details className="adhd-display-controls">
          <summary>Display options</summary>
          <div>
            <button type="button" aria-pressed={adhdPreferences.lowStimulation} onClick={() => updateAdhdPreference("lowStimulation")}>Quiet mode</button>
            <button type="button" aria-pressed={adhdPreferences.softColors} onClick={() => updateAdhdPreference("softColors")}>Softer colors</button>
            <button type="button" aria-pressed={adhdPreferences.reducedMotion} onClick={() => updateAdhdPreference("reducedMotion")}>Reduce motion</button>
          </div>
        </details>
      )}
      {children}
    </div>
  );
}
