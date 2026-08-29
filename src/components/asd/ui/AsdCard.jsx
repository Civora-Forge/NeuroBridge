/**
 * AsdCard.jsx — the shared card shell for the ASD surface.
 *
 * One consistent shell (soft radius, warm border, left accent rail, gentle
 * offset shadow) so every ASD feature belongs to the same visual language
 * while each feature keeps its own identity through content and accent tone.
 *
 * Can be a plain <section>, an <a> href, or an interactive <button>.
 */

import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const TONE_TEXT = Object.freeze({
  teal: "text-[#0D9488]",
  mint: "text-[#059669]",
  amber: "text-[#D97706]",
  violet: "text-[#7C3AED]",
  rose: "text-[#E11D48]",
  cyan: "text-[#0891B2]",
  sky: "text-[#0284C7]",
  stone: "text-[#0F766E]",
});

export function asdToneText(tone) {
  return TONE_TEXT[tone] ?? TONE_TEXT.teal;
}

export function AsdCard({
  children,
  tone = "teal",
  href,
  to,
  onClick,
  className = "",
  actionLabel,
  "aria-label": ariaLabel,
}) {
  const interactive = Boolean(href || to || onClick);
  const Tag = href ? "a" : to ? Link : interactive ? "button" : "section";
  const props = {};
  if (href) props.href = href;
  if (to) props.to = to;
  if (onClick) props.onClick = onClick;
  if (interactive) {
    props["aria-label"] = ariaLabel ?? actionLabel ?? "Open";
  }
  if (!href && !to) {
    props.type = "button";
  }
  const toneText = asdToneText(tone);

  return (
    <Tag
      {...props}
      className={`relative overflow-hidden rounded-2xl border-2 border-l-4 border-[#B2DFDB] border-l-[#0D9488] bg-white p-5 text-left text-[#134E4A] shadow-[3px_3px_0_#D5F5EC] transition-all ${
        interactive
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0D9488] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200"
          : ""
      } ${className}`}
    >
      {children}
      {actionLabel && (
        <span className={`mt-3 inline-flex items-center gap-1.5 text-sm font-black ${toneText}`}>
          {actionLabel} <ArrowRight size={15} />
        </span>
      )}
    </Tag>
  );
}