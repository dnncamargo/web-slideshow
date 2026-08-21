# PowerShow

PowerShow is a web platform for authoring, organizing, publishing, presenting, and remotely controlling interactive slide presentations.

The project is designed around a practical presentation setup: the authenticated Studio runs on the operator's computer or mobile device, while the public Player runs on the projection screen, projector, TV, or second display.

> PowerShow is under active development.

## Product surfaces

PowerShow is organized as a suite:

```text
PowerShow Suite
├── PowerShow Studio   — presentation workspace and library
├── PowerShow Editor   — slide authoring
├── PowerShow Control  — live presenter console
└── PowerShow Player   — public projection runtime

Future public surface:
└── PowerShow Watch / Audience
```

Studio, Editor, and Control belong to the authenticated Studio application. Player is a separate public runtime.

The surfaces share a common visual language and application primitives, while preserving layouts and interaction density appropriate to their roles.

## Architecture overview

```text
Private draft
    │
    │ Publish
    ▼
Immutable published version
    │
    ├──────────────► Public publication pointer
    │
    └──────────────► Live session
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        PowerShow Control      PowerShow Player
        presenter console      projection runtime
              │                     │
              └──── commands ───────┘
                     + ACK
```

PowerShow deliberately separates:

- authoring;
- Studio organization;
- publication;
- live control;
- public projection.

A draft may continue changing without mutating an already published version. Published versions are immutable. Live session state is independent from the canonical presentation document.

## Presentation documents

Presentations are structured JSON documents validated by `@powershow/document-schema`.

Current schema version:

```text
schemaVersion: 1
```

The canonical document uses `slides[]`.

Conceptually:

```text
Presentation
└── Slides
    └── Elements
        ├── Text
        ├── Textbox
        ├── Image
        ├── Code
        ├── Terminal
        ├── Table
        ├── Divider
        ├── Topics
        ├── Chart
        ├── Interactive
        └── Container
            └── Elements
```

Containers are recursive and remain the fundamental generic layout primitive.

Rows and columns are compositions of containers rather than rigid special-purpose document structures. Layout presets create useful starting trees without restricting later composition.

Structured elements may expose their own semantic structure instead of pretending that every content model is a generic container.

## Rendering

PowerShow follows the principle:

> Structured for authoring. Native for presenting.

```text
PowerShow document
      │
      ▼
Schema validation
      │
      ▼
@powershow/renderer
      │
      ▼
HTML + CSS + lightweight JavaScript
      │
      ▼
Editor preview / Studio preview / Control preview / Player
```

The Player is intentionally lightweight and favors standard browser primitives, small runtime modules, and event-driven behavior.

Published presentation output must remain deterministic and self-contained.

## Application UI and presentation themes

PowerShow keeps application UI styling separate from authored presentation styling.

```text
@powershow/ui
→ application interface
  Studio / Editor chrome / Inspector / Control

@powershow/theme
→ presentation content appearance and effective defaults
```

Studio, Editor, and Control reuse actual shared UI primitives rather than parallel CSS implementations that merely look similar.

The pages may still differ in composition:

- Studio behaves like a workspace / file manager;
- Editor is a high-density authoring tool;
- Control is operational, responsive, and distance-readable.

## Persistence boundaries

PowerShow keeps private authoring data, private organization metadata, public published data, and Live state separate.

### Private mutable draft

```text
users/{uid}/presentations/{presentationId}
```

The authenticated Studio edits and saves the canonical draft here.

The Firestore document also carries private Studio metadata outside the canonical Presentation, including organization state such as:

```text
archivedAt
folderId
```

Changing organization metadata does not change canonical presentation content or create a new presentation revision.

### Private presentation folders

```text
users/{uid}/presentationFolders/{folderId}
```

Folders are private Studio organization metadata.

They are not part of `@powershow/document-schema`, are not published, and are never required by Player.

Folders are flat in the current implementation.

