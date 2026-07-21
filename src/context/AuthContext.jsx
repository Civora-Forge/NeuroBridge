import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { resolveEnabledFeatures } from "@/lib/featureRegistry";
import { DISORDERS } from "@/lib/disorders";
import { pushWardNote } from "@/lib/careSyncStore";
import { supabase } from "@/lib/supabaseClient";

function buildProfileFromSupabase(supabaseUser) {
  const meta = supabaseUser?.user_metadata ?? {};
  const appMeta = supabaseUser?.app_metadata ?? {};

  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name: meta.name || meta.full_name || supabaseUser.email?.split("@")[0] || "User",
    role: appMeta.role || meta.role || "user",
    abhaId: meta.abhaId ?? null,
    disorders: Array.isArray(meta.disorders) ? meta.disorders : [],
    tagProfile: meta.tagProfile ?? {},
    enabledModules: Array.isArray(meta.enabledModules) ? meta.enabledModules : [],
    onboardingCompleted: Boolean(meta.onboardingCompleted),
    privacy: meta.privacy ?? { shareActivity: true, shareJournal: false, shareAlerts: true },
    accessibility: meta.accessibility ?? { reduceMotion: false, screenReader: false },
    linkedWardIds: meta.linkedWardIds ?? [],
    linkedUserId: meta.linkedUserId ?? null,
    _supabase: true,
  };
}

export const CARE_LINK_REGISTRY = {
  "CL-ARUN-0042": "nb-user-042",
  "CL-MEERA-0011": "nb-user-011",
  "CL-RIYA-0088": "nb-user-088",
};
const ASD_WARD_SETTINGS_PREFIX = "nb_asd_ward_settings_";

function resolveWardIdFromUser(user) {
  if (!user) return null;
  if (typeof user.id === "string" && user.id.startsWith("nb-user-")) {
    return user.id;
  }
  const careLinkId = String(user?.careLinkId || "").toUpperCase().trim();
  if (careLinkId && CARE_LINK_REGISTRY[careLinkId]) {
    return CARE_LINK_REGISTRY[careLinkId];
  }
  const email = String(user?.email || "").toLowerCase();
  if (email.includes("riya")) return "nb-user-088";
  if (email.includes("arun")) return "nb-user-042";
  if (email.includes("meera")) return "nb-user-011";
  return null;
}

function syncWardSettingsFromUser(user, patch = {}) {
  if (!user || user.role !== "user") return;
  const wardId = resolveWardIdFromUser(user);
  if (!wardId) return;

  const key = `${ASD_WARD_SETTINGS_PREFIX}${wardId}`;
  let existing = {};
  try {
    existing = JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    existing = {};
  }

  const disorders = Array.isArray(patch.disorders)
    ? patch.disorders
    : Array.isArray(user.disorders)
    ? user.disorders
    : existing.disorders || [];

  const privacy = patch.privacy
    ? { ...(existing.privacy || {}), ...patch.privacy }
    : user.privacy
    ? { ...(existing.privacy || {}), ...user.privacy }
    : existing.privacy || { shareActivity: true, shareJournal: false, shareAlerts: true };

  localStorage.setItem(
    key,
    JSON.stringify({
      ...existing,
      disorders,
      privacy,
    }),
  );
}

