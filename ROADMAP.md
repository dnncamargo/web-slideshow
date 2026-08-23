# PowerShow Roadmap

This document is the current execution order for PowerShow.

Historical checkpoint names remain historical. The roadmap below reflects the product and authoring sequence currently used for new work.

## Canonical schema version policy

The current document remains:

```text
schemaVersion: 1
```

PowerShow is still pre-stable. Canonical contract cleanup may intentionally invalidate disposable development presentations without creating a second schema version, a migration layer, or a V1/V2 compatibility system.

A future schema-version bump should happen only when PowerShow has a real compatibility boundary worth preserving.

The historical branch name `feat/canonical-v2` does **not** mean the repository is introducing `schemaVersion: 2`; it is the branch currently used for canonical contract refinement.

---

# P9 — Live presentation and Control foundation ✅

Status: **complete for the current product baseline**.

Delivered foundations include:

- authenticated Studio / Control surfaces;
- public Player runtime;
- immutable published presentation versions;
- public publication pointer;
- active Live version state;
- Previous / Next remote navigation;
- Player ACK-authoritative state;
- latency / synchronization diagnostics;
- Current and Next previews;
- private Notes;
- presentation Summary;
- responsive Presenter / Control experience;
- staged Live Publish;
- Control preview of the latest publication while Player stays on the released version;
- logical slide preservation by `slide.id` across publication changes;
- explicit **Update Player** promotion;
- Player hot reload after promotion;
- version/revision protection against stale command and ACK reuse;
- presentation Library organization and publication workflows.

These behaviors are regression gates for later canonical-document changes. A schema refactor is not complete if Studio, persistence, publication, Control, or Player stop traversing the same canonical presentation safely.

---

# P10 — Authoring and Canonical Document Model ← ACTIVE

P10 builds the canonical authoring vocabulary before JSON Import/Export and broader properties/resource systems make the document contract more externally visible.

The governing principle is:

> Prefer semantic, readable, predictable PowerShow documents over persisted implementation details.

## P10.1 — Typography & Fonts ✅

Delivered:

- typography authoring foundation;
- effective Theme/default editing baselines;
- font resources and provider-oriented Font Manager;
- Fontsource and Google Fonts work;
- explicit application of newly added fonts;
- Normal / Regular preference when font variants are available.

## P10.2 — Links / Interaction ✅

Delivered safe URL links for applicable visual elements while preserving renderer-owned interaction semantics.

## P10.3 — ContentSlot ✅

Delivered structured nested content slots as a reusable authoring/document primitive.

## P10.4 — Topics ✅

Delivered canonical structured Topics, recursive TopicItem authoring, ContentSlot integration, rendering, hierarchy, and depth-safe authoring behavior.

## P10.5 — Structured Table ✅

Delivered the structured Table foundation with ContentSlots, semantic rendering, hierarchy integration, and Studio authoring.

The older Simple Table path still exists and may be reconsidered during later canonical cleanup, but its removal must not block the current Container work unless it becomes a concrete dependency.

## P10.x — Inline / Rich Text ✅

Delivered canonical inline rich-text runs and selection-based authoring for supported Text content, including nested Text inside structured content.

WYSIWYG toolbar placement and broader editing polish are intentionally deferred to the UX cycle.

## P10.6 — Gallery minimum ✅

Delivered the Gallery foundation and minimal Studio authoring.

Future redesign may consider richer Image composition, per-item behavior, and interactive navigation, but those are not part of the current canonical cleanup.

## P10.7 — Embed minimum ✅

Delivered canonical Embed with renderer-owned security and minimal authoring.

## P10.8 — Blocks ✅

Delivered static structured visual Blocks with recursive authoring, renderer support, persistence/recovery safeguards, and socket/value semantics.

The model is closed for now. Visual readability and editor polish are deferred.

## P10.9 — Scripted ✅

Delivered sandboxed authored HTML/CSS/JavaScript.

Security remains renderer-owned:

- `allow-scripts` only;
- no same-origin capability;
- restrictive CSP;
- no PowerShow runtime bridge;
- no direct execution inside Studio or Player DOM.

