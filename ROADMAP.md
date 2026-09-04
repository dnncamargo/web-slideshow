# PowerShow Roadmap

This document records the **PowerShow execution path from the canonical-document foundation to the current work area**.

Its purposes are:

1. preserve enough implementation history that completed architectural decisions are not accidentally reopened;
2. define the current execution order without allowing stale branches, old handoffs or historical SHAs to become competing sources of truth.

Merged code in `main` remains authoritative. Every new work area begins by revalidating the real repository state.

## Status legend

- ✅ complete / merged
- 🟡 useful operational base complete; future expansion exists
- ← NEXT current planned execution area
- planned future checkpoint
- deferred intentional backlog/future work

## Execution policy

PowerShow uses audit-first, checkpoint-driven development:

```text
AUDIT current code
→ collect EVIDENCE
→ freeze the smallest DECISION
→ IMPLEMENT narrowly
→ TEST
→ inspect the real remote SHA / diff / files
→ manual acceptance when visual/runtime behavior requires it
→ PR / merge
```

Core rules:

- `schemaVersion` stays literally `1`;
- no migration, dual schema, compatibility layer or generic abstraction without a concrete requirement;
- current code in `main` is the first authority for implementation details;
- tests are contractual evidence but do not replace manual visual/runtime acceptance;
- search/reuse existing ownership before creating another state, protocol or abstraction;
- branch names and historical SHAs are evidence only — always fetch and revalidate;
- completed architecture should not be reopened speculatively.

---

# P0–P8 — Foundation history ✅

These headings group the early repository chronology; merged PRs remain the detailed authority.

## P0 — Canonical document foundation ✅

Reference: PR #2.

Established strict `@powershow/document-schema`, recursive semantic elements, runtime validation and `schemaVersion: 1`.

## P1 — Renderer and Player foundation ✅

References: PRs #3–#5.

Established the shared rendering boundary:

```text
canonical Presentation
→ shared renderer
→ Studio preview / Player runtime
```

## P2 — Studio Editor V0 ✅

References: PRs #6–#13.

Delivered the first visual authoring shell, slide CRUD/navigation, recursive element selection/update, inspectors, presets and localization.

## P3 — Visual authoring vocabulary ✅

References: PRs #14–#29.

Expanded typography, gradients, fonts, reusable colors, Image sizing and style authoring.

## P4 — Hierarchy, positioning and Canvas authoring ✅

References: PRs #30–#38.

Delivered Container Flow/Stack, hierarchy operations, Canvas move/resize, Image proportional resize and focal authoring.

Canonical placement after later cleanup:

```text
Flow
→ no authored layout.position

Absolute
→ layout.position: "absolute"
→ direct top/right/bottom/left edges
```

## P5 — Firebase persistence, Library and autosave ✅

References: PRs #39–#41.

Established user-scoped Firestore drafts, Library workflows, repository-backed Editor loading and debounced/explicit save.

## P6 — Immutable publishing ✅

Reference: PR #42.

Established immutable published presentation versions. Existing versions are never modified in place.

## P7 — Authentication, public pointer and remote-control base ✅

References: PRs #43–#44.

Delivered Studio authentication, public publication pointer, Control boundary and RTDB remote-navigation base.

## P8 — Live activation and Library entry ✅

References: PRs #45–#46.

Established Library Present / Control / End lifecycle. Publish and Present remain separate operations.

---

# P9 — Live presentation foundation ✅

References: PRs #47–#57 and later hardening.

Delivered:

- Player live entry from `live/current`;
- exact immutable-version loading;
- logical `pageId` navigation;
- Control desired state;
- Player applied state / ACK;
- coalescing and latency evidence;
- reload/reconnect convergence;
- staged publication updates and explicit version promotion;
- private slide Notes outside the canonical Presentation;
- Watch following actual Player-applied state.

Core flow:

```text
Control desired state
→ RTDB
→ Player applies immutable published state
→ Player applied state / ACK
→ Control + Watch observe convergence
```

---

# P10 — Canonical Authoring & Import Foundation ✅

Goal: one strict, semantic, self-contained Presentation that can be authored, persisted, published, rendered, exported and imported without a second persisted language.

Final baseline rules include:

- `schemaVersion` remains `1`;
- strict responsibility-specific element contracts;
- no universal persisted style bag;
- no historical placement compatibility model;
- Player is independent of Studio-private resources;
- `textbox` is not canonical; boxed text is `Container + Text`;
- import/export operate directly on the canonical Presentation.

