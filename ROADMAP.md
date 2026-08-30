# PowerShow Roadmap

This document records the **complete PowerShow execution path from the first canonical document work to the current roadmap**.

It has two purposes:

1. preserve the real historical sequence so the project does not lose architectural context;
2. define the current execution order without turning old planning labels into competing sources of truth.

Merged PRs and commits remain authoritative for implementation details. The roadmap summarizes product milestones, current decisions, and future work.

## Status legend

- ✅ complete / merged
- 🟡 partially complete or continuing through later work
- ← NEXT current planned execution area
- planned future checkpoint
- deferred intentional backlog/future work

## Execution policy

PowerShow uses audit-first, checkpoint-driven development:

```text
inspect current code
→ verify whether the capability already exists
→ identify the existing boundary to reuse
→ freeze architecture / invariants
→ implement narrowly
→ test
→ review the real remote commit / diff
→ advance
```

Completed architecture should not be reopened speculatively. Canonical changes after the contract cleanup must be driven by concrete product requirements.

`schemaVersion` remains literally `1`; no migration, dual schema, or compatibility layer is introduced unless a future explicitly approved requirement makes it necessary.

---

# P0–P8 — Foundation history ✅

The earliest repository history did not consistently use the later P-number vocabulary. P0–P8 below are retrospective groupings used only to keep the roadmap continuous. PR chronology remains the authoritative historical reference.

## P0 — Canonical document foundation ✅

Reference: PR #2.

Established:

- `@powershow/document-schema`;
- canonical Presentation / Slide / element data;
- strict runtime validation;
- recursive Container composition;
- `schemaVersion: 1`.

PowerShow presentation state became semantic document data rather than serialized Editor DOM state.

## P1 — Renderer and Player foundation ✅

References: PRs #3–#5.

Established:

- shared Presentation rendering pipeline;
- first public Player runtime;
- visual primitives and Theme integration;
- renderer as a reusable package boundary.

Core invariant:

```text
canonical Presentation
→ shared renderer
→ Studio preview / Player runtime
```

## P2 — Studio Editor V0 ✅

References: PRs #6–#13.

Delivered the first visual authoring environment:

- three-column Studio editor;
- slide navigation and CRUD;
- recursive element selection/update;
- early Text, Textbox, Code, Terminal, Image and Table inspectors;
- movement/reparenting foundations;
- layout presets and spacing controls;
- localization;
- Inspector section architecture.

The Editor remained an interface over the canonical Presentation rather than a second persisted editor model.

## P3 — Visual authoring vocabulary ✅

References: PRs #14–#29.

Expanded semantic authoring with:

- renderer style hardening;
- typography controls;
- gradients;
- FontResources;
- Google Fonts / Fontsource / manual font acquisition;
- text stroke;
- HEX / RGBA color handling;
- reusable presentation colors;
- Image sizing;
- effective Theme/default authoring.

Provider-specific font metadata remained authoring-time information; Presentations store normalized FontResources.

## P4 — Hierarchy, positioning and direct Canvas authoring ✅

References: PRs #30–#38.

Delivered:

- Flow / Stack Container child layout;
- semantic positioning and layer operations;
- hierarchical Elements tree;
- drag/reparent hierarchy operations;
- direct Canvas movement and resizing;
- Image proportion-preserving resize;
- focal-point authoring.

Historical placement models from this phase were later simplified by P10.11. The final canonical rule is:

```text
Flow
→ no authored layout.position

Absolute
→ layout.position: "absolute"
→ direct top/right/bottom/left edges
```

Hierarchy is represented by the nested document tree, not `parentId`, order, or numeric `zIndex` fields.

## P5 — Firebase persistence, Library and autosave ✅

References: PRs #39–#41.

Established:

- Firebase modular Web configuration;
- user-scoped Firestore repository;
- Library create/open/archive flows;
- repository-backed Editor loading;
- explicit Save and debounced autosave;
- dirty/saving/error state handling;
- persistence metadata outside canonical Presentation data.

Private drafts:

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

Delivered `draftRevision`, stable `publicationId`, immutable `versionId` snapshots, idempotent unchanged publication, strict Firestore Rules, and public published-version loading.

