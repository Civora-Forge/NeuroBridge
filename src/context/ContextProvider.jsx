import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  contextEngine,
  contextEventBus,
  ContextEvents,
  getUnifiedContextAPI,
} from "@/adaptive/context";
import { useAuth } from "@/context/AuthContext";

const ContextStateContext = createContext(null);

/** Map URL paths to canonical activity module names */
const PATH_MODULE_MAP = [
  { match: /adaptive-reading|reading-module/i, module: "reader" },
  { match: /\/adhd\/focus/i, module: "focus" },
  { match: /\/adhd\/timeline|\/adhd\/breakdown/i, module: "planner" },
  { match: /regulation|breathing|calm-mode/i, module: "regulation" },
  { match: /reflection|journal/i, module: "reflection" },
  { match: /\/dyslexia/i, module: "dyslexia" },
  { match: /\/adhd/i, module: "adhd" },
  { match: /\/asd/i, module: "asd" },
  { match: /\/ocd/i, module: "ocd" },
  { match: /\/depression/i, module: "depression" },
  { match: /\/dyscalculia/i, module: "dyscalculia" },
];

function resolveModuleFromPath(pathname) {
  if (!pathname || pathname === "/") return "dashboard";
  for (const { match, module } of PATH_MODULE_MAP) {
    if (match.test(pathname)) return module;
  }
  const segments = pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] || "dashboard";
}

export function ContextProvider({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  const [context, setContext] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    contextEngine.init({ initialScreen: resolveModuleFromPath(location.pathname) });
    getUnifiedContextAPI().then(setContext);

    return () => contextEngine.stop();
  }, []);

  useEffect(() => {
    if (user) {
      contextEngine.syncProfile({
        id: user.id,
        disorders: user.disorders,
        communicationPreference: user.accessibility?.screenReader ? "verbal" : "adaptive",
      });
    }
  }, [user]);

  useEffect(() => {
    const moduleName = resolveModuleFromPath(location.pathname);
    contextEngine.trackNavigation(moduleName, { path: location.pathname });
    getUnifiedContextAPI().then(setContext);
  }, [location.pathname]);

  useEffect(() => {
    const unsub = contextEventBus.subscribe(ContextEvents.CONTEXT_UPDATED, (payload) => {
      if (payload.context) {
        setContext(payload.context);
        setLastUpdated(payload.timestamp || new Date().toISOString());
      }
    });
    return unsub;
  }, []);

  const processUserMessage = useCallback(async (text, options) => {
    const result = await contextEngine.processUserMessage(text, options);
    setContext(result.context);
    setLastUpdated(new Date().toISOString());
    return result;
  }, []);

  const refreshContext = useCallback(async () => {
    const snapshot = await getUnifiedContextAPI();
    setContext(snapshot);
    setLastUpdated(new Date().toISOString());
    return snapshot;
  }, []);

  const value = useMemo(
    () => ({
      context,
      lastUpdated,
      processUserMessage,
      refreshContext,
      isReady: contextEngine.isInitialized,
    }),
    [context, lastUpdated, processUserMessage, refreshContext]
  );

  return <ContextStateContext.Provider value={value}>{children}</ContextStateContext.Provider>;
}

export function useContextState() {
  const ctx = useContext(ContextStateContext);
  if (!ctx) {
    throw new Error("useContextState must be used within ContextProvider");
  }
  return ctx;
}

/** Safe hook for modules that may render outside provider during tests */
export function useContextStateOptional() {
  return useContext(ContextStateContext);
}

export { resolveModuleFromPath };