### Immutable published versions

```text
publishedPresentations/{publicationId}/versions/{versionId}
```

Publishing creates an immutable snapshot when the canonical draft revision changed.

### Public publication pointer

```text
publishedPresentations/{publicationId}
```

The public pointer identifies the currently published version:

```text
{
  currentVersionId,
  publishedRevision,
  publishedAt
}
```

### Private slide notes

```text
users/{uid}/presentations/{presentationId}/private/notes
```

Presenter notes remain private and are not part of the canonical presentation or read by the public Player.

### Live session state

Firebase Realtime Database carries ephemeral Live state and presentation control synchronization.

The Live architecture distinguishes durable published presentation data from transient commands and acknowledgements.

## Live control invariants

The Player ACK is authoritative for the slide actually confirmed on screen.

Control does not invent a second local current-slide truth. Its current preview, next preview, counter, Summary highlight, and Notes derive from the confirmed Live state.

Summary is read-only. Previous and Next are live commands rather than local preview navigation.

Reloading Control or Player must recover coherently from persisted Live state.

## PowerShow Control

PowerShow Control currently provides:

- current slide preview;
- next slide preview;
- ACK-authoritative Previous / Next navigation;
- current / total slide counter;
- read-only slide Summary;
- private per-slide Notes;
- sync / latency status;
- local clock;
- live presentation termination;
- responsive desktop and mobile layouts;
- shared Studio locale selection.

Its visual language follows the same application UI foundation used throughout PowerShow while preserving an operational presenter layout.

## PowerShow Studio

Studio is the private workspace for presentations and reusable authoring resources.

Current information architecture:

```text
Studio
├── Presentations
│   ├── All
│   └── Archived
├── Folders
│   ├── Folder A
│   ├── Folder B
│   └── ...
└── Resources
    ├── Styles
    ├── Palettes
    └── Fonts
```

### Presentation workspace

Studio provides:

- file-manager-style presentation rows;
- first-slide thumbnail previews;
- single-selection workflow;
- contextual management toolbar;
- Details pane;
- responsive desktop/mobile composition;
- Live presentation status;
- presentation creation and editing;
- archive and restore.

`All` contains every active presentation, including presentations assigned to folders.

A folder destination contains active presentations assigned to that folder.

`Archived` contains archived presentations regardless of their previous folder.

### First-slide previews

Library thumbnails reuse `@powershow/renderer`.

The preview is derived from the presentation already loaded for the Library:

- no per-row `getPresentation()` calls;
- no stored thumbnail blob;
- no base64 thumbnail persistence;
- no separate miniature renderer.

A blank or malformed first slide uses a decorative fallback.

### Permanent deletion

Permanent deletion is intentionally conservative.

Only archived presentations that have never been published may currently be permanently deleted from Studio.

The user must type the displayed presentation name exactly before the destructive action becomes available.

If publication metadata is present — including malformed metadata — deletion fails closed.

Published public versions and publication pointers are not silently removed when a private draft is deleted.

Safe deletion of already-published presentation artifacts is a separate future problem.

## Typical authoring structure

A slide may contain hierarchical containers with mixed content:

```text
Slide
├── Header
├── Main
│   ├── Container
│   │   └── Image
│   └── Container
│       ├── Textbox
│       ├── Topics
│       ├── Terminal
│       └── Chart
└── Footer
```

Columns are containers, not special immutable element types.

A footer belongs to the slide root rather than to an individual column.

## Inspector and element semantics

PowerShow keeps element-specific semantics instead of forcing every element through one generic editor.

The current Inspector architecture uses element-specific inspectors coordinated by a dispatcher.

The intended relative property order is:

```text
Content / Source / Structure
Layout
Size
Spacing
Placement
Typography
Appearance
Interaction
Effects
```

Irrelevant sections may be omitted, but surviving sections should remain predictable.

A property's semantic role is defined before deciding whether it belongs in a reusable Saved Style.

