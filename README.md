# PowerShow

PowerShow is a cloud-first slide authoring and presentation system built around a strict canonical document model, shared rendering, immutable publication snapshots, and live presentation control.

The same canonical Presentation moves through the complete lifecycle:

```text
PowerShow Library / PowerShow Editor
→ save / reload
→ publish
→ immutable version
→ PowerShow Control
→ PowerShow Player
→ PowerShow Watch
```

## Product surfaces

```text
PowerShow
│
├── Public Portal        /
│
├── Studio               authenticated namespace
│   ├── Library          /studio/library
│   ├── Editor           /studio/editor
│   └── Control          /studio/control
│       └── Maintenance  /studio/control/maintenance
│
└── Live Runtime         public
    ├── Player
    ├── Watch            /watch
    ├── Demo             /demo   (technical route)
    └── Cover            /cover  (technical route)
```

- **Public Portal** — public PowerShow root. Without Live it exposes the self-contained demo; during Live it shows the active presentation cover and Watch entry.
- **PowerShow Library** — authenticated presentation management, folders, import/export, publishing, lifecycle actions and Custom Library access.
- **PowerShow Editor** — visual authoring of the canonical Presentation.
- **PowerShow Control** — authenticated live-session control, direct navigation, publication promotion, Player-state feedback, Gallery commands and bounded recovery.
- **Maintenance & Diagnostics** — a Control-owned authenticated operational surface for Player evidence and explicit recovery actions.
- **PowerShow Player** — public projection runtime.
- **PowerShow Watch** — public read-only audience surface following the actual Player-applied state.

The public root is deliberately not another Player. During Live, Cover remains static/read-only while Watch follows the real Player state.

## Repository structure

PowerShow is a pnpm monorepo.

```text
apps/
  studio/         Public Portal + authenticated Library, Editor and Control
  player/         Player, Watch, Demo and Cover runtimes
  player-legacy/  separated compatibility runtime

packages/
  document-schema/  canonical Presentation contract and validation
  renderer/         shared semantic rendering pipeline
  theme/            shared presentation defaults
  ui/               PowerShow Suite UI tokens and primitives
  firebase/         shared Firebase support
```

The canonical document contract lives in `packages/document-schema`. Studio previews and runtime surfaces reuse the shared renderer rather than maintaining separate presentation contracts.

## Canonical document principles

PowerShow stores a semantic Presentation instead of serialized Editor DOM/application state.

Current invariants:

- `schemaVersion` is literally `1`;
- schemas are strict and responsibility-specific;
- one canonical representation is preferred for each authored intention;
- published versions are self-contained immutable snapshots;
- Studio-private metadata and transient UI state do not enter the canonical Presentation;
- Player never depends on private Custom Library records;
- `textbox` is not canonical — boxed text is `Container + Text`;
- hierarchy is the nested document tree, not `parentId` or numeric `zIndex`;
- Flow is the absence of absolute positioning; authored edges require `layout.position: "absolute"`;
- canonical changes are driven by concrete product requirements, not speculative compatibility layers.

The current element union includes:

```text
text
image
gallery
code
terminal
table
chart
interactive
divider
embed
blocks
scripted
topics
container
```

## Authoring and Presentation-local reuse

PowerShow distinguishes private reusable masters from Presentation-local live relationships.

```text
Custom Library resource
→ copy/materialize values into Presentation
→ Presentation owns the resulting canonical data
```

Presentation-local systems include Palette references, Text Styles and Linked Styles.

Text Style precedence:

```text
Theme role baseline
→ Text Style
→ local Text override
```

A detached Text materializes its effective typography locally and no longer counts as linked usage even when it retains a fundamental `variant` role.

Linked Style precedence:

```text
Theme / defaults
→ Linked Style
→ local Container override
```

Linked Styles are Presentation-scoped, self-contained and Container-only in the current contract. Custom Library Styles remain copy/materialization resources rather than runtime dependencies.

Recent Editor resource refinements also align `+ Add Linked Style`, `+ Add Style`, and `Apply to selected` with the compact shared resource-action visual; Text Styles expose a projected-style count, and Container `Preserve size` uses the checkbox-first Inspector grammar.

## Import / Export

PowerShow exports the canonical Presentation directly as readable JSON:

```text
*.powershow.json
```

Import performs:

```text
JSON.parse
→ PresentationSchema
→ allocate a new root Presentation id
→ persist as a new private draft
```

Slides, nested elements, Palette references, FontResources, Text Styles, Linked Styles and authored content remain canonical and editable. There is no transfer envelope, hidden compatibility schema or automatic migration layer.

## Persistence and publishing

Private drafts are stored in Firestore. Publishing creates immutable versions and a public publication pointer:

```text
private draft
  publication.publicationId
        │
        ▼
publishedPresentations/{publicationId}
  currentVersionId
        │
        ▼
publishedPresentations/{publicationId}/versions/{versionId}
```

