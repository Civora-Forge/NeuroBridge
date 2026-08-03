import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  contextEngine,
  contextStore,
  contextEventBus,
  ContextEvents,
  validateContextSignal,
  evaluateSignalFreshness,
  isDuplicateSignal,
  clearDedupCache,
  detectSignalConflicts,
  fuseContext,
  computeFreshnessIndex,
  detectMaterialChange,
  handleGetUnifiedContext,
  getContextSnapshotAPI,
  ContextSnapshotAdapter,
  trackActivity,
  resetActivityTracker,
  collectEnvironmentContext,
  startSession,
  resetSessionTracker,
  analyzeConversation,
  inferMood,
  resetMoodAgent,
  createContextSignal,
} from "../adaptive/context/index.js";
import { resolveEnabledFeatures, FEATURES } from "../lib/featureRegistry.js";

describe("Context & Perception Layer — Validation, Fusion & Unified Context API", () => {
  beforeEach(() => {
    contextEventBus.clear();
    contextStore.reset();
    resetActivityTracker();
    resetSessionTracker();
    resetMoodAgent();
    clearDedupCache();
  });

  afterEach(() => {
    contextEngine.stop();
  });

  describe("1. Context Validator", () => {
    it("should sanitize invalid/missing signal payloads without crashing", () => {
      const res1 = validateContextSignal(null);
      expect(res1.isValid).toBe(false);
      expect(res1.effectiveConfidence).toBe(0.0);

      const res2 = validateContextSignal({
        source: "activityTracker",
        payload: "invalid_string_payload",
      });
      expect(res2.isValid).toBe(true);
      expect(res2.sanitizedSignal.payload).toEqual({});
    });

    it("should detect duplicate signals within deduplication window", () => {
      const signal = createContextSignal({
        id: "dup_sig_001",
        source: "activityTracker",
        type: ContextEvents.ACTIVITY_UPDATED,
        payload: { currentModule: "reader" },
      });

      const firstCheck = validateContextSignal(signal);
      expect(firstCheck.isDuplicate).toBe(false);

      const secondCheck = validateContextSignal(signal);
      expect(secondCheck.isDuplicate).toBe(true);
      expect(secondCheck.errors).toContain(
        "Duplicate signal detected within deduplication window",
      );
    });

    it("should evaluate freshness and decay confidence past TTL", () => {
      const freshTime = new Date().toISOString();
      const freshEval = evaluateSignalFreshness(freshTime, 1.0, 30);
      expect(freshEval.isStale).toBe(false);
      expect(freshEval.effectiveConfidence).toBe(1.0);

      // Signal created 45 seconds ago (TTL = 30s)
      const staleTime = new Date(Date.now() - 45000).toISOString();
      const staleEval = evaluateSignalFreshness(staleTime, 1.0, 30);
      expect(staleEval.isStale).toBe(true);
      expect(staleEval.effectiveConfidence).toBeLessThan(1.0);
    });

    it("should detect conflicts between explicit mood check-in and negative text sentiment", () => {
      const currentContext = {
        conversation: {
          lastUserMessage: "Everything is failing",
          sentimentScore: -0.8,
        },
      };

      const conflicts = detectSignalConflicts(
        "mood",
        { value: "calm" },
        currentContext,
      );

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].category).toBe("mood");
      expect(conflicts[0].description).toContain("calm");
    });

    it("should gracefully degrade when optional sources (battery/geo/weather) are unavailable", () => {
      const env = collectEnvironmentContext();

      expect(env.battery).toBeDefined(); // may be null
      expect(env.location).toBeNull();
      expect(env.weather).toBeNull();

      const validation = validateContextSignal({
        source: "environmentContext",
        type: ContextEvents.ENVIRONMENT_UPDATED,
        payload: env,
      });

      expect(validation.isValid).toBe(true);
    });
  });

  describe("2. Context Fusion Engine", () => {
    it("should fuse 6 categories into Unified Context Object with required metadata", () => {
      contextEngine.init({ initialScreen: "planner" });

      const uco = fuseContext();

      expect(uco).toHaveProperty("profile");
      expect(uco).toHaveProperty("activity");
      expect(uco).toHaveProperty("environment");
      expect(uco).toHaveProperty("conversation");
      expect(uco).toHaveProperty("mood");
      expect(uco).toHaveProperty("session");
      expect(uco).toHaveProperty("metadata");

      expect(uco.metadata.observedAt).toHaveProperty("earliest");
      expect(uco.metadata.observedAt).toHaveProperty("latest");
      expect(uco.metadata.updatedAt).toBeDefined();
      expect(uco.metadata.sourceMap).toBeDefined();
      expect(uco.metadata.dimensionalConfidence).toBeDefined();
      expect(uco.metadata.overallConfidence).toBeGreaterThanOrEqual(0.0);
      expect(uco.metadata.freshnessIndex).toBeGreaterThanOrEqual(0.0);
      expect(uco.metadata.stalenessFlags).toBeDefined();
    });

    it("should enforce strict architectural boundary (NO intervention decisions or UI actions)", () => {
      const uco = fuseContext();

      expect(uco).not.toHaveProperty("intervention");
      expect(uco).not.toHaveProperty("recommendation");
      expect(uco).not.toHaveProperty("uiAdaptation");
      expect(uco).not.toHaveProperty("cognitiveLoadModel");
    });

    it("should detect material context changes accurately", () => {
      const prev = fuseContext({ activity: { activity: "reading" } });
      const next = fuseContext({ activity: { activity: "focus_session" } });

      const changeCheck = detectMaterialChange(prev, next);

      expect(changeCheck.isMaterialChange).toBe(true);
      expect(changeCheck.materialChanges[0]).toContain("activity_changed");
    });
  });

  describe("3. Unified Context API & Interface", () => {
    it("should adapt UnifiedContext into a public ContextSnapshot without internal-only fields", () => {
      const unified = fuseContext({});
      const snapshot = ContextSnapshotAdapter.toContextSnapshot(unified);

      expect(snapshot).toHaveProperty("snapshotId");
      expect(snapshot).toHaveProperty("timestamp");
      expect(snapshot).toHaveProperty("metadata.snapshotVersion");
      expect(snapshot.userId).toBeNull();
      expect(snapshot).toHaveProperty("behavior");
      expect(snapshot).toHaveProperty("deviceInteraction");
      expect(snapshot).toHaveProperty("explicitRequests");
      expect(snapshot).toHaveProperty("biometrics");
      expect(snapshot).not.toHaveProperty("emotion");
      expect(snapshot).not.toHaveProperty("task");
      expect(snapshot).not.toHaveProperty("confidence.overall");
    });

    it("should handle GET /api/context/current endpoint request correctly", () => {
      contextEngine.init({ initialScreen: "reader" });

      const res = handleGetUnifiedContext();

      expect(res.status).toBe("success");
      expect(res.statusCode).toBe(200);
      expect(res.timestamp).toBeDefined();
      expect(res.data).toHaveProperty("snapshotId");
      expect(res.data).toHaveProperty("userId");
      expect(res.data).toHaveProperty("profile");
      expect(res.data).toHaveProperty("activity");
      expect(res.data).toHaveProperty("environment");
      expect(res.data).toHaveProperty("conversation");
      expect(res.data).toHaveProperty("mood");
      expect(res.data).toHaveProperty("session");
      expect(res.data).toHaveProperty("metadata");
    });

    it("should allow client helper getContextSnapshotAPI to retrieve snapshot", async () => {
      contextEngine.init();

      const data = await getContextSnapshotAPI();

      expect(data).toHaveProperty("snapshotId");
      expect(data).toHaveProperty("profile");
      expect(data).toHaveProperty("metadata");
    });

    it("should expose explicitRequest under conversation for downstream modules", async () => {
      contextEngine.init();

      const result = await contextEngine.processUserMessage(
        "I need help focusing.",
        { useAI: false, inputMode: "chat" },
      );

      expect(result.context.conversation).toHaveProperty("explicitRequest");
      expect(result.context.conversation.explicitRequest).toMatchObject({
        intent: "focus_support",
        requestType: "explicit_help_request",
        priority: "high",
        originalText: "I need help focusing.",
      });
      expect(
        result.context.conversation.explicitRequest.timestamp,
      ).toBeDefined();
      expect(result.context.explicitRequests).toMatchObject({
        requestType: "explicit_help_request",
        inputMode: "chat",
      });
    });

    it("should update live interaction metrics after navigation changes", () => {
      contextEngine.init({ initialScreen: "reader" });
      contextEngine.trackNavigation("reader", { path: "/reader" });
      contextEngine.trackNavigation("reader", { path: "/reader" });

      const snapshot = ContextSnapshotAdapter.toContextSnapshot(
        contextEngine.getLatestContext(),
      );

      expect(
        snapshot.deviceInteraction.repeatedNavigation,
      ).toBeGreaterThanOrEqual(1);
      expect(snapshot.behavior.taskSwitchFrequency).toBeGreaterThanOrEqual(0);
      expect(
        snapshot.deviceInteraction.currentSessionDuration,
      ).toBeGreaterThanOrEqual(0);
    });
  });

  describe("4. Feature Registry Normalization", () => {
    it("should keep root dyslexia access enabled when only dyslexia subfeatures are present", () => {
      const enabled = resolveEnabledFeatures({
        enabledModules: [FEATURES.DYSLEXIA_READER],
      });

      expect(enabled.has(FEATURES.DYSLEXIA)).toBe(true);
      expect(enabled.has(FEATURES.DYSLEXIA_READER)).toBe(true);
    });
  });
});