Do not reopen Scripted security during unrelated canonical cleanup.

---

# P10.10 — Canonical Visual Vocabulary & Contract Cleanup ← ACTIVE

## P10.10-A — Background Pattern contract ✅

Established the Pattern visual capability and canonical validation foundation.

## P10.10-B — Pattern renderer ✅

Established static Pattern rendering and the Container reference implementation.

## P10.10-C — Pattern Studio authoring ✅

Delivered Container Pattern authoring, presets, Custom Pattern support, validation, persistence behavior, and manual gate coverage.

## P10.10-D — Gradient Border authoring ✅

Delivered Border paint selection between Color and Gradient using the existing canonical Border gradient capability.

Gradient Border remains a Border paint mode, not a separate top-level feature.

## P10.10-E — Canonical Contract Cleanup ← CURRENT

Purpose: fix the most consequential accumulated contract inconsistencies **without turning the checkpoint into a complete redesign of every element**.

### Scope rule

A cleanup belongs here when it materially improves or unblocks the next authoring/document features.

Good reasons:

- two canonical representations express the same intent;
- a field lives under the wrong semantic responsibility;
- Studio and renderer require precedence rules because the contract is duplicated;
- the current shape would make JSON Import/Export or Elements Properties unnecessarily confusing;
- a missing structural concept prevents an already intended feature from being represented correctly.

Not enough by itself:

- a different shape looks more elegant;
- future features might hypothetically need it;
- a complete taxonomy could be more symmetrical;
- an unrelated subsystem could also be refactored while nearby code is open.

### Schema-version constraint

Keep:

```text
schemaVersion: 1
```

Do not introduce:

- `PresentationV2Schema`;
- V1/V2 unions;
- migration adapters;
- legacy compatibility parsing;
- a schema bump solely for these pre-stable corrections.

Development presentations may be recreated after breaking canonical changes.

---

## P10.10-E1 — Canonical Container candidate alignment ← NEXT

The repository currently contains an intentionally parallel Container candidate/parity harness. Before any production cutover, align that candidate to the selected canonical responsibilities.

### Target responsibilities

```text
Container
├── identity / structure
│   ├── id
│   ├── type
│   ├── role?
│   ├── hidden
│   ├── link?
│   └── children
│
├── layout
│   ├── size
│   ├── spacing
│   ├── overflow
│   ├── positioning
│   └── children layout
│
├── style
│   ├── foreground color
│   ├── background
│   ├── border
│   ├── borderRadius
│   └── className?  [advanced escape hatch under audit]
│
├── typography
│
└── effect
    ├── opacity
    └── shadow
```

### Canonical minimum

A minimal Container remains simple:

```json
{
  "id": "container-1",
  "type": "container",
  "children": []
}
```

Empty namespaces are not required and should not be materialized merely for symmetry.

### `layout`

Preferred Container layout vocabulary:

```text
layout
├── width
├── height
├── minWidth
├── minHeight
├── maxWidth
├── maxHeight
├── margin
├── marginTop
├── marginRight
├── marginBottom
├── marginLeft
├── padding
├── paddingTop
├── paddingRight
├── paddingBottom
├── paddingLeft
├── overflow
├── position
├── top
├── right
├── bottom
├── left
└── children
    ├── mode
    ├── direction
    ├── gap
    ├── distribution
    ├── horizontalAlign
    └── verticalAlign
```

### Positioning

Canonical authoring should use the explicit positioning vocabulary:

```json
{
  "layout": {
    "position": "absolute",
    "top": 24,
    "right": 32
  }
}
```

Normal flow is represented by absence of `position`.

Remove the candidate `placement` abstraction from the target Container contract:

```text
placement
placement.mode
placement.anchor
placement.offsetX
placement.offsetY
```

`inset` is not canonical authoring syntax. It is a CSS shorthand and adds no necessary semantic information to the document.

The renderer remains free to emit internal `position: relative`, `inset: 0`, transforms, wrappers, or overlays whenever implementation requires them.

`position: relative` is not an authorable Container decision unless a future concrete product requirement establishes one.

### Child layout

