# PowerShow Roadmap

This document records the **PowerShow execution path from the canonical-document foundation to the current work area**.

It has two purposes:

1. preserve enough real implementation history that architectural decisions are not accidentally reopened;
2. define the current execution order without allowing old planning labels, stale branches, or handoff SHAs to become competing sources of truth.

Merged PRs and the code currently in `main` remain authoritative for implementation details.

## Status legend

- ✅ complete / merged
- 🟡 operational base complete; additional future expansion exists
- ← NEXT current planned execution area
- planned future checkpoint
- deferred intentional backlog/future work

## Execution policy

PowerShow uses audit-first, checkpoint-driven development:

```text
inspect current code
→ verify what already exists
→ identify the existing ownership boundary
→ freeze architecture / invariants
→ implement narrowly
→ test
→ review the real remote commit / diff
→ manual acceptance when visual/runtime behavior requires it
→ advance
```

Core rules remain:

- `schemaVersion` stays literally `1`;
- no migration, dual schema, compatibility layer, or generic abstraction without a concrete requirement;
- current code in `main` outranks stale planning documents;
- branch names and historical SHAs are evidence only — always revalidate the real repository state before starting a new work area;
- completed architecture should not be reopened speculatively.

---

# P0–P8 — Foundation history ✅

The earliest repository history did not consistently use later P-number labels. These headings are retrospective groupings only; PR chronology remains the authoritative history.

## P0 — Canonical document foundation ✅

Reference: PR #2.

Established:

- `@powershow/document-schema`;
- strict canonical Presentation / Slide / element data;
- recursive Container composition;
- runtime validation;
- `schemaVersion: 1`.

PowerShow persistence became semantic document data rather than serialized Editor DOM state.

## P1 — Renderer and Player foundation ✅

References: PRs #3–#5.

Established the reusable rendering boundary:

```text
canonical Presentation
→ shared renderer
→ Studio preview / Player runtime
```

## P2 — Studio Editor V0 ✅

References: PRs #6–#13.

Delivered the first three-column visual authoring environment, slide CRUD/navigation, recursive element selection/update, early inspectors, layout presets and localization.

The Editor remained an interface over the canonical Presentation rather than a second persisted editor model.

## P3 — Visual authoring vocabulary ✅

References: PRs #14–#29.

Expanded typography, gradients, fonts, reusable colors, Image sizing and renderer/style authoring. Provider-specific font metadata remained authoring-time data; Presentations consume normalized FontResources.

## P4 — Hierarchy, positioning and Canvas authoring ✅

References: PRs #30–#38.

Delivered Container Flow/Stack behavior, hierarchy/tree operations, Canvas movement/resizing, Image proportional resize and focal-point authoring.

Final canonical placement rule after later cleanup:

```text
Flow
→ no authored layout.position

Absolute
→ layout.position: "absolute"
→ direct top/right/bottom/left edges
```

Hierarchy is represented by the nested document tree, not `parentId`, numeric `zIndex`, or a parallel ordering model.

## P5 — Firebase persistence, Library and autosave ✅

References: PRs #39–#41.

Established Firebase modular configuration, user-scoped Firestore drafts, Library workflows, repository-backed Editor loading and explicit/debounced save behavior.

Private draft boundary:

```text
users/{uid}/presentations/{presentationId}
```

## P6 — Immutable publishing ✅

Reference: PR #42.

Established:

```text
private draft
→ publish
→ immutable public version
→ Player
```

Published versions are immutable snapshots and are never modified in place.

## P7 — Authentication, public pointer and remote-control base ✅

References: PRs #43–#44.

Delivered Studio authentication, Control boundary, RTDB remote-navigation foundation, public publication pointer and Player version resolution.

## P8 — Live activation and Library entry ✅

References: PRs #45–#46.

Established:

```text
Library Present
→ activate live/current
→ Control

Library Control
→ reopen active Control

Library End
→ terminate live/current
```

Publish and Present remain separate operations. Starting Live does not implicitly publish pending draft changes.

---

# P9 — Live presentation foundation ✅

References: PRs #47–#57, with later production hardening in PR #72.

Delivered:

- Player live entry from `live/current`;
- exact immutable-version loading;
- activation-scoped slide state;
- Control desired state;
- Player applied state / ACK;
- command coalescing and latency measurement;
- private slide Notes outside canonical Presentation;
- staged publication updates and explicit promotion;
- logical slide identity by `pageId`;
- reload/reconnect convergence;
- Watch following actual Player-applied state;
- bounded Player diagnostics and cache hardening.

Core slide Live flow:

```text
Control desired state
→ RTDB
→ Player applies immutable published state
→ Player applied state / ACK
→ Control + Watch observe convergence
```

---

# P10 — Canonical Authoring & Import Foundation ✅

Goal: a semantic, self-contained document that can be authored, saved, published, rendered, exported and imported without a second persisted language.

Final baseline rules:

- `schemaVersion` remains `1`;
- strict responsibility-specific element contracts;
- no universal persisted `ElementStyle` bag;
- Flow = absence of `layout.position`;
- Absolute = `layout.position: "absolute"` + direct edges;
- no persisted anchor/offset compatibility model;
- published versions remain immutable and self-contained;
- Player remains independent from Studio-private data;
- `textbox` is not canonical; boxed text is `Container + Text`;
- import/export operate on canonical Presentation directly.

## P10 checkpoints

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
| P10.10 | Scripted | ✅ | #79 |
| P10.11 | Canonical Contract Cleanup | ✅ | #80–#83 |
| P10.12 | JSON Import / Export | ✅ | #84 |
| P10.13 | Import compatibility gate | ✅ absorbed | #84 + later recovery validation |

P10.11 removed historical universal/base style contracts, historical placement compatibility, and canonical Textbox. It exists to free product development, not to begin an endless schema-cleanup cycle.

P10.12 keeps export/import deliberately simple:

```text
Export
Presentation
→ readable *.powershow.json

Import
JSON.parse
→ PresentationSchema
→ new root Presentation id
→ new private draft
```

No export envelope, migration language, compatibility alias system, or asset-package contract exists.

---

# P11 — Resources, Organization & Text Styles ✅

References: PRs #69–#71, #85–#105.

Delivered:

- shared Studio / Library shell;
- private flat folders;
- Custom Library Styles with materialization/copy semantics;
- Presentation and Custom Library Palettes;
- Presentation and Custom Library Fonts;
- refined Text Inspector;
- canonical Presentation-local Text Styles;
- recovery hardening.

Custom Library resources remain independent masters:

```text
Custom Library resource
→ materialize/copy canonical values
→ Presentation owns resulting data
```

Canonical Text Style precedence:

```text
Theme role baseline
→ Text Style
→ local Text override
```

Fundamental roles remain:

```text
title
subtitle
body
caption
```

Recovery remains explicit repair, not migration.

---

# P12 — UX / Properties refinement ✅

Delivered:

- shared logical slide geometry (`960 × 540` for 16:9, `960 × 720` for 4:3);
- Player/Editor/Presenter/Watch geometry convergence;
- Palette and gradient corrections;
- Custom Library Style UX hardening;
- canonical Container `layout.overflow`;
- Container Children Fit (`Contain`, `Cover`, `Fill`);
- nested Fit runtime hydration;
- Preserve size through `layout.flexShrink?: 0`;
- current-contract Import/Export regression coverage.

Direct Canvas manipulation inside fitted transformed Containers remains deferred until inverse transformed-authoring geometry is deliberately implemented.

---

# Runtime and product-surface refinement ✅

Reference: PR #107.

Current product surfaces:

```text
PowerShow
│
├── Public Portal        /
├── Studio
│   ├── Library          /studio/library
│   ├── Editor           /studio/editor
│   └── Control          /studio/control
└── Live Runtime
    ├── Player
    └── Watch
```

Delivered route/naming coherence, direct Control navigation, keyboard refinement, shared Player projection surface, Watch runtime ownership, Control exit/recovery behavior, Player-local fullscreen confirmation and dedicated `live/fullscreenRequest` intent.

Native fullscreen remains Player-local because browser fullscreen requires local user activation.

---

# Branding support ✅

Reference: PR #108.

PowerShow favicons are present on Studio and Player surfaces.

---

# Public Portal / Live Cover ✅

Reference: PR #109.

No Live:

```text
/
→ /demo
→ ambient full-screen demo
```

Active Live:

```text
/
→ /cover
→ exact live published version
→ first slide only
→ static/read-only
```