Published versions are snapshots and are never modified in place.

## P7 — Authentication, public publication pointer and remote-control foundation ✅

References: PRs #43–#44.

Delivered:

- persistent Google/Firebase Auth for Studio;
- authenticated Control boundary;
- RTDB remote-navigation foundation;
- public publication pointer:

```text
publishedPresentations/{publicationId}
```

- pointer-owned `currentVersionId`;
- public Player version resolution;
- separation of public delivery from mutable Studio drafts.

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

Publish and Present remain separate operations. Starting Live never implicitly publishes pending draft changes.

---

# P9 — Live presentation foundation ✅

References: PRs #47–#57, with later production hardening in PR #72.

Delivered the current real-presentation runtime foundation:

- Player live entry from `live/current`;
- exact immutable published-version loading;
- activation-scoped slide state;
- Player ACK and confirmed state;
- command coalescing and latency measurement;
- private slide Notes outside canonical Presentation data;
- Control current/next preview foundation;
- staged publication updates;
- explicit promotion to newer immutable versions;
- logical slide/page identity by `pageId`;
- desired / applied state convergence;
- reload/reconnect convergence;
- Watch following actual Player-applied state;
- production-safe Player diagnostics and cache hardening.

High-level Live flow:

```text
Control desired state
→ RTDB
→ Player applies immutable published state
→ Player applied state / ACK
→ Control + Watch observe convergence
```

Deferred Live extensions remain future work rather than keeping P9 open indefinitely.

---

# P10 — Canonical Authoring & Import Foundation ✅

Goal: provide a semantic, self-contained authoring model that can be safely saved, published, rendered, exported and imported.

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
- import/export use canonical Presentation directly.

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

### P10.11 — Canonical Contract Cleanup ✅

Delivered:

- canonical Container / Text / Image contracts;
- surface- and data-element-specific contracts;
- canonical ContentSlot;
- Image Crop;
- Divider and Topics final contracts;
- Chart / Interactive semantic position-only contracts;
- dedicated renderer paths;
- removal of universal `BaseElementSchema` / `ElementStyleSchema` / historical placement contracts;
- removal of canonical Textbox.

This checkpoint exists to free product development, not to start an endless schema-cleanup cycle.

### P10.12 — JSON Import / Export ✅

Reference: PR #84.

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

There is no export envelope, second schema language, migration layer, compatibility alias system, or asset package format.

Import and Recovery remain intentionally different product boundaries.

---

# P11 — Resources, Organization & Text Styles ✅

## P11.1 — Shared Studio / Library application shell ✅

References: PRs #69–#71 and #100.

Delivered shared `@powershow/ui`, file-manager-style Library, first-slide previews, selection-first contextual actions, responsive navigation, archive/folder organization, and consistent UI hierarchy.

## P11.2 — Folders and private organization metadata ✅

Reference: PR #71.

Folders remain private Studio metadata, outside canonical Presentation and Player runtime. V1 folders are flat.

## P11.3 — Custom Library Styles ✅

References: PRs #85–#99.

Delivered reusable Style recipe extraction, persistence, preview, Apply, materialization, same-type merge, and placement workflows.

Architecture:

```text
Custom Library Style
→ materialize/copy canonical values
→ Presentation owns resulting data
```

There is no live dependency link from a Presentation back to Custom Library data.

## P11.4 — Presentation + Custom Library Palettes ✅

Reference: PR #101.

Delivered Presentation-local Palette colors and references plus private Custom Library Palette masters with safe materialization and edit lifecycle.

## P11.5 — Presentation + Custom Library Fonts ✅

Reference: PR #102.

Delivered Custom Library Font masters, provider/manual acquisition, Presentation-local FontResource materialization, face merge/conflict rules, previews, and in-use removal protection.

## P11.6 — Text Inspector authoring refinement ✅

Reference: PR #103.

Delivered Content / Typography / Appearance / Effects / Placement / Interaction hierarchy, compact RichText formatting integration, mixed-selection semantics, clear-formatting behavior, and Palette-aware inline color handling.

## P11.7 — Canonical Presentation-local Text Styles ✅

Reference: PR #105.

Fundamental roles:

