# Roadmap

This document records the **execution path from the canonical-document foundation to the current work area**.

Merged code in `main` remains authoritative. Every new work area begins by revalidating the real repository state.

## Status legend

- ✅ complete / merged
- 🟡 useful operational base complete; future expansion exists
- ← NEXT current planned execution area
- planned future checkpoint
- deferred intentional backlog/future work

## Execution policy

The repository uses audit-first, checkpoint-driven development:

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

Established strict `@web-slideshow/document-schema`, recursive semantic elements, runtime validation and `schemaVersion: 1`.

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

Delivered shared Studio/Library shell, private folders, Custom Library resources, Presentation-local Palette/FontResources/Text Styles, and target-specific Linked Styles for Container, Topics, Code, Terminal, Table (Simple and Structured) and Divider. The resource system now provides local-over-master property ownership, Inspector local overrides, master property propagation, and categorized property authoring parity where relevant.

Style property precedence:

```text
local authored property
> master Style property
> Theme / role / element default
```

Inspector edits the selected element locally; Resources edits the shared master and propagates property ownership to currently linked applicable usages. Master Add/Edit/Remove clears the matching local property while preserving unrelated properties. Attach and destination-owned Switch semantics are distinct from Detach, which preserves effective state by materializing required values locally.

Text content and rich content remain outside Text Style ownership. Linked Styles now support the seven completed target contracts: Container, Topics, Code, Terminal, Simple Table, Structured Table and Divider. Table modes remain incompatible and target/mode are immutable after creation; the expansion is not a generic all-elements abstraction.

Attach / Switch / Detach semantics:

```text
Attach: destination-defined properties become linked
Switch: destination ownership only; omitted properties are not copied from the source
Detach: relationship removed; effective state preserved locally
```

---

# P12 — UX / Properties refinement ✅

Delivered shared logical slide geometry, Player/Editor/Presenter/Watch geometry convergence, Palette/gradient corrections, Container overflow/Fit/Preserve size, Image inspector refinements, Delete→Enter confirmation and related authoring polish.

Direct Canvas manipulation inside transformed fitted Containers remains deferred until inverse transformed-authoring geometry is deliberately implemented.

---

# Runtime and product surfaces ✅