| Checkpoint | Area | Status | Main references |
|---|---|---:|---|
| P10.1 | Typography & Fonts refinement | ✅ | #58–#59 |
| P10.2 | Links / Interaction | ✅ | #60–#62 |
| P10.3 | ContentSlot foundation | ✅ | #63 |
| P10.4 | Topics | ✅ | #64–#66 |
| P10.5 | Structured Table | ✅ | #73 |
| P10.6 | Inline Text / Rich Text foundation | ✅ | #74 |
| P10.7 | Gallery minimum | ✅ | #75 |
| P10.8 | Embed minimum | ✅ | #76 |
| P10.9 | Blocks + Code semantics | ✅ | #77–#78 |
| P10.10 | Scripted minimum | ✅ | #79 |
| P10.11 | Canonical Contract Cleanup | ✅ | #80–#83 |
| P10.12 | JSON Import / Export | ✅ | #84 |

P10.8 and P10.10 are minimum implementations, not a declaration that Embed or Scripted need no further product refinement.

---

# P11 — Resources, Organization & Text Styles ✅

References: PRs #69–#71, #85–#105, with later refinement in PRs #125 and #129.

Delivered:

- shared Studio / Library shell;
- private folders;
- Custom Library Styles/Palettes/Fonts;
- Presentation-local Palette, FontResources and Text Styles;
- refined Text Inspector;
- explicit recovery rather than migration;
- real Text Style usage locations and navigation;
- target-aware Text Style and Linked Style association UX;
- projected Text Styles count;
- compact shared resource-action styling for Add/Apply controls.

Text Style precedence:

```text
Theme role baseline
→ Text Style
→ local Text override
```

A detached Text is excluded from usage/removal safety even if it retains a fundamental `variant` role.

Linked Styles remain a different mechanism:

```text
Theme / defaults
→ Linked Style
→ local Container override
```

Current V1 is Container-only, Presentation-scoped and self-contained.

---

# P12 — UX / Properties refinement ✅

Delivered:

- shared logical slide geometry;
- Player/Editor/Presenter/Watch geometry convergence;
- Palette and gradient corrections;
- Container `layout.overflow`;
- Children Fit (`Contain`, `Cover`, `Fill`);
- Preserve size through `layout.flexShrink?: 0`;
- import/export regression coverage;
- Image Inspector ordering and Preserve proportion refinement;
- native-focus Delete → Enter confirmation flow in PR #126;
- checkbox-first Container `Preserve size` Inspector grammar in PR #129.

Direct Canvas manipulation inside transformed fitted Containers remains deferred until inverse transformed-authoring geometry is deliberately implemented.

---

# Runtime and product surfaces ✅

Current surfaces:

```text
PowerShow
│
├── Public Portal        /
├── Studio
│   ├── Library          /studio/library
│   ├── Editor           /studio/editor
│   └── Control          /studio/control
│       └── Maintenance  /studio/control/maintenance
└── Live Runtime
    ├── Player
    └── Watch
```

Canonical product names are PowerShow Library, PowerShow Editor, PowerShow Control, PowerShow Player and PowerShow Watch.

Public Portal / Live Cover is complete through PR #109. Cover remains static/read-only; Watch remains the actual audience follower.

---

# Gallery V1 ✅

References: PRs #114–#115.

Gallery is one semantic media frame with ordered items and no per-item IDs. Delivered Studio item authoring, Image↔Gallery structure operations, Player local advance/expanded behavior and one-way Control commands through `live/galleryControl/<slot>`.

Gallery deliberately has no ACK or Player→Control Gallery synchronization.

---

# Maintenance & Diagnostics — first operational slice ✅

References: PRs #116–#119, #121 and Suite-chrome PR #127.

Delivered:

- Player presence/current report and boot-scoped leases;
- Control/Maintenance status evidence;
- remote reload;
- same-boot presentation retry;
- real browser-cache clear path;
- Player-local recovery options;
- Maintenance under PowerShow Control;
- canonical Suite topbar with `<<< Back to presentation`;
- square diagnostic cards and Suite tokens.

Diagnostics remains bounded. Do not turn it into a generic fleet/admin console, expose secrets, add history/polling without need, or create broad automatic repair.

---

# Persistence serialization hardening ✅

Reference: PR #120.

Firestore persists canonical Presentation content as `presentationJson`, parsed and validated through `PresentationSchema` on read. This avoids deep nested-map limits without introducing a second canonical format.

---

# Blocks — grammar-based didactic visual authoring ✅

References: PRs #122–#123.

Canonical Blocks persists a single `source` string. A handwritten parser creates transient structure for the shared static renderer.

Grammar:

```text
\start(...)
\statement(...)
\scope(...){...}
\end(...)
\value(...)
\variable(...)
\logic(...)
```

Blocks is static/didactic, not executable. Do not add interpreter/compiler/runtime behavior without a separately approved requirement.

---

# Editor Resource Controls polish ✅

Reference: PR #129.

Merged refinements:

