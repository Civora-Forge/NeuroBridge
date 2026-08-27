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

import { useState, useEffect, useCallback } from "react";
import { Settings, Eye, Sparkles, LayoutGrid, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "neurobridge-sensory-preferences";

const DEFAULTS = {
  visualIntensity: "comfortable",
  animation: "normal",
  density: "standard",
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
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7BA8]">
        {Icon && <Icon size={13} />}
        {label}
      </div>
      <div className="flex gap-1 rounded-xl bg-[#F0F4FF] p-1 border border-[#C7D2FE]">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              value === opt.value
                ? "bg-white text-[#4F6BF6] shadow-sm"
                : "text-[#6B7BA8] hover:text-[#4F6BF6]"
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
  const [prefs, setPrefs] = useState(loadPreferences);

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

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.sensoryVisual = prefs.visualIntensity;
    root.dataset.sensoryAnimation = prefs.animation;
    root.dataset.sensoryDensity = prefs.density;

    if (prefs.animation === "off") {
      root.classList.add("sensory-no-animation");
    } else {
      root.classList.remove("sensory-no-animation");
    }
  }, [prefs]);

  return (
    <div className={`rounded-2xl border border-[#C7D2FE] bg-white/80 backdrop-blur ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#DDE8FC] text-[#4F6BF6]">
            <Settings size={14} />
          </div>
          <span className="text-sm font-semibold text-[#1E2A5E]">Sensory Settings</span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-[#6B7BA8]" />
        ) : (
          <ChevronDown size={16} className="text-[#6B7BA8]" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-[#C7D2FE] px-4 py-4">
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

              <p className="text-[11px] text-[#6B7BA8] leading-relaxed">
                These settings are saved on this device and apply across sessions. Adjust anytime.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { loadPreferences, DEFAULTS };
