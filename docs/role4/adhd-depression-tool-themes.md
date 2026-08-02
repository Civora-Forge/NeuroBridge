# ADHD And Depression Tool Themes

## Scope

This theme layer applies only inside the ten ADHD and depression support-tool components. It does not change the application shell, home page, login, onboarding, navigation, guardian/support views, or unrelated modules. The global CSS variables remain unchanged.

## Rationale

The defaults are need-informed visual treatments rather than clinical claims or diagnosis labels. They aim to support readable grouping, low visual clutter, quiet writing surfaces, and clear next actions. They do not infer a user's diagnosis, state, or treatment needs.

## Theme IDs And Module Mapping

| Theme | Modules |
| --- | --- |
| `adhd_focus` | Task Breakdown, Focus Session, Visual Timeline, Mood Check-in, Accountability Session |
| `depression_gentle` | Gentle Activity, Grounding, Social Connection |
| `depression_reflection` | Cognitive Reframing, Evidence Journal |

## Architecture

`SupportToolThemeProvider` sets `data-support-theme` and local `--tool-*` variables on a wrapper inside each tool component. The scoped stylesheet uses only these variables: background, surface, strong surface, primary, primary hover, accent, text, muted text, border, focus ring, success, warning, and danger. It does not write `--background`, `--primary`, or other global application variables.

The default tokens are:

| Theme | Background | Primary | Accent | Text | Border |
| --- | --- | --- | --- | --- |
| `adhd_focus` | `#F8F8F5` | `#406D9F` | `#A96824` | `#202C36` | `#C6D0DB` |
| `depression_gentle` | `#F7F6F2` | `#526F7E` | `#A96846` | `#26343B` | `#CCD3D5` |
| `depression_reflection` | `#F6F4F7` | `#685B77` | `#7A6652` | `#302A35` | `#D3CAD7` |

## Accessibility

The theme helper verifies normal and muted text against its local background at WCAG AA 4.5:1 or better, and primary/focus indicators against surfaces at 3:1 or better. Focus-visible outlines are local to themed tool pages. A scoped reduced-motion rule removes decorative animation and transition time when the user requests reduced motion. Labels, status text, and controls continue to communicate state independently of color.

## Override

The provider accepts a validated optional override and safely falls back to the route recommendation. `neutral` disables the local treatment. A user-facing preference control and persistence are intentionally deferred to avoid expanding the global settings surface; future work should be co-designed and tested with users rather than inferred from a diagnosis.

## Limitations

These are visual defaults only. They do not change lifecycle, reflection, memory, personalization, evidence, safety, access control, or Role 1/Role 2 behavior. Future co-design and usability testing should validate the palettes, labels, reduced-motion experience, and optional preference control with diverse users.
