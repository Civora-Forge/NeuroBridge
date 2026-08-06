import { useCallback, useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ContextProvider, useContextState, resolveModuleFromPath } from "@/context/ContextProvider";
import ContextInspector from "@/components/dev/ContextInspector";
import AdaptiveEngineBridge from "@/components/adaptive/AdaptiveEngineBridge";
import { buildUserPreferencesFragment } from "@/support/framework/userPreferencesAdapter";
import { FEATURES } from "@/lib/featureRegistry";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

import DisorderSelection from "./pages/onboarding/DisorderSelection";

import Login from "./pages/Login";
import Home from "./pages/Home";
import LoginUser from "./pages/LoginUser";
import LoginGuardian from "./pages/LoginGuardian";
import LoginSupport from "./pages/LoginSupport";
import NotFound from "./pages/NotFound";
import UserSettings from "./pages/user/UserSettings";
import GuardianDashboard from "./pages/guardian/GuardianDashboard";
import SupportDashboard from "./pages/support/SupportDashboard";
import ToolWorkspace from "./pages/ToolWorkspace";

import ASDPage from "./pages/ASDPage";
import ASDRoutinePage from "./pages/asd/ASDRoutinePage";
import ASDSensoryPage from "./pages/asd/ASDSensoryPage";
import ASDStoriesPage from "./pages/asd/ASDStoriesPage";
import ASDMeltdownPage from "./pages/asd/ASDMeltdownPage";
import ASDEmotionPage from "./pages/asd/ASDEmotionPage";
import ASDSocialScenariosPage from "./pages/asd/ASDSocialScenariosPage";

import EmotionCoach from "./pages/adhd/EmotionCoach";
import VisualTimeline from "./pages/adhd/VisualTimeline";
import TaskBreakdown from "./pages/adhd/TaskBreakdown";
import FocusSessions from "./pages/adhd/FocusSessions";
import BodyDoubling from "./pages/adhd/BodyDoubling";

import DyslexiaDashboard from "./pages/dyslexia/DyslexiaDashboard";
import AdaptiveReadingModule from "./pages/dyslexia/AdaptiveReadingModule";
import PhonologicalTrainingGenerator from "./pages/dyslexia/PhonologicalTrainingGenerator";
import MultiSensoryReinforcementMode from "./pages/dyslexia/MultiSensoryReinforcementMode";
import DyslexiaWritingAssistant from "./pages/dyslexia/DyslexiaWritingAssistant";
import AIPersonalLearningProfile from "./pages/dyslexia/AIPersonalLearningProfile";

import DyscalculiaPage from "./pages/DyscalculiaPage";
import NumberSenseEngine from "./pages/dyscalculia/NumberSenseEngine";
import GuidedStepPractice from "./pages/dyscalculia/GuidedStepPractice";
import RealLifeMathSimulator from "./pages/dyscalculia/RealLifeMathSimulator";
import CalmMode from "./pages/dyscalculia/CalmMode";
import PatternRecognitionTrainer from "./pages/dyscalculia/PatternRecognitionTrainer";

import APDPage from "./pages/APDPage";
import ADHDPage from "./pages/adhd/ADHDPage";

import AnxietyPage from "./pages/AnxietyPage";
import DyspraxiaDashboard from "./pages/dyspraxia/DyspraxiaDashboard";
import AOMILibrary from "./pages/dyspraxia/AOMILibrary";
import HapticPacer from "./pages/dyspraxia/HapticPacer";
import ARInstructionCards from "./pages/dyspraxia/ARInstructionCards";
import SafeRoutePlanner from "./pages/dyspraxia/SafeRoutePlanner";

import OCDPage from "./pages/ocd/OCDPage";
import ERPExposureTracker from "./pages/ocd/ERPExposureTracker";
import ExposureHierarchyBuilder from "./pages/ocd/ExposureHierarchyBuilder";
import SUDSMonitor from "./pages/ocd/SUDSMonitor";
import ExposureSessionTimer from "./pages/ocd/ExposureSessionTimer";
import ERPProgressTracker from "./pages/ocd/ERPProgressTracker";

// ── Depression ─────────────────────────────
import DepressionDashboard from "./pages/depression/DepressionDashboard";
import MVHProtocol from "./pages/depression/MVHProtocol";
import AnxietyDissolver from "./pages/depression/AnxietyDissolver";
import SocialBroadcaster from "./pages/depression/SocialBroadcaster";
import CognitiveReframer from "./pages/depression/CognitiveReframer";
import EvidenceFolder from "./pages/depression/EvidenceFolder";

const queryClient = new QueryClient();

