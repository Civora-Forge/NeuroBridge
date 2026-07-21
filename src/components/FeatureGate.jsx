/**
 * FeatureGate.jsx  —  Render-level feature guard.
 *
 * Usage:
 *   <FeatureGate feature="ocd.erp-tracker">
 *     <ERPTracker />
 *   </FeatureGate>
 *
 *   <FeatureGate feature="adhd" fallback={<ComingSoon />}>
 *     <ADHDDashboard />
 *   </FeatureGate>
 *
 * If the feature is not in the user's enabled set the children are NEVER
 * mounted — not hidden with CSS, not lazy-loaded.
 */

import { useAuth } from "@/context/AuthContext";

/**
 * @param {{ feature: string, fallback?: React.ReactNode, children: React.ReactNode }} props
 */
export default function FeatureGate({ feature, fallback = null, children }) {
  const { hasFeature } = useAuth();

  if (!hasFeature(feature)) return fallback;
  return children;
}