Republishing never mutates an existing published version. The canonical Presentation is serialized as `presentationJson` at the persistence boundary and validated again on read.

Private organization metadata and slide Notes remain outside the canonical Presentation.

## Live presentation model

Transient live control uses Firebase Realtime Database while published content remains in immutable Firestore versions.

Primary slide flow:

```text
Control desired slide state
→ RTDB
→ Player applies immutable published state
→ Player applied state / ACK
→ Control + Watch observe convergence
```

Gallery deliberately uses a narrower one-way contract:

```text
Control desired Gallery state
→ live/galleryControl/<slot>
→ Player
```

A physical Gallery interaction on Player remains local and does not update Control.

Maintenance / Diagnostics adds bounded operational evidence and explicit retry, reload and cache-clear recovery without becoming a generic administration console.

## Blocks

Blocks is a static didactic visual element inspired by mBlock/Tinkercad. Canonical state is a single `source` string; a handwritten parser produces a transient AST for shared static rendering.

Current grammar includes:

```text
\start(...)
\statement(...)
\scope(...){...}
\end(...)
\value(...)
\variable(...)
\logic(...)
```

Blocks is intentionally not an executable programming environment.

## Scripted

`scripted` already exists as a canonical, authored and rendered element. It is the next active refinement area, not a new element to create.

Current canonical authored fields are:

```text
title
html
css
script
```

The Editor keeps these source fields in local drafts and commits them together only through **Apply / Run**, preventing JavaScript from being re-executed on every keystroke.

The shared renderer executes authored content only inside a renderer-owned sandboxed iframe:

```text
sandbox="allow-scripts"
referrerpolicy="no-referrer"
fixed CSP
```

The sandbox deliberately denies same-origin access, forms, popups, downloads, top navigation, storage and network connections. Authored JavaScript does not execute in the PowerShow application context. The renderer does not use `eval`, `Function`, `document.write` or string timers.

The next Scripted work must begin with an audit of the real current code and tests. The planned direction is to improve controlled interactivity without weakening this isolation boundary. A dedicated PowerShow/Control bridge, if implemented, must use explicit declared controls and validated messages rather than exposing application/Firebase/session access to authored code.

## Embed

`embed` also already exists canonically and in the shared renderer. The current Editor authors:

```text
src     absolute http/https URL
title   required accessibility title
```

The renderer owns the iframe policy. Current runtime uses scripts/forms/same-origin for practical external embeds, grants fullscreen only, uses `strict-origin-when-cross-origin`, lazy loads the iframe, and does not expose sandbox policy as authored Presentation state.

Embed refinement follows Scripted. The first checkpoint must audit concrete provider/runtime problems before changing sandbox, permissions, URL normalization or authoring UX. Security-sensitive changes must stay renderer-owned unless a separately justified canonical requirement exists.

## Current completed refinement line

The recent merged baseline includes:

- Gallery V1 across Studio, Player, RTDB and Control;
- Maintenance & Diagnostics D0–D2 with Player presence and bounded recovery;
- Firestore serialization hardening for deep canonical Presentations;
- grammar-based Blocks visual authoring;
- Typography/Text Style usage locations and target-aware association behavior (PR #125);
- Image Inspector and Delete→Enter ergonomics (PR #126);
- PowerShow Suite chrome for Maintenance, including `<<< Back to presentation` and square diagnostic cards (PR #127);
- Editor Resource Controls polish: checkbox-first Preserve size, compact Add/Apply actions and projected Text Styles count (PR #129).

## Deferred work

These items are intentionally not active:

- `publishNow` Editor mode;
- Chart V1;
- making Topics itself a consumer of Typography Styles;
- broader Diagnostics D3 expansion;
- Production Readiness and Audience/Watch expansion until promoted by concrete need.

## Development

Requirements:

- Node.js `>=24 <25`;
- pnpm `10.28.0`.

Typical validation:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Firebase Web configuration is documented in `.env.example`. RTDB rule changes live in `database.rules.json` and require an explicit Firebase rules deployment; a Vercel application deploy does not deploy Firebase rules.

## Project workflow

PowerShow development is audit-first and checkpoint-driven:

```text
AUDIT
→ EVIDENCE
→ DECISION
→ IMPLEMENT
→ TEST
→ review the real remote SHA/diff
→ manual acceptance where visual/runtime behavior requires it
→ PR / merge
```

Current code in `main` is the first authority for implementation details, followed by tests, canonical contracts, documentation/handoffs, and historical evidence. Search and reuse existing ownership before creating new states, abstractions or protocols.

Repository execution rules live in `AGENTS.md`. Operational handoffs are provided explicitly between work areas and must always be revalidated against the real current `main`.

## Roadmap

See [`ROADMAP.md`](./ROADMAP.md) for chronology and the active execution queue.

Current execution order:

```text
Scripted enhancement
→ Embed adjustments
→ other work only when explicitly promoted
```

Chart and `publishNow` are deferred.
