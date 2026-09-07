# PowerShow Roadmap

This document records the **PowerShow execution path from the canonical-document foundation to the current work area**.

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
→ branch closure
→ PR / merge
→ verify the remote merge
→ return local repository to updated main
```

Core rules:

- `schemaVersion` stays literally `1`;
- no migration, dual schema, compatibility layer or generic abstraction without a concrete requirement;
- current code in `main` is the first authority for implementation details;
- tests are contractual evidence but do not replace manual visual/runtime acceptance when acceptance is required;
- search/reuse existing ownership before creating another state, protocol or abstraction;
- branch names and historical SHAs are evidence only — always fetch and revalidate;
- completed architecture should not be reopened speculatively.

### Branch closure — mandatory before PR

Before opening a PR for a completed work area:

1. audit the complete branch diff against current `main`;
2. confirm only the intended files/scope changed;
3. run the relevant final suite, typecheck and `git diff --check`;
4. confirm the worktree is clean;
5. confirm the branch is not unexpectedly behind `main`.

If closure reveals a new failure, audit its cause before patching it. A PR is opened only after the branch is technically ready.

### Post-merge closure — mandatory

After every PR + merge:

```text
git fetch origin --prune
git switch main
git pull --ff-only origin main
```

Then verify:

```text
branch == main
HEAD == origin/main
worktree clean
```

Do not begin a new work area or create a new feature branch from a stale local `main`. If fetch/switch/pull fails or the worktree is unexpectedly dirty, stop and report instead of repairing history automatically.

---

# P0–P8 — Foundation history ✅

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

Existing published versions are immutable.

## P7 — Authentication, public pointer and remote-control base ✅

References: PRs #43–#44.

Delivered Studio authentication, public publication pointer, Control boundary and RTDB remote-navigation base.

## P8 — Live activation and Library entry ✅

References: PRs #45–#46.

Established Library Present / Control / End lifecycle. Publish and Present remain separate operations.

---

# P9 — Live presentation foundation ✅

References: PRs #47–#57 and later hardening.

Delivered Player live entry, immutable-version loading, logical `pageId` navigation, Control desired state, Player applied state / ACK, latency evidence, reconnect convergence, staged publication promotion, private Notes and Watch following actual Player-applied state.

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

| Checkpoint | Area | Status | Main references |
|---|---|---:|---|
| P10.1 | Typography & Fonts refinement | ✅ | #58–#59 |
| P10.2 | Links / Interaction | ✅ | #60–#62 |
| P10.3 | ContentSlot foundation | ✅ | #63 |
| P10.4 | Topics minimum | ✅ | #64–#66 |
| P10.5 | Structured Table | ✅ | #73 |
| P10.6 | Inline Text / Rich Text foundation | ✅ | #74 |
| P10.7 | Gallery minimum | ✅ | #75 |
| P10.8 | Embed minimum | ✅ | #76 |
| P10.9 | Blocks + Code semantics | ✅ | #77–#78 |
| P10.10 | Scripted minimum | ✅ | #79 |
| P10.11 | Canonical Contract Cleanup | ✅ | #80–#83 |
| P10.12 | JSON Import / Export | ✅ | #84 |

Permanent P10 invariants include:

- `schemaVersion` remains `1`;
- strict responsibility-specific contracts;
- no universal persisted style bag;
- Player independent of Studio-private resources;
- `textbox` is not canonical; boxed text is `Container + Text`;
- import/export operates directly on the canonical Presentation.

---

# P11 — Resources, Organization & Text Styles ✅

References: PRs #69–#71, #85–#105, with later refinement in PRs #125 and #129.

Delivered shared Studio/Library shell, private folders, Custom Library resources, Presentation-local Palette/FontResources/Text Styles, Linked Styles, refined usage/navigation and compact shared resource actions.

Text Style precedence:

```text
Theme role baseline
→ Text Style
→ local Text override
```

Linked Style precedence:

```text
Theme / defaults
→ Linked Style
→ local Container override
```

---

# P12 — UX / Properties refinement ✅

Delivered shared logical slide geometry, Player/Editor/Presenter/Watch geometry convergence, Palette/gradient corrections, Container overflow/Fit/Preserve size, Image inspector refinements, Delete→Enter confirmation and related authoring polish.

Direct Canvas manipulation inside transformed fitted Containers remains deferred until inverse transformed-authoring geometry is deliberately implemented.

---

# Runtime and product surfaces ✅

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

Public Portal / Live Cover is complete; Cover remains static/read-only while Watch follows real Player state.

---

# Gallery V1 ✅

References: PRs #114–#115.

Gallery is one semantic media frame with ordered items. Studio, Player local behavior and one-way Control commands through `live/galleryControl/<slot>` are complete.

---

# Maintenance & Diagnostics — first operational slice ✅

References: PRs #116–#119, #121, Suite-chrome PR #127 and later Player-logs work in PR #134.

Delivered:

- Player presence/current report and boot-scoped leases;
- Control/Maintenance status evidence;
- remote reload;
- same-boot presentation retry;
- real browser-cache clear path;
- Player-local recovery options;
- Maintenance under PowerShow Control;
- remote activation-scoped Player logs mode for already-open Players.

Diagnostics remains bounded. Do not turn it into a generic fleet/admin console or broad automatic repair system.

---

# Persistence serialization hardening ✅

Reference: PR #120.

Firestore persists canonical Presentation content as `presentationJson`, parsed and validated through `PresentationSchema` on read.

---

# Blocks — grammar-based didactic visual authoring ✅

References: PRs #122–#123.

Canonical Blocks persists a single `source` string. A handwritten parser creates transient structure for shared static rendering. Blocks is static/didactic, not executable.

---

# Editor Resource Controls polish ✅

Reference: PR #129.

Merged Preserve size grammar, compact Add/Apply actions, projected Text Styles count and related resource-control polish.

---

# Scripted controlled interaction ✅

References: PR #133 and HTTPS-image refinement PR #149.

Delivered:

- declared action ports;
- declared boolean and number state ports;
- `input`, `output` and `input-output` direction where applicable;
- Player-owned transient runtime identity;
- strict Player↔sandbox message validation;
- Scripted-specific RTDB input/runtime/report state;
- Control stateful controls generated from declarations;
- desired/reported/pending/divergent semantics;
- retained renderer-owned sandbox and fixed CSP boundary;
- HTTPS image loading in addition to `data:` and `blob:` while general networking remains blocked.

Permanent constraints remain:

- no `allow-same-origin` for Scripted;
- no Firebase SDK/tokens/session exposure inside authored code;
- no parent DOM access;
- no top navigation/forms/popups/downloads/storage;
- no `eval` / `Function`;
- no JavaScript payload delivered through RTDB;
- runtime state never persists into the Presentation.

`img-src https:` is a narrow image capability: sandboxed JavaScript can initiate image GET requests, while `connect-src 'none'` still blocks fetch/XHR/WebSocket/EventSource.

---

# Player presentation options + remote logs ✅

Reference: PR #134.

Delivered:

- slide transition: Fade / Slide / None;
- Player control position;
- Player control style;
- counter On / Off;
- control-bar animation;
- activation-scoped `live/slideTransition`;
- activation-scoped `live/playerControls`;
- activation-scoped `live/playerLogs`;
- Maintenance connected-Player discovery from boot-scoped leases;
- remote logs On/Off without sending arbitrary Player URLs through RTDB.

RTDB rules for these contracts were validated and explicitly deployed.

---

# Mobile Library / Control recovery ✅

Current `main` preserves the accepted mobile Library and Control behavior after PR #134.

Current rule:

- compact Player Settings is desktop-only;
- Previous, Next, Fullscreen and End remain part of mobile Control;
- responsive ownership stays in layout/CSS rather than user-agent detection.

An iPhone 14 Plus is a concrete mobile acceptance device in the current workflow, but breakpoint changes remain evidence-driven.

---

# Terminal / Code / Table typography and layout refinement ✅

References: PRs #138–#141.

Completed refinement of existing canonical elements without creating new element types or duplicate style contracts:

- Terminal, Code and Simple Table typography/color refinement (#138);
- Terminal title appearance and typography (#139);
- shared inline RichText authoring foundation (#140);
- Terminal title font size (#141).

---

# Plot V1 + continuation ✅

References: PRs #142 and #146–#148.

Plot persists restricted mathematical intent; it does not persist generated geometry or arbitrary JavaScript.

Completed capability line:

- explicit-y, explicit-x and implicit-2d sources;
- explicit-z 3D surface geometry;
- static SVG 3D wireframe projection;
- element sizing/positioning through existing shared layout ownership;
- Plot colors/background;
- z-based 3D gradient;
- canonical animation parameter intent with transient runtime bindings;
- Player/Watch/Demo animation playback and Editor local preview;
- Control→Player remote Play/Pause/Reset actions;
- axis color, stroke width and opacity refinement.

Permanent Plot boundary:

```text
restricted mathematical source
→ transient parse / semantic / samples / geometry
→ shared renderer projection
```

No Three.js/WebGL/Canvas/camera/mesh persistence is part of the current architecture.

Physical acceptance on the target Android interactive display with Firefox 116 remains pending because the hardware has not yet been available. This is a release gate, not negative compatibility evidence.

---

# Deterministic Studio test debt ✅

Reference: PR #144.

The post-Plot deterministic Studio debt was closed tests-only. Later feature work has continued to grow the suite; do not treat the historical 185-file baseline as a current expected count.

---

# Font authoring refinement ✅

Reference: PR #150.

Delivered without schema or renderer redesign:

- editable manual `fontFamily` authoring;
- Presentation FontResource families retained as suggestions;
- blank returns to inherited/default behavior;
- Text Styles can author a family even with zero Presentation fonts;
- complete FontResource in-use detection across current canonical typography consumers, including Code, Terminal body/title, Table/Topics ContentSlots, Text Styles and Linked Styles.

Manual family names are system/browser family requests, not automatic downloads. Portable fonts continue to use canonical `Presentation.resources.fonts` and renderer-generated `@font-face`.

Final PR #150 closure evidence included Studio typecheck PASS, full Studio suite **188 files / 2,245 tests / 0 failures**, remote Studio/Player checks PASS and manual acceptance PASS.

Direct This Presentation FontResource authoring is deferred. Library-thumbnail FontResource style injection parity is a separate backlog item.

---

# Topics refinement ✅

Reference: PR #152.

Topics minimum authoring was delivered historically in P10.4. The refinement line audited and improved the existing canonical model rather than creating a second list element.

Canonical structure remains:

```text
TopicsElement
→ items: TopicItem[]
   ├── content: ContentSlot
   │   ├── layout?
   │   ├── style?
   │   ├── typography?
   │   └── children: PowerShowElement[]
   └── children: TopicItem[]
