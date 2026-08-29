/**
 * AsdCharacter.jsx — a friendly, non-childish character avatar for the ASD
 * surface. A soft gradient "friend" with a simple face and an optional
 * accessory sticker. Used to represent story characters, scenario NPCs and the
 * conversation partner. Decorative text/emoji are always aria-hidden; a label
 * is provided for screen readers where one is passed.
 */

const TONES = Object.freeze({
  teal: { bg: "linear-gradient(135deg,#99F6E4 0%,#2DD4BF 55%,#0D9488 100%)", face: "#0F3D38", ring: "#5EEAD4" },
  mint: { bg: "linear-gradient(135deg,#D1FAE5 0%,#6EE7B7 60%,#34D399 100%)", face: "#0B3B33", ring: "#A7F3D0" },
  amber: { bg: "linear-gradient(135deg,#FEF3C7 0%,#FCD34D 60%,#F59E0B 100%)", face: "#4A3203", ring: "#FDE68A" },
  violet: { bg: "linear-gradient(135deg,#EDE9FE 0%,#C4B5FD 60%,#8B5CF6 100%)", face: "#2E1065", ring: "#DDD6FE" },
  rose: { bg: "linear-gradient(135deg,#FFE4E6 0%,#FDA4AF 60%,#F43F5E 100%)", face: "#4C0519", ring: "#FECDD3" },
  cyan: { bg: "linear-gradient(135deg,#CFFAFE 0%,#67E8F9 60%,#06B6D4 100%)", face: "#164E63", ring: "#A5F3FC" },
  sky: { bg: "linear-gradient(135deg,#E0F2FE 0%,#7DD3FC 60%,#0EA5E9 100%)", face: "#0C4A6E", ring: "#BAE6FD" },
});

const ACCESSORY_LIST = Object.freeze({
  leaf: { emoji: "🍃", label: "a small leaf friend" },
  star: { emoji: "⭐", label: "a star friend" },
  flower: { emoji: "🌸", label: "a flower friend" },
  cloud: { emoji: "☁️", label: "a cloud friend" },
  heart: { emoji: "💛", label: "a heart" },
  spark: { emoji: "✨", label: "a sparkle" },
  music: { emoji: "🎵", label: "a music note" },
  book: { emoji: "📖", label: "a little book" },
  hand: { emoji: "👋", label: "a waving hand" },
});

export function AsdCharacter({
  tone = "teal",
  name = "Friend",
  size = 72,
  accessory = null,
  accessoryLabel = null,
  ariaHidden = false,
  className = "",
}) {
  const palette = TONES[tone] ?? TONES.teal;
  const sticker = accessory && ACCESSORY_LIST[accessory]
    ? { emoji: ACCESSORY_LIST[accessory].emoji, visible: true }
    : null;

  const eye = { width: size * 0.09, height: size * 0.12, borderRadius: "50%", background: palette.face };

  return (
    <span
      role={ariaHidden ? "presentation" : undefined}
      aria-hidden={ariaHidden ? true : undefined}
      aria-label={ariaHidden ? undefined : name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full align-middle select-none ${className}`}
      style={{
        width: size,
        height: size,
        background: palette.bg,
        boxShadow: `0 ${Math.round(size * 0.06)}px ${Math.round(size * 0.18)}px rgba(15,118,110,0.14)`,
        outline: `3px solid ${palette.ring}`,
        outlineOffset: -3,
        position: "relative",
      }}
    >
      {/* face */}
      <span aria-hidden="true" className="flex flex-col items-center justify-center gap-[14%]" style={{ width: size * 0.5 }}>
        <span aria-hidden="true" className="flex items-center justify-between" style={{ width: size * 0.46 }}>
          <span style={eye} />
          <span style={eye} />
        </span>
        <span
          aria-hidden="true"
          style={{
            width: size * 0.26,
            height: size * 0.1,
            borderBottom: `${Math.max(2, Math.round(size * 0.045))}px solid ${palette.face}`,
            borderRadius: "0 0 999px 999px",
          }}
        />
      </span>

      {sticker && (
        <span
          aria-hidden="true"
          className="absolute grid place-items-center"
          style={{ top: size * -0.05, right: size * -0.08, fontSize: size * 0.3 }}
          title={accessoryLabel ?? ACCESSORY_LIST[accessory].label}
        >
          {sticker.emoji}
        </span>
      )}
    </span>
  );
}

export function getCharacterToneForScenarios() {
  return Object.keys(TONES);
}