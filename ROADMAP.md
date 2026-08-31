# PowerShow Roadmap

This document records the **complete PowerShow execution path from the first canonical document work to the current roadmap**.

It has two purposes:

1. preserve the real historical sequence so the project does not lose architectural context;
2. define the current execution order without turning old planning labels into competing sources of truth.

Merged PRs and commits remain authoritative for implementation details. The roadmap summarizes product milestones, current decisions, and future work.

## Status legend

- ✅ complete / merged
- 🟦 complete in feature branch; integration/merge still to be checked
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

Before every new work area, revalidate the real repository state. Branch names and SHAs recorded in handoffs or prior checkpoints are evidence, not permission to assume the repository has not moved.

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

High-level slide Live flow:

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
- diagnostics kept bounded in Player instrumentation rather than creating a speculative second runtime;
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

The root `/` is an operational public PowerShow portal.

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

The Live cover intentionally does **not** follow Control current preview, `live/playerState`, Player navigation, autoplay, fullscreen requests, or ACK state.

The Watch QR points to `/watch`, is generated locally with `qrcode.react`, appears only while Live is active, has no `Open Watch` CTA, is draggable with Pointer Events, remains clamped to the viewport, and does not persist its position.

Responsibility split:

```text
Player      = real projection
Watch       = real audience follower
Root        = portal / showcase
Control     = operator intent
Diagnostics = technical observability
```

---

# Linked Styles — This Presentation ✅

References: PRs #111–#113.

Linked Styles solve the Presentation-local live reuse problem that materialized Custom Library Styles do not solve.

```text
Custom Library Style
→ apply/copy
→ independent canonical values

Linked Style
→ Presentation-local reference
→ shared authored responsibility
```

V1 is intentionally narrow:

- Container-only;
- Presentation-scoped and self-contained;
- zero or one Linked Style reference per Container;
- definition may provide `layout`, `style`, `typography`, and `effect`;
- definitions do not own content, children, link, visibility or element identity;
- no `managedProperties[]` list;
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

Nested contracts are resolved explicitly rather than by blind generic `deepMerge()`.

Delivered across the Linked Styles milestones:

- strict canonical definitions and references;
- field-safe resolution;
- renderer integration;
- create / attach / switch / detach;
- detach with authored-value materialization;
- This Presentation management;
- local override handling and reset-to-linked behavior;
- usability/resource refinement.

Linked Styles are complete and should not be reopened speculatively.

---

# Gallery V1 — semantic media frame, runtime and Control 🟦

Gallery work was promoted from the old horizontal minimum into a complete semantic media-frame path on `feat/gallery-semantics`.

The feature branch is complete through the current visual refinement checkpoint; integration/merge into `main` must still be checked against the real repository state before beginning the next implementation branch.

## G1 — Semantic media frame ✅

Gallery is one frame containing an ordered array of images, not a generic Container of independently positioned Image elements.

Per-item authored media fields:

```text
src
alt
fit?
crop?
focalPoint?
```

No Gallery item IDs were introduced. Order/index is the item identity inside one Gallery.

The first item preserves intrinsic sizing ownership where required; later items overlay the same frame.

## G2 — Studio authoring ✅

Delivered:

- transient selected Gallery item state;
- Image-derived crop and focal-point authoring;
- exact Gallery element addressing;
- structural add/remove/reorder behavior;
- selected Image child foreground in the Editor.

Studio selection is not canonical and does not change Player runtime state.

## G3 — Player local runtime ✅

Delivered:

- click/touch advance;
- wrap from final item to first;
- independent multiple Galleries;
- reset to item 0 when a slide is remounted;
- Player-local expanded Gallery presentation;
- expanded Gallery click advances the same local Gallery.

Manual acceptance confirmed local Gallery interaction, looping, WebP and animated GIF playback.

## G4A — one-way RTDB Gallery protocol ✅

Path:

```text
live/galleryControl/<slot>
```

`slot` is the deterministic zero-based Gallery ordinal on the current canonical slide. It is an RTDB address, not canonical identity.

Record:

```ts
interface LiveGalleryControlState {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
  elementId: string;
  targetIndex: number;
  expanded: boolean;
}
```

The contract uses exact canonical `elementId` inside the record because arbitrary canonical element IDs are not assumed to be valid RTDB path keys.

Player uses child-scoped subscription (`onChildAdded` / `onChildChanged`) so an update to Gallery A does not reapply an old desired state for Gallery B and erase local Player divergence.

