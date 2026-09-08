import { useEffect, useState } from "react";
import { MousePointer2 } from "lucide-react";

/**
 * A brief, subtle "the assistant is taking you there" animation: a cursor
 * icon glides from `from` to `to` (viewport pixel coordinates), shows a small
 * click ripple at the destination, then calls onArrive. Purely decorative —
 * the real navigation only happens inside onArrive, driven by the real
 * action the backend returned, never fabricated here.
 */
const GLIDE_MS = 650;
const CLICK_MS = 220;

export default function AgentCursor({ from, to, onArrive }) {
  const [pos, setPos] = useState(from);
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPos(to));
    const clickTimer = setTimeout(() => setClicked(true), GLIDE_MS);
    const arriveTimer = setTimeout(() => onArrive?.(), GLIDE_MS + CLICK_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(clickTimer);
      clearTimeout(arriveTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed z-[100] pointer-events-none transition-all ease-in-out"
      style={{ left: pos.x, top: pos.y, transitionDuration: `${GLIDE_MS}ms`, transform: "translate(-2px, -2px)" }}
      aria-hidden="true"
    >
      <MousePointer2 className="w-5 h-5 text-primary drop-shadow-md" fill="currentColor" />
      {clicked && (
        <span className="absolute -left-2.5 -top-2.5 w-8 h-8 rounded-full border-2 border-primary opacity-70 animate-ping" />
      )}
    </div>
  );
}