Keep the distinction:

```text
layout.position
→ placement of this Container in its parent

layout.children
→ organization of this Container's children
```

`gap` belongs under `layout.children.gap` because it describes the relationship among children.

### Overflow

Prefer:

```text
layout.overflow
```

rather than `style.overflow`.

### Style

Container visual surface:

```text
style
├── color
├── background
│   ├── color
│   ├── gradient
│   └── pattern
├── border
├── borderRadius
└── className?
```

Do not impose Gradient/Pattern XOR merely as cleanup. The current direction allows the visual layers to coexist when the renderer supports their composition.

`className` remains an advanced technical escape hatch under audit and must not block the main Container cleanup.

### Typography

Container typography becomes a sibling responsibility:

```json
{
  "typography": {
    "fontFamily": "Inter",
    "fontSize": 20,
    "fontWeight": 400,
    "lineHeight": 1.4
  }
}
```

Do not persist explicit `inheritance` or `context` objects. CSS/renderer inheritance is runtime behavior.

### Effects

Prefer:

```text
effect.opacity
effect.shadow
```

rather than placing these fields inside visual surface style.

### Link and behavior

Container `link` remains a direct property. The Inspector may present it under an Interaction section without forcing an `interaction` or empty `behavior` namespace into the document.

### E1 modification boundary

First align only the parallel candidate schema/renderer and its focused tests.

Do **not** combine candidate alignment with the production cutover in the same checkpoint.

---

## P10.10-E2 — Container production cutover

After remote review and approval of the candidate:

1. make the new Container structure the normal canonical `ContainerSchema`;
2. migrate all Studio producers to the new addresses;
3. migrate Canvas/layout interactions;
4. make the normal renderer consume the new Container directly;
5. remove temporary V2/legacy Container parity infrastructure;
6. keep `schemaVersion: 1`;
7. recreate disposable fixtures/presentations as needed.

### Producers to audit

At minimum:

- element creation;
- layout presets;
- Container Inspector;
- Size controls;
- Position controls;
- Canvas drag/resize;
- hierarchy/tree operations;
- demo/fixture presentations;
- duplication/copy operations;
- Theme/preset resolution.

### Consumers to audit

At minimum:

- renderer;
- Canvas preview;
- thumbnail preview;
- persistence validation;
- Firestore draft save/reload;
- publication transaction;
- Control published-version reader;
- Player published-version loader.

### No permanent dual Container model

After cutover, the product should simply have:

```text
ContainerSchema
renderContainer()
```

not a permanent architecture of:

```text
LegacyContainer
V2Container
```

---

## P10.10-E3 — Integrated Container gate

The canonical change is not complete merely because schema and renderer tests pass.

A newly created presentation using the cleaned-up Container contract must pass:

```text
New presentation
      ↓
Edit
      ↓
Save
      ↓
Studio reload
      ↓
Publish
      ↓
Control
      ↓
Player
      ↓
Previous / Next
      ↓
republish changed presentation
      ↓
Control sees pending publication
      ↓
Update Player
      ↓
Player promotion / reload
      ↓
Control reload
      ↓
Player reload
```

Preserve the existing Live wire contract unless the canonical change exposes a concrete incompatibility. The RTDB protocol should not learn Container implementation details.

Preserve Firestore publication guarantees and immutable published versions.

---

## P10.10-E4 — Selective remaining canonical cleanup

After Container is stable, evaluate remaining candidates one by one. Do not automatically execute the entire historical cleanup wishlist.

### Strong structural candidate: Image crop / frame

Image currently has `fit` and `focalPoint`, but no explicit canonical crop. A future checkpoint should define the minimum structural contract needed to support:

- explicit crop;
- stable image frame semantics;
- clipping;
- border and gradient border;
- borderRadius;
- optional link;
- renderer structure independent from whether the Image is linked.

The canonical document should describe Image intent; wrapper/clip/media DOM structure remains renderer implementation.

### Pattern semantic cleanup

The preferred long-term JSON is semantic and readable, for example:

```json
{
  "pattern": {
    "type": "dots",
    "color": "rgba(148,163,184,0.20)",
    "size": 24,
    "opacity": 0.7
  }
}
```

