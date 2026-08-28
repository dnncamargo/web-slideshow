# PowerShow

PowerShow is a cloud-first slide authoring and presentation system built around a strict canonical document model, shared rendering, immutable publication snapshots, and live presentation control.

The project separates authoring, projection, audience viewing, and presenter control so the same presentation data can move safely through the complete lifecycle:

```text
Studio
→ save/reload
→ publish
→ immutable version
→ Control / Presenter
→ Player
→ Watch
```

## Product surfaces

- **Studio / Library** — authenticated presentation management, folders, Custom Library resources, import/export, publishing, and lifecycle actions.
- **Editor** — visual authoring of canonical PowerShow presentations.
- **Control / Presenter** — authenticated live-session control with current/next preview, Notes, navigation, publication promotion, and Player state feedback.
- **Player** — public projection runtime optimized for lightweight playback.
- **Watch** — public read-only audience surface following the actual applied Player state.
- **Legacy Player** — compatibility runtime kept separate from the current Player.

## Repository structure

PowerShow is a pnpm monorepo.

```text
apps/
  studio/         authenticated Studio, Library, Editor, Control and Watch
  player/         current public projection runtime
  player-legacy/  compatibility projection runtime

packages/
  document-schema/  canonical Presentation contract and validation
  renderer/         shared semantic rendering pipeline
  theme/            shared presentation theme/defaults
  ui/               application UI tokens and primitives
  firebase/         shared Firebase support
```

The canonical document contract lives in:

```text
packages/document-schema
```

The renderer is shared across authoring previews and presentation runtime rather than maintaining separate visual contracts for Studio and Player.

## Canonical document principles

PowerShow stores a semantic Presentation document rather than raw HTML/CSS application state.

Current invariants:

- `schemaVersion` is literally `1`;
- schemas are strict;
- one canonical representation is preferred for each authored intention;
- published versions are self-contained immutable snapshots;
- Studio-private organization metadata does not enter the published Presentation;
- Player never depends on Custom Library records or private Studio metadata;
- `textbox` is no longer a canonical element — boxed text is represented with `Container + Text`;
- hierarchical composition is represented by the document tree, not by separate `parentId` or `zIndex` fields;
- Flow is the absence of absolute positioning; authored edges require `layout.position: "absolute"`;
- Text Styles are Presentation-local resources with precedence:

```text
Theme role baseline
→ Text Style
→ local Text override
```

The current canonical PowerShow element union includes:

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

## Import / Export

PowerShow exports the canonical Presentation directly as readable JSON:

```text
*.powershow.json
```

There is deliberately no transfer envelope.

Import performs:

```text
JSON.parse
→ PresentationSchema
→ allocate a new root Presentation id
→ persist as a new private draft
```

The imported copy preserves slides, elements, internal IDs, Palette, FontResources, Text Styles, and authored content. Only the root Presentation id is replaced for the new draft.

Legacy or incompatible documents are not silently migrated during import. Recovery is a separate explicit product flow.

## Persistence and publishing

Private drafts are stored in Firestore under the authenticated user.

Publishing creates immutable public versions and maintains a public publication pointer:

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

Republishing does not mutate an existing published version.

Studio organization such as folders and archived state remains private persistence metadata outside the canonical Presentation.

Private slide Notes are also stored outside the canonical Presentation so Notes writes do not change `draftRevision` or publication content.

## Live presentation model

Transient presentation control uses Firebase Realtime Database while published presentation content remains in Firestore.

The live path uses logical slide/page identity and desired/applied state:

```text
Control desired state
→ RTDB
→ Player applies published presentation state
→ Player applied state / ACK
→ Control and Watch observe convergence
```

The architecture supports:

- authenticated activation and termination;
- public Player live entry;
- logical `pageId` navigation;
- command/state convergence across reloads;
- staged publication updates while a Player remains live;
- explicit promotion to a newer immutable version;
- preservation of logical slide identity across publication promotion;
- public Watch following actual applied Player state;
- bounded production diagnostics for Player troubleshooting.

## Authoring resources

PowerShow distinguishes Presentation-local resources from reusable private Custom Library masters.

```text
Custom Library master
→ copy/materialize into Presentation
→ canonical Presentation resource
→ publish as self-contained snapshot
```

Current reusable resource families are:

- Styles;
- Palettes;
- Fonts.

Presentation-local resources include:

- Palette colors and references;
- FontResources;
- Text Styles.

There are no live dependency links from a published Presentation back to private Custom Library data.

## Text Styles

Text Styles provide reusable Presentation-local text appearance while preserving local overrides.

Fundamental roles:

```text
title
subtitle
body
caption
```

Custom Text Styles choose one of those roles as their Theme baseline and may author:

- text color;
- font family;
- font size;
- font weight/style;
- alignment;
- line height and letter spacing;
- transform/wrapping behavior;
- decoration;
- decoration color;
- text stroke.

Palette references and FontResources remain canonical resources rather than being flattened into renderer-only values.

## Recovery

Persisted drafts that no longer satisfy the strict canonical contract are inspected before the Editor opens.

Recovery distinguishes:

- valid presentations;
- presentations with removable incompatible semantic content;
- structurally unrecoverable presentations.

Recovery is explicit and conservative. It may remove incompatible content, but it does not create schema migrations or compatibility aliases.

## Development

Requirements:

- Node.js `>=24 <25`;
- pnpm `10.28.0`.

Install and validate the monorepo:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Firebase Web configuration is documented in `.env.example`.

Copy it to `.env.local` and provide the project-specific values required by the Studio environment.

## Project workflow

PowerShow development is checkpoint-driven.

The normal implementation loop is:

```text
inspect current code
→ freeze architecture and invariants
→ implement narrowly
→ test
→ review the real remote diff/commit
→ advance
```

Repository execution rules and agent guidance live in:

- `AGENTS.md`;
- `DS.RULES.md` for DeepSeek-specific execution.

## Roadmap

See [`ROADMAP.md`](./ROADMAP.md) for the complete project chronology from the initial canonical document foundation through the current roadmap and backlog.

At the current baseline, the document/renderer/Player/Studio/persistence/publishing/live-control/import-export/Custom Library/Text Styles foundations are established. The remaining roadmap focuses on selected UX refinement, production readiness, diagnostics, and future audience expansion without reopening the canonical contract speculatively.