/** Phase 4 app hook-up: feeds the live ContextSnapshot + userId + user
 *  preferences into the flag-gated Adaptive Engine bridge (renders nothing;
 *  inert while the runtime flag is OFF). */
function AdaptiveRuntime() {
  const location = useLocation();
  const { user } = useAuth();
  const { context } = useContextState();
  const moduleId = resolveModuleFromPath(location.pathname);
  const getSnapshot = useCallback(() => context, [context]);
  const userPreferences = useMemo(() => buildUserPreferencesFragment(user), [user]);

  return (
    <AdaptiveEngineBridge
      moduleId={moduleId}
      getSnapshot={context != null ? getSnapshot : undefined}
      userId={user?.id}
      userPreferences={userPreferences}
    />
  );
}

function ShellRoutes() {
  return (
    <ContextProvider>
      <AppLayout>
        <Routes>
        {/* Support-only */}
        <Route
          path="/support-dashboard"
          element={
            <ProtectedRoute role="support">
              <SupportDashboard />
            </ProtectedRoute>
          }
        />

        {/* Guardian-only */}
        <Route
          path="/guardian-dashboard"
          element={
            <ProtectedRoute role="guardian">
              <GuardianDashboard />
            </ProtectedRoute>
          }
        />

        {/* User-only */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute role="user">
              <UserSettings />
            </ProtectedRoute>
          }
        />

        {/* Any authenticated user */}
        <Route
          path="/"
          element={
            <ProtectedRoute role="user">
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tool/:moduleId"
          element={
            <ProtectedRoute role="user">
              <ToolWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/asd"
          element={
            <ProtectedRoute feature={FEATURES.ASD}>
              <ASDPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/asd/routine"
          element={
            <ProtectedRoute feature={FEATURES.ASD}>
              <ASDRoutinePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/asd/sensory"
          element={
            <ProtectedRoute feature={FEATURES.ASD}>
              <ASDSensoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/asd/stories"
          element={
            <ProtectedRoute feature={FEATURES.ASD}>
              <ASDStoriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/asd/meltdown"
          element={
            <ProtectedRoute feature={FEATURES.ASD}>
              <ASDMeltdownPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/asd/emotion"
          element={
            <ProtectedRoute feature={FEATURES.ASD}>
              <ASDEmotionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/asd/social-scenarios"
          element={
            <ProtectedRoute feature={FEATURES.ASD}>
              <ASDSocialScenariosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/adhd/timeline"
          element={
            <ProtectedRoute feature={FEATURES.ADHD_TIMELINE}>
              <VisualTimeline />
            </ProtectedRoute>
          }
        />
        <Route
          path="/adhd/breakdown"
          element={
            <ProtectedRoute feature={FEATURES.ADHD_BREAKDOWN}>
              <TaskBreakdown />
            </ProtectedRoute>
          }
        />
        <Route
          path="/adhd/focus"
          element={
            <ProtectedRoute feature={FEATURES.ADHD_FOCUS}>
              <FocusSessions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/adhd/doubling"
          element={
            <ProtectedRoute feature={FEATURES.ADHD_DOUBLING}>
              <BodyDoubling />
            </ProtectedRoute>
          }
        />
        <Route
          path="/adhd/emotion-coach"
          element={
            <ProtectedRoute feature={FEATURES.ADHD_EMOTION}>
              <EmotionCoach />
            </ProtectedRoute>
          }
        />
        <Route
          path="/adhd"
          element={
            <ProtectedRoute feature={FEATURES.ADHD}>
              <ADHDPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dyslexia"
          element={
            <ProtectedRoute feature={FEATURES.DYSLEXIA}>
              <DyslexiaDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyslexia/reading-module"
          element={
            <Navigate to="/dyslexia/adaptive-reading" replace />
          }
        />
        <Route
          path="/dyslexia/adaptive-reading"
          element={
            <ProtectedRoute feature={FEATURES.DYSLEXIA_ADAPTIVE_READING}>
              <AdaptiveReadingModule />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyslexia/phonology"
          element={
            <ProtectedRoute feature={FEATURES.DYSLEXIA}>
              <PhonologicalTrainingGenerator />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyslexia/reinforcement"
          element={
            <ProtectedRoute feature={FEATURES.DYSLEXIA}>
              <MultiSensoryReinforcementMode />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyslexia/writing-assistant"
          element={
            <ProtectedRoute feature={FEATURES.DYSLEXIA}>
              <DyslexiaWritingAssistant />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyslexia/personal-profile"
          element={
            <ProtectedRoute feature={FEATURES.DYSLEXIA}>
              <AIPersonalLearningProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dyscalculia"
          element={
            <ProtectedRoute feature={FEATURES.DYSCALCULIA}>
              <DyscalculiaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyscalculia/number-sense"
          element={
            <ProtectedRoute feature={FEATURES.DYSCALCULIA}>
              <NumberSenseEngine />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyscalculia/step-practice"
          element={
            <ProtectedRoute feature={FEATURES.DYSCALCULIA}>
              <GuidedStepPractice />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyscalculia/real-life-math"
          element={
            <ProtectedRoute feature={FEATURES.DYSCALCULIA}>
              <RealLifeMathSimulator />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyscalculia/calm-mode"
          element={
            <ProtectedRoute feature={FEATURES.DYSCALCULIA}>
              <CalmMode />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyscalculia/patterns"
          element={
            <ProtectedRoute feature={FEATURES.DYSCALCULIA}>
              <PatternRecognitionTrainer />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ocd"
          element={
            <ProtectedRoute feature={FEATURES.OCD}>
              <OCDPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ocd/exposure-tracker"
          element={
            <ProtectedRoute feature={FEATURES.OCD_ERP_TRACKER}>
              <ERPExposureTracker />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ocd/exposure-hierarchy"
          element={
            <ProtectedRoute feature={FEATURES.OCD_HIERARCHY}>
              <ExposureHierarchyBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ocd/suds-monitor"
          element={
            <ProtectedRoute feature={FEATURES.OCD_SUDS}>
              <SUDSMonitor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ocd/exposure-session"
          element={
            <ProtectedRoute feature={FEATURES.OCD_SESSION_TIMER}>
              <ExposureSessionTimer />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ocd/progress"
          element={
            <ProtectedRoute feature={FEATURES.OCD_PROGRESS}>
              <ERPProgressTracker />
            </ProtectedRoute>
          }
        />

        {/* Depression */}
        <Route
          path="/depression"
          element={
            <ProtectedRoute feature={FEATURES.DEPRESSION}>
              <DepressionDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/depression/mvh"
          element={
            <ProtectedRoute feature={FEATURES.DEPRESSION_MVH}>
              <MVHProtocol />
            </ProtectedRoute>
          }
        />
        <Route
          path="/depression/anxietydissolver"
          element={
            <ProtectedRoute feature={FEATURES.DEPRESSION_ANXIETY_DISSOLVER}>
              <AnxietyDissolver />
            </ProtectedRoute>
          }
        />
        <Route
          path="/depression/social"
          element={
            <ProtectedRoute feature={FEATURES.DEPRESSION_SOCIAL}>
              <SocialBroadcaster />
            </ProtectedRoute>
          }
        />
        <Route
          path="/depression/reality"
          element={
            <ProtectedRoute feature={FEATURES.DEPRESSION_REALITY}>
              <CognitiveReframer />
            </ProtectedRoute>
          }
        />
        <Route
          path="/depression/evidence"
          element={
            <ProtectedRoute feature={FEATURES.DEPRESSION}>
              <EvidenceFolder />
            </ProtectedRoute>
          }
        />

        <Route
          path="/apd"
          element={
            <ProtectedRoute feature={FEATURES.APD}>
              <APDPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyspraxia"
          element={
            <ProtectedRoute feature={FEATURES.DYSPRAXIA}>
              <DyspraxiaDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyspraxia/aomi-library"
          element={
            <ProtectedRoute feature={FEATURES.DYSPRAXIA_AOMI}>
              <AOMILibrary />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyspraxia/haptic-pacer"
          element={
            <ProtectedRoute feature={FEATURES.DYSPRAXIA_HAPTIC}>
              <HapticPacer />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyspraxia/ar-instructions"
          element={
            <ProtectedRoute feature={FEATURES.DYSPRAXIA_AR}>
              <ARInstructionCards />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dyspraxia/safe-route"
          element={
            <ProtectedRoute feature={FEATURES.DYSPRAXIA_ROUTE}>
              <SafeRoutePlanner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/anxiety"
          element={
            <ProtectedRoute feature={FEATURES.ANXIETY}>
              <AnxietyPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </AppLayout>
      <ContextInspector />
      <AdaptiveRuntime />
    </ContextProvider>
  );
}

/* =====================================================
   App Root
===================================================== */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public — no layout, no auth required */}
            <Route path="/login" element={<Login />} />
            <Route path="/login-user" element={<LoginUser />} />
            <Route path="/login-guardian" element={<LoginGuardian />} />
            <Route path="/login-support" element={<LoginSupport />} />

            <Route
              path="/onboarding/disorders"
              element={
                <ProtectedRoute>
                  <DisorderSelection />
                </ProtectedRoute>
              }
            />

            <Route path="/*" element={<ShellRoutes />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