Cover does not follow Control preview, `live/playerState`, Player navigation, autoplay, fullscreen requests, Gallery commands, or ACK state.

Watch remains the actual audience follower. The Control Watch QR is Live-only, generated locally, draggable and non-persistent.

Responsibility split:

```text
Player      = real projection
Watch       = real audience follower
Root        = portal / showcase
Control     = operator intent
Diagnostics = technical observability / bounded recovery
```

---

# Linked Styles — This Presentation ✅

References: PRs #111–#113.

Linked Styles solve Presentation-local live reuse while Custom Library Styles remain copy/materialization resources.

```text
Custom Library Style
→ apply/copy
→ independent canonical values

Linked Style
→ Presentation-local reference
→ shared authored responsibility
```

V1 remains intentionally narrow:

- Container-only;
- Presentation-scoped and self-contained;
- zero or one Linked Style reference per Container;
- definition may provide `layout`, `style`, `typography`, and `effect`;
- no content/children/link/visibility/identity ownership;
- no `managedProperties[]`;
- local Container values remain overrides;
- no multiple-style cascade;
- no Player dependency on Custom Library;
- `schemaVersion` remains `1`.

Precedence:

```text
Theme / defaults
→ Linked Style
→ local Container override
```

Linked Styles are complete and should not be reopened speculatively.

---

# Gallery V1 — semantic media frame, runtime and Control ✅

References: PRs #114–#115.

Gallery is now merged history, not an integration-gate item.

Canonical Gallery remains one semantic media frame containing an ordered array of items:

```text
src
alt
fit?
crop?
focalPoint?
```

No item IDs were introduced; item order/index is identity within a Gallery.

Delivered:

- transient Studio Gallery-item selection;
- Image-derived crop/focal authoring;
- structural add/remove/reorder;
- Gallery items in the Elements selector;
- Image ↔ Gallery structural drag operations;
- Player local click/touch advance with wrap;
- Player-local expanded Gallery presentation;
- WebP/GIF-compatible media behavior;
- one-way RTDB Gallery protocol;
- Control desired-state owner;
- current Control preview projection of commanded Gallery state;
- mobile/desktop Control placement refinement.

Live path:

```text
Control desired Gallery state
→ live/galleryControl/<slot>
→ Player
```

Gallery intentionally has **no ACK and no Player→Control synchronization**. Physical Player interaction may diverge from Control's last commanded desired index until Control sends a new command.

Direct Gallery interaction inside the Control preview remains unnecessary; contextual controls near the preview are the accepted V1 pattern.

---

# Maintenance & Diagnostics — operational first slice ✅

References: PRs #116–#119 and #121.

The promoted Maintenance/Diagnostics work moved from audit-only planning into a bounded operational surface.

## D0 — ownership/evidence audit ✅

The audit established the separation between:

- authenticated Studio operator surfaces;
- public Player runtime;
- Firestore publication/draft ownership;
- RTDB live operational state;
- read-only health evidence;
- narrowly justified recovery actions.

The guiding sequence remains:

```text
observe
→ identify ownership
→ derive health/integrity state
→ show evidence
→ allow only explicit bounded recovery
```

## D1 — Player presence and Maintenance surface ✅

Reference: PR #116.

Delivered:

- read-only Player presence in Control and Maintenance;
- one current Player report;
- ephemeral boot-scoped connection lease;
- `onDisconnect` registration before online publication;
- delayed disconnect isolation per boot lease;
- activation/promotion/end cleanup of Player presence;
- authenticated Maintenance route and responsive layout.

D1 deliberately did not create a fleet/device system, heartbeat protocol, history store, or generic admin console.

## D2A — remote Player reload recovery ✅

Reference: PR #117.

Delivered a revisioned reload request scoped to the current Player boot, presence-gated Control/Maintenance state and strict RTDB validation.

## D2B — same-boot presentation retry ✅

Reference: PR #118.

Delivered retry through the existing Player loading/rendering path and recovery-status evidence without creating a second loading pipeline.

## D2C1 — clear Player browser cache ✅

Reference: PR #119.

Delivered explicit cache clearing through a same-origin technical route using scoped `Clear-Site-Data` headers.

## D2C2 — Player-local recovery options ✅

Reference: PR #121.

Delivered a discreet `See more / See less` recovery surface for Player load failures that reuses retry, reload and cache-clear contracts locally without writing a remote recovery request.

