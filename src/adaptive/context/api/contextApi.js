/**
 * contextApi.js — Unified Context API & Service Contract
 *
 * Part of the Context & Perception Engine for NeuroBridge V2.
 *
 * Provides the clean REST API endpoint handler and client service interface for external modules
 * (such as the Adaptive Intelligence layer, User State Model, and frontend components)
 * to retrieve the current Unified Context Object.
 *
 * ENDPOINT:
 * GET /api/context/current
 *
 * Ownership: Context & Perception Engineer
 */

import { contextEngine } from "../contextEngine.js";

/**
 * Express / Vite / Service handler for GET /api/context/current.
 * Answers: "What do we currently know about the user right now and how fresh/reliable is it?"
 *
 * @param {object} [req] - Optional HTTP request object
 * @returns {{ status: string, statusCode: number, timestamp: string, data: import("../types/contextTypes.js").UnifiedContextObject }}
 */
export function handleGetUnifiedContext(req = {}) {
  const timestamp = new Date().toISOString();
  const contextSnapshot = contextEngine.getLatestContext();

  return {
    status: "success",
    statusCode: 200,
    timestamp,
    data: contextSnapshot,
  };
}

/**
 * Client service helper for Adaptive Intelligence modules to retrieve the current context snapshot.
 * Uses HTTP fetch if endpoint is configured, or falls back to in-memory contextEngine facade.
 *
 * @param {object} [options]
 * @param {string} [options.apiBaseUrl] - Optional API base URL override
 * @returns {Promise<import("../types/contextTypes.js").UnifiedContextObject>}
 */
export async function getUnifiedContextAPI(options = {}) {
  const apiBaseUrl = options.apiBaseUrl || (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL) || "";

  if (apiBaseUrl) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/context/current`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        const json = await response.json();
        if (json && json.data) {
          return json.data;
        }
      }
    } catch (_err) {
      // Fallback gracefully to in-memory facade API
    }
  }

  // Local synchronous fallback
  const res = handleGetUnifiedContext();
  return res.data;
}