```text
Application
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

The current product surfaces are Library, Editor, Control, Player and Watch.

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
- Maintenance under Control;
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

# Shape integration ✅

Reference: PR #209 and the SH6 integration acceptance checkpoint.

Shape integration is complete without changing the canonical schema version; `schemaVersion` remains literally `1`.

Completed capability line:

- canonical Shape element with path and bounded generated geometry intent;
- Studio Shape creation, Geometry authoring and Shape Inspector integration;
- Rectangle, Ellipse, Triangle, Polygon and Star presets;
- generated QR Shape authoring with editable content, error correction and quiet zone;
- bounded raw SVG `d` authoring;
- safe static SVG import with basic primitive normalization and 2D transform flattening;
- single-layer Shape import and compound Container + Shape materialization;
- imported appearance and opacity normalization with canonical-only persistence;
- Appearance, Effects, Size and Interaction integration;
- shared renderer coverage across Studio preview, Library thumbnails, export and publication/Player output;
- bounded Shape animation with rotation, translation, skew, duration, loop and autoplay;
- local Studio preview and separate Control→Player Play/Pause/Reset live actions;
- strict separate Shape live-action RTDB channel, independent from Plot animation.
- QR rounded background and outer Border semantics.

Permanent Shape boundary:

```text
authored path / supported static SVG / bounded generator intent
→ canonical Shape/Container representation
→ shared renderer
```

The current contract supports bounded raw SVG path-data (`d`) and a safe static SVG subset containing `svg`, `g`, `path`, `rect`, `circle`, `ellipse`, `line`, `polyline` and `polygon`. Supported `fill`, `stroke`, `stroke-width`, `fill-rule` and `opacity`, including compatible inherited values, normalize into canonical Shape style/effects. Supported `matrix(...)`, `translate(...)`, `scale(...)`, `rotate(...)`, `skewX(...)` and `skewY(...)` transforms flatten into canonical geometry. One visual layer remains a Shape; multiple layers are materialized as a Container in stack mode with ordered Shape children. Raw XML, source transform strings and source primitive tags are never persisted. Unsupported or unsafe content is rejected rather than silently persisted or executed, including scripts, external references, CSS/style markup, text and unsupported SVG capabilities. Shape Transform provides authored translation/rotation, while bounded animation remains separate and composes after it. QR modules remain square; the white QR surface and outer Border frame share the canonical Rounded corners radius, with Border paint/style support on the single outer frame.

Parameterized complex forms such as arrows, braces, speech balloons and thought balloons remain a future semantic-generator boundary. Adding them requires a separate architecture checkpoint rather than silently expanding the current Shape presets.

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

Direct This Presentation FontResource authoring is deferred. Library-thumbnail FontResource style injection parity is recorded as complete in the later managed-assets/resource sequence below.

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
   │   └── children: PresentationElement[]
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

# Topics Checkbox presentation ✅

Delivered the Checkbox presentation kind within the existing Topics structure:

- `Topics.kind = checkbox`, with local two-state / three-state mode;
- native shared renderer/runtime, with `markerColor` reused as the Checkbox accent;
- Canvas interaction and one-way Control → Player absolute state through `live/checkboxControl`;
- transient runtime state only, with Player-local interaction remaining local;
- Live activation, promotion and end cleanup;
- no `schemaVersion` bump.

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

The audit initially tested removing `allow-same-origin`, but manual evidence with Blockly Games showed that external applications may require their own normal origin capability for storage/origin-dependent behavior. Restoring `allow-same-origin` preserved provider origin without making a cross-origin provider same-origin with the application.

Permanent decisions:

- sandbox/Permissions Policy remain renderer-owned, not authored;
- global removal of `allow-same-origin` is not justified by current evidence;
- provider refusal via `X-Frame-Options` / CSP `frame-ancestors` is not an application bug and must not be bypassed;
- bounded YouTube normalization remains; no speculative provider matrix was added;
- same-origin application iframe behavior remains security-sensitive and belongs to focused security review rather than a provider-breaking global sandbox change.

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

# Editor History / Undo-Redo ✅

Editor History is complete as a session-scoped authoring capability. The canonical owner of undoable state is the `Presentation` snapshot; History itself is not part of the persisted document.

Delivered:

- semantic discrete actions and coalesced continuous editing/gestures;
- a maximum of 30 retained actions per Editor session;
- Undo/Redo over canonical `Presentation` snapshots, with selection and clipboard state kept outside those snapshots;
- normal autosave after Undo/Redo mutations without clearing History on Save or Publish;
- current Inspector, structural, Canvas, resource and Custom Library Apply paths covered by the implementation;
- a read-only History panel driven by action metadata, with applied actions newest first and the next Redo action first;
- `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z`, while native editable-control undo remains native.

The high-signal manual acceptance areas were completed by the user. The remaining Canvas browser/device smoke (drag, resize, crop, focal point and Container Fit) does not block this milestone and remains a future post-merge verification item. Automated coverage and implementation are present, but this checkpoint does not claim that physical/manual Canvas acceptance is complete.

At this close checkpoint (`75ca782630ee3742f887e531a389e485a1fb03a6`), Studio and Player Vercel results were green. That evidence does not establish the user-facing production deployment identity, so production deployment is not claimed as verified here.

---

# P13 — Production Readiness — planned

Topics, Embed refinement and Editor History are complete. P13 remains a planned readiness work area, but it is not designated as the next work area at this checkpoint.

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

# Recent completed refinement ✅

The following current-state work is complete at its recorded closure point:

- **Published Presentation deletion** — PR #170. Archived published Presentations can be permanently deleted. Historical published versions are removed in bounded batches, while the current version, publication pointer, private notes and private draft are removed in the final cleanup batch. Publication ownership is bound to immutable `ownerUid`; legacy ownerless records require trusted/Admin backfill rather than a normal client claim. A live publication must be stopped before the normal Archive → Delete lifecycle.
- **Container delete preserving children** — PR #171. Compatible non-empty Containers can be removed while their direct children are promoted at the wrapper's former sibling position. Child IDs and payloads remain unchanged, the operation is one History action, and Undo/Redo restore and reapply the exact unwrap. Empty Containers, Structured Table ContentSlot-owned Containers, and incompatible TopicItem ContentSlot cases remain destructive-only.
- **Root Definition preserve-children correction** — The dialog availability probe now resolves the actual persisted owner tree through `resolveOwnedAuthoringTree`, covering ordinary Slides, Root Definitions and Slide-local Root-backed ownership. Compatible Root-backed local Containers receive the same three-action choice; the existing `findLocalRootChildOwner → updateLocalRootChildren → unwrapContainerPreservingChildren` mutation remains unchanged, preserving child IDs/order/payload. Destructive deletion still removes wrapper plus children, Undo/Redo remains one History action, canonical Root protection and in-use receiver protections remain unchanged, and no schema/renderer/Player/publication changes were made. Manual product acceptance is complete.
- **Historical identity cleanup** — PR #172. Repository, package, route, storage, documentation and instance-branding surfaces use the neutral current identity contract. The production display name remains configurable through `WEB_SLIDESHOW_DISPLAY_NAME`.
- **Import-time ID normalization** — PR #173. Import regenerates deterministic type-aware structural IDs and remaps typed Text Style and Linked Style references. Scripted port identities and authored strings remain stable. Duplicate/copy authoring is handled separately in Studio and now derives new duplicate IDs from a stable pre-copy family root without migrating existing IDs.
- **Root Definitions / structural normalization** — SM6E1–SM6E3. The canonical `rootDefinitions` collection, shared preset structural primitive, same-workspace lifecycle, This Presentation browser/management, explicit/default Slide association, receiver authorization, owner-aware master and Slide-local authoring, state-aware assignment safety, Element Style compatibility, resource composition, History, persistence, import/export, publish, Player, Control, Library-thumbnail and renderer acceptance are complete. `schemaVersion` remains literally `1`; V1 intentionally keeps one effective Root per Slide, disallows nested Roots and per-Slide master property overrides, and blocks destructive reassignment instead of migrating content automatically.

These completions do not change `schemaVersion`, the Presentation schema, persistence format, publication model, or Player/Studio boundaries.

---

# Managed asset and FontResource foundation ✅

The completed managed-asset sequence is:

- **Managed asset storage foundation** — PR #213.
- **Custom Library font file upload** — PR #214, supporting TTF and WOFF2 files.
- **Managed binary storage migration** — PR #215 moved managed binary storage from Firebase Storage to Vercel Blob. Firebase remains the Auth / Firestore / RTDB platform; Vercel Blob is the current managed binary asset store.
- **Scripted FontResource parity** — PR #216 reuses `Presentation.resources.fonts` and the canonical `renderFontResources()` output, injecting renderer-owned font CSS into Scripted `srcdoc`. The sandbox remains `allow-scripts`, without `allow-same-origin`; `connect-src` remains `'none'`; `font-src` permits `https:` and `data:`; `media-src` was not expanded to HTTPS by this PR.

Custom Library resources remain private reusable masters/sources. Applying one materializes/copies the required data into the Presentation, so the Presentation owns canonical runtime data/resources and published/exported presentations do not depend on private Custom Library state. Managed binary bytes live in managed asset storage where required, with public URL/resource metadata carried by the Presentation for runtime use. This does not define a generic `FileResource` schema.

Library-thumbnail FontResource parity is implemented: `PresentationThumbnailPreview` renders with Presentation context and reuses `renderFontResources(preview.presentation.resources?.fonts)`. Tests verify the resulting `style[data-presentation-font-resources]` output. Direct This Presentation FontResource authoring remains deferred.

## Presentation Resources direction

The planned resource taxonomy separates semantic resource kind from physical/textual representation. The semantic direction is:

- Text — `.txt`;
- Markdown — `.md`;
- Structured Data — `.csv`, `.json`, `.xml`;
- Image — `.png`, `.jpg`/`.jpeg`, `.webp`, `.gif`, `.svg`;
- Audio — `.mp3`, `.wav`, `.ogg`;
- Font — `.ttf`, `.woff`, `.woff2`, `.otf`.

Representation is a separate, independent dimension classified as `text` or `binary`. Examples include Markdown → text, JSON → text, SVG → Image with a text representation, PNG → Image with a binary representation, MP3 → Audio with a binary representation and TTF → Font with a binary representation. Markdown is a document with structure/semantics and does not inherently define visual appearance.

File extension is import/validation evidence, not canonical resource identity. Product behavior should be driven primarily by semantic resource kind; MIME type and extension may participate in import detection, validation, upload constraints and media handling. This is a product/architecture direction only: it does not add a persisted generic resource schema or change `schemaVersion`.

The taxonomy is a future expansion direction. It does not mark Text, Markdown, Structured Data, Image or Audio resource-management capabilities complete; current completed managed-resource work is recorded above, including Fonts.

---

# Pattern and Container Color refinement ✅

The current authoring and rendering model includes:

- parameterized Container Background Patterns with Pattern-owned colors, Size and Rotation;
- a structured 14-preset catalog: Grid, Fine Grid, Dots, Offset Dots, Diagonal Lines, Art Deco, Circuit Grid, Paper, Graph Paper Dotted, Dashed Paper, Cross, Crossed Axes, Triple-Axis Overlay and Chevron;
- 1–4 semantic Pattern Color slots with normal ColorValue / Palette behavior and Linked Container Style support;
- Studio-only preset identity; canonical documents remain referential and parameterized without a persisted preset id;
- Background-owned masking for Dashed Paper and Cross, using effective Container Background paint while keeping Container Background independently authored;
- Container foreground Color inheritance for Text, Topics text, eligible Topics markers, Table textual foreground and nested Containers;
- independent semantic color systems for Code, Terminal, Blocks and Plot root/curve semantics;
- Studio distinction between authored Color, Inherited from Container / Herdado do Container and Theme default / Padrão do tema, without persisting inherited/effective child Color;
- Plot axis labels using explicit Axis Color > Container foreground > theme primary for 2D x/y/f(x) and 3D x/y/z, with the 2D x label framed beyond the mathematical endpoint without changing curve geometry.

Do not infer rejected intermediate Pattern geometry or a generic Linked Style target from this refinement. The completed Linked Style expansion remains target-specific: Container, Topics, Code, Terminal, Simple Table, Structured Table and Divider.

---

# Recorded execution order and immediate next area

The recorded execution order is:

## Historical execution order

### 1. Table Size ✅

Completed using the existing canonical layout, renderer, Inspector, Canvas/resizing and Structured Table ContentSlot boundaries.

### 2. Divider gradient ✅

Completed using the existing Divider visual/style schema, Gradient and ColorValue primitives, renderer behavior and Inspector conventions.

### 3. Linked Styles target expansion ✅

Completed the target-specific expansion for Code, Terminal, Simple Table, Structured Table and Divider, while preserving Container and Topics. The completed implementation covers each target's canonical shareable properties, local-over-linked precedence, attach/switch/detach ownership, Resources authoring, usage discovery, propagation, History, Root Definition ownership/navigation and import/export references where relevant. The result is not a generic all-elements abstraction, and the target contracts are intentionally not identical.

## Completed continuation

### 1. Inspector canonical order ✅

Completed the canonical Inspector tail normalization so Placement is penultimate and Interaction is final for linkable Text, Image, Container and Shape elements, while generic non-linkable Placement remains unchanged.

### 2. Scripted Control ports vertical layout ✅

Completed the vertical stacking of Scripted Control port controls without changing the Scripted document contract or runtime protocol.

### 3. Duplicate ID genealogy normalization ✅

Completed normalization of new duplicate IDs from a stable pre-copy family root, including malformed historical trailing copy suffixes, without migration, canonical schema changes, or unrelated authoring behavior.

### 4. Structured source editor and Shape source authoring ✅

Completed the shared CodeMirror authoring surface for Presentation text Files, Scripted HTML/CSS/JavaScript and Shape Custom path/SVG without introducing a shared persistence model. Presentation Files retain their `file.source.content` Save boundary; Scripted retains local drafts plus canonical **Apply / Run**; Shape retains the existing `pathSource` draft plus canonical Shape **Apply**. Raw Shape path data remains plain text, bounded SVG uses XML editing/formatting, compound and unsafe SVG behavior stays on the existing importer/parser path, and Shape does not persist original SVG source.

The shared editor now includes syntax profiles, pairing/indentation helpers, local Undo/Redo, supported Format Code, line numbers, active-line/gutter highlighting, selection-match highlighting and a compact floating Find/Replace surface backed by the official `@codemirror/search` state and commands. Search/Replace edits remain transient until the owning consumer's existing Save/Apply boundary. No additional consumers, Blocks live-preview editor, generic source/preview mode, tabs, LSP or persisted source abstraction remain in this workstream.

## Current next area

### 1. Text effects — gradient fill / shadow / glow ✅

Completed with the canonical Text contract: Fill persists as mutually exclusive Color or Gradient using existing Gradient/ColorValue primitives; Gradient is one composition across Text content; Shadow remains glyph-based; Glow is Text-local and rendered as an external glyph halo; palette references, publication and the shared renderer preserve the same meaning across Studio and Player. Accepted behavior includes Gradient, Shadow and Glow independently and in combination, with `schemaVersion` remaining literally `1`.

### 2. Pointed Notes — numbered Canvas markers + Control reading ✅

Pointed Notes complete the existing private Notes capability without changing the canonical Presentation or `schemaVersion`.

- one existing private `PresentationNotes` repository/document remains the storage boundary;
- normalized `SlideNotes` contain pointed entries with stable opaque IDs, plain text and logical `x`/`y` coordinates;
- numbering is derived from pointed-note order and is not persisted;
- new notes use a deterministic centered logical slide position;
- Editor exposes Pointed Notes only, with plain-text editing and a compact `+` action;
- Editor-only Canvas markers are square 32×32 logical units; drag preview is local and the final position is saved after `pointerup`;
- legacy ordinary text is hidden from authoring but preserved for persistence compatibility;
- Control provides read-only numbered lists on desktop and mobile, with no preview markers;
- Player, Watch, renderer and publication have no dependency on private Notes;
- no second Notes system, private schema version or canonical Presentation/schema change was introduced;
- manual product acceptance is complete.

### 3. Container delete preserving children under Root Definition ✅

The dialog now offers Delete container and children, Delete container, keep children, and Cancel for compatible non-empty Containers authored in `localRootChildren` on Root-backed Slides. The regression was caused by probing the Slide-owned `slide.elements` tree instead of the persisted owner tree; `resolveOwnedAuthoringTree` now supplies the correct probe tree. The existing preserve mutation path remains unchanged, child IDs/order/payload are preserved, destructive deletion remains available, Undo/Redo remains one History action, canonical Root and in-use receiver protections are unchanged, and manual product acceptance is complete. No schema, renderer, Player or publication changes were made.

---

# Future / deferred

## P14 — Maintenance & Diagnostics 🟡

D0–D2 plus remote logs are operational. Further expansion remains evidence-driven and bounded. Do not turn Maintenance into a generic fleet-management surface without concrete need.

## P15 — Audience / Watch expansion — future

Watch already follows Player-applied state. Viewer presence/count/nickname and richer audience behavior remain future candidates and must never grant audience clients shared presentation control.

## Product / authoring backlog

Deferred candidates include:

- **complete audit** — cross-cutting integrity audit, including canonical/global ID uniqueness and other issues intentionally kept out of feature-specific checkpoints;
- **AI Converter** — convert external/source content into the existing canonical Presentation rather than introducing a second document model;
- **Player hardening with local history/continuity** — stronger local recovery/history behavior without replacing immutable publication and Live ownership;
- direct This Presentation FontResource authoring;
- Topics → Text Style consumption;
- Custom Library portability refinements;

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
       Topics Checkbox presentation + Control sync           ✅
       Embed viewport + stable Control preview (#154)       ✅
       Editor History / Undo-Redo                            ✅
       Root Definitions / structural normalization            ✅
       Managed asset storage foundation (#213)                ✅
       Custom Library TTF/WOFF2 upload (#214)                ✅
       Managed binary storage on Vercel Blob (#215)           ✅
       Scripted FontResource parity (#216)                    ✅
       Library-thumbnail FontResource rendering              ✅
       Structured source editor + Shape path/SVG authoring    ✅

NEXT:
  not selected

IMMEDIATE QUEUE:
  not selected

RELEASE GATE STILL PENDING:
  Android interactive display + Firefox 116 physical Player acceptance

FUTURE / DEFERRED:
  P14 bounded Diagnostics expansion
  P15 Audience / Watch expansion
  complete audit
  AI Converter
  Player hardening with local history/continuity
  direct This Presentation FontResource authoring
  Topics → Text Style consumption
  Custom Library portability
```

The Root Definition preserve-children correction is closed; future work should be selected from the deferred roadmap after merge and local-main closure.
