# Gentle Activity

- Canonical ID: `support.gentle_activity`; route: `/depression/mvh`.
- The first completed MVH action starts the lifecycle; each action reports aggregate progress; all five steps complete once; explicit reset after start abandons with aggregate outcome. Page open, pre-start reset, and unmount do not create interventions.
- Outcomes contain only total/completed steps, completion ratio, duration, optional bounded 1-5 energy values and delta, natural completion, and pacing configuration.
- Reflection uses aggregate completion, step pattern, and non-clinical energy-change categories. Memory derives completion and high-step-abandonment patterns; hints are advisory `reduceStepCount` and `useLowEffortProtocol`; generic Support Evidence aggregates the canonical module without ranking.
- Missing authenticated user IDs keep the protocol local. No raw steps, journals, transcripts, diagnosis, or treatment claims are stored.
- Limitation: no preferred pacing hint is created until sanitized configuration evidence is reflected.
