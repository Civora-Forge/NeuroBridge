/**
 * AsdScene.jsx — the shared illustrated-scene backdrop for the ASD surface.
 *
 * A soft gradient "scene" with blurred decorative blobs and an optional
 * character/emoji centrepiece. Used by Social Stories scene art, the Emotion
 * Decoder and the Scenario Simulator so those features feel like moving
 * through pictures rather than reading documents. Decoration is always
 * `aria-hidden`; meaningful labels are passed separately.
 *
 * Respects the existing visual style (younger scales art up, clear calms it
 * down via `.asd-illustration`) and reduced motion.
 */

import { useSensoryReducedMotion } from "@/hooks/useSensoryReducedMotion";

const BLOB_PALETTES = [
  { a: "rgba(255,255,255,0.85)", b: "rgba(221,214,254,0.55)" },
  { a: "rgba(255,255,255,0.9)", b: "rgba(165,243,252,0.5)" },
  { a: "rgba(255,255,255,0.9)", b: "rgba(254,240,138,0.45)" },
  { a: "rgba(255,255,255,0.9)", b: "rgba(254,205,211,0.45)" },
];

export function AsdScene({
  gradient,
  emoji = null,
  emojiSize = 72,
  blobs = true,
  blobPalette = 0,
  contentClassName = "",
  className = "",
  children,
  style = null,
}) {
  const { reduced } = useSensoryReducedMotion();
  const palette = BLOB_PALETTES[blobPalette % BLOB_PALETTES.length] ?? BLOB_PALETTES[0];

  return (
    <div className={`asd-scene ${className}`} style={{ background: gradient, ...style }}>
      {blobs && (
        <span aria-hidden="true">
          <i
            className="asd-scene-blob"
            style={{
              top: -64,
              left: -56,
              width: 230,
              height: 230,
              background: `radial-gradient(circle at 35% 35%, ${palette.a}, ${palette.b})`,
            }}
          />
          <i
            className="asd-scene-blob"
            style={{
              bottom: -66,
              right: -44,
              width: 190,
              height: 190,
              background: `radial-gradient(circle at 40% 40%, ${palette.a}, ${palette.b})`,
            }}
          />
          <i
            className="asd-scene-blob"
            style={{
              top: "28%",
              right: "10%",
              width: 120,
              height: 120,
              opacity: 0.6,
              background: `radial-gradient(circle at 35% 35%, ${palette.a}, ${palette.b})`,
            }}
          />
        </span>
      )}

      {emoji && (
        <span
          aria-hidden="true"
          className="asd-illustration pointer-events-none absolute inset-x-0 top-4 grid select-none place-items-center drop-shadow-[0_6px_16px_rgba(13,148,136,0.18)]"
          style={{ fontSize: emojiSize }}
        >
          {reduced ? null : <span className="asd-float" style={{ "--asd-float-dur": "6.5s" }}>{emoji}</span>}
        </span>
      )}

      <div className={`asd-scene-content ${contentClassName}`}>{children}</div>
    </div>
  );
}

export default AsdScene;