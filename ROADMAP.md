# PowerShow Roadmap

This document records the **complete PowerShow execution path from the first canonical document work to the current roadmap**.

It has two purposes:

1. preserve the real historical sequence so the project does not lose architectural context;
2. define the current execution order without turning old planning labels into competing sources of truth.

Merged PRs and commits remain authoritative for implementation details. The roadmap summarizes product milestones and invariants.

## Status legend

- ✅ complete / merged
- 🟡 partially complete or continuing through later work
- ← NEXT current planned execution area
- planned future checkpoint
- deferred intentional backlog/future work

## Execution policy

PowerShow uses checkpoint-driven development:

```text
inspect current code
→ identify the concrete product need
→ freeze architecture / invariants
→ implement narrowly
→ test
→ review the real remote commit / diff
→ advance
```

Completed architecture should not be reopened speculatively. Canonical changes after the contract cleanup must be driven by concrete product requirements.

`schemaVersion` remains literally `1` unless a future explicitly approved migration milestone changes that rule.

---

# P0–P8 — Foundation history ✅

The earliest repository history did not consistently use the later P-number vocabulary. P0–P8 below are **retrospective milestone groupings** used only to make the roadmap continuous from the beginning. PR chronology is the authoritative historical reference.

## P0 — Canonical document foundation ✅

Reference: PR #2.

Established:

- the first `@powershow/document-schema` package;
- canonical Presentation / Slide / element data;
- strict runtime validation;
- recursive Container composition;
- `schemaVersion: 1` as the document version baseline.

This created the rule that PowerShow presentation state is semantic document data rather than serialized Editor DOM state.

---

## P1 — Renderer and Player foundation ✅

References: PRs #3–#5.

Established:

- shared Presentation rendering pipeline;
- first public Player runtime;
- visual primitives and Theme integration;
- semantic rendering as a reusable package boundary rather than Player-only rendering.

Core invariant established here:

```text
canonical Presentation
→ shared renderer
→ Studio preview / Player runtime
```

---

## P2 — Studio Editor V0 ✅

References: PRs #6–#13.

Delivered the first usable visual authoring environment:

- three-column Studio editor;
- slide navigation and slide CRUD;
- recursive element selection/update;
- Text, Textbox, Code, Terminal, Image and Table inspectors;
- element movement/reparenting foundations;
- layout presets and spacing controls;
- Studio localization EN / pt-BR;
- Inspector section architecture;
- shared Appearance authoring.

The Editor remained an interface over the canonical Presentation rather than a second persisted editor model.

---

## P3 — Visual authoring vocabulary ✅

References: PRs #14–#29.

Expanded semantic authoring without introducing arbitrary CSS persistence:

- renderer visual-style hardening;
- typography controls;
- background gradients;
- presentation FontResources;
- secure Google Fonts / Fontsource / manual acquisition workflows;
- text stroke;
- supported HEX / RGBA colors;
- reusable presentation colors;
- layout-preset refinements;
- Image sizing;
- effective Theme/default authoring behavior.

Provider-specific font metadata remained authoring-time information; Presentations store normalized FontResources.

---

## P4 — Hierarchy, positioning and direct Canvas authoring ✅

References: PRs #30–#38.

Delivered:

- Flow / Stack Container child layout;
- semantic positioning and layer operations;
- hierarchical Elements tree;
- drag/reparent hierarchy operations;
- direct Canvas movement;
- direct Canvas resizing;
- Image proportion-preserving resize;
- semantic Image focal point;
- direct focal-point Canvas editing.

Historical placement models from this phase were later simplified by P10.11. The final canonical rule is now:

```text
Flow
→ no authored layout.position

Absolute
→ layout.position: "absolute"
→ direct top/right/bottom/left edges
```

Hierarchy continues to be represented by the nested document tree, not separate `parentId`, order or numeric `zIndex` fields.

---

## P5 — Firebase persistence, Library and autosave ✅

References: PRs #39–#41.

Established the private draft lifecycle:

- Firebase modular Web configuration;
- authenticated user-scoped Firestore repository;
- Presentation persistence behind repository abstractions;
- Library creation/open/archive workflows;
- repository-backed Editor loading by Presentation id;
- explicit Save and debounced autosave;
- dirty/saving/error state handling;
- persistence metadata outside the canonical Presentation.

Private draft storage established the path:

