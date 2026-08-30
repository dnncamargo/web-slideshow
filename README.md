# PowerShow

PowerShow is a cloud-first slide authoring and presentation system built around a strict canonical document model, shared rendering, immutable publication snapshots, and live presentation control.

The project separates authoring, projection, audience viewing, presenter control, and the public entry surface so the same Presentation can move safely through its complete lifecycle:

```text
Library / Editor
→ save / reload
→ publish
→ immutable version
→ Control
→ Player
→ Watch
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
│
└── Live Runtime         public
    ├── Player
    ├── Watch            /watch
    ├── Demo             /demo   (technical route)
    └── Cover            /cover  (technical route)
```

- **Public Portal** — public PowerShow root. When no Live session is active it uses the self-contained demo as an ambient full-screen surface; during Live it shows only the active presentation cover and exposes a Watch QR code.
- **PowerShow Library** — authenticated presentation management, folders, Custom Library resources, import/export, publishing, and lifecycle actions.
- **PowerShow Editor** — visual authoring of canonical PowerShow presentations.
- **PowerShow Control** — authenticated live-session control, direct slide navigation, publication promotion, Player-state feedback, and presentation recovery actions.
- **PowerShow Player** — public projection runtime optimized for lightweight playback.
- **PowerShow Watch** — public read-only audience surface following the actual applied Player state.
- **Legacy Player** — compatibility runtime kept separate from the current Player.

The public root is deliberately **not another Player**. During Live it renders the first slide only through `/cover`; Watch remains the audience follower and Player remains the real projection surface.

## Repository structure

PowerShow is a pnpm monorepo.

```text
apps/
  studio/         public root + authenticated Library, Editor and Control
  player/         Player, Watch, Demo and Cover public runtime routes
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
- hierarchical composition is represented by the document tree, not by separate `parentId` or numeric `zIndex` fields;
- Flow is the absence of absolute positioning; authored edges require `layout.position: "absolute"`;
- canonical changes are driven by concrete product needs rather than speculative compatibility layers.

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

## Container authoring

Containers provide the reusable layout structure for presentation content. They support Flow / Stack child composition, authored absolute positioning where needed, canonical overflow behavior, typography/effects, and nested composition.

A Container can also scale its child composition with Children Fit (`Contain`, `Cover`, or `Fill`) while its own visual box remains unchanged.

Within a parent Flow layout, a Container may use Preserve size to resist flex compression without leaving normal flow. This is not an absolute-positioning or fill-remaining-space contract.

## Presentation-local reuse

PowerShow distinguishes **copy/materialization reuse** from **live Presentation-local reuse**.

Existing Presentation-local systems include Palette references and Text Styles. Text Styles resolve with:

```text
Theme role baseline
→ Text Style
→ local Text override
```

The next planned reuse feature is **Linked Styles** under **This Presentation**. Linked Styles are intended to let multiple existing Containers share a live Presentation-local style/layout decision instead of repeatedly copying the same values.

V1 direction:

```text
Theme / defaults
→ Linked Style
→ local Container override
```

Linked Styles are planned as:

- Presentation-scoped and self-contained;
- Container-only in V1;
- one linked style reference per Container;
- able to provide `layout`, `style`, `typography`, and `effect` values;
- compatible with local overrides;
- attachable/detachable without changing the current visual result;
- independent from private Custom Library data at Player runtime.

The final persisted shape must be audited against the current canonical schema before implementation.

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

The imported copy preserves the complete schema-validated Presentation, including slides, elements, internal IDs, Palette, FontResources, Text Styles, and authored content. Only the root Presentation id is replaced for the new draft; private Studio metadata is not part of transfer.

Legacy or incompatible documents are not silently migrated during import. Recovery is a separate explicit product flow.

A future **AI Import** path is expected to produce the same canonical Presentation contract rather than introducing a second persisted document language.

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

Current live responsibilities are intentionally separate:

```text
Player      = real projection
Watch       = real audience follower
Root        = portal / showcase
Control     = operator intent
Diagnostics = technical observability
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
- Player-local fullscreen behavior consistent with browser user-gesture restrictions;
- bounded production diagnostics for Player troubleshooting.

## Public Portal and Live Cover

The public root has two modes:

```text
No Live
→ /demo
→ full-screen ambient demo

Live
→ /cover
→ static first slide of the active immutable version
```

The Live cover does not follow `live/playerState`, Control preview, navigation, autoplay, fullscreen requests, or ACK state.

The root Watch QR points to `/watch`, is generated locally, and can be dragged with Pointer Events on touchscreen devices while remaining clamped to the viewport. The current operational compatibility target includes Firefox 116 on Android touchscreen hardware.

## Authoring resources

PowerShow distinguishes Presentation-local resources from reusable private Custom Library masters.

```text
Custom Library master
→ copy/materialize into Presentation
→ canonical Presentation resource/data
→ publish as self-contained snapshot
```

Current reusable Custom Library resource families include:

- Styles;
- Palettes;
- Fonts.

Presentation-local resources include:

- Palette colors and references;
- FontResources;
- Text Styles.

Linked Styles are planned as another Presentation-local authoring mechanism, but unlike Custom Library Styles they are intended to preserve a live relationship between multiple elements **inside the same Presentation**.

There are no live dependency links from a published Presentation back to private Custom Library data.

## Chart and Gallery status

`chart` already exists in the canonical element union with semantic `line`, `bar`, `area`, and `scatter` series data, but the current shared renderer still treats it as a placeholder. **Chart V1** is planned to implement real rendering and Studio authoring without redesigning the canonical model around a rendering library.

`gallery` already has a functional minimum horizontal swipe/scroll carousel based on native CSS scroll snapping. **Gallery V2** is planned as an improvement of that existing element rather than a second Gallery implementation.

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

PowerShow development is checkpoint-driven and audit-first.

The normal implementation loop is:

```text
inspect current code
→ verify whether the capability already exists
→ identify the existing boundary to reuse
→ freeze the smallest correct architecture
→ implement narrowly
→ test
→ review the real remote commit / diff
→ advance
```

Repository execution rules and agent guidance live in:

- `AGENTS.md`;
- `DS.RULES.md` for DeepSeek-specific execution.

## Roadmap

See [`ROADMAP.md`](./ROADMAP.md) for the complete project chronology and current execution queue.

The current baseline includes the canonical document/renderer foundation, Studio authoring, persistence and immutable publishing, live Control/Player/Watch convergence, import/export, Custom Library resources, Text Styles, runtime surface refinement, and the immersive Public Portal/Live Cover.

The next explicit feature checkpoint is **Linked Styles — This Presentation**, followed by the broader authoring/runtime queue recorded in the roadmap, including mobile Control/Library simplification, configurable slide transitions, short Undo/Redo, AI Import, Chart V1, Gallery V2, Player offline recovery, maintenance/diagnostics, and audience expansion.
