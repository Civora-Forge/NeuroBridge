/**
 * AsdChip.jsx — small pill label used across the ASD surface for badges,
 * cues, detected strengths and improvement tags. Text is always the primary
 * meaning; icons/emojis are optional decoration that is aria-hidden.
 */

export function AsdChip({ children, tone = "neutral", icon: Icon = null, className = "", muted = false }) {
  const tones = {
    teal: "bg-[#E0F5EE] text-[#0D9488] border-[#B2DFDB]",
    amber: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
    violet: "bg-[#EDE9FE] text-[#6D28D9] border-[#DDD6FE]",
    rose: "bg-[#FFE4E6] text-[#BE123C] border-[#FECDD3]",
    stone: "bg-[#EFF4F2] text-[#5F8A87] border-[#D5E6E0]",
    neutral: "bg-white text-[#5F8A87] border-[#D5E6E0]",
  };
  const palette = muted ? tones.stone : tones[tone] ?? tones.neutral;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${palette} ${className}`}>
      {Icon && <Icon aria-hidden="true" size={13} className="shrink-0" />}
      <span>{children}</span>
    </span>
  );
}

export function AsdSticker({ emoji, label, size = 32, className = "" }) {
  const safe = label || "decorative sticker";
  return (
    <span role="img" aria-label={label ? `Sticker: ${label}` : undefined} aria-hidden={label ? undefined : true} title={label} className={`inline-grid shrink-0 select-none place-items-center ${className}`} style={{ width: size, height: size, fontSize: size * 0.6 }}>
      {emoji}
    </span>
  );
}