## Reuse model

PowerShow distinguishes different kinds of reuse.

```text
Theme
→ presentation-wide visual and structural identity

Saved Style
→ reusable element-level canonical property configuration

Reusable graphical resource
→ reusable authored definition with stable identity
```

Saved Styles are intended to materialize effective values into the canonical presentation rather than become runtime dependencies of Player.

Reusable graphical resources may use references during authoring, but publishing must snapshot or otherwise resolve them so published presentations remain self-contained.

## Interactive and structured content

PowerShow is intended to support educational and technical interactive content, including:

- mathematical graphs;
- waveform demonstrations;
- PWM demonstrations;
- electrical circuit visualizations;
- geometric demonstrations;
- tables and charts;
- structured topic content;
- diagrams;
- interactive galleries;
- reusable graphical resources;
- interactive widgets.

Official interactive components should use explicit semantics and schemas where practical.

Arbitrary user JavaScript is a separate trust boundary and requires explicit sandboxing. It is not treated as ordinary presentation content.

## Monorepo

PowerShow uses a pnpm workspace.

```text
web-slideshow/
├── apps/
│   ├── studio/
│   ├── player/
│   └── player-legacy/
│
├── packages/
│   ├── document-schema/
│   ├── firebase/
│   ├── renderer/
│   ├── theme/
│   └── ui/
│
├── AGENTS.md
├── DS.RULES.md
├── ROADMAP.md
├── readme.md
├── package.json
└── pnpm-workspace.yaml
```

## Development

Requirements:

```text
Node.js >=24 <25
pnpm
TypeScript
Vitest
Firebase
```

Install dependencies:

```bash
pnpm install
```

Run workspace checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Focused Studio checks commonly use:

```bash
pnpm --filter @powershow/studio typecheck
pnpm --filter @powershow/studio test
```

Firebase Firestore rules are deployed separately from application deployments:

```bash
firebase deploy --only firestore:rules
```

Vercel application deployment does not deploy Firebase security rules.

Agents and contributors must read:

```text
AGENTS.md
```

before changing the repository.

Execution agents using the DeepSeek-specific workflow must also follow:

```text
DS.RULES.md
```

## Current status

PowerShow already includes:

- canonical presentation schema and validation;
- recursive authored element trees;
- shared renderer;
- presentation themes and centralized effective element defaults;
- authenticated Studio;
- private draft persistence;
- immutable publication versions and public publication pointers;
- reactive Live sessions;
- Player remote navigation with ACK synchronization;
- responsive PowerShow Control;
- private slide Notes;
- shared application UI foundation;
- specialized Editor Inspectors;
- Google / web font management;
- links and element interaction support;
- Divider and structured Topics authoring;
- redesigned Studio presentation workspace;
- first-slide Library thumbnails;
- private flat folders;
- archive / restore;
- protected permanent deletion for eligible archived drafts.

The current Studio Organization cycle is complete in the feature branch and is being finalized for merge.

## Roadmap

After Studio Organization is merged, the closed execution sequence is:

```text
1. Element Properties
   ↓
2. Saved Style eligibility / contract
   ↓
3. Saved Styles
   ↓
4. Resources
   ├── Styles
   ├── Palettes
   └── Fonts
   ↓
5. Custom Style Library
   ↓
6. Broad Editor refinements
```

The sequence deliberately defines element-property semantics before building reusable style systems.

Later exploratory areas include:

- folder rename and removal UX;
- reusable custom color palettes;
- border-color reuse;
- gradient borders;
- background patterns;
- richer Text behavior;
- additional structured elements;
- interactive galleries;
- reusable graphical resources;
- official interactive technical / educational components;
- sandboxed custom JavaScript elements;
- broader Watch / Audience experiences;
- documentation;
- legacy runtime expansion;
- release hardening and offline resilience.

Exploratory areas are not implementation contracts until their architecture is explicitly defined.