Gallery is intentionally one-way:

```text
Control desired Gallery state
→ RTDB
→ Player
```

There is no Gallery ACK, Player Gallery state, or Player-to-Control synchronization.

A physical Player touch may move the Player to a different image while Control continues to show the last desired index it commanded. This asymmetry is intentional.

The Gallery RTDB rules were also deliberately deployed to the configured Firebase Realtime Database. Application/Vercel deployment and Firebase rules deployment remain separate operations.

## G4B — Control desired-state owner ✅

`useLiveGalleryControl` owns only Gallery desired intent. It remains separate from the global slide `LiveControl` contract.

It:

- uses the exact immutable `livePresentation` currently running in Player;
- resolves the current desired `pageId` exactly;
- discovers nested Galleries in canonical traversal order;
- hydrates matching persisted RTDB desired state;
- defaults missing records to `targetIndex = 0`, `expanded = false` without baseline writes;
- sends absolute next/wrap target indexes;
- sends absolute expanded booleans;
- keeps pending isolation per Gallery;
- scopes local committed/pending operations to activation, version, page, slot and exact element ID;
- ignores stale async completions after page/identity changes;
- rejects impossible expansion intent for empty Galleries.

## G5 — visible PowerShow Control actions ✅

Current Gallery controls are contextual actions next to the current slide preview:

```text
Galeria
[ Próxima imagem ] [ Expandir / Recolher ]
```

Multiple Galleries receive deterministic labels and independent commands.

The UI does not display or invent Player actual Gallery state.

When a newer publication is staged but not yet promoted to Player, Gallery controls are suppressed because the visible newer preview may have a structurally different Gallery set from the immutable live version.

## G6A — Inspector and Control visual refinement ✅

Delivered:

- Inspector child selectors as `Image 1`, `Image 2`, ... rather than bare numbers;
- selected child using the established cyan/slate Inspector visual language;
- Add / Move up / Move down / Remove grouped before Source/media fields;
- consistent compact structural-control geometry;
- only Remove uses danger styling;
- multiple Control Gallery groups stacked vertically instead of forming one horizontal sequence.

## Preview interaction decision

Direct Gallery interaction inside the Control preview was considered but is **not required**.

Accepted PowerShow product pattern:

```text
Preview
+
contextual controls nearby
```

Not every interactive capability needs the preview itself to become a command surface. Direct preview interaction can be added later only when it materially improves operation.

## Gallery integration gate

Before treating Gallery as merged history, revalidate the feature branch and `main`. A final quick end-to-end smoke may be used if needed to document the complete post-rules Control → RTDB → Player path before PR/merge.

---

# Immediate next execution area — Maintenance & Diagnostics ← NEXT

The next product work area is a deliberate **Maintenance / Diagnostics** surface.

The first checkpoint is **D0 — System Audit**, not UI implementation.

## D0 — ownership and evidence audit

Audit the existing real system before freezing route, data model, or actions:

- Studio authentication;
- Firestore private drafts;
- public publication pointer;
- immutable published versions;
- publication lifecycle;
- `live/current`;
- `live/controlState`;
- `live/playerState`;
- `live/fullscreenRequest`;
- `live/galleryControl`;
- historical slide command/ACK paths still in use;
- Player diagnostics and `?logs=true` behavior;
- Watch and Cover resolution;
- Firebase initialization/configuration;
- existing recovery/cleanup operations;
- Library/Control lifecycle actions.

Mandatory ownership questions:

- Is the surface Studio-authenticated, public runtime, or split by responsibility?
- Which information is private?
- Which state is only observable?
- Which checks require Firestore?
- Which checks require RTDB?
- Which records can become stale/orphaned?
- Which inconsistencies can be detected without mutation?
- Which maintenance actions already exist as safe operations?
- Which repairs should **not** exist yet?
- Which information belongs to operator UX versus developer instrumentation?

## Direction

Default to **read-only observability first**:

```text
observe
→ identify ownership
→ derive health/integrity state
→ show evidence
→ only then consider explicit repair
```

Do not begin with a generic admin console.

Do not:

- expose secrets;
- add Presentation fields for diagnostics;
- invent a repair protocol;
- silently reconstruct persisted data;
- add broad bulk mutation;
- duplicate Player diagnostics merely for symmetry;
- mix developer logs and user-facing status without a deliberate boundary.

The first Maintenance/Diagnostics implementation checkpoint should be proposed only after D0 produces an ownership map and the smallest useful surface.

