/**
 * AdaptiveEngineBridge.jsx — Phase 4 live wiring (flag-gated)
 *
 * Mounts the Adaptive Engine decision path in the live app. It is a pure,
 * prop-driven boundary: it forwards the live ContextSnapshot producer
 * (`getSnapshot`), the resolved moduleId, and the authenticated userId into
 * the feature-flagged `useAdaptiveBehavioralEngine` hook.
 *
 * The bridge renders nothing and NEVER executes actions: it only produces
 * decisions (and their traces) when the Adaptive Engine runtime flag is ON.
 * When the flag is OFF (the product default) the hook is inert and the app
 * is unchanged (spec §22 Phase 4 exit criteria).
 *
 * Props are injected by the app hook-up point (`AdaptiveRuntime` in
 * App.jsx), keeping this component free of Role 1 / auth coupling so it can
 * be tested in isolation.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { useAdaptiveBehavioralEngine } from "@/hooks/useAdaptiveBehavioralEngine";

export default function AdaptiveEngineBridge({ moduleId, getSnapshot, userId, enabled }) {
  useAdaptiveBehavioralEngine({ moduleId, getSnapshot, userId, enabled });
  return null;
}