```text
title
subtitle
body
caption
```

Precedence:

```text
Theme role baseline
→ Text Style
→ local Text override
```

Delivered fundamental/custom Text Styles, sparse authoring, Palette/FontResource integration, attach/switch/detach/reattach, local override precedence, real renderer preview, JSON round-trip, autosave/reload, and Player/shared-renderer acceptance.

`schemaVersion` remained `1`.

## P11.8 — Recovery hardening and recovery UI ✅

Reference: PR #105 final checkpoints.

Recovery remains explicit destructive repair, not migration.

---

# P12 — UX / Properties refinement ✅

P12 refined established contracts without reopening P11 foundations or expanding the document model speculatively.

Delivered:

- shared logical slide geometry (`960 × 540` for 16:9, `960 × 720` for 4:3);
- Player/Editor/Presenter/Watch logical geometry convergence;
- Palette and gradient rendering corrections;
- Custom Library Style UX hardening;
- canonical Container `layout.overflow`;
- Container Children Fit (`Contain`, `Cover`, `Fill`);
- nested Fit runtime hydration;
- Preserve size via `layout.flexShrink?: 0`;
- current-contract Import/Export regression coverage.

Direct Canvas manipulation of descendants inside fitted Containers remains deferred until inverse transformed-authoring geometry is implemented.

---

# Runtime and surface refinement ✅

Reference: PR #107.

This follow-up closed the previously listed Control refinement area and aligned product/runtime ownership.

Delivered:

- authenticated Studio route and naming coherence;
- `/studio/library`, `/studio/editor`, `/studio/control` surface alignment;
- direct Control slide navigation;
- keyboard Previous/Next refinement;
- shared Player projection surface;
- Watch moved to the Player/live runtime;
- Control exit/recovery behavior;
- Player-local fullscreen confirmation flow;
- fullscreen intent through dedicated `live/fullscreenRequest`;
- diagnostics ownership kept in Player instead of creating a second diagnostics route;
- cache hardening.

Architecture after this checkpoint:

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

Fullscreen remains Player-local because the browser requires local user activation.

---

# Branding support ✅

Reference: PR #108.

PowerShow favicons were added to Studio and Player surfaces.

---

# Public Portal / Live Cover ✅

Reference: PR #109.

The root `/` is now an operational public PowerShow portal.

## No Live

```text
/
→ /demo
→ full-screen ambient demo
→ autoplay
```

## Active Live

```text
/
→ /cover
→ first slide only
→ static
```

The Live cover intentionally does **not** follow:

- Control current preview;
- `live/playerState`;
- Player navigation;
- autoplay;
- fullscreen requests;
- ACK state.

It resolves the active immutable published version and renders its first slide through the shared projection surface.

The Watch QR:

- points to `/watch`;
- is generated locally with `qrcode.react`;
- appears only while Live is active;
- has no `Open Watch` CTA;
- is draggable using Pointer Events;
- is clamped to the viewport;
- has no persisted position;
- is intended to work on the current operational target including Firefox 116 on Android touchscreen hardware.

Responsibility split:

```text
Player      = real projection
Watch       = real audience follower
Root        = portal / showcase
Control     = operator intent
Diagnostics = technical observability
```

---

# Immediate next execution area — Linked Styles ← NEXT

Linked Styles address a concrete reuse problem that current Custom Library Styles do not solve.

Current Custom Library Style behavior is copy/materialization reuse:

```text
Custom Library Style
→ apply/copy
→ resulting element becomes independent
```

Linked Styles are intended to provide **live Presentation-local reuse by reference**.

Example product need:

```text
30 Containers use gap: 16
→ edit one Linked Style to gap: 12
→ all linked Containers update
```

This is semantically similar to a CSS class, but remains a canonical authored PowerShow relationship rather than raw CSS dependency.

## Product location

```text
This Presentation
└── Linked Styles
```

Linked Styles belong to the current Presentation, not to Custom Resources.

## V1 frozen direction

V1 is intentionally narrow:

- Container-only;
- Presentation-scoped;
- self-contained in save/export/publish/Player;
- zero or one Linked Style reference per Container;
- may provide `layout`, `style`, `typography`, and `effect`;
- must not own `id`, `type`, `role`, `hidden`, `link`, `children`, or content;
- the presence of a property in the Linked Style defines what it provides;
- no separate `managedProperties[]` list;
- local Container values remain overrides;
- no multiple-style cascade in V1;
- no runtime dependency on Custom Library data;
- `schemaVersion` remains `1`.

Precedence:

```text
Theme / defaults
→ Linked Style
→ local Container override
```

## Attach / Detach semantics

**Attach** transfers responsibility for the properties supplied by the Linked Style from local element values to the shared definition while preserving the current appearance.

**Detach** materializes the effective linked values locally before removing the reference, again preserving the current appearance.

**Reset to linked value** removes only the local override for that property.

## Resolution rule

Nested contracts must be resolved explicitly. Do not implement a generic blind `deepMerge()`.

Example:

```text
Linked:
layout.children.gap = 12

Local:
layout.children.direction = row

Effective:
gap = 12
direction = row
```

The existing Presentation-local Text Styles architecture is the main precedent to audit and reuse: Presentation-level definitions, stable references, validation traversal, resolver boundary, and local override precedence.

## Planned Linked Styles checkpoints

### LS1 — Canonical Contract

- audit current `main` again before freezing persisted names;
- Presentation-level Linked Style definitions;
- Container reference;
- unique IDs;
- valid-reference validation;
- non-empty definition validation;
- Container-only V1;
- canonical tests;
- no renderer or Studio UI yet.

### LS2 — Resolution

- explicit field-safe resolver;
- linked + local precedence;
- nested resolution tests;
- attach/detach helpers only if the audited boundary supports them naturally.

### LS3 — Renderer Integration

- shared renderer consumes effective Container values;
- Player and Studio preview stay visually coherent;
- no second renderer path.

### LS4 — Inspector Attach / Detach

- select Linked Style;
- create from selected Container;
- attach;
- detach preserving appearance;
- show current relationship.

### LS5 — This Presentation management

- list;
- create;
- edit;
- rename;
- delete with explicit reference semantics;
- usage count.

### LS6 — Override UX

- show Linked vs Local override;
- Reset to linked value;
- show linked value where useful;
- indicate affected element count when editing a shared definition.

### LS7 — Bulk reuse

- create from selection;
- find matching Containers;
- attach many;
- select linked elements.

Bulk operations must not enter LS1 merely because they are useful later.

---

# Short-term authoring / runtime queue

These are explicit roadmap candidates after or around Linked Styles. They should still be promoted one checkpoint at a time after auditing the current implementation.

## Mobile Control and Library simplification

Target the actual mobile/touch operating surface rather than creating a parallel mobile product.

Current important compatibility target includes Firefox 116 on Android touchscreen hardware.

## Configurable slide transitions

The Player/projection surface already has transition capability. Future work should expose a semantic configurable transition contract by reusing that implementation instead of creating a second animation system.

Audit the current transition ownership before changing the canonical schema.

## Short Undo / Redo

Implement a bounded authoring history for Editor actions.

Keep this distinct from persisted immutable Version History:

```text
Undo / Redo
= short local authoring history

Version History
= persisted Presentation/publication history
```

## AI Import

Future AI-assisted import should produce the existing canonical Presentation directly:

```text
input / source
→ AI transformation
→ canonical Presentation
→ PresentationSchema validation
→ normal import/persistence path
```

Do not create a second persisted AI document language unless a concrete requirement proves necessary.

## Chart V1

`chart` already has a canonical semantic contract with:

```text
line
bar
area
scatter
```

and renderer-library-neutral series data.

The current renderer still uses a placeholder for Chart.

Chart V1 should:

- implement real rendering for the existing semantic types;
- add Studio creation/authoring;
- audit sizing/style needs before expanding the schema;
- keep canonical series data renderer-library-neutral;
- choose rendering technology only when promoted;
- keep Player lightweight.

Do not redesign canonical Chart merely to fit a chosen charting library.

## Gallery V2

Gallery already exists and has a functional minimum horizontal carousel based on native CSS scrolling and scroll snap.

Gallery V2 should improve that existing element rather than create a second Gallery path.