- Container `Preserve size` checkbox appears before its label;
- `+ Add Linked Style` uses the compact shared resource-action visual;
- `+ Add Style` uses intrinsic width rather than stretching across the panel;
- Custom Library Apply uses `Apply to selected` / `Aplicar à seleção` and the same shared action visual;
- Text Styles exposes the same count-pill grammar as Linked Styles, derived from the projected style set including fundamentals;
- Custom Library Apply fallback/Retry styling remains local to the reusable picker.

This work is now part of `main`; there is no remaining integration gate for `fix/editor-resource-control-polish`.

---

# Scripted enhancement ← NEXT

`scripted` already exists in the canonical union, Editor and shared renderer. The active work is refinement, especially controlled interaction, not element creation.

## Current audited contract

Canonical authored fields:

```text
ScriptedElement
├── id
├── type: "scripted"
├── hidden
├── layout?
├── style?
├── effect?
├── title
├── html
├── css
└── script
```

Editor behavior:

- `title`, `html`, `css`, `script` are edited in local drafts;
- drafts commit together through explicit **Apply / Run**;
- Reset restores local drafts to canonical values;
- the Inspector does not execute authored JavaScript itself;
- canonical updates may recreate the iframe, so write-on-every-keystroke is intentionally avoided.

Renderer-owned security boundary:

```text
sandbox="allow-scripts"
referrerpolicy="no-referrer"
fixed CSP
```

The fixed CSP denies network connections, child frames, objects, forms, top navigation and external resource origins except deliberately allowed data/blob media/font cases. Scripted has no same-origin permission, no storage, no Firebase/session access and no authored sandbox policy. The renderer bootstrap does not use `eval`, `Function`, `document.write` or string timers.

## S0 — real-system audit

Before implementation, re-audit:

- current `ScriptedElementSchema` and defaults;
- `scripted-inspector.tsx` drafts / Apply-Run lifecycle;
- `render-scripted.ts` sandbox, CSP and bootstrap;
- active-slide Player lifecycle/remount behavior;
- current Player/Watch rendering ownership;
- Control ownership and Gallery/live-state precedents;
- RTDB rules and cleanup conventions;
- existing tests/fixtures;
- security boundaries that must remain permanent.

Do not assume an old handoff exactly matches the latest code.

## Planned interaction direction

The intended refinement is a **small declared control surface** rather than arbitrary application access.

Conceptual declaration:

```text
control
├── stable id / name
├── operator label
└── kind
    ├── action
    └── boolean state
```

Candidate V1 semantics:

```text
action:
- scroll up
- scroll down
- reset
- next step

boolean state:
- switch on/off
- play/paused
- visible/hidden
```

The exact persisted declaration shape is **not frozen** until S0/S1 audit evidence is reviewed.

## Bridge/security invariants

If the bridge is promoted:

```text
Control intent
→ Scripted-specific RTDB state/command
→ Player validates activation/version/page/slot/element/control identity
→ Player postMessage to the mounted sandbox
→ sandbox may report explicitly declared state
→ Player validates event.source + strict envelope
→ Control observes validated state where required
```

Permanent constraints:

- no `allow-same-origin` for Scripted;
- no Firebase SDK/tokens/session exposure inside authored code;
- no parent DOM access;
- no top navigation/forms/popups/downloads/storage;
- no `eval` / `Function`;
- no JavaScript payload delivered through RTDB;
- Presentation remains the owner of authored code/declarations;
- runtime state is transient and scoped to the active runtime;
- stale/delayed commands must be rejected across activation/version/page/remount changes.

Suggested checkpoints:

```text
S0 — audit current implementation and runtime lifecycle
S1 — freeze action + boolean control declaration contract
S2 — sandbox bridge / fixed API / message validation
S3 — Studio authoring for declarations
S4 — RTDB protocol + Player routing + rules
S5 — contextual Control UI + state/pending semantics
S6 — circuit/classic-scroll acceptance and hardening
```

Use the narrowest checkpoint possible. Do not implement a generic automation/event framework.

---

# Embed adjustments — NEXT AFTER SCRIPTED

`embed` is an existing minimum implementation.

## Current audited contract

Canonical authored fields:

```text
EmbedElement
├── id
├── type: "embed"
├── hidden
├── layout?
├── style?
├── effect?
├── src      absolute http/https URL
└── title    required accessibility title
```

Editor behavior:

- `src` and `title` use local drafts;
- valid values commit on blur/Enter;
- Escape restores the canonical value;
- invalid URL/title drafts never enter canonical state;
- iframe security policy is not authorable in Studio.

Renderer-owned policy currently uses:

```text
sandbox="allow-scripts allow-forms allow-same-origin"
allow="fullscreen"
referrerpolicy="strict-origin-when-cross-origin"
loading="lazy"
```