Operational evidence remains sanitized.

### Diagnostics boundary after D2

Current Maintenance/Diagnostics is **sufficiently complete to leave the active roadmap**. Future D3-style expansion should be promoted only by a concrete operational need.

Still deferred:

- generic admin/fleet/device management;
- broad automatic repair;
- diagnostics history without a demonstrated need;
- secrets/internal configuration exposure;
- speculative heartbeat/polling systems.

Physical Firefox 116 recovery acceptance was noted as pending during the D2 line and may be revisited as part of Production Readiness rather than keeping Diagnostics open indefinitely.

---

# Persistence serialization hardening ✅

Reference: PR #120.

Firestore storage was hardened against canonical nested-map depth limits.

Current persistence rule:

```text
canonical Presentation object
→ serialized presentationJson in Firestore
→ parse + PresentationSchema on read
```

Important invariants:

- canonical Presentation itself remains unchanged;
- `schemaVersion` remains `1`;
- deep Topics/RichText/Palette compositions remain supported;
- nullable canonical values are preserved;
- no legacy reader, migration, or dual persistence model was added;
- the homologation cutover was deliberate and clean.

This is a persistence representation detail, not a second canonical document format.

---

# Blocks — grammar-based didactic visual authoring ✅

References: PRs #122–#123.

Blocks has been redesigned and manually accepted as a **static visual didactic element inspired by mBlock and Tinkercad**, not an executable programming environment.

## Canonical ownership

Canonical Blocks persists:

```text
BlocksElement
├── id
├── type: "blocks"
├── hidden
├── layout?
├── style?
├── effect?
└── source: string
```

There is no persisted recursive BlockItem tree, AST, command IDs, execution state, Blockly workspace, compiler, interpreter or runtime protocol.

Pipeline:

```text
source:string
→ handwritten parser
→ transient AST
→ static shared renderer
```

## Visual grammar

Seven shape commands:

```text
\start(...)
\statement(...)
\scope(...){...}
\end(...)
\value(...)
\variable(...)
\logic(...)
```

Current visual categories:

```text
events
output
control
input
math
variables
```

Category determines the normal fill family; command determines geometry.

Optional local color override is authored inside the source annotation, with local color winning over category/default fill.

Static dropdown-like option token:

```text
\[option text\]
```

Raw square brackets remain ordinary text.

`\value` is a composable oval reporter and may contain inline reporters/options. `\logic` remains the hexagonal reporter. All output remains inert and HTML-escaped.

## Studio authoring

Blocks Content uses one multiline source textarea with pure parser diagnostics.

Compact syntax toolbar:

```text
EV  STM  SCO  END  VAL  VAR  01
```

Buttons insert literal grammar at the current selection/caret and return the caret to the parameter area of the inserted syntax. This toolbar is an authoring shortcut, not a second AST editor.

Appearance supports category colors, text color and block stroke without creating per-block canonical style records.

## Renderer / geometry

Final accepted direction:

- intrinsic individual block widths, aligned by the left connection axis;
- compact scope closing area;
- subtle block delimitation/stroke;
- fixed-depth logic tips rather than percentage-width geometry;
- oval value/reporters with deliberate minimum footprint;
- shared rendering across Studio Preview, Player and Watch.

## Shared Color Picker refinement

The Blocks manual-acceptance cycle exposed a shared Studio picker issue. PR #123 also stabilized Picked Colors:

- live picker movement continues updating the authored preview;
- intermediate preview samples are not added to Picked history;
- final committed picks enter transient MRU history;
- equivalent colors deduplicate/move to front;
- Picked is capped at 16 colors;
- UI is bounded to 8 columns × 2 rows;
- Picked remains Editor-session state and is not persisted into Presentation.

Blocks is now **closed**. Do not reopen it speculatively or add execution/runtime behavior without a separately approved product requirement.

---

# Immediate next execution area — Chart V1 ← NEXT

`chart` already exists in the canonical element union, but the real implementation must be audited before design decisions are made.

Current roadmap intent is to turn the existing Chart placeholder into the smallest useful semantic chart element **without shaping canonical data around a rendering library**.

Existing semantic series concepts historically include:

```text
line
bar
area
scatter
```

Do not assume that memory or this roadmap exactly matches the current schema. The next chat must inspect the real `main` contract first.

