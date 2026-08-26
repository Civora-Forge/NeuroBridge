# Role 1 Context Comparison

Role 1 owns snapshot generation. Role 4 accepts caller-supplied snapshots or references and never retrieves or creates snapshots itself. The minimal reference retains IDs, timestamps, optional emotion/activity fields, intent, urgency, and confidence; raw conversation, profiles, environment, events, and reasoning are omitted.

Comparisons are optional, serializable, and observational only. Missing sides produce an unavailable comparison. Deltas never establish intervention effectiveness or causation. Live Role 1 lookup and post-intervention snapshot wiring are deferred because no stable public lookup/request API currently exists.

Verification: focused 2 files / 2 tests; full suite 41 files / 214 tests. Lint is blocked only by the existing `src/adaptive/context/jitaiService.js:118` parser error.
