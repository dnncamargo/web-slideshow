# PowerShow Roadmap

This document is the **current operational execution order** for PowerShow.

Checkpoint numbering follows the actual execution chronology. Historical PRs and commits remain the authoritative references for past implementation details; the roadmap does not maintain a second table translating obsolete planned numbers into current numbers.

## Execution policy

The roadmap is a work-order document, not a promise that every future contract is already frozen.

For planned work:

```text
inspect current code
→ define the concrete product need
→ freeze architecture/contract for the checkpoint
→ implement narrowly
→ test
→ review the real remote commit
→ advance
```

Do not reopen completed architecture cleanup speculatively. After P10.11, contract changes should be driven by concrete product requirements.

---

# P9 — Live presentation foundation ✅

Status: **complete in the previous product cycle**.

The core real-presentation path is already in production code:

- authenticated Studio / Control;
- live presentation activation;
- Player live entry from the active session;
- canonical live slide state;
- Player ACK / desired-applied state convergence;
- navigation by logical slide/page id;
- private slide notes;
- Presenter / Control view;
- Current and Next previews;
- staged publication updates while a Player is live;
- logical-slide preservation across publication promotion;
- Watch following applied Player state;
- reload/convergence hardening for the live protocol.

Deferred product extensions from this area are tracked in Backlog rather than keeping P9 open indefinitely.

---

# P10 — Canonical Authoring / Import Foundation

Goal: provide a complete, semantic, self-contained authoring model that can be safely saved, published, rendered, exported and imported.

Current baseline rules:

- `schemaVersion` remains `1`;
- one canonical representation per authored intention;
- no universal persisted `ElementStyle` bag;
- Flow = absence of `layout.position`;
- Absolute = `layout.position: "absolute"` + direct edges;
- no persisted `ElementPlacement`, anchor or offset model;
- no migration/backfill/compatibility aliases introduced by P10.11;
- published versions remain immutable and self-contained;
- Player remains independent from Studio.

## P10 status

| Checkpoint | Area | Status |
|---|---|---:|
| P10.1 | Typography & Fonts | ✅ |
| P10.2 | Links / Interaction | ✅ |
| P10.3 | ContentSlot foundation | ✅ |
| P10.4 | Topics | ✅ |
| P10.5 | Structured Table | ✅ |
| P10.6 | Inline Text / Rich Text foundation | ✅ |
| P10.7 | Gallery minimum | ✅ |
| P10.8 | Embed minimum | ✅ |
| P10.9 | Blocks + Code semantics | ✅ |
| P10.10 | Scripted | ✅ |
| P10.11 | Canonical Contract Cleanup | ✅ |
| **P10.12** | **JSON Import / Export** | **← NEXT** |
| P10.13 | Import compatibility gate | planned |

### P10.9 — Blocks + Code semantics ✅

Delivered:

- Code remains static `<pre><code>` content;
- Blocks is structured visual code, static and provider-neutral;
- recursive Blocks authoring;
- persistence/recovery safeguards;
- regression coverage.

Merged through PR #77 with the follow-up Blocks hotfix in PR #78.

### P10.10 — Scripted ✅

Delivered through PR #79:

- canonical Scripted element;
- authored HTML/CSS/JavaScript in Studio;
- explicit Apply / Run authoring flow;
- renderer-owned sandboxed iframe;
- exact sandbox policy: `allow-scripts` only;
- no `allow-same-origin`;
- fixed CSP and `no-referrer` policy;
- no `eval`, `Function`, runtime bridge or authored sandbox permissions;
- Canvas / Player / persistence / publication / recovery coverage.

Scripted is intentionally distinct from Embed:

```text
Embed
→ external content in a sandboxed iframe

Scripted
→ authored HTML/CSS/JS in an isolated renderer-owned sandbox
```

### P10.11 — Canonical Contract Cleanup ✅

Completed and merged through PR #81.

Squash merge baseline on `main`:

```text
4b7f945fcff38666e73792b9d684cc9cd5f82f04
```

Delivered:

- responsibility-specific canonical contracts for all current elements;
- canonical Container / Text / Textbox / Image / surface / data contracts;
- canonical Image Crop;
- Divider and Topics contracts;
- Chart / Interactive semantic position-only contracts;
- structural canonical ContentSlot;
- dedicated canonical renderers;
- removal of `BaseElementSchema`;
- removal of universal `ElementStyleSchema`;
- removal of `ElementPlacementSchema`;
- removal of generic persisted-style `renderStyle()`;
- removal of legacy Placement Inspector/helpers;
- strict schema tests, renderer tests, Studio tests and Player tests;
- Studio and Player production builds passing.

