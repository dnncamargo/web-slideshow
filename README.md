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
- **PowerShow Control** — authenticated live-session control, navigation, Player options, contextual element controls and Player-state feedback.
- **Maintenance & Diagnostics** — a Control-owned authenticated operational surface for Player evidence, bounded recovery and remote diagnostics mode.
- **PowerShow Player** — public projection runtime.
- **PowerShow Watch** — public read-only audience surface following actual Player-applied state.

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

Other bounded Live contracts include:

- `live/galleryControl/<slot>` for one-way Gallery intent;
- `live/slideTransition` for presentation-slide transition mode;
- `live/playerControls` for Player control position/style/counter/animation;
- `live/playerLogs` for activation-scoped remote diagnostics mode;
- Scripted-specific runtime/input/report roots for declared ports.

Runtime state remains outside the canonical Presentation.

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

Scripted controlled interaction is complete through PR #133.

Canonical authored state remains self-contained in the Presentation and now includes declared `ports` in addition to `title`, `html`, `css` and `script`. Ports are explicit capabilities, not introspection of arbitrary authored JavaScript.

Supported runtime semantics include:

- action ports;
- boolean state ports with `input`, `output` or `input-output` direction;
- number state ports with `input`, `output` or `input-output` direction and optional finite `min`/`max`/`step` guidance.

The Editor keeps source fields in local drafts and commits them through explicit **Apply / Run**. PowerShow Control renders controls from declarations; Player owns runtime identity and validates activation/version/page/slot/element/port before bridging messages to the mounted sandbox.

The shared renderer keeps the permanent isolation boundary:

```text
sandbox="allow-scripts"
referrerpolicy="no-referrer"
fixed CSP
```

No same-origin permission, Firebase/session exposure, parent DOM access, storage, popup/top-navigation privileges, `eval`, `Function`, or JavaScript payload delivered through RTDB is allowed. Runtime state is transient and never persisted into the Presentation.

## Player options and Maintenance

PR #134 added activation-scoped Player presentation options and remote logs control.

PowerShow Control can configure:

- slide transition: Fade / Slide / None;
- Player control position;
- Player control style;
- counter On / Off;
- Player control-bar animation.

Maintenance discovers connected Players from existing boot-scoped presence leases and broadcasts only the desired logs boolean. Each Player owns and rewrites its own URL: enabling logs adds/replaces `logs=true`; disabling logs removes all query parameters while preserving path/hash. URL equality prevents reload loops.

RTDB rules for `slideTransition`, `playerControls` and `playerLogs` were explicitly deployed after validation.

## Mobile surfaces

The accepted mobile Library and Control layout was recovered on current `main` after PR #134.

Current product rule for the compact Player settings control:

- Player Settings is desktop-only;
- Previous, Next, Fullscreen and End remain available in mobile Control;
- responsive behavior is CSS/layout-owned rather than user-agent/device sniffing.

An iPhone 14 Plus is a concrete mobile acceptance device used during current development. Breakpoint changes should still be evidence-driven rather than device-specific hacks.

## Embed

`embed` exists canonically and in the shared renderer. The Editor authors an absolute http/https `src` and required accessibility `title`; renderer-owned iframe policy remains security-sensitive. Embed refinement is not in the active queue and should resume only from a concrete provider/runtime audit.

## Current completed refinement line

Recent merged work includes:

- Gallery V1 across Studio, Player, RTDB and Control;
- Maintenance & Diagnostics D0–D2 with Player presence and bounded recovery;
- Firestore serialization hardening for deep canonical Presentations;
- grammar-based Blocks visual authoring;
- Typography/Text Style usage and target-aware association behavior;
- Image Inspector and Delete→Enter ergonomics;
- PowerShow Suite chrome for Maintenance;
- Editor Resource Controls polish;
- Scripted declared action/boolean/number ports with Player bridge and Control stateful controls (PR #133);
- Player slide transitions, Player control options and remote Maintenance logs (PR #134);
- recovered mobile Library/Control layout with Player Settings desktop-only.

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
→ POST-MERGE LOCAL CLOSURE
```

After every PR + merge, the local repository must return to the current `main` before another work area starts:

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

If fetch/switch/pull fails or the repository is unexpectedly dirty, stop and report rather than repairing history automatically. Never create the next feature branch from a stale local `main`.

Authority order for implementation work is:

```text
current code in main
→ tests
→ canonical contracts / renderer ownership
→ README / ROADMAP / current handoff
→ historical branches / old handoffs / memory
```

Search and reuse existing ownership before creating new states, abstractions or protocols.

Repository execution rules live in `AGENTS.md`. Operational handoffs are provided explicitly between work areas and must always be revalidated against the real current `main`.

## Roadmap

See [`ROADMAP.md`](./ROADMAP.md) for chronology and the active execution queue.

Current execution order:

```text
Terminal + Code + Table typography/layout refinements
→ Chart V1
→ other work only when explicitly promoted
```

`publishNow`, Topics→Typography Style consumption, broader Diagnostics and Embed refinement remain deferred/future until explicitly promoted.