const MOCK_USERS = {
  admin: {
    id: "nb-admin-001",
    name: "Dr. Priya Nair",
    email: "admin@neurobridge.in",
    role: "admin",
    abhaId: "27-4567-8901-2345",
    designation: "Lead Clinical Coordinator",
  },
  user: {
    id: "nb-user-042",
    name: "Arun Kumar",
    email: "arun@neurobridge.in",
    role: "user",
    abhaId: "14-2345-6789-0123",
    careLinkId: "CL-ARUN-0042",
    selectedProfile: "ocd",
    disorders: [DISORDERS.OCD],
    privacy: {
      shareActivity: true,
      shareJournal: false,
      shareAlerts: true,
    },
    accessibility: {
      reduceMotion: false,
      screenReader: false,
    },
  },
  "nb-user-011": {
    id: "nb-user-011",
    name: "Meera Pillai",
    email: "meera@neurobridge.in",
    role: "user",
    abhaId: "22-9876-5432-1100",
    careLinkId: "CL-MEERA-0011",
    selectedProfile: "dyslexia",
    disorders: [DISORDERS.DYSLEXIA],
    privacy: {
      shareActivity: true,
      shareJournal: true,
      shareAlerts: true,
    },
    accessibility: { reduceMotion: false, screenReader: true },
  },
  user_asd_anxiety: {
    id: "nb-user-088",
    name: "Riya Sen",
    email: "riya@neurobridge.in",
    role: "user",
    abhaId: "44-8080-9090-1010",
    careLinkId: "CL-RIYA-0088",
    selectedProfile: "asd",
    disorders: [DISORDERS.ANXIETY, DISORDERS.ASD],
    privacy: {
      shareActivity: true,
      shareJournal: true,
      shareAlerts: true,
    },
    accessibility: { reduceMotion: false, screenReader: false },
  },
  guardian: {
    id: "nb-guardian-001",
    name: "Suma Thomas",
    email: "suma@neurobridge.in",
    role: "guardian",
    linkedUserId: "nb-user-042",
    abhaId: "33-1122-3344-5566",
    linkedWardIds: ["nb-user-042", "nb-user-011"],
    relationship: "Parent",
  },
  guardian_asd_anxiety: {
    id: "nb-guardian-088",
    name: "Neha Sen",
    email: "neha.guardian@neurobridge.in",
    role: "guardian",
    linkedUserId: "nb-user-088",
    abhaId: "55-2222-3333-4444",
    linkedWardIds: ["nb-user-088"],
    relationship: "Parent",
  },
  support: {
    id: "nb-support-001",
    name: "Dr. Asha Menon",
    email: "support@neurobridge.in",
    role: "support",
    linkedUserId: "nb-user-088",
    abhaId: "66-2222-1111-0000",
    designation: "Therapist",
  },
};

export const MOCK_WARD_ACTIVITY = {
  "nb-user-042": {
    name: "Arun Kumar",
    profile: "ocd",
    today: [
      { time: "08:14", event: "Completed a 10-min Mindfulness session", type: "positive" },
      { time: "10:02", event: "Resisted 3 compulsions using Ritual Delayer", type: "positive" },
      { time: "12:30", event: "Logged a thought trigger: contamination concern", type: "neutral" },
      { time: "14:55", event: "ERP session: SUDS dropped from 72 → 34", type: "positive" },
      { time: "16:10", event: "SOS Grounding triggered — high anxiety moment", type: "alert" },
      { time: "18:00", event: "Completed 2 Response Prevention Goals", type: "positive" },
    ],
    alerts: [
      { id: "a1", ts: "Today 16:10", level: "high", message: "SOS Grounding activated. SUDS reported at 85.", resolved: false },
      { id: "a2", ts: "Yesterday", level: "medium", message: "Missed 2 scheduled ERP sessions.", resolved: true },
    ],
    journalNotes: [
      { id: "j1", from: "guardian", text: "So proud of you for your ERP session today! 🌟", ts: "Today 08:00", private: false },
      { id: "j2", from: "ward", text: "Felt really anxious at school but used the 4-7-8 breathing.", ts: "Today 13:00", private: false },
    ],
    weeklyStats: { erpSessions: 5, compulsionsResisted: 14, averageSuds: 48, streakDays: 4 },
  },
  "nb-user-011": {
    name: "Meera Pillai",
    profile: "dyslexia",
    today: [
      { time: "09:00", event: "Completed 3 Adaptive Reading modules", type: "positive" },
      { time: "11:30", event: "Word Bank: 12 new words mastered", type: "positive" },
      { time: "14:00", event: "Reader Mode session: 22 minutes", type: "positive" },
    ],
    alerts: [],
    journalNotes: [
      { id: "j3", from: "guardian", text: "Amazing reading session today, Meera!", ts: "Today 09:30", private: false },
    ],
    weeklyStats: { readingModules: 11, wordsMastered: 47, averageSession: 18, streakDays: 7 },
  },
  "nb-user-088": {
    name: "Riya Sen",
    profile: "asd",
    today: [
      { time: "08:10", event: "Started ASD routine visual schedule", type: "positive" },
      { time: "10:05", event: "Sensory break completed with calm breathing", type: "positive" },
      { time: "13:20", event: "Trigger logged: loud classroom noise", type: "neutral" },
    ],
    alerts: [
      { id: "a88-1", ts: "Today 13:20", level: "medium", message: "Sensory trigger detected.", resolved: false },
    ],
    journalNotes: [
      { id: "j88-1", from: "ward", text: "Noise felt too much, breathing helped.", ts: "Today 13:40", private: false },
    ],
    weeklyStats: { calmingSessions: 9, sensoryBreaks: 12, averageAnxiety: 42, streakDays: 5 },
  },
};