## C0 / E0 — Chart system audit

Before implementation, audit:

- exact canonical Chart schema and strictness;
- current defaults;
- current renderer placeholder;
- current Studio Inspector / creation path;
- shared sizing/layout/appearance responsibilities;
- Palette integration opportunities already available;
- Player/Watch rendering ownership;
- tests and fixtures;
- whether any charting dependency already exists;
- actual performance constraints on Player.

Mandatory questions:

- What semantic data does the existing canonical Chart already express?
- Which visual responsibilities belong in canonical Chart versus renderer defaults?
- Does V1 need axes, legends, labels or only the smallest subset supported by the current contract?
- Can V1 be rendered with lightweight SVG/CSS before adding a dependency?
- If a library is needed, can it remain renderer-owned and absent from canonical data?
- Which Studio controls are genuinely required for authoring the existing contract?

Do **not** redesign Chart merely to fit Chart.js, D3, Recharts, ECharts or another library.

Suggested progression:

```text
E0 — audit real implementation
E1 — freeze/confirm semantic contract
E2 — renderer
E3 — Studio authoring
E4 — runtime behavior only if semantically required
E5 — visual polish / manual acceptance
```

No Chart implementation should begin until E0 evidence is reviewed.

---

# P13 — Production Readiness — planned

Goal: move PowerShow from a rapidly evolving development system into dependable real production use.

Expected areas:

- full Studio → Save/reload → Publish → Control → Player E2E;
- Live/publication reliability under reload/reconnect;
- authentication / authorization / public-read review;
- failure/recovery behavior;
- deployment configuration and production smoke tests;
- Player performance on constrained/older hardware;
- modern/legacy Player compatibility expectations;
- physical Firefox 116 Android/touchscreen verification where still relevant;
- responsive desktop/mobile verification;
- security review for Player, Embed and Scripted;
- release checklist and rollback expectations;
- production error surfaces and operator recovery.

Production Readiness should prioritize concrete production failures over cosmetic backlog.

---

# P14 — Maintenance & Diagnostics 🟡

The first useful Maintenance/Diagnostics slice is complete through D2 and is no longer the active work area.

Future expansion may include, only when promoted by evidence:

- richer publication pointer/version integrity presentation;
- additional stale operational-state diagnostics;
- carefully bounded history;
- additional explicit safe cleanup/recovery actions;
- deployment/runtime guidance.

Diagnostics must remain bounded and must not expose sensitive internals to public clients.

---

# P15 — Audience / Watch expansion — future

The public read-only Watch surface already follows actual Player-applied slide state.

Future candidates:

- lightweight viewer presence;
- heartbeat / TTL / disconnect semantics;
- viewer count in Control;
- optional nickname without account;
- optional viewer list;
- privacy boundaries;
- multi-tab behavior;
- richer read-only Watch experience.

Audience clients must never gain control of shared presentation state through presence features.

---

# Player resilience — planned

Offline/recovery is a runtime continuity concern separate from Diagnostics observability.

When promoted, audit:

- caching the last valid immutable presentation/version locally;
- continuing to render last known usable content during temporary connectivity failure where safe;
- convergence back to authoritative Live state after reconnection;
- avoiding unnecessary polling or continuous rendering loops.

Do not collapse offline continuity into the Maintenance UI.

---

# Short-term / future candidates

These are explicit candidates, not automatic next checkpoints.

## Mobile Control and Library simplification

Target the real touch operating surface rather than creating a parallel mobile product.

## Configurable slide transitions

The projection surface already has transition capability. Future work should expose semantic configuration by reusing current runtime ownership instead of introducing a second animation system.

Audit transition ownership before changing canonical schema.

## Short Undo / Redo

Keep bounded local authoring history distinct from persisted immutable Version History.

```text
Undo / Redo
= short local authoring history

Version History
= persisted Presentation/publication history
```

## AI Import

Future AI-assisted import should produce the existing canonical Presentation directly:

```text
input/source
→ AI transformation
→ canonical Presentation
→ PresentationSchema validation
→ normal import/persistence path
```

Do not create a second persisted AI document language without a concrete requirement.

---

# Backlog

Backlog items are preserved deliberately but do **not** automatically become the next checkpoint.

Before promotion:

