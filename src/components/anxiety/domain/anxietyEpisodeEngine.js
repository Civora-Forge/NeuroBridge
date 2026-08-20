/**
 * anxietyEpisodeEngine.js — Anxiety Episode lifecycle manager
 *
 * Responsibilities:
 *   - Groups individual observations and check-ins into continuous episode models.
 *   - Manages state transitions: BASELINE → ESCALATING → ACTIVE → RECOVERING → RESOLVED.
 *   - Tracks peak severity, trend, intervention history, and recovery trajectory.
 *   - Pure, deterministic JavaScript.
 */

import { EpisodeStatus } from "./anxietyTypes";

/**
 * Creates a fresh anxiety episode
 *
 * @param {object} state Current AnxietyState
 * @param {string} [trigger] User trigger or description
 * @param {string} [timestamp]
 * @returns {object} Episode
 */
export function createEpisode(state, trigger = "", timestamp = new Date().toISOString()) {
  const severityVal = Number(state?.severity?.value ?? 0);
  const escalationVal = Number(state?.escalation?.value ?? 0);

  let status = EpisodeStatus.BASELINE;
  if (escalationVal >= 0.6) {
    status = EpisodeStatus.ESCALATING;
  } else if (severityVal >= 4) {
    status = EpisodeStatus.ACTIVE;
  }

  return {
    id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    startTime: timestamp,
    status,
    peakSeverity: severityVal,
    currentSeverity: severityVal,
    trigger: trigger.trim() || "Unspecified",
    trend: escalationVal >= 0.5 ? "increasing" : "stable",
    stateSnapshot: state,
    interventions: [],
    outcome: null,
    lastUpdatedAt: timestamp,
  };
}

/**
 * Updates an ongoing episode with a new state check-in or intervention event
 *
 * @param {object|null} currentEpisode Existing episode or null
 * @param {object} nextState Next derived AnxietyState
 * @param {object} [interventionEvent] Optional intervention execution event or outcome
 * @returns {object} Updated Episode
 */
export function updateEpisode(currentEpisode, nextState, interventionEvent = null) {
  const now = new Date().toISOString();
  const nextSeverity = Number(nextState?.severity?.value ?? 0);

  if (!currentEpisode || currentEpisode.status === EpisodeStatus.RESOLVED) {
    return createEpisode(nextState, nextState?.rawInput?.triggerText, now);
  }

  const prevSeverity = currentEpisode.currentSeverity;
  const peakSeverity = Math.max(currentEpisode.peakSeverity, nextSeverity);
  const severityDelta = nextSeverity - prevSeverity;

  let trend = "stable";
  if (severityDelta > 0) trend = "increasing";
  if (severityDelta < 0) trend = "decreasing";

  let status = currentEpisode.status;

  // Handle post-intervention outcome updates
  if (interventionEvent) {
    const isCompleted = interventionEvent.completed === true;
    const reduction = Number(interventionEvent.delta ?? 0);
    const postSeverity = Number(interventionEvent.postSeverity ?? nextSeverity);

    if (isCompleted && (reduction >= 2 || postSeverity <= 4)) {
      status = postSeverity <= 3 ? EpisodeStatus.RESOLVED : EpisodeStatus.RECOVERING;
    } else if (postSeverity <= 3) {
      status = EpisodeStatus.RESOLVED;
    } else {
      status = EpisodeStatus.ACTIVE;
    }

    return {
      ...currentEpisode,
      currentSeverity: postSeverity,
      peakSeverity,
      trend: "decreasing",
      status,
      stateSnapshot: nextState,
      interventions: [...currentEpisode.interventions, interventionEvent],
      outcome: interventionEvent,
      lastUpdatedAt: now,
    };
  }

  // State-driven transition logic
  if (nextSeverity <= 3) {
    if (currentEpisode.status === EpisodeStatus.RECOVERING || currentEpisode.status === EpisodeStatus.ACTIVE) {
      status = EpisodeStatus.RESOLVED;
    } else {
      status = EpisodeStatus.BASELINE;
    }
  } else if (nextSeverity >= 4) {
    if (nextState.escalation?.value >= 0.6) {
      status = EpisodeStatus.ESCALATING;
    } else if (currentEpisode.status === EpisodeStatus.RECOVERING && severityDelta <= 0) {
      status = EpisodeStatus.RECOVERING;
    } else {
      status = EpisodeStatus.ACTIVE;
    }
  }

  return {
    ...currentEpisode,
    currentSeverity: nextSeverity,
    peakSeverity,
    trend,
    status,
    stateSnapshot: nextState,
    lastUpdatedAt: now,
  };
}
