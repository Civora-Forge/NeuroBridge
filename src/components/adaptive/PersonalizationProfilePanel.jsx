/**
 * PersonalizationProfilePanel.jsx — User control over the persistent
 * personalization profile (Task 5).
 *
 * Lets the user view the profile, edit explicit preferences (everywhere or
 * for one activity), see which preferences were learned from their feedback
 * and forget them, undo the last change, reset learned personalization, or
 * reset everything. Changes save immediately (locally first, then to the
 * account when signed in). Raw feedback / behavioural history is never shown.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { useId, useMemo, useState } from "react";
import { Brain, Cloud, CloudOff, HardDrive, RotateCcw, Sparkles, Trash2, Undo2 } from "lucide-react";
import { usePersonalizationProfile } from "@/adaptive/personalization/usePersonalizationProfile";
import { describeProfile } from "@/adaptive/personalization/profileModel";
import { SyncStatus } from "@/adaptive/personalization/profileStore";
import {
  AVOID_FIELD_PREFIX,
  AVOIDABLE_PATTERNS,
  LEARNED_STANCES,
  MODE_FIELD_PREFIX,
  MODE_STANCES,
  PREFERENCE_DIMENSIONS,
  SUPPORT_MODES,
} from "@/adaptive/personalization/profileVocabulary";
import { getSupportModules } from "@/support/framework/supportModuleRegistry";

const STATUS_COPY = {
  [SyncStatus.SYNCED]: { icon: Cloud, text: "Saved to your account — available on your other devices" },
  [SyncStatus.LOCAL_ONLY]: { icon: HardDrive, text: "Saved on this device only" },
  [SyncStatus.OFFLINE]: { icon: CloudOff, text: "Saved on this device — will sync when you're back online" },
  [SyncStatus.SYNCING]: { icon: Cloud, text: "Saving…" },
  [SyncStatus.LOADING]: { icon: Cloud, text: "Loading…" },
  [SyncStatus.IDLE]: { icon: HardDrive, text: "Not loaded" },
};

function moduleLabel(modules, moduleId) {
  if (!moduleId) return "Everywhere";
  return modules.find((module) => module.id === moduleId)?.title ?? moduleId;
}

function fieldLabel(field) {
  if (PREFERENCE_DIMENSIONS[field]) return PREFERENCE_DIMENSIONS[field].label;
  if (field.startsWith(MODE_FIELD_PREFIX)) return SUPPORT_MODES[field.slice(MODE_FIELD_PREFIX.length)]?.label ?? field;
  if (field.startsWith(AVOID_FIELD_PREFIX)) return AVOIDABLE_PATTERNS[field.slice(AVOID_FIELD_PREFIX.length)] ?? field;
  return field;
}

export default function PersonalizationProfilePanel({ userId }) {
  const store = usePersonalizationProfile(userId);
  const scopeSelectId = useId();
  const modules = useMemo(() => getSupportModules().filter((module) => module.id && module.title), []);
  const [scope, setScope] = useState("global");
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState("");

  if (!userId) {
    return (
      <section className="neuro-card p-6" aria-label="Personalization">
        <p className="text-sm text-muted-foreground">Sign in to keep your support preferences between sessions.</p>
      </section>
    );
  }

  const profile = store.profile;
  const moduleId = scope === "global" ? null : scope;
  const bucket = profile ? (moduleId ? profile.explicit.contexts[moduleId] ?? {} : profile.explicit.global) : {};
  const current = (field) => (bucket[field]?.value ?? null);
  const description = describeProfile(profile);
  const status = STATUS_COPY[store.status] ?? STATUS_COPY[SyncStatus.IDLE];
  const StatusIcon = status.icon;

  const run = async (operation) => {
    setError("");
    try {
      await operation();
    } catch (err) {
      setError(err?.message || "That change could not be saved.");
    }
  };
  const set = (field, value) => run(() => store.setPreference(field, value, { moduleId }));

  return (
    <section className="neuro-card p-6 space-y-5" aria-label="Personalization">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> How NeuroBridge supports you
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Your own settings always come first. Learned preferences only nudge suggestions and never override
            your settings or safety support. Changes save automatically.
          </p>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5" data-testid="personalization-sync-status">
          <StatusIcon className="w-3.5 h-3.5" /> {status.text}
        </p>
      </div>

      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}

      <div className="space-y-1">
        <label htmlFor={scopeSelectId} className="text-xs font-medium">Apply settings to</label>
        <select
          id={scopeSelectId}
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="global">Everywhere</option>
          {modules.map((module) => (
            <option key={module.id} value={module.id}>{module.title} only</option>
          ))}
        </select>
        {moduleId && (
          <p className="text-xs text-muted-foreground">Anything left as "No preference" here uses your "Everywhere" setting.</p>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium flex items-center gap-1.5">Your settings <span className="text-[10px] rounded bg-primary/10 px-1.5 py-0.5 text-primary">Set by you</span></legend>
        <div className="grid sm:grid-cols-2 gap-3">
          {Object.entries(PREFERENCE_DIMENSIONS).map(([field, definition]) => (
            <label key={field} className="text-xs space-y-1 block">
              <span className="font-medium">{definition.label}</span>
              <select
                aria-label={definition.label}
                value={current(field) ?? ""}
                onChange={(event) => set(field, event.target.value || null)}
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="">No preference</option>
                {Object.entries(definition.values).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Support modes</legend>
        {Object.entries(SUPPORT_MODES).map(([mode, definition]) => {
          const field = `${MODE_FIELD_PREFIX}${mode}`;
          return (
            <label key={mode} className="flex items-center justify-between gap-3 text-sm">
              <span>{definition.label}</span>
              <select
                aria-label={definition.label}
                value={current(field) ?? ""}
                onChange={(event) => set(field, event.target.value || null)}
                className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
              >
                <option value="">No preference</option>
                <option value={MODE_STANCES.PREFERRED}>I like this</option>
                <option value={MODE_STANCES.AVOIDED}>Don't use this</option>
              </select>
            </label>
          );
        })}
        <p className="text-xs text-muted-foreground">Calming support for overwhelming moments is always available and can't be turned off here.</p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Please avoid</legend>
        {Object.entries(AVOIDABLE_PATTERNS).map(([pattern, label]) => {
          const field = `${AVOID_FIELD_PREFIX}${pattern}`;
          return (
            <label key={pattern} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={current(field) === true} onChange={(event) => set(field, event.target.checked || null)} />
              {label}
            </label>
          );
        })}
      </fieldset>

      <div className="space-y-2">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5" /> Learned from your feedback
          <span className="text-[10px] rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700">Learned</span>
        </h3>
        {description.learned.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing learned yet. NeuroBridge only remembers a pattern after you've responded the same way several times
            over more than one session.
          </p>
        ) : (
          <ul className="space-y-1.5" aria-label="Learned preferences">
            {description.learned.map((item) => (
              <li key={`${item.moduleId ?? "global"}:${item.key}`} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {item.label} —{" "}
                  {item.stance === LEARNED_STANCES.FAVOURED ? "usually helpful for you" : "usually not wanted"}
                  <span className="text-xs text-muted-foreground"> ({moduleLabel(modules, item.moduleId)}, {item.strength})</span>
                </span>
                <button
                  type="button"
                  className="neuro-btn-ghost text-xs"
                  onClick={() => run(() => store.forgetLearned(item.key, { moduleId: item.moduleId }))}
                >
                  Forget
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {description.explicit.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Summary of your settings</h3>
          <ul className="text-xs text-muted-foreground space-y-0.5" aria-label="Explicit preferences">
            {description.explicit.map((item) => (
              <li key={`${item.moduleId ?? "global"}:${item.field}`}>
                {fieldLabel(item.field)}
                {typeof item.value === "string" && PREFERENCE_DIMENSIONS[item.field] ? `: ${PREFERENCE_DIMENSIONS[item.field].values[item.value]}` : ""}
                {item.value === MODE_STANCES.PREFERRED ? ": preferred" : item.value === MODE_STANCES.AVOIDED ? ": avoided" : ""}
                {` · ${moduleLabel(modules, item.moduleId)}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="neuro-btn-outline text-xs flex items-center gap-1.5 disabled:opacity-50"
          disabled={!description.undo}
          onClick={() => run(() => store.undo())}
        >
          <Undo2 className="w-3.5 h-3.5" /> Undo last change
        </button>
        <button
          type="button"
          className="neuro-btn-outline text-xs flex items-center gap-1.5"
          onClick={() => run(() => store.resetLearned())}
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset learned preferences
        </button>
        {!confirmReset ? (
          <button
            type="button"
            className="text-xs flex items-center gap-1.5 rounded-xl border border-rose-500 text-rose-600 px-3 py-1.5"
            onClick={() => setConfirmReset(true)}
          >
            <Trash2 className="w-3.5 h-3.5" /> Reset everything
          </button>
        ) : (
          <span className="flex items-center gap-2 text-xs">
            Clear all settings and learned preferences?
            <button
              type="button"
              className="rounded-xl bg-rose-600 text-white px-3 py-1.5"
              onClick={() => run(async () => { await store.resetAll(); setConfirmReset(false); })}
            >
              Yes, reset
            </button>
            <button type="button" className="neuro-btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
          </span>
        )}
      </div>
    </section>
  );
}