---

# Minimum-element improvement sequence

After Maintenance / Diagnostics reaches an acceptable first version, return to the minimum semantic elements one at a time.

Current priority:

```text
1. Blocks refinement
2. Chart V1
3. other minimum-element improvements as promoted
```

Do not implement several elements as one milestone.

## Blocks refinement — planned after Diagnostics

Blocks already exists across the canonical schema, renderer and Studio Inspector. It is **not** a new element to create.

Existing implementation includes responsibility-specific Blocks rendering and authoring paths. The next Blocks work should begin with an audit of:

- current canonical contract;
- intended semantic abstraction;
- renderer output;
- nested/block-item behavior;
- Studio Inspector/editing model;
- visual consistency;
- missing authoring operations;
- Player/Watch behavior;
- test coverage.

Canonical Blocks semantics should remain provider-neutral and static unless a concrete runtime requirement proves otherwise.

## Chart V1 — planned after Blocks

`chart` already exists in the canonical element union with semantic series concepts including:

```text
line
bar
area
scatter
```

The shared renderer still treats Chart as a placeholder.

Before implementing real Chart rendering:

- audit the exact current Chart schema;
- identify the minimum authored intent it already expresses;
- preserve renderer-library-neutral canonical data;
- audit sizing/style needs before expanding the schema;
- choose SVG/canvas/library technology only after the contract is understood;
- keep Player lightweight.

Do not redesign canonical Chart merely to fit Chart.js, D3, Recharts, or another chosen implementation library.

Suggested element sequence:

```text
E0 — audit real implementation
E1 — freeze/confirm semantic contract
E2 — renderer
E3 — Studio authoring
E4 — runtime behavior only when semantically required
E5 — visual polish / manual acceptance
```

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

Production Readiness should prioritize concrete failures over cosmetic backlog. Its P-number is historical planning vocabulary, not a requirement that it execute before the currently promoted Maintenance/Diagnostics and minimum-element work.

---

# P14 — Maintenance & Diagnostics ← NEXT / partial base exists

A diagnostics foundation already exists, especially Player `?logs=true`, live-state observability and recovery/lifecycle code.

The promoted work area is now Maintenance & Diagnostics, beginning with D0 audit and read-only health/integrity presentation before repair actions.

Potential domains after audit include:

- active Live identity/version visibility;
- publication pointer/version integrity;
- connectivity and runtime health;
- Control desired / Player applied convergence where that contract exists;
- stale Live operational records;
- deployment/runtime guidance;
- explicit safe cleanup/recovery actions where an existing operation justifies them.

Diagnostics must remain bounded and must not expose sensitive internals to public clients.

---

# P15 — Audience / Watch expansion — future

A basic public read-only Watch surface already follows actual Player-applied slide state.

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

# Short-term / future candidates

These remain explicit roadmap candidates but are not the current checkpoint.

## Mobile Control and Library simplification

Target the actual mobile/touch operating surface rather than creating a parallel mobile product.

Current important compatibility target includes Firefox 116 on Android touchscreen hardware.

## Configurable slide transitions

The Player/projection surface already has transition capability. Future work should expose a semantic configurable transition contract by reusing that implementation instead of creating a second animation system.

Audit transition ownership before changing the canonical schema.

## Short Undo / Redo

Implement bounded local authoring history, distinct from persisted immutable Version History.

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

## Visual vocabulary

- additional background patterns when driven by real design needs;
- gradient-border refinements;
- Divider refinements;
- reusable visual components should use responsibility-specific contracts;
- never reintroduce a universal style bag for convenience.

Gallery V1 is no longer listed here as a generic future Gallery V2 milestone. Further Gallery changes should be promoted only from concrete observed needs.

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
- Notes UX refinement without moving private Notes into canonical Presentation data;
- direct preview interaction only where it provides clear product value rather than as a universal requirement.

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
       Gallery V1 — feature branch                          🟦 integration gate

NEXT:
  Maintenance & Diagnostics — D0 audit

THEN:
  Blocks refinement
  Chart V1
  other minimum-element improvements as promoted

FUTURE:
  Production Readiness
  Mobile Control / Library simplification
  Configurable slide transitions
  Short Undo / Redo
  AI Import → canonical Presentation
  Player offline cache / recovery
  Audience / Watch presence expansion
```

The next implementation work must begin with a fresh audit of the real repository state and the existing diagnostics/maintenance ownership boundaries. Do not start by inventing a route, repair protocol, or admin data model.