```text
users/{uid}/presentations/{presentationId}
```

---

## P6 — Immutable publishing ✅

Reference: PR #42.

Established the separation between mutable authoring and immutable delivery:

```text
private draft
→ publish
→ immutable public version
→ Player
```

Delivered:

- `draftRevision` persistence metadata;
- transactional publication;
- stable `publicationId` across publishes;
- immutable `versionId` snapshots;
- idempotent unchanged publication;
- public direct-read published versions;
- strict Firestore Rules around authoritative publication;
- public Player loading of an immutable published version.

Published versions are snapshots and are never modified in place.

---

## P7 — Authentication, public publication pointer and remote-control foundation ✅

References: PRs #43–#44.

Delivered:

- persistent Google/Firebase Auth for Studio;
- authenticated Control boundary;
- RTDB remote navigation foundation;
- public publication pointer:

```text
publishedPresentations/{publicationId}
```

- pointer-owned `currentVersionId`;
- public Player resolving the current published version by `publicationId`;
- separation of public Player delivery from mutable Studio draft state.

Studio / Control became authenticated surfaces while Player remained public.

---

## P8 — Live activation and Library entry ✅

References: PRs #45–#46.

Established the user-facing Live lifecycle:

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

Status: **complete**.

Delivered the current real-presentation runtime:

- Player live entry from `live/current`;
- exact immutable published-version loading;
- activation-scoped slide state;
- Player ACK and Control confirmed state;
- command coalescing and latency measurement;
- private slide Notes outside canonical Presentation data;
- Presenter / Control view;
- Current and Next slide previews;
- responsive Control shell;
- staged publication updates while a Player remains live;
- explicit promotion to a newer immutable version;
- logical slide/page identity by `pageId`;
- desired / applied live-state convergence;
- reload/reconnect convergence;
- Watch following actual Player-applied state;
- production-safe Player diagnostics and stale-shell cache hardening.

Current high-level Live flow:

```text
Control desired state
→ RTDB
→ Player applies state from immutable publication
→ Player applied state / ACK
→ Control + Watch observe actual state
```

Deferred live extensions remain in Backlog rather than keeping P9 open indefinitely.

---

# P10 — Canonical Authoring & Import Foundation ✅

Goal: provide a semantic, self-contained authoring model that can be safely saved, published, rendered, exported and imported.

Final baseline rules established by this milestone:

- `schemaVersion` remains `1`;
- strict responsibility-specific element contracts;
- no universal persisted `ElementStyle` bag;
- Flow = absence of `layout.position`;
- Absolute = `layout.position: "absolute"` + direct edges;
- no persisted anchor/offset placement compatibility model;
- published versions remain immutable and self-contained;
- Player remains independent from Studio-private data;
- `textbox` is not canonical; boxed text is `Container + Text`;
- import/export use the canonical Presentation directly, without a second transfer schema.

## P10 status

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

Supporting work during this period also included Firestore nesting-depth protection, Divider, shared application UI, Library organization, and Player production diagnostics.

---

## P10.11 — Canonical Contract Cleanup ✅

The cleanup replaced earlier broad/shared persisted style abstractions with the current responsibility-specific contracts.

Delivered:

- canonical Container / Text / Image contracts;
- surface and data-element-specific contracts;
- canonical ContentSlot;
- Image Crop;
- Divider and Topics final contracts;
- Chart / Interactive semantic position-only contracts;
- dedicated renderer paths;
- removal of universal `BaseElementSchema` / `ElementStyleSchema` / historical placement contracts;
- strict schema/renderer/Studio/Player regressions;
- removal of canonical Textbox in PR #83.

This checkpoint exists to free product development, not to start an endless schema-cleanup cycle.

---

## P10.12 — JSON Import / Export ✅

Reference: PR #84.

PowerShow now exports/imports the canonical Presentation directly:

```text
*.powershow.json
```

Contract:

```text
Export
Presentation
→ readable JSON

Import
JSON.parse
→ PresentationSchema
→ new root Presentation id
→ new private draft
```

There is:

- no export envelope;
- no second schema language;
- no migration layer;
- no compatibility alias system;
- no asset package format.

Slides, elements, internal IDs, resources and authored strings remain canonical through the transfer boundary.

---

## P10.13 — Import compatibility gate ✅ absorbed

The planned compatibility gate was satisfied without introducing a separate compatibility architecture.