function resolveMockAccountKey(role, options = {}) {
  const email = String(options.email || "").toLowerCase().trim();
  const careLinkId = String(options.careLinkId || "").toUpperCase().trim();

  if (email.includes("riya")) {
    return role === "guardian" ? "guardian_asd_anxiety" : "user_asd_anxiety";
  }

  if (email.includes("neha") || careLinkId === "CL-RIYA-0088") {
    return "guardian_asd_anxiety";
  }

  if (role === "user") {
    return "user_asd_anxiety";
  }

  if (role === "guardian") {
    return "guardian_asd_anxiety";
  }

  if (role === "support") {
    return "support";
  }

  return role;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const disorders = useMemo(() => {
    if (!user) return [];
    if (Array.isArray(user.disorders) && user.disorders.length > 0) return user.disorders;
    if (user.selectedProfile) return [user.selectedProfile];
    return [];
  }, [user]);

  const enabledModules = useMemo(
    () => (Array.isArray(user?.enabledModules) ? user.enabledModules : []),
    [user],
  );
  const tagProfile = useMemo(() => user?.tagProfile ?? {}, [user]);
  const enabledFeatures = useMemo(
    () => resolveEnabledFeatures({ disorders, enabledModules }),
    [disorders, enabledModules],
  );
  const hasFeature = useCallback((featureKey) => enabledFeatures.has(featureKey), [enabledFeatures]);

  useEffect(() => {
    let mounted = true;

    const applyAuthenticatedUser = (authUser) => {
      const profile = buildProfileFromSupabase(authUser);
      const persisted = (() => {
        try {
          return JSON.parse(localStorage.getItem(`nb_prefs_${profile.id}`) || "{}");
        } catch {
          return {};
        }
      })();
      const fullUser = { ...profile, ...persisted, _supabase: true };
      localStorage.setItem("nb_auth", JSON.stringify(fullUser));
      if (!mounted) return;
      setUser(fullUser);
      setIsAuthenticated(true);
      setIsLoading(false);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        applyAuthenticatedUser(session.user);
        return;
      }
      try {
        const stored = localStorage.getItem("nb_auth");
        if (stored) {
          const parsed = JSON.parse(stored);
          setUser(parsed);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch {
        localStorage.removeItem("nb_auth");
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    });

    const sessionTimeout = new Promise((resolve) => setTimeout(() => resolve({ data: { session: null } }), 4000));
    Promise.race([supabase.auth.getSession(), sessionTimeout])
      .then(({ data: { session } }) => {
        if (!mounted) return;
        if (session?.user) {
          applyAuthenticatedUser(session.user);
          return;
        }
        try {
          const stored = localStorage.getItem("nb_auth");
          if (stored) {
            const parsed = JSON.parse(stored);
            setUser(parsed);
            setIsAuthenticated(true);
          }
        } catch {
          localStorage.removeItem("nb_auth");
        } finally {
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!mounted) return;
        try {
          const stored = localStorage.getItem("nb_auth");
          if (stored) {
            const parsed = JSON.parse(stored);
            setUser(parsed);
            setIsAuthenticated(true);
          }
        } catch {
          localStorage.removeItem("nb_auth");
        } finally {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const loginWithEmail = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    const profile = buildProfileFromSupabase(data.user);
    const persisted = (() => {
      try {
        return JSON.parse(localStorage.getItem(`nb_prefs_${profile.id}`) || "{}");
      } catch {
        return {};
      }
    })();

    const fullUser = { ...profile, ...persisted, _supabase: true };
    localStorage.setItem("nb_auth", JSON.stringify(fullUser));
    setUser(fullUser);
    setIsAuthenticated(true);
    return fullUser;
  }, []);

  const signUpWithEmail = useCallback(async (email, password, name, role = "user") => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role, disorders: [] },
      },
    });

    if (error) throw new Error(error.message);

    if (data.user && data.user.identities?.length === 0) {
      throw new Error("An account with this email already exists. Please sign in.");
    }

    if (!data.session) {
      return { needsConfirmation: true };
    }

    const profile = buildProfileFromSupabase(data.user);
    localStorage.setItem("nb_auth", JSON.stringify(profile));
    setUser(profile);
    setIsAuthenticated(true);
    return profile;
  }, []);

  const login = useCallback((role, options = {}) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const accountKey = options.accountKey || resolveMockAccountKey(role, options);
        const mockUser = MOCK_USERS[accountKey] || MOCK_USERS[role];

        if (!mockUser) {
          reject(new Error("Invalid role"));
          return;
        }

        const persisted = (() => {
          try {
            return JSON.parse(localStorage.getItem(`nb_prefs_${mockUser.id}`) || "{}");
          } catch {
            return {};
          }
        })();

        const fullUser = {
          ...mockUser,
          ...persisted,
          onboardingCompleted: persisted.onboardingCompleted ?? false,
          _supabase: false,
        };
        localStorage.setItem("nb_auth", JSON.stringify(fullUser));
        syncWardSettingsFromUser(fullUser);
        setUser(fullUser);
        setIsAuthenticated(true);
        resolve(fullUser);
      }, 900);
    });
  }, []);

  const linkWard = useCallback((careLinkId) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const wardId = CARE_LINK_REGISTRY[String(careLinkId || "").trim().toUpperCase()];
        if (!wardId) {
          reject(new Error("Care-Link ID not found. Please check and try again."));
          return;
        }

        setUser((prev) => {
          const updated = {
            ...prev,
            linkedWardIds: [...new Set([...(prev?.linkedWardIds ?? []), wardId])],
          };
          localStorage.setItem("nb_auth", JSON.stringify(updated));
          return updated;
        });

        resolve(wardId);
      }, 700);
    });
  }, []);

  const postGuardianNote = useCallback((wardId, text) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const key = `nb_guardian_notes_${wardId}`;
        const existing = (() => {
          try {
            return JSON.parse(localStorage.getItem(key) || "[]");
          } catch {
            return [];
          }
        })();

        const note = {
          id: `gn-${Date.now()}`,
          from: "guardian",
          text,
          ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          private: false,
        };

        localStorage.setItem(key, JSON.stringify([note, ...existing]));
        pushWardNote(wardId, { from: "guardian", text, wardName: "Ward", isPrivate: false });
        resolve(note);
      }, 400);
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("nb_auth");
    supabase.auth.signOut().catch(() => {});
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      localStorage.setItem("nb_auth", JSON.stringify(updated));
      localStorage.setItem(`nb_prefs_${prev.id}`, JSON.stringify(patch));
      syncWardSettingsFromUser(updated, patch);
      return updated;
    });
  }, []);

  const updateDisorders = useCallback((newDisorders) => {
    return new Promise((resolve) => {
      setUser((prev) => {
        if (!prev) {
          resolve(null);
          return prev;
        }
        const updated = { ...prev, disorders: newDisorders };
        localStorage.setItem("nb_auth", JSON.stringify(updated));
        localStorage.setItem(`nb_prefs_${prev.id}`, JSON.stringify({ disorders: newDisorders }));
        syncWardSettingsFromUser(updated, { disorders: newDisorders });
        resolve(updated);
        return updated;
      });
    });
  }, []);

  const value = {
    user,
    role: user?.role ?? null,
    isAuthenticated,
    isLoading,
    disorders,
    tagProfile,
    enabledModules,
    enabledFeatures,
    hasFeature,
    updateDisorders,
    login,
    loginWithEmail,
    signUpWithEmail,
    logout,
    updateUser,
    linkWard,
    postGuardianNote,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
