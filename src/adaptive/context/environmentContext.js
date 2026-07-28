/**
 * environmentContext.js — Environment Context Processor
 *
 * Part of the Context & Perception Engine.
 * Processes privacy-conscious environmental signals: time of day, day of week,
 * online/offline status, device type, and screen parameters.
 *
 * Optional signals (battery, geolocation, weather) degrade gracefully and are never required.
 *
 * Ownership: Context & Perception Engineer
 */

import { contextEventBus } from "./events/contextEventBus.js";
import { ContextEvents } from "./events/contextEvents.js";
import { contextStore } from "./contextStore.js";
import { createContextSignal } from "./types/contextTypes.js";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Determine time of day classification based on hour.
 * @param {number} hour
 * @returns {"morning" | "afternoon" | "evening" | "night"}
 */
function getTimeOfDay(hour) {
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 16) return "afternoon";
  if (hour >= 17 && hour <= 21) return "evening";
  return "night";
}

/**
 * Safely parse browser device and platform info without heavy dependencies.
 * @returns {{ deviceType: string, browser: string, platform: string, screenSize: { width: number, height: number } }}
 */
function getDeviceInfo() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      deviceType: "unknown",
      browser: "unknown",
      platform: "unknown",
      screenSize: { width: 0, height: 0 },
    };
  }

  const ua = navigator.userAgent || "";
  let deviceType = "desktop";
  if (/mobile/i.test(ua)) deviceType = "mobile";
  else if (/ipad|tablet/i.test(ua)) deviceType = "tablet";

  let browser = "unknown";
  if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/edg/i.test(ua)) browser = "Edge";

  return {
    deviceType,
    browser,
    platform: navigator.platform || "unknown",
    screenSize: {
      width: window.innerWidth || (window.screen ? window.screen.width : 0),
      height: window.innerHeight || (window.screen ? window.screen.height : 0),
    },
  };
}

/**
 * Collect optional battery status with graceful fallback.
 * @returns {Promise<{ level: number|null, charging: boolean|null }|null>}
 */
async function getOptionalBatteryInfo() {
  try {
    if (typeof navigator !== "undefined" && "getBattery" in navigator && typeof navigator.getBattery === "function") {
      const battery = await navigator.getBattery();
      return {
        level: typeof battery.level === "number" ? battery.level : null,
        charging: typeof battery.charging === "boolean" ? battery.charging : null,
      };
    }
  } catch (_err) {
    // Graceful degradation: return null if not available or permitted
  }
  return null;
}

let _isMonitoring = false;
let _onlineHandler = null;
let _offlineHandler = null;
let _resizeHandler = null;

/**
 * Collect and process environment context.
 *
 * @returns {import("./types/contextTypes.js").EnvironmentContext}
 */
export function collectEnvironmentContext() {
  const now = new Date();
  const hour = now.getHours();
  const timeOfDay = getTimeOfDay(hour);
  const dayOfWeek = DAYS_OF_WEEK[now.getDay()];
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine !== false : true;
  const device = getDeviceInfo();

  const envContext = {
    currentTime: now.toISOString(),
    timeOfDay,
    dayOfWeek,
    isOnline,
    device,
    battery: null, // Asynchronously enriched if available
    location: null, // Optional, gracefully null
    weather: null,  // Optional, gracefully null
  };

  // Asynchronously attempt battery info fetch without blocking synchronous call
  getOptionalBatteryInfo().then((batteryData) => {
    if (batteryData) {
      envContext.battery = batteryData;
      contextStore.updateContext("environment", { battery: batteryData }, "environmentContext", 0.95);
    }
  });

  // Update ContextStore environment dimension
  contextStore.updateContext("environment", envContext, "environmentContext", 0.95);

  // Construct and emit typed EnvironmentUpdated signal & event
  const signal = createContextSignal({
    source: "environmentContext",
    type: ContextEvents.ENVIRONMENT_UPDATED,
    payload: envContext,
    confidence: 0.95,
    ttlSeconds: 300,
  });

  contextEventBus.emit(ContextEvents.ENVIRONMENT_UPDATED, {
    environment: envContext,
    signal,
    timestamp: now.toISOString(),
  });

  contextEventBus.emit(ContextEvents.SIGNAL_RECEIVED, signal);

  return envContext;
}

/**
 * Start automatic monitoring of environment events (online, offline, window resize).
 */
export function startEnvironmentMonitoring() {
  if (_isMonitoring || typeof window === "undefined") return;

  _onlineHandler = () => collectEnvironmentContext();
  _offlineHandler = () => collectEnvironmentContext();
  _resizeHandler = () => collectEnvironmentContext();

  window.addEventListener("online", _onlineHandler);
  window.addEventListener("offline", _offlineHandler);
  window.addEventListener("resize", _resizeHandler);

  _isMonitoring = true;
  collectEnvironmentContext();
}

/**
 * Stop automatic environment event monitoring.
 */
export function stopEnvironmentMonitoring() {
  if (!_isMonitoring || typeof window === "undefined") return;

  if (_onlineHandler) window.removeEventListener("online", _onlineHandler);
  if (_offlineHandler) window.removeEventListener("offline", _offlineHandler);
  if (_resizeHandler) window.removeEventListener("resize", _resizeHandler);

  _isMonitoring = false;
}

/**
 * Determine if the current environment is conducive to the requested intervention.
 * Preserves legacy compatibility.
 *
 * @param {object} environment
 * @param {string} interventionType
 * @returns {{ suitable: boolean, reason?: string }}
 */
export function assessEnvironmentFit(environment, interventionType) {
  if (!environment) {
    return { suitable: true };
  }

  // Example privacy-conscious fit checks:
  if (environment.isOnline === false && interventionType === "cloud_sync") {
    return { suitable: false, reason: "Device is currently offline" };
  }

  return { suitable: true };
}