The current boundary explicitly rejects:

- malformed JSON;
- wrong schema versions;
- removed/legacy canonical element types such as `textbox`;
- documents that fail current `PresentationSchema` validation.

Subsequent recovery hardening ensures old persisted private drafts can be handled separately without weakening Import.

Import and Recovery remain intentionally different product boundaries.

---

# P11 — Resources, Organization & Text Styles ✅

The original P11 direction has now largely been delivered.

## P11.1 — Shared Studio / Library application shell ✅

References: PRs #69–#71 and #100.

Delivered:

- shared `@powershow/ui` tokens and primitives;
- file-manager-style authenticated Library;
- first-slide previews;
- selection-first contextual actions;
- responsive Studio navigation;
- active / archived presentation views;
- consistent heading/action hierarchy.

---

## P11.2 — Folders and private organization metadata ✅

Reference: PR #71.

Rules:

- folders are private Studio metadata;
- folders are not part of canonical Presentation data;
- Player never depends on folders;
- archive/folder changes do not change draft content or publication snapshots;
- V1 folders remain flat.

---

## P11.3 — Custom Library Styles ✅

References: PRs #85–#99.

Delivered the complete V1 reusable Style recipe lifecycle:

- selected-property inventory;
- recipe extraction and composition;
- strict private persisted contract;
- Firestore persistence;
- Save flow;
- Library browser and safe preview;
- materialization into ordinary canonical elements;
- same-type merge and sibling/root placement;
- Apply workflow;
- no live dependency link from Presentation back to Custom Library.

Architectural rule:

```text
Custom Library Style
→ materialize/copy canonical values
→ Presentation owns its resulting data
```

---

## P11.4 — Presentation + Custom Library Palettes ✅

Reference: PR #101.

Delivered:

- canonical Presentation-local Palette colors;
- stable Palette references;
- renderer CSS-variable resolution;
- Custom Library Palette masters;
- copy/materialization into Presentation-local Palette;
- safe edit/rename/remove behavior;
- literal ↔ Palette authoring lifecycle.

Private master Palette data never becomes a runtime dependency of the Player.

---

## P11.5 — Presentation + Custom Library Fonts ✅

Reference: PR #102.

Delivered:

- private Custom Library Font masters;
- Google / Fontsource / manual acquisition in the Custom Library workflow;
- Presentation-local FontResource materialization;
- face merge/conflict rules;
- in-use removal protection;
- real previews and multi-weight selection;
- no provider/provenance links in canonical Presentation data.

Architecture:

```text
Custom Library Font
→ Presentation FontResource
→ element/Text Style typography
```

---

## P11.6 — Text Inspector authoring refinement ✅

Reference: PR #103.

Delivered the authoring foundation required before Text Styles:

- Content / Typography / Appearance / Effects / Placement / Interaction hierarchy;
- compact RichText formatting integration;
- mixed-selection semantics;
- clear-formatting behavior;
- Palette-aware inline color equality;
- canonical Placement before Interaction.

Broader WYSIWYG polish remains backlog/P12 work.

---

## P11.7 — Canonical Presentation-local Text Styles ✅

Reference: PR #105.

Text Styles are Presentation-local reusable text appearance, distinct from Custom Library families.

Fundamental roles:

```text
title
subtitle
body
caption
```

Final precedence:

```text
Theme role baseline
→ Text Style
→ local Text override
```

Text Styles own exactly:

```text
style.color

typography.fontFamily
typography.fontSize
typography.fontWeight
typography.fontStyle
typography.textAlign
typography.lineHeight
typography.letterSpacing
typography.textTransform
typography.whiteSpace
typography.textWrapStyle
typography.overflowWrap
typography.textDecorationLine
typography.textDecorationColor
typography.textStroke
```

Delivered lifecycle coverage includes:

- fundamental and custom Styles;
- sparse authoring;
- Palette-linked colors;
- FontResource integration;
- attach / switch / detach / reattach;
- local override precedence;
- Aa preview through the real renderer;
- canonical JSON round-trip;
- autosave and Editor remount/reload;
- Player and shared-renderer acceptance.

`schemaVersion` remains `1`; no migration or compatibility aliases were introduced.

---

## P11.8 — Recovery hardening and recovery UI ✅

Reference: PR #105 final checkpoints.

Delivered:

- recovery of incompatible Presentation-level Text Style content;
- removal of obsolete branch-local `typographyStyles` without migration;
- wrong-type/current invalid `textStyles` recovery;
- dependent custom Text pruning through existing structural recovery;
- preservation of fundamental Text where its invalid override can be removed;
- explicit `text-style` recovery issues;
- polished recoverable / confirmation / repairing / failure / unrecoverable screens.

Recovery remains explicit destructive repair, not migration.

---

# P12 — UX / Properties refinement ← NEXT

Goal: refine authoring and product ergonomics now that the canonical contracts, portability, resources and Text Styles are stable.

P12 should be **selective**, not a reason to reopen every Editor idea before production readiness.

Candidate work, promoted checkpoint-by-checkpoint only when concrete:

- final WYSIWYG-oriented Text authoring refinements;
- keep inline formatting controls close to the Content editing surface;
- Image Inspector semantic ordering and framing UX;
- broader Inspector ordering/consistency cleanup;
- Blocks authoring UI refinement;
- targeted Canvas refinements that preserve canonical contracts;
- concise semantic help text where terminology remains ambiguous;
- real authoring smoke/acceptance across representative presentation types.

Already completed P12-like work such as the Text Inspector hierarchy should not be reimplemented.

The rule for P12 is:

```text
fix concrete authoring friction
→ preserve canonical contract
→ avoid speculative feature expansion
```

---

# P13 — Production Readiness — planned

Goal: move PowerShow from a rapidly evolving development system into dependable real production use.

Expected areas:

- full Studio → Save/reload → Publish → Control → Player E2E;
- Live/publication reliability under real reload/reconnect conditions;
- authentication / authorization / public-read boundary review;
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

# P14 — Diagnostics — deferred / partially founded

A diagnostics foundation already exists, especially Player `?logs=true` and production loading diagnostics.

Future diagnostics may include:

- production-safe runtime diagnostics expansion;
- explicit live latency/convergence instrumentation surfaces;
- operator troubleshooting views;
- deploy/runtime health visibility.

Diagnostics must remain gated and must not expose sensitive internals to public clients.

---

# P15 — Audience — future / Watch foundation exists

A basic public read-only Watch surface already follows actual Player-applied state.

Future Audience work may add:

- lightweight viewer presence;
- optional nickname without account;
- heartbeat / TTL / disconnect semantics;
- viewer count in Control;
- optional viewer list;
- privacy boundaries;
- multi-tab behavior;
- richer read-only Watch experience.

Audience clients must never gain control of shared presentation state through presence features.

---

# Backlog

Backlog items are preserved deliberately but **do not automatically become the next checkpoint**.

Before promotion:

```text
verify current implementation
→ identify concrete missing behavior
→ decide whether it blocks active roadmap
→ freeze architecture if needed
→ implement narrowly
```

## Presentation lifecycle / version history

### Permanent Delete of the Presentation aggregate

Future permanent deletion should treat one Presentation and its history as one independent aggregate:

```text
Presentation
├── private draft
├── private notes / sidecar data
└── publication
    ├── public pointer
    └── immutable versions/*
```

Frozen direction:

- one Presentation/history must never affect another Presentation;
- immutable versions are never edited in place;
- deleting the whole Presentation may delete its complete private/public history;
- a live active publication should be handled explicitly before permanent deletion;
- public version enumeration should not be opened merely to support browser-side deletion;
- safe server/privileged cascade deletion should be evaluated with future Version History management.

### Version History management

Future Library/Editor management should expose the immutable version history owned by a Presentation without changing the canonical Presentation document.

A version belongs to one Presentation/publication aggregate and is not shared across presentations.

---

## Custom Library custom-variant portability

Known follow-up:

```text
Custom Library recipe may contain:
variant: "quote"

while the Presentation-local custom Text Style "quote" is not part of the recipe.
```

Do not solve this by adding a fourth Custom Library family casually.

The dependency/materialization contract should be designed explicitly when this backlog item is promoted.

---

## Known bugs / Canvas

### Cropped Image selection visibility — high

- an Image with canonical `crop` may disappear visually while selected in Studio Canvas;
- the crop persists correctly;
- after reload the Image renders with the expected crop;
- treat as Studio/Canvas lifecycle/rendering behavior, not a canonical-contract failure.

---

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

Interaction should normally remain near the end of a visual-element Inspector.

---

## Text / rich-authoring refinements