P10.11 exists to **free further product development**, not to begin another indefinite schema-cleanup cycle.

Remaining visual vocabulary and UX gaps are explicit backlog items unless a concrete feature promotes one into the active roadmap.

---

## P10.12 — JSON Import / Export ← NEXT

Goal: make the canonical PowerShow document portable without redesigning the document model again.

Architecture must be frozen at checkpoint start, but the direction is:

- export a self-contained canonical Presentation document;
- import through the canonical schema boundary;
- preserve resources required by the presentation document;
- provide clear validation/error behavior;
- preserve semantic IDs and authored structure unless the import contract explicitly requires otherwise;
- do not introduce a second schema language for import/export;
- do not use P10.12 as an excuse to redesign P10.11 contracts.

Required end-to-end invariant:

```text
Studio
→ export
→ import
→ save/reload
→ publish
→ Control
→ Player
```

The exact file UX, collision policy, replacement/copy semantics and error presentation must be frozen before implementation.

---

## P10.13 — Import compatibility gate

Goal: harden the portability boundary before moving into higher-level organization and production work.

Planned validation areas:

- representative canonical presentations round-trip correctly;
- invalid documents fail safely and understandably;
- imported content does not silently widen canonical contracts;
- persistence and publication remain canonical after import;
- recovery behavior remains structurally conservative;
- Studio / renderer / Control / Player agree on imported documents;
- compatibility expectations are explicit rather than accidental.

This checkpoint must not introduce speculative migration architecture.

---

# P11 — Resources & Organization

Goal: improve how users organize presentations and reuse authoring resources without leaking private Studio metadata into published documents.

Planned areas, to be frozen checkpoint-by-checkpoint:

## P11.1 — Studio / Library organization

Direction:

- PowerShow Studio as the authoring home;
- file-manager style presentation list;
- thumbnails;
- selection-first workflow;
- contextual actions;
- active / archived presentation states;
- responsive Studio navigation.

## P11.2 — Folders and private organization metadata

Rules already established:

- folders are private Studio metadata;
- folders are not part of the published Presentation document;
- Player never depends on folder metadata;
- exact Firestore persistence shape must be frozen before implementation.

## P11.3 — Reusable resources

Preserve this distinction:

```text
Theme
→ presentation-wide visual / structural identity

Saved Style
→ reusable element-level authoring configuration
```

Potential resource libraries:

- Saved Styles;
- Colors / palettes;
- Fonts.

A Saved Style must materialize canonical values into the Presentation when applied. Published snapshots must remain self-contained and must never resolve a private Saved Style id at runtime.

---

# P12 — UX / Properties refinement

Goal: refine the Studio after the canonical contracts and portability boundary are stable.

This is the preferred home for broad Inspector/editor polish that should not interrupt the critical feature path.

Planned areas include:

- semantic Inspector ordering and grouping;
- clearer help text where terminology is ambiguous;
- consistent Size / Positioning / Appearance / Effects / Interaction ordering;
- richer but still contract-safe Properties controls;
- final WYSIWYG-oriented text authoring refinements;
- authoring ergonomics and visual consistency;
- targeted Canvas refinements that do not widen canonical contracts.

Do not turn each feature checkpoint before P12 into a general Editor redesign.

---

# P13 — Production Readiness

Goal: move PowerShow from a feature-complete development system into dependable real production use.

Expected areas:

- fix production-blocking known bugs;
- full Studio → Save/reload → Publish → Control → Player E2E;
- live-session and publication reliability;
- authentication / authorization / public-read boundary review;
- failure and reload recovery;
- deployment configuration and production smoke tests;
- performance checks, especially Player and constrained hardware;
- modern / legacy Player compatibility expectations;
- responsive desktop/mobile verification;
- browser compatibility for interactive and sandboxed content;
- final security review for public Player, Embed and Scripted;
- production error states and operator-facing recovery behavior;
- release checklist and rollback expectations.

Production Readiness should prioritize concrete failures over cosmetic backlog.

---

# P14 — Diagnostics — deferred

Diagnostics are useful but are not currently on the critical path.

Potential work:

- production-safe runtime diagnostics;
- more explicit live latency / convergence instrumentation;
- operator troubleshooting surfaces;
- deploy/runtime health visibility.

Diagnostics must remain gated and must not expose sensitive internals to public clients.

---

# P15 — Audience — future

Audience/Watch expansion remains future work after the authoring and production path is stable.

Potential areas:

- lightweight public viewer presence;
- optional nickname without account;
- heartbeat / TTL / disconnect semantics;
- viewer count in Control;
- optional viewer list;
- privacy boundaries;
- multi-tab behavior;
- richer read-only Watch experience.