rather than persisting a resolved CSS gradient for every common preset.

Keep Custom Pattern as the place for lower-level CSS-oriented escape hatches when required.

Do not let this work block Container unless Background integration requires it.

### Other candidates — not automatically in scope

Reconsider only when they have concrete value:

- retirement of legacy Simple Table;
- tighter `LengthSchema` domains;
- Chart / Interactive placeholder status;
- margin/padding representation cleanup;
- `className` retirement or formalization;
- `textbox.preset` cleanup;
- broader namespace normalization across every element.

---

# P10.11 — JSON Import / Export

Implement import/export **after** the essential canonical cleanup is stable.

Goals:

- human-readable canonical JSON;
- deterministic export shape;
- strict canonical validation on import;
- clear errors for invalid documents;
- no hidden dependency on private Studio state;
- preserve self-contained published documents.

P10.11 should consume the contract; it should not become another broad schema-design cycle.

---

# P10.12 — Import compatibility / capability gate

Define the difference between:

```text
structurally valid canonical document
```

and:

```text
combination that PowerShow currently supports semantically and can author/render
```

Goals:

- explicit capability policy;
- predictable unsupported-combination errors;
- no accidental inference of product capability merely because a broad schema field exists;
- shared semantics that can later support Elements Properties.

This checkpoint is about capability/support compatibility, **not** V1/V2 schema migration.

---

# P11 — Resources & Organization

Build reusable authoring resources without making Player depend on private Studio state.

Planned areas:

- reusable Saved Styles;
- color resources / reusable palette;
- font resources and organization;
- authoring libraries where useful;
- continued presentation/folder organization refinement.

Core invariant:

```text
private Studio resource
        ↓ apply
materialized canonical values
        ↓ publish
self-contained presentation
```

Player must not resolve private Saved Style or palette IDs at runtime.

---

# P12 — Elements Properties & Authoring UX

Consolidate the property system and deferred editor polish after the canonical contract is sufficiently stable.

Planned areas include:

- capability-driven Elements Properties;
- semantic property grouping;
- better Content / WYSIWYG toolbar proximity;
- common text formatting UX;
- reusable custom color palette UX;
- visual Blocks readability/layout refinement;
- Inspector consistency;
- advanced property presentation only where useful;
- additional Gallery/Divider refinement where justified.

Do not reopen already-stable element models merely for aesthetic cleanup.

---

# P13 — Production Readiness

Prepare PowerShow for dependable real-world use.

Expected areas:

- end-to-end hardening;
- deployment/regression gates;
- recovery/failure behavior;
- performance review;
- browser/runtime compatibility review;
- security review;
- persistence/publication integrity;
- operational documentation.

Exact checkpoints are intentionally not frozen yet.

---

# P14 — Diagnostics / Observability — DEFERRED

Broader diagnostics remain valuable but should not distract from canonical authoring and production readiness.

Player already has targeted diagnostics for important loading/live paths. Expand observability when operational needs justify it.

---

# P15 — Audience / Watch — FUTURE

Future public audience capabilities may include:

- read-only Watch experience;
- audience QR entry;
- lightweight presence;
- viewer count;
- optional nickname;
- heartbeat / TTL;
- privacy boundaries;
- multi-tab behavior.

Audience must remain unable to control the shared presentation.

---

# Parking lot — valid ideas, not frozen execution scope

These ideas remain valid but should not block the active canonical-contract work:

- dedicated PowerShow documentation page near later product stabilization;
- interactive Gallery evolution;
- richer Divider capabilities;
- additional Pattern presets / libraries;
- saved Pattern resources;
- translation action using `文`;
- richer Text topics/bullets and editing controls;
- image crop UI with handles, zoom, pan, masks, rotate/flip;
- real Chart element;
- real Interactive element libraries;
- function plots / geometry / PWM / circuit experiences;
- additional Live commands;
- browser fullscreen refinements;
- broader Audience/Watch experience.

The roadmap should be updated when one of these becomes a concrete product checkpoint, rather than silently expanding an active checkpoint.
