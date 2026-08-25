# PowerShow

PowerShow is a web platform for authoring, publishing, presenting, and remotely controlling interactive slide presentations.

The project is designed around a practical presentation setup: the authenticated Studio runs on the operator's computer or mobile device, while the public Player runs on the projection screen, projector, TV, or second display.

> PowerShow is under active development.

## Product surfaces

PowerShow is organized as a suite:

```text
PowerShow Suite
├── PowerShow Studio   — presentation library / home
├── PowerShow Editor   — slide authoring
├── PowerShow Control  — live presenter console
└── PowerShow Player   — public projection runtime

Future public surface:
└── PowerShow Watch / Audience
```

Studio, Editor, and Control belong to the authenticated Studio application. The Player is a separate public runtime.

The normal operator workflow does not require Studio Library and Control to be open simultaneously, but the system must remain coherent when multiple tabs or devices are open.

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

PowerShow deliberately separates authoring, publication, and live projection.

A draft may keep changing without mutating an already published version. Published versions are immutable. Live session state is kept separately from the published document.

## Presentation documents

Presentations are structured JSON documents validated by `@powershow/document-schema`.

Current schema version:

```text
schemaVersion: 1
```

Conceptually:

```text
Presentation
└── Slides
    └── Elements
        ├── Text
        ├── Image
        ├── Code
        ├── Terminal
        ├── Table
        ├── Chart
        ├── Interactive
        └── Container
            └── Elements
```

Containers are recursive. Layout presets create starting structures rather than rigid templates.

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
Editor preview / Control preview / Player
```

The Player is intentionally lightweight and favors standard browser primitives, small runtime modules, and event-driven behavior.

## Persistence boundaries

PowerShow keeps private authoring data, public published data, and live control state separate.

### Private mutable draft

```text
users/{uid}/presentations/{presentationId}
```

The authenticated Studio edits and saves the canonical draft here.

### Immutable published versions

```text
publishedPresentations/{publicationId}/versions/{versionId}
```

A publish creates an immutable snapshot when the draft revision changed.

### Public publication pointer

```text
publishedPresentations/{publicationId}
```

The pointer identifies the latest published version:

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

Presenter notes remain private and are not read by the public Player.

### Live session state

Firebase Realtime Database carries the active live state:

```text
live/current
live/slideCommand
live/slideAck
```

`live/current` identifies the version currently released to the Player. Slide navigation uses command/ACK synchronization.

## Live control invariants

The Player ACK is authoritative for the slide that is actually confirmed on screen.

The Control does not invent a local "current slide" state. Its current preview, next preview, counter, Summary highlight, and Notes are derived from the ACK-confirmed slide.

The Summary is read-only. Previous/Next are live commands, not local preview navigation.

The current Live protocol is activation-scoped. Reloading Control or Player must recover from persisted Live state without requiring a new session.

## Current Control

PowerShow Control currently provides:

- current slide preview;
- next slide preview;
- ACK-authoritative Previous/Next navigation;
- current / total slide counter;
- read-only slide Summary;
- private per-slide Notes;
- sync / latency status;
- local clock;
- End presentation;
- responsive desktop and mobile layouts;
- shared Studio locale selection.

The Control visual language follows the Editor: flat orthogonal regions, dividers, shared typography, and compact interactive controls.

Fullscreen is currently a disabled placeholder. A canonical session timer is also deferred until a real persisted session start time exists.

## Staged Live Publish — next milestone

The next functional milestone changes how a new publication interacts with an already running live session.

The intended model is:

```text
Publish V2
    │
    ├── public publication pointer → V2
    │
    └── Control automatically previews V2

Player remains on V1
    │
    ▼
Control shows an inline pending-version state
    │
    └── [Update Player]
             │
             ▼
        live/current → V2
             │
             ▼
        Player reloads V2
        preserving the logical current slide when possible
```

Key rules:

- Control follows the latest published version automatically.
- Player changes version only after explicit operator authorization.
- No modal is required.
- The existing excess space in the Control action area is used for version messages and the **Update Player** action.
- If slide order, insertion, or removal changed, Control shows a compact structural warning.
- While Control and Player are on different versions, Previous/Next are disabled to avoid sending absolute indices against different slide orders.
- The logical current slide is preserved by `slide.id` when possible.
- Multiple publishes before Player promotion collapse to the latest published version; no update queue is required.

See [`ROADMAP.md`](./ROADMAP.md) for the execution plan.

## Typical authoring structure

A slide may contain hierarchical containers with mixed content:

```text
Slide
├── Header
├── Main
│   ├── Container
│   │   └── Image
│   └── Container
│       ├── Text
│       ├── Terminal
│       └── Chart
└── Footer
```

Columns are containers, not special element types. A footer belongs to the slide root rather than to an individual column.

## Interactive content

PowerShow is intended to support educational and technical interactive content, including:

- mathematical graphs;
- geometric demonstrations;
- PWM and waveform demonstrations;
- electrical circuit visualizations;
- source code;
- terminal simulations;
- tables;
- charts;
- diagrams and interactive widgets.

Arbitrary user JavaScript requires explicit sandboxing and is not treated as ordinary presentation content.

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

Agents and contributors must read:

```text
AGENTS.md
```

before changing the repository.

## Current status

The project already includes:

- canonical presentation schema and fixtures;
- shared renderer;
- theme support;
- authenticated Studio;
- private draft persistence;
- immutable publishing and public publication pointer;
- private slide Notes;
- reactive Live sessions;
- Player remote navigation with ACK;
- presenter current/next previews;
- responsive PowerShow Control;
- live session termination and reload recovery.

The immediate priority is no longer visual organization. It is making live publishing safe and useful during an active presentation, followed by richer Control commands.

## Roadmap summary

```text
P8   Control shell + responsive presenter          ✅ complete
P9   Live presentation operations                 ← next
P10  Audience presence
P11  PowerShow Studio / Library redesign
P12  Folders + persistence
P13  Saved Styles / reusable libraries
```

Detailed checkpoints and acceptance criteria live in [`ROADMAP.md`](./ROADMAP.md).