Audience clients must never gain control of the shared presentation state through presence features.

---

# Backlog

Backlog items are intentionally preserved but **do not automatically become the next checkpoint**.

Before promoting a backlog item:

```text
verify current implementation
→ identify concrete missing behavior
→ decide whether it blocks the active roadmap
→ freeze architecture if needed
→ implement
```

## Known bugs

### Cropped Image selection visibility — high

- an Image with canonical `crop` may disappear visually when selected in the Studio Canvas;
- the crop itself persists correctly;
- after reload, the Image renders with the expected crop;
- treat as a Studio/Canvas lifecycle/rendering bug, not a canonical-contract failure.

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
Interaction
```

General preference:

- Size should precede Interaction;
- Interaction should normally appear near the end of a visual element Inspector.

## Text / rich-authoring refinements

- move inline formatting controls closer to / above Content so selection + formatting feels WYSIWYG;
- topics/bullets inside richer text authoring where appropriate;
- verify final nowrap authoring UX;
- `Normal` should be the first/default text-transform option;
- ALL CAPS authoring affordance where still needed.

## Fonts / typography UX

- when font variants are listed, Normal / Regular must be first/default when available;
- do not let provider ordering select Italic by default;
- keep provider-specific Font Manager UI behind a single Source selector.

## Reusable authoring resources

- reusable custom color palette;
- easier reuse/preservation of border colors;
- Saved Styles / Colors / Fonts libraries under P11 when their persistence model is frozen.

## Gallery / visual vocabulary

- interactive gallery beyond the current Gallery minimum;
- broader pattern support where a concrete element contract requires it;
- additional visual vocabulary gaps discovered during real authoring;
- do not reintroduce a universal style bag to solve these.

Already implemented and therefore **not generic backlog items**:

- Divider;
- Topics;
- Gallery minimum;
- Embed minimum;
- Scripted minimum;
- canonical background pattern support in its approved locations;
- gradient-border authoring where currently supported.

## Interactive educational elements

Future explicit components may include:

- sine / function plots;
- linear functions;
- quadratic functions;
- square waves;
- PWM demonstrations;
- electrical circuits / current-flow visualization;
- geometry demonstrations;
- interactive diagrams.

Official interactive components should have explicit semantic contracts. Do not encode a rendering library (Chart.js, D3, React, Canvas, SVG, etc.) into their canonical document schema.

## Scripted future enhancements

The secure Scripted minimum is complete. Future capabilities must preserve the security boundary:

- authored JavaScript never executes in the PowerShow application context;
- no `eval` / `Function`;
- sandbox permissions remain renderer-owned unless a future security design explicitly changes that;
- no PowerShow/session/control runtime bridge by default.

## Control / live extensions

Core live operation is complete, but future operator features remain backlog unless promoted:

- richer Control commands;
- explicit command protocol extensions;
- native-browser fullscreen UX / local user-gesture semantics;
- additional presentation-mode controls.

Do not pretend remotely requested browser-restricted behavior succeeded when the browser requires a local user gesture.

## Studio polish

- use the Chinese ideogram `文` as the translation symbol where that translation action is surfaced;
- broader visual consistency refinements;
- concise semantic help text;
- documentation page when terminology/workflows are closer to final;
- avoid proliferating top-level Inspector sections for every feature.

## Player / runtime future work

- additional legacy-runtime expansion only when justified by real compatibility needs;
- offline/resilience improvements;
- further performance work after measurement;
- avoid unnecessary polling or continuous rendering loops.

---

# Current execution order

```text
P9    Live presentation foundation           ✅

P10   Canonical Authoring / Import Foundation
  10.1  Typography & Fonts                   ✅
  10.2  Links / Interaction                  ✅
  10.3  ContentSlot foundation               ✅
  10.4  Topics                               ✅
  10.5  Structured Table                     ✅
  10.6  Inline Text / Rich Text              ✅
  10.7  Gallery minimum                      ✅
  10.8  Embed minimum                        ✅
  10.9  Blocks + Code semantics              ✅
  10.10 Scripted                             ✅
  10.11 Canonical Contract Cleanup           ✅
  10.12 JSON Import / Export                 ← NEXT
  10.13 Import compatibility gate            planned

P11   Resources & Organization                planned
P12   UX / Properties refinement              planned
P13   Production Readiness                    planned
P14   Diagnostics                             deferred
P15   Audience                                future
```

The next implementation checkpoint should start from current `main`, inspect the actual import/export boundaries, freeze P10.12 architecture, and only then create its implementation branch.