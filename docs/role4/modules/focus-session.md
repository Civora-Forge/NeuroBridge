# Focus Session Lifecycle Integration

- Canonical ID: `support.focus_session`
- Route: `/adhd/focus`
- Start: existing Start button only; page load is local setup.
- Progress: persisted once at 25%, 50%, and 75%, never every second.
- Pause/resume: existing button maps to lifecycle pause/resume.
- Completion: timer expiry completes once with `completedNaturally: true`.
- Reset: active unfinished sessions abandon; pre-start reset creates no record; unmount does not abandon.
- Outcome: planned/actual duration, pause/resume count, completion ratio, interruptions, natural completion, and break flags. No intent, tag, audio, or free text is persisted.
- Reflection: aggregate completion ratio, planned duration, pause count, and natural completion insights.
- Memory/hints: reflected duration, low-pause completion, long-session abandonment, and completion-ratio patterns may create advisory memory and hints. Reflection v1 does not supply break duration, so no preferred break hint is invented.
- Evidence: the generic API reports Focus Session aggregate history without ranking.
- Authentication: missing user IDs retain local timer and legacy streak behavior but write no Role 4 records.
- Compatibility: `focusforge-streak` remains unchanged; a future phase may derive it from canonical outcomes.