```

Delivered:

- strict `TopicItem` canonical validation;
- structural sibling reorder;
- deterministic structural indent/outdent;
- contextual hierarchy controls;
- simplified Element Tree projection without a redundant Content pseudo-node;
- first usable Text child projected as the Topic row label rather than a separately draggable primary Text row;
- additional Text/non-Text ContentSlot children remain ordinary canonical rows;
- regression coverage for deep structural reorder, hierarchy and label projection.

Permanent authoring rule remains: Studio limits creation of structural `TopicItem.children` to depth 5, while deeper canonical documents remain loadable/renderable/persistable.

Audit decisions:

- a second ContentSlot authoring system was **not justified**;
- renderer/appearance redesign was **not justified**;
- autonomous nested Topics inside a TopicItem ContentSlot was **not justified**;
- direct Topics → Presentation Text Style consumption remains deferred;
- cross-cutting canonical ID uniqueness/integrity belongs to a separate complete-audit backlog rather than Topics.

Manual acceptance passed before merge.

---

# Embed refinement ✅

Reference: PR #154.

Embed minimum was delivered historically in P10.8. The refinement line started with an evidence-first provider/runtime/security audit and promoted only concrete product needs.

## Canonical viewport

Embed now optionally owns:

```text
viewport?
├── zoom?    0.1 .. 4
├── top?     >= 0
├── right?   >= 0
├── bottom?  >= 0
└── left?    >= 0
```

Semantics:

- `zoom: 1` = 100%;
- edge values are non-negative CSS px in the iframe's unscaled internal coordinate space;
- absent/default values are pruned;
- an empty `viewport` is never persisted.

This is distinct from `layout.top/right/bottom/left`, which positions the Embed itself in its parent.

## Renderer / provider behavior

The renderer owns a clipped outer viewport and transform-based iframe scaling. It never accesses provider DOM, `contentDocument`, provider scrolling APIs or provider-specific JavaScript APIs.

The fixed renderer-owned iframe policy remains:

```text
sandbox="allow-scripts allow-forms allow-same-origin"
allow="fullscreen"
referrerpolicy="strict-origin-when-cross-origin"
loading="lazy"
```

The audit initially tested removing `allow-same-origin`, but manual evidence with Blockly Games showed that external applications may require their own normal origin capability for storage/origin-dependent behavior. Restoring `allow-same-origin` preserved provider origin without making a cross-origin provider same-origin with PowerShow.

Permanent decisions:

- sandbox/Permissions Policy remain renderer-owned, not authored;
- global removal of `allow-same-origin` is not justified by current evidence;
- provider refusal via `X-Frame-Options` / CSP `frame-ancestors` is not a PowerShow bug and must not be bypassed;
- bounded YouTube normalization remains; no speculative provider matrix was added;
- same-origin PowerShow iframe behavior remains security-sensitive and belongs to focused security review rather than a provider-breaking global sandbox change.

## Studio authoring

The Inspector exposes:

```text
Embed viewport