Potential areas to audit when promoted:

- navigation controls;
- indicators;
- captions;
- thumbnails;
- focal point/crop behavior;
- autoplay;
- touch ergonomics.

Do not expand the canonical contract before deciding which behaviors are actually authored versus renderer-owned.

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
- modern / legacy Player compatibility expectations;
- responsive desktop/mobile verification;
- security review for Player, Embed and Scripted;
- release checklist and rollback expectations;
- production error surfaces and operator recovery.

Production Readiness should prioritize concrete failures over cosmetic backlog.

---

# P14 — Maintenance & Diagnostics — planned / partially founded

A diagnostics foundation already exists, especially Player `?logs=true` and runtime loading diagnostics.

Future work may include:

- a deliberate maintenance/diagnostics surface;
- connectivity and active-version visibility;
- Player state / Live convergence visibility;
- latency instrumentation;
- operator troubleshooting;
- deploy/runtime health visibility;
- recovery guidance.

Diagnostics must remain bounded and must not expose sensitive internals to public clients.

Do not duplicate diagnostics already owned by Player merely to create a symmetric route.

---

# P15 — Audience / Watch expansion — future

A basic public read-only Watch surface already follows actual Player-applied state.

Future work may add:

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

Player offline/recovery work should preserve presentation continuity during temporary connection failure.

Direction to audit when promoted:

- cache the last valid immutable presentation/version locally;
- continue rendering the last known usable content while connectivity is unavailable where safe;
- separate resilience behavior from diagnostics UI;
- converge back to authoritative Live state after reconnection;
- avoid unnecessary polling or continuous rendering loops.

Offline/recovery is a runtime continuity problem; Maintenance/Diagnostics is an observability problem. Do not collapse them into one feature.

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

A live active publication should be handled explicitly before permanent deletion. Public version enumeration should not be opened merely to support browser-side deletion.

## Custom Library custom-variant portability

Known dependency problem:

```text
Custom Library recipe may contain:
variant: "quote"

while the Presentation-local custom Text Style "quote" is not part of the recipe.
```

Do not solve this by casually adding another Custom Library family. Design the dependency/materialization contract explicitly when promoted.

## Known Canvas bug — Cropped Image selection visibility

High priority when reproduced/promoted:

- an Image with canonical `crop` may disappear visually while selected in Studio Canvas;
- crop persists correctly;
- after reload the Image renders correctly;
- treat as Studio/Canvas lifecycle/rendering behavior, not a canonical-contract failure.

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
- provider-specific acquisition remains behind Custom Library Font workflow;
- Presentation typography consumes normalized FontResources.

## Blocks authoring UI

Canonical Blocks semantics are complete; future authoring can become more direct while preserving provider-neutral static canonical Blocks and avoiding unnecessary runtime coupling.

## Visual vocabulary

- additional background patterns when driven by real design needs;
- gradient-border refinements;
- Divider refinements;
- Gallery V2 as listed above;
- reusable visual components should use responsibility-specific contracts;
- never reintroduce a universal style bag for convenience.

## Interactive educational elements

Potential semantic components include:

- function/sine plots;
- linear/quadratic functions;
- square waves;
- PWM demonstrations;
- electrical circuits/current-flow visualization;
- geometry demonstrations;
- interactive diagrams.

Official interactive components should have explicit semantic contracts. Rendering technology must not leak into canonical Presentation data.

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
- dedicated Presenter UX improvements where a concrete distinction from Control is needed;
- Notes UX refinement without moving private Notes into canonical Presentation data.

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

Linked Styles — This Presentation                          ← NEXT

Near-term candidates:
  Mobile Control / Library simplification
  Configurable slide transitions
  Short Undo / Redo
  AI Import → canonical Presentation
  Chart V1
  Gallery V2
  Player offline cache / recovery
  Maintenance + Diagnostics
  Audience / Watch presence expansion

P13   Production Readiness                                  planned
P14   Maintenance & Diagnostics                             planned / partial base
P15   Audience / Watch expansion                            future / Watch base exists
```

The next implementation checkpoint should start with a fresh audit of the current `main` canonical schema and existing Text Style/resource patterns before freezing the persisted Linked Styles contract.
