/**
 * adaptiveRuntimeContext.js — Adaptive Engine live runtime context (Phase 4)
 *
 * Single decision path for the running app. Mounted once inside
 * `ContextProvider`, it drives `useAdaptiveBehavioralEngine` with the live
 * ContextSnapshot (module resolved from the current URL path), the
 * authenticated userId, and the D14 `userPreferences` fragment — then exposes
 * the resulting `{ plan, trace, ... }` to every consumer below it via context.
 *
 * The provider renders nothing and never auto-executes: the engine is a
 * decision producer only (see `useAdaptiveBehavioralEngine`). Consumers like
 * `AdaptiveUIRuntime` decide whether and how to apply the decision.
 *
 * When the runtime flag is OFF (product default; tests) the hook is inert and
 * the provider carries an idle decision — the app is unchanged.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  useContextState,
  resolveModuleFromPath,
} from "@/context/ContextProvider";
import { useAdaptiveBehavioralEngine } from "@/hooks/useAdaptiveBehavioralEngine";
import { buildUserPreferencesFragment } from "@/support/framework/userPreferencesAdapter";
import { usePersonalizationProfile } from "@/adaptive/personalization/usePersonalizationProfile";
import { resolveProfileView } from "@/adaptive/personalization/profileModel";
import { promoteFromFeedback } from "@/adaptive/personalization/profileStore";
import { isReflectionEnabled } from "@backend/adaptive/engine/featureFlags";
import { createReEvaluationScheduler } from "@/adaptive/execution/reEvaluationScheduler";
import { bindExecutionStoreToUser } from "@/adaptive/execution/uiExecution";
import {
  getCanonicalSupportModuleId,
  getSupportModules,
} from "@/support/framework/supportModuleRegistry";

export const AdaptiveRuntimeContext = createContext(null);

/**
 * Resolve the current path to a canonical registered support module id so the
 * engine's module context (safety level, supported dimensions, module
 * policies) flows at the app level. Route matching is precise; a small legacy
 * alias map covers shorthand module names; otherwise `null` (generic engine
 * fallback).
 */
export function resolveCanonicalModuleId(pathname) {
  if (!pathname || pathname === "/") return null;
  const clean = pathname.split("?")[0].split("#")[0];
  for (const module of getSupportModules()) {
    if (!module.route) continue;
    if (
      clean === module.route ||
      clean.startsWith(`${module.route}/`) ||
      clean.startsWith(`${module.route}?`)
    ) {
      return module.id;
    }
  }
  const legacyAliases = {
    focus: "support.focus_session",
    reader: "dyslexia.adaptive-reading",
  };
  const name = resolveModuleFromPath(pathname);
  return legacyAliases[name] ?? getCanonicalSupportModuleId(name) ?? null;
}

/**
 * Run the Adaptive Engine decision path for the current route and expose the
 * result (plan / trace / control surface) to the subtree.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 */
export function AdaptiveRuntimeProvider({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  const { context, refreshContext } = useContextState();

  const moduleId = resolveCanonicalModuleId(location.pathname) ?? null;
  const getSnapshot = useCallback(() => context, [context]);
  const userPreferences = useMemo(
    () => buildUserPreferencesFragment(user),
    [user],
  );

  // Temporal stability (Task 2): the engine schedules its own re-evaluation
  // (confirmation windows, minimum-duration ends, periodic review of active
  // adaptations). Refresh the live snapshot at that time so pending entries
  // confirm and stale adaptations expire even without new user interaction.
  // Scheduled from every committed decision (Task 3) — including decisions
  // whose effective plan is unchanged and so cause no re-render.
  // Task 6: one pending timer, clamped delay, and a refresh budget so a
  // re-evaluation that is always due can never become a runaway loop.
  const refreshRef = useRef(refreshContext);
  refreshRef.current = refreshContext;
  const schedulerRef = useRef(null);
  if (schedulerRef.current === null) {
    schedulerRef.current = createReEvaluationScheduler({
      refresh: () => {
        if (typeof refreshRef.current === "function") refreshRef.current();
      },
    });
  }
  const onDecision = useCallback((outcome) => {
    schedulerRef.current.schedule(outcome?.plan?.reEvaluateAt);
  }, []);
  useEffect(() => () => schedulerRef.current?.reset(), []);

  // Task 5: persistent, user-owned personalization profile (local copy +
  // account sync). Read before every decision.
  const userId = user?.id ?? null;

  // Task 6: per-user isolation. Consent decisions / dismissals belong to the
  // signed-in user, and a re-evaluation scheduled for one user never fires
  // for the next. Layout effect: bound before the UI runtime resolves.
  useLayoutEffect(() => {
    bindExecutionStoreToUser(userId);
    schedulerRef.current?.reset();
  }, [userId]);
  const personalizationStore = usePersonalizationProfile(userId);
  const profile = personalizationStore.profile;
  const temporary = personalizationStore.temporary;
  const profileLoaded = Boolean(profile);
  useEffect(() => {
    // Promote feedback that became reliable since the last session.
    if (userId && profileLoaded && isReflectionEnabled()) promoteFromFeedback(userId).catch(() => {});
  }, [userId, profileLoaded]);
  const personalization = useMemo(
    () =>
      userId && profile
        ? resolveProfileView(profile, { moduleId, temporary: temporary ?? undefined, includeLearned: isReflectionEnabled() })
        : undefined,
    [userId, profile, temporary, moduleId],
  );

  const engine = useAdaptiveBehavioralEngine({
    moduleId,
    getSnapshot: context != null ? getSnapshot : undefined,
    userId: user?.id,
    userPreferences,
    onDecision,
    personalizationProfile: profile,
    temporaryPreferences: temporary,
  });

  const value = useMemo(
    () => ({
      moduleId,
      // Feedback capture (Task 4) is per user; never written into traces.
      userId: user?.id ?? null,
      userPreferences,
      // Task 5: resolved profile for this module (presentation hints, offer
      // suppression). Undefined until the profile is loaded.
      personalization,
      ...engine,
    }),
    [moduleId, user?.id, userPreferences, personalization, engine],
  );

  return (
    <AdaptiveRuntimeContext.Provider value={value}>
      {children}
    </AdaptiveRuntimeContext.Provider>
  );
}

/**
 * Read the live Adaptive Engine runtime state.
 * @throws {Error} When used outside `AdaptiveRuntimeProvider`.
 */
export function useAdaptiveRuntime() {
  const ctx = useContext(AdaptiveRuntimeContext);
  if (!ctx) {
    throw new Error(
      "useAdaptiveRuntime must be used within AdaptiveRuntimeProvider",
    );
  }
  return ctx;
}
