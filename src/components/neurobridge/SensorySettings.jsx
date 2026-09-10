/**
 * SensorySettings.jsx — Module-specific sensory preferences for ASD + Anxiety.
 *
 * Provides controls for:
 *   - Visual intensity (Simple / Comfortable / Expressive)
 *   - Animation (Off / Reduced / Normal)
 *   - Interface density (Simple / Standard)
 *
 * Persists to localStorage under a module-scoped key.
 * Reads from and writes to a data attribute on the wrapper element
 * so CSS can respond to these preferences.
 */

import { useState, useEffect, useCallback, useId } from "react";
import { Settings, Eye, Sparkles, LayoutGrid, ChevronDown, ChevronUp, Type } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PRESETS, DEFAULT_PRESET_ID, matchPresetId } from "@/lib/presentationPresets";
import { PREFERENCES_CHANGED_EVENT } from "@/lib/presentationPreferences";

const STORAGE_KEY = "neurobridge-sensory-preferences";

const DEFAULTS = {
  visualIntensity: "comfortable",
  animation: "normal",
  density: "standard",
  textScale: "normal",
};

function loadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function savePreferences(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* silent */
  }
}

function SegmentedControl({ value, onChange, options, icon: Icon, label }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {Icon && <Icon size={13} />}
        {label}
      </div>
      <div className="flex gap-1 rounded-xl bg-secondary p-1 border border-border">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              value === opt.value
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SensorySettings({ moduleKey = "global", className = "" }) {
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [prefs, setPrefs] = useState(loadPreferences);
  const panelId = useId();
  // Respects the OS-level reduce-motion preference on top of the app's own
  // Animation setting — this panel's own expand/collapse shouldn't move if
  // the user (or their OS) has said motion should be minimized.
  const prefersReducedMotion = useReducedMotion();

  const update = useCallback(
    (key, val) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: val };
        savePreferences(next);
        return next;
      });
    },
    []
  );

  const applyPreset = useCallback((presetId) => {
    const preset = PRESETS[presetId];
    if (!preset) return;
    setPrefs(() => {
      const next = { ...preset.values };
      savePreferences(next);
      return next;
    });
  }, []);

  // If the agent applies a preset (from any page, via presentationPreferences.js)
  // while this panel happens to be open, reflect that change here too instead
  // of silently showing a stale selection.
  useEffect(() => {
    const onExternalChange = (e) => setPrefs(e.detail ?? loadPreferences());
    window.addEventListener(PREFERENCES_CHANGED_EVENT, onExternalChange);
    return () => window.removeEventListener(PREFERENCES_CHANGED_EVENT, onExternalChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    // Must match the attribute name supportToolThemes.css actually selects on
    // ([data-sensory-visual-intensity=...]) — this was previously written as
    // `sensoryVisual` (-> data-sensory-visual), which the CSS never matched,
    // so the Visual Intensity control silently did nothing.
    root.dataset.sensoryVisualIntensity = prefs.visualIntensity;
    root.dataset.sensoryAnimation = prefs.animation;
    root.dataset.sensoryDensity = prefs.density;
    root.dataset.sensoryTextScale = prefs.textScale ?? "normal";

    if (prefs.animation === "off") {
      root.classList.add("sensory-no-animation");
    } else {
      root.classList.remove("sensory-no-animation");
    }
  }, [prefs]);

  const activePresetId = matchPresetId(prefs) ?? DEFAULT_PRESET_ID;

  return (
    <div className={`rounded-2xl border border-border bg-card/80 backdrop-blur ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings size={14} aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold text-foreground">How this looks and feels</span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border px-4 py-4">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Pick what helps
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(PRESETS).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      aria-pressed={activePresetId === preset.id}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        activePresetId === preset.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:bg-secondary"
                      }`}
                    >
                      <div className="text-xs font-bold text-foreground">{preset.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                {showAdvanced ? "Hide advanced controls" : "Show advanced controls"}
              </button>

              {showAdvanced && (
                <div className="space-y-4 pt-1">
                  <SegmentedControl
                    label="Visual Intensity"
                    icon={Eye}
                    value={prefs.visualIntensity}
                    onChange={(v) => update("visualIntensity", v)}
                    options={[
                      { value: "simple", label: "Simple" },
                      { value: "comfortable", label: "Comfortable" },
                      { value: "expressive", label: "Expressive" },
                    ]}
                  />
                  <SegmentedControl
                    label="Animation"
                    icon={Sparkles}
                    value={prefs.animation}
                    onChange={(v) => update("animation", v)}
                    options={[
                      { value: "off", label: "Off" },
                      { value: "reduced", label: "Reduced" },
                      { value: "normal", label: "Normal" },
                    ]}
                  />
                  <SegmentedControl
                    label="Interface Density"
                    icon={LayoutGrid}
                    value={prefs.density}
                    onChange={(v) => update("density", v)}
                    options={[
                      { value: "simple", label: "Simple" },
                      { value: "standard", label: "Standard" },
                    ]}
                  />
                  <SegmentedControl
                    label="Text Size"
                    icon={Type}
                    value={prefs.textScale ?? "normal"}
                    onChange={(v) => update("textScale", v)}
                    options={[
                      { value: "normal", label: "Normal" },
                      { value: "large", label: "Large" },
                    ]}
                  />
                </div>
              )}

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Saved on this device. Change it anytime — nothing else about your data changes.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { loadPreferences, DEFAULTS };
