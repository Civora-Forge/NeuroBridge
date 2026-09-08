/**
 * Locates the real, currently-rendered link on screen that corresponds to an
 * agent navigation action's `path` — so the cursor animation has a genuine
 * on-screen destination to glide to, never a fabricated position.
 *
 * Falls back to the top-level module link (e.g. "/adhd" for "/adhd/breakdown")
 * when the exact sub-route isn't visible on the current page (most module
 * sub-tools only render as links on that module's own dashboard). Returns
 * null when nothing reasonable is found — callers must navigate directly
 * without an animation in that case, never block on it.
 */
export function findNavTarget(path) {
  if (!path || typeof document === "undefined") return null;

  const exact = document.querySelector(`a[href="${path}"]`);
  if (exact) return exact;

  const topSegment = "/" + path.split("/").filter(Boolean)[0];
  if (topSegment === "/") return null;
  return document.querySelector(`a[href="${topSegment}"]`);
}
