import { useState, useEffect } from "react";
const metaphors = [
    {
        title: "Leaves on a Stream",
        text: "Imagine placing each intrusive thought on a leaf and watching it float away down a gentle stream. You don't need to grab it. Just watch it pass.",
        practice: "Close your eyes. Place this exact thought on a leaf. Picture it drifting slowly downstream. When you're ready, open your eyes.",
    },
    {
        title: "Radio Doom & Gloom",
        text: "Your mind is like a radio station called 'Radio Doom & Gloom.' You can notice it's playing without turning up the volume. Thank your mind for the broadcast.",
        practice: "Say to yourself: \"Thanks, mind, for that broadcast.\" Then return to the room around you. What can you hear right now?",
    },
    {
        title: "The Unwelcome Party Guest",
        text: "The thought is like an uninvited guest at a party. You don't have to entertain them. Acknowledge their presence and return to what matters.",
        practice: "Nod at the guest. Say internally: \"I see you.\" Then immediately look around — pick one thing in the room and describe it to yourself.",
    },
    {
        title: "Passengers on the Bus",
        text: "You are the bus driver. Intrusive thoughts are rowdy passengers. They can shout directions, but you keep driving toward your values.",
        practice: "Ask: what direction am I *actually* going today? Name one value that matters to you. That is your destination — stay on route.",
    },
    {
        title: "Clouds in the Sky",
        text: "You are the sky. Thoughts are just clouds passing through—some dark, some light. None of them are you. None of them stay forever.",
        practice: "Take a slow breath. You are the sky — vast, unchanging. Watch this thought drift across. You are still here when it passes.",
    },
    {
        title: "The Tug-of-War Monster",
        text: "You're in a tug-of-war with a thought-monster over a pit. The winning move? Drop the rope. The monster stays, but you're free.",
        practice: "Literally relax your hands. Open them. Feel that release. You are no longer pulling. The thought is still there — and that is okay.",
    },
];

// Track usage in localStorage
function incrementActSosUses() {
    try {
        const prev = JSON.parse(localStorage.getItem("nb_act_sos_log") ?? "[]");
        prev.push({ id: `sos-${Date.now()}`, createdAt: new Date().toISOString() });
        localStorage.setItem("nb_act_sos_log", JSON.stringify(prev.slice(-100)));
    } catch (_) {}
}

export default function ACTSOSModal({ open, onClose }) {
    const [current, setCurrent] = useState(() => Math.floor(Math.random() * metaphors.length));
    const [phase, setPhase]     = useState("read"); // "read" | "practice"
    const [breathCount, setBreathCount] = useState(0);
    const [breathing, setBreathing]     = useState(false);

    // Reset phase when modal opens fresh
    useEffect(() => { if (open) { setPhase("read"); setBreathCount(0); setBreathing(false); } }, [open]);

    const shuffle = () => {
        let next;
        do { next = Math.floor(Math.random() * metaphors.length); } while (next === current && metaphors.length > 1);
        setCurrent(next);
        setPhase("read");
        setBreathCount(0);
    };

    const handlePractice = () => setPhase("practice");

    const handleBreathe = () => {
        if (breathing) return;
        setBreathing(true);
        let n = 0;
        const t = setInterval(() => {
            n++;
            setBreathCount(n);
            if (n >= 3) { clearInterval(t); setBreathing(false); }
        }, 3000);
    };

    const handleClose = () => {
        incrementActSosUses();
        onClose();
    };

    if (!open) return null;
    const m = metaphors[current];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
            <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"/>
            <div className="relative neuro-card max-w-md w-full p-8 text-center animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">
                    Cognitive Defusion
                </p>
                <h2 className="text-2xl font-bold mb-4">{m.title}</h2>

                {phase === "read" && (
                    <>
                        <p className="text-muted-foreground text-base leading-relaxed mb-6">{m.text}</p>
                        <div className="flex gap-3 justify-center">
                            <button className="neuro-btn-outline text-sm" onClick={shuffle}>
                                Another Metaphor
                            </button>
                            <button className="neuro-btn-primary text-sm" onClick={handlePractice}>
                                Practice This →
                            </button>
                        </div>
                    </>
                )}

                {phase === "practice" && (
                    <>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-4 italic">{m.practice}</p>
                        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 mb-5 space-y-2">
                            <p className="text-xs text-sky-700 font-semibold">Anchor with 3 slow breaths</p>
                            <div className="flex justify-center gap-2">
                                {[1, 2, 3].map((n) => (
                                    <div key={n}
                                        className={`h-7 w-7 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                                            breathCount >= n ? "bg-sky-500 text-white" : "bg-sky-100 text-sky-400"
                                        }`}>
                                        {n}
                                    </div>
                                ))}
                            </div>
                            {!breathing && breathCount < 3 && (
                                <button onClick={handleBreathe} className="text-xs text-sky-600 hover:text-sky-800 underline">
                                    {breathCount === 0 ? "Start breathing" : "Continue"}
                                </button>
                            )}
                            {breathing && <p className="text-xs text-sky-600 animate-pulse">Breathe in… hold… out…</p>}
                        </div>
                        <div className="flex gap-3 justify-center">
                            <button className="neuro-btn-outline text-sm" onClick={() => setPhase("read")}>
                                Back
                            </button>
                            <button className="neuro-btn-primary text-sm" onClick={handleClose}>
                                {breathCount >= 3 ? "I Feel Better ✓" : "I Feel Better"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