The same-origin + scripts combination is practical for external providers but security-sensitive, especially for same-origin URLs. That is a renderer concern, not permission to expose arbitrary authored sandbox tokens.

## E0 — Embed audit

Before changing Embed, establish the concrete product problems to solve and audit:

- which real providers/URLs currently fail or behave poorly;
- same-origin versus cross-origin behavior;
- fullscreen behavior;
- referrer requirements;
- iframe sizing/fit and Editor interaction ergonomics;
- URL normalization/provider convenience versus canonical generic URL ownership;
- security implications of `allow-same-origin` + `allow-scripts`;
- current tests and runtime behavior in Player/Watch;
- whether any provider-specific handling is actually necessary.

Do not make `sandbox`, Permissions Policy or provider internals authored Presentation fields merely for convenience.

Suggested progression:

```text
E0 — audit real Embed failures/use cases
E1 — freeze renderer/security and authoring responsibilities
E2 — targeted renderer/provider correction
E3 — Studio UX refinement if needed
E4 — Player/Watch/manual provider acceptance
```

---

# Explicitly deferred

## Chart V1 — deferred

Chart remains canonical semantic data (`line`, `bar`, `area`, `scatter`) with placeholder rendering. The user explicitly deferred implementation. Do not select a charting library or alter the Chart contract until Chart is promoted again.

## publishNow — deferred

The proposed Editor `publishnow=true` fast-live mode is intentionally paused. Do not add deferred-revision metadata, hot snapshots, Control bypass or Player changes until the user explicitly resumes this work.

## Topics consuming Typography Styles — deferred concept

Current Topics owns its own typography context while TopicItem content may contain Text elements with their own Text Style/local semantics. A future design may allow Topics itself to consume a Typography Style, but this is not implemented or frozen.

---

# P13 — Production Readiness — planned

Future production work may include:

- full Studio → Save/reload → Publish → Control → Player E2E;
- auth/rules/public-read review;
- deploy/smoke/rollback procedures;
- Player performance on constrained hardware;
- physical Firefox 116 Android/touch verification where still relevant;
- responsive acceptance;
- security review for Embed and Scripted;
- production error/recovery surfaces.

Production Readiness should be promoted from concrete deployment/reliability needs rather than cosmetic backlog.

---

# P14 — Maintenance & Diagnostics 🟡

D0–D2 is complete and no longer active. Future expansion should be evidence-driven and remain bounded.

---

# P15 — Audience / Watch expansion — future

Watch already follows actual Player-applied state. Viewer presence/count/nickname and richer audience behavior remain future candidates and must never grant audience clients control of shared presentation state.

---

# Other future candidates

- mobile Control / Library simplification when promoted;
- configurable slide transitions;
- bounded local Undo / Redo distinct from immutable Version History;
- AI Import producing the existing canonical Presentation;
- Player offline continuity from the last valid immutable version;
- custom-variant portability for Custom Library recipes;
- remaining WYSIWYG/Text refinements;
- visual vocabulary refinements driven by real presentation needs.

Further Gallery or Blocks changes require concrete observed needs, not generic V2 milestones.

---

# Current execution summary

```text
P0    Canonical document foundation                         ✅
P1    Renderer + Player foundation                          ✅
P2    Studio Editor V0                                      ✅
P3    Visual authoring vocabulary                           ✅
P4    Hierarchy / positioning / direct Canvas              ✅
P5    Firebase persistence / Library / autosave             ✅
P6    Immutable publishing                                  ✅
P7    Auth / publication pointer / remote-control base      ✅
P8    Live activation / Library Present-Control-End         ✅
P9    Live presentation foundation                          ✅
P10   Canonical Authoring & Import Foundation               ✅
P11   Resources, Organization & Text Styles                 ✅
P12   UX / Properties refinement                            ✅
       Runtime / Control / Watch refinement                 ✅
       Public Portal / Live Cover                           ✅
       Linked Styles                                        ✅
       Gallery V1                                           ✅
       Maintenance & Diagnostics D0–D2                     ✅
       Persistence serialization hardening                  ✅
       Blocks visual authoring                              ✅
       Typography usage / associations (#125)               ✅
       Image/Delete ergonomics (#126)                       ✅
       Maintenance Suite chrome (#127)                      ✅
       Editor Resource Controls polish (#129)               ✅

NEXT:
  Scripted enhancement — begin with S0 audit

THEN:
  Embed adjustments — begin with E0 audit

DEFERRED:
  Chart V1
  publishNow
  Topics → Typography Style consumer concept

FUTURE / AS PROMOTED:
  Production Readiness
  Player resilience
  Audience / Watch expansion
```

The next implementation session must begin by auditing the **real current `main`** and Scripted ownership boundaries before freezing any new canonical or RTDB contract.