- continue moving inline formatting toward a compact WYSIWYG editing surface;
- richer topics/bullets integration only where it fits the canonical structure;
- verify final nowrap authoring UX;
- keep `Normal` first/default for text-transform;
- provide ALL CAPS affordance only where still useful beyond `textTransform`;
- preserve RichText runs instead of flattening them during ordinary edits.

---

## Fonts / typography UX

- Normal / Regular remains first/default when provider variants are shown;
- never choose Italic merely because provider ordering puts it first;
- provider-specific acquisition remains behind the Custom Library Font workflow;
- Presentation typography consumes normalized FontResources only.

---

## Blocks authoring UI

Canonical Blocks semantics are complete, but authoring can become more visual/direct:

- improve block/part/socket hierarchy manipulation;
- reduce form-like editing where safe;
- preserve static provider-neutral canonical Blocks;
- do not add Blockly/runtime coupling merely for Editor convenience.

---

## Gallery / visual vocabulary

- richer interactive Gallery behavior beyond current minimum;
- additional pattern vocabulary when driven by concrete design needs;
- reusable visual components should use responsibility-specific contracts;
- never reintroduce a universal style bag to solve convenience gaps.

Already implemented and not generic backlog items:

- Divider;
- Topics;
- Gallery minimum;
- Embed minimum;
- Scripted minimum;
- approved background patterns;
- supported gradient borders.

---

## Chart implementation

Chart has a canonical semantic contract but remains a renderer/authoring expansion opportunity.

Future direction:

- implement real rendering for existing `line`, `bar`, `area`, `scatter` contracts;
- add Studio creation/authoring;
- keep canonical series data renderer-library-neutral;
- choose rendering technology only when promoted;
- keep Player lightweight.

Do not redesign the canonical Chart merely to fit a chosen charting library.

---

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

---

## Scripted future enhancements

The secure Scripted minimum is complete.

Future work must preserve:

- authored JavaScript does not execute in the PowerShow application context;
- no `eval` / `Function`;
- sandbox permissions remain renderer-owned unless a dedicated security design changes them;
- no PowerShow/session/control bridge by default.

---

## Control / Live extensions

Potential future work:

- richer Control commands;
- explicit command protocol extensions;
- native browser fullscreen UX consistent with local user-gesture rules;
- additional presentation-mode controls.

Do not claim browser-restricted behavior succeeded when the browser requires a local user gesture.

---

## Studio polish

- use the Chinese ideogram `文` as the translation symbol where the translation action is surfaced;
- broader visual consistency refinements;
- documentation/help when terminology stabilizes;
- avoid proliferating top-level Inspector sections for every capability.

---

## Player / runtime future work

- additional legacy-runtime expansion only when justified by real compatibility needs;
- offline/resilience improvements;
- performance work driven by measurement;
- avoid unnecessary polling or continuous rendering loops.

---

# Complete execution order

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
  10.1   Typography & Fonts refinement                      ✅
  10.2   Links / Interaction                                ✅
  10.3   ContentSlot foundation                             ✅
  10.4   Topics                                             ✅
  10.5   Structured Table                                   ✅
  10.6   Inline Text / Rich Text                            ✅
  10.7   Gallery minimum                                    ✅
  10.8   Embed minimum                                      ✅
  10.9   Blocks + Code semantics                            ✅
  10.10  Scripted                                           ✅
  10.11  Canonical Contract Cleanup + Textbox removal       ✅
  10.12  JSON Import / Export                               ✅
  10.13  Import compatibility gate                          ✅ absorbed

P11   Resources, Organization & Text Styles                 ✅
  11.1   Shared Studio / Library shell                      ✅
  11.2   Folders / private organization                     ✅
  11.3   Custom Library Styles                              ✅
  11.4   Presentation + Custom Library Palettes             ✅
  11.5   Presentation + Custom Library Fonts                ✅
  11.6   Text Inspector authoring refinement                ✅
  11.7   Presentation-local Text Styles                     ✅
  11.8   Recovery hardening + recovery UI                   ✅

P12   UX / Properties refinement                            ← NEXT
P13   Production Readiness                                  planned
P14   Diagnostics                                           deferred / partial base
P15   Audience expansion                                    future / Watch base exists
```

The next checkpoint should start from current `main`, inspect concrete P12 authoring friction, and promote only the smallest high-value refinement before moving toward P13 Production Readiness.