Zoom
[ 100 ] %

Framing / Enquadramento
Top      Right
Bottom   Left
```

Zoom is displayed as 10–400% and converted to canonical 0.1–4. Edge controls author non-negative px values. Returning all fields to defaults removes `viewport` entirely.

## Control preview stability

Manual acceptance exposed a separate Control integration bug: the one-second presenter clock rerender could recreate iframe-backed preview DOM. PR #154 now preserves the `dangerouslySetInnerHTML` payload by effective markup, separates renderer hydration from Gallery projection and stabilizes derived Gallery targets.

Regression coverage verifies that an Embed iframe node remains identical across equivalent preview rerenders and is replaced when effective slide markup actually changes.

Manual acceptance passed with Blockly Games: provider content rendered, viewport zoom/framing worked and the Control iframe remained stable across clock ticks.

---

# P13 — Production Readiness ← NEXT

Topics and Embed refinement are complete. P13 is now the active work area.

P13 should stabilize the product from concrete deployment/reliability/security evidence rather than reopen completed feature architecture speculatively.

Planned audit/checkpoint line:

- Studio → publish → Control → Player end-to-end validation;
- authentication and authorization review;
- Firestore / RTDB rules review against current contracts;
- deployment configuration, smoke checks and rollback readiness;
- responsive acceptance across Studio and runtime surfaces;
- constrained-hardware performance evidence;
- focused security review, including current iframe/provider boundaries and other externally reachable surfaces;
- production logging/diagnostic behavior and failure recovery evidence;
- Android interactive-display / Firefox 116 physical Player acceptance when hardware becomes available.

P13 begins with an audit of the current production-readiness surface. Implementation checkpoints are promoted only from concrete findings.

The unavailable Android interactive display remains an explicit release gate, not negative compatibility evidence.

---

# Future / deferred

## P14 — Maintenance & Diagnostics 🟡

D0–D2 plus remote logs are operational. Further expansion remains evidence-driven and bounded. Do not turn Maintenance into a generic fleet-management surface without concrete need.

## P15 — Audience / Watch expansion — future

Watch already follows Player-applied state. Viewer presence/count/nickname and richer audience behavior remain future candidates and must never grant audience clients shared presentation control.

## Product / authoring backlog

Deferred candidates include:

- **Delete and preserve children** — define deliberate hierarchy semantics before implementing destructive element deletion that retains descendants;
- **Delete published** — define the lifecycle/authorization semantics for removing published material;
- **complete audit** — cross-cutting integrity audit, including canonical/global ID uniqueness and other issues intentionally kept out of feature-specific checkpoints;
- **AI Converter** — convert external/source content into the existing canonical Presentation rather than introducing a second document model;
- **Player hardening with local history/continuity** — stronger local recovery/history behavior without replacing immutable publication and Live ownership;
- direct This Presentation FontResource authoring;
- Library-thumbnail FontResource parity;
- Topics → Text Style consumption;
- bounded Undo/Redo;
- Custom Library portability refinements;
- remaining WYSIWYG/Text improvements.

Backlog items are not active checkpoints until evidence and an explicit product decision promote them.

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
       Gallery V1                                           ✅
       Maintenance & Diagnostics                            ✅
       Persistence serialization hardening                  ✅
       Blocks visual authoring                              ✅
       Editor Resource Controls polish                      ✅
       Scripted controlled interaction (#133)               ✅
       Player options + remote logs (#134)                  ✅
       Mobile Library / Control recovery                    ✅
       Terminal / Code / Table refinement (#138–#141)       ✅
       Plot V1 (#142)                                       ✅
       Studio deterministic test debt closure (#144)        ✅
       Plot continuation / 3D / animation (#146)            ✅
       Plot remote animation controls (#147)                ✅
       Plot axis appearance (#148)                          ✅
       Scripted HTTPS images (#149)                         ✅
       Font authoring + usage protection (#150)             ✅
       Topics structural refinement (#152)                  ✅
       Embed viewport + stable Control preview (#154)       ✅

NEXT:
  P13 Production Readiness
  → read-only readiness audit
  → smallest evidence-backed readiness checkpoints
  → deployment / reliability / security acceptance

RELEASE GATE STILL PENDING:
  Android interactive display + Firefox 116 physical Player acceptance

FUTURE / DEFERRED:
  P14 bounded Diagnostics expansion
  P15 Audience / Watch expansion
  Delete and preserve children
  Delete published
  complete audit
  AI Converter
  Player hardening with local history/continuity
  direct This Presentation FontResource authoring
  Library-thumbnail FontResource parity
  Topics → Text Style consumption
  bounded Undo/Redo
  Custom Library portability
  remaining WYSIWYG/Text improvements
```

The next implementation chat must begin from a fully closed local `main`, revalidate the real remote baseline, and start **P13 with an audit before changing production code**.