```text
audit current implementation
→ verify what already exists
→ identify concrete missing behavior
→ decide whether it blocks active roadmap
→ freeze smallest architecture
→ implement narrowly
```

## Presentation lifecycle / Version History

Future management should expose immutable version history owned by a Presentation without changing the canonical Presentation document.

Permanent Delete should treat one Presentation and its complete history as one independent aggregate:

```text
Presentation
├── private draft
├── private notes / sidecar data
└── publication
    ├── public pointer
    └── immutable versions/*
```

A live active publication must be handled explicitly before permanent deletion.

## Custom Library custom-variant portability

Known dependency problem:

```text
Custom Library recipe may contain:
variant: "quote"

while the Presentation-local custom Text Style "quote" is not part of the recipe.
```

Do not solve this by casually adding another Custom Library family. Design dependency/materialization explicitly when promoted.

## Known Canvas bug — Cropped Image selection visibility

When reproduced/promoted:

- an Image with canonical `crop` may disappear visually while selected in Studio Canvas;
- crop persists correctly;
- after reload the Image renders correctly;
- treat this as Studio/Canvas lifecycle behavior, not canonical-contract failure.

## Image Inspector semantic organization

Preferred future order:

```text
Source
  Source
  Alternative text

Framing
  Fit
  Crop
  Focal Point

Size
Appearance
Effects
Placement
Interaction
```

## Text / WYSIWYG refinements

- compact WYSIWYG editing surface;
- topics/bullets integration where compatible with canonical structure;
- final nowrap UX;
- `Normal` first/default for text-transform;
- ALL CAPS affordance where still useful;
- preserve RichText runs through ordinary edits.

## Fonts / typography UX

- Normal / Regular remains first/default when variants are shown;
- never choose Italic merely because provider ordering puts it first;
- provider-specific acquisition stays behind Custom Library Font workflow;
- Presentation typography consumes normalized FontResources.

## Visual vocabulary

- additional background patterns when driven by real design needs;
- gradient-border refinements;
- Divider refinements;
- responsibility-specific reusable visual components only;
- never reintroduce a universal style bag for convenience.

Further Gallery or Blocks changes should be promoted only from concrete observed needs, not as generic V2 milestones.

## Interactive educational elements

Potential semantic components include:

- function/sine plots;
- linear/quadratic functions;
- square waves;
- PWM demonstrations;
- electrical circuits/current-flow visualization;
- geometry demonstrations;
- interactive diagrams.

Official interactive components require explicit semantic contracts. Rendering technology must not leak into canonical Presentation data.

## Scripted future enhancements

Preserve:

- authored JavaScript does not execute in the PowerShow application context;
- no `eval` / `Function`;
- sandbox permissions remain renderer-owned unless a dedicated security design changes them;
- no PowerShow/session/control bridge by default.

## Control / Presenter refinement

Potential future work:

- richer Control commands;
- additional presentation-mode controls;
- dedicated Presenter UX only where a concrete distinction from Control is needed;
- Notes UX refinement without moving private Notes into canonical Presentation;
- direct preview interaction only where it provides clear product value.

## Studio polish

- use the Chinese ideogram `文` as the translation symbol where translation action is surfaced;
- broader visual consistency refinements;
- documentation/help when terminology stabilizes;
- avoid proliferating top-level Inspector sections for every capability.

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
       Runtime / Control / Watch refinement (#107)          ✅
       Branding support (#108)                              ✅
       Public Portal / Live Cover (#109)                    ✅
       Linked Styles — This Presentation (#111–#113)        ✅
       Gallery V1 (#114–#115)                               ✅
       Maintenance & Diagnostics D0–D2 (#116–#119, #121)    ✅ first operational slice
       Persistence serialization hardening (#120)           ✅
       Blocks visual authoring (#122–#123)                  ✅

NEXT:
  Chart V1 — E0 audit of the real current contract/renderer/Studio path

THEN / AS PROMOTED:
  other minimum-element improvements
  Production Readiness

FUTURE:
  Mobile Control / Library simplification
  Configurable slide transitions
  Short Undo / Redo
  AI Import → canonical Presentation
  Player offline continuity
  Audience / Watch presence expansion
  evidence-driven Diagnostics D3 additions
```

The next implementation chat must begin by auditing the **real current `main`** and the existing Chart ownership boundaries. Do not begin by choosing a charting library or changing the canonical Chart schema from memory.