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

import { createContext, useCallback, useContext, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  useContextState,
  resolveModuleFromPath,
} from "@/context/ContextProvider";
import { useAdaptiveBehavioralEngine } from "@/hooks/useAdaptiveBehavioralEngine";
import { buildUserPreferencesFragment } from "@/support/framework/userPreferencesAdapter";
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
  const { context } = useContextState();

  const moduleId = resolveCanonicalModuleId(location.pathname) ?? null;
  const getSnapshot = useCallback(() => context, [context]);
  const userPreferences = useMemo(
    () => buildUserPreferencesFragment(user),
    [user],
  );

  const engine = useAdaptiveBehavioralEngine({
    moduleId,
    getSnapshot: context != null ? getSnapshot : undefined,
    userId: user?.id,
    userPreferences,
  });

  const value = useMemo(
    () => ({ moduleId, userPreferences, ...engine }),
    [moduleId, userPreferences, engine],
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
