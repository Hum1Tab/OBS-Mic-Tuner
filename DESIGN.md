# v0.3 redesign

Brief: the software and design feel poor; investigate skills and reference good products, then overhaul the whole experience.

Research: installed skill catalog and the skill-installer curated catalog were checked. Applied the public [frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md). No unrelated cloud/website skills or global plugin installation are needed for an Electron desktop application.

References: [Elgato Wave Link setup](https://www.elgato.com/us/en/explorer/products/wave/wave-link-3-0-software-overview/) for staged microphone setup; [RØDE UNIFY guide](https://rode.com/en-nl/user-guides/unify) for audio-focused organization. No logos, screenshots, or proprietary artwork are copied.

Design plan: a desktop audio workbench with a permanent navigation rail and three task-specific pages. Measurement has a real input waveform and current reading prompt. Listening has a real recorded waveform, transport, and A/B controls. Export has the ordered filter chain and copy/save actions. Avoid a marketing-page hero and a long pile of identical cards.

Tokens: ink #263449, muted #617086, navigation #233449, canvas #f4f7fa, surface #ffffff, accent #217b99. Signal line #2385a6; warning amber only for actionable notices. Typography: Yu Gothic UI/Segoe UI, 14px body, 28px page heading, 18px section heading. Tabular numerals only for measurements. Modest 8–16px radii, no decorative gradients.

Plan critique: a blue sidebar alone is generic. Make the defining element the functional oscilloscope and waveform transport; only actual audio drives it. The current phase, remaining seconds, and next action must be visible together. All later steps are unavailable until real data exists. Instructions live beside the relevant action. Keyboard focus, reduced motion, 900px minimum window, and scrolling for short windows are required.

Completion evidence required: rendered initial/recording/listening/export views, navigation and keyboard operation, all existing audio tests, updated end-to-end smoke test, packaged application smoke test, updated Windows EXE and ZIP. This plan is not a completion claim.

Review outcome: the first export layout used equal-height cards with too much blank space. Replaced it with an ordered vertical filter list, compact parameter groups, and no irrelevant parameter values for disabled filters. Replaced the music glyph with a microphone SVG. The taskbar icon now matches the navigation colors. Screenshot inspection covers the initial state, recording, listening, export, and all pages at minimum width. Packaged smoke tests also exercise the custom transport and help dialog. See VALIDATION.md for executed checks.
