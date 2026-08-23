# PowerShow

PowerShow is a web-based system for authoring, publishing, presenting, and remotely controlling interactive slide presentations.

The architectural goal is simple:

> Rich authoring, predictable canonical documents, lightweight playback.

PowerShow keeps authoring concerns in Studio and presentation concerns in the Renderer/Player boundary. The structured presentation document is the source of truth; the runtime translates that document into HTML, CSS, and lightweight JavaScript.

## Current status

PowerShow is under active development.

The current canonical document still uses:

```json
{
  "schemaVersion": 1
}
```

`schemaVersion` is intentionally **not** being bumped merely because pre-stable canonical structures are being cleaned up. Existing development presentations are still disposable and may be recreated after breaking contract changes. A future version bump should represent a real compatibility boundary, not ordinary pre-stable model refinement.

The active authoring cycle is **P10 — Authoring and Canonical Document Model**. The current checkpoint is the canonical contract cleanup inside P10.10. See [ROADMAP.md](./ROADMAP.md) for the execution order.

## Runtime surfaces

### Studio

Authenticated application for:

- presentation library and organization;
- slide authoring;
- publishing;
- live-session activation;
- Control / presenter workflows.

### Control

Authenticated presenter surface for:

- Current and Next previews;
- Previous / Next navigation;
- private Notes;
- presentation Summary;
- Player ACK / live synchronization;
- staged published-version review and Player promotion;
- ending the active presentation.

### Player

Public presentation runtime for the projected presentation.

The Player:

- loads immutable published presentation versions;
- validates them through the canonical document schema;
- renders through `@powershow/renderer`;
- follows the active Live version and slide state;
- remains independent from Studio authoring code.

### Player Legacy

Compatibility-oriented runtime for constrained or older browsers.

Audience / Watch capabilities are planned separately and must remain read-only with respect to shared presentation control.

## Architecture

```text
Canonical PowerShow Document
            │
            ▼
        Validation
            │
            ▼
  @powershow/renderer
            │
            ▼
HTML + CSS + lightweight JS
            │
            ▼
          Player
```

Publishing keeps the same canonical presentation document self-contained:

```text
Studio draft
    │
    ▼
canonical validation
    │
    ▼
Firestore private draft
    │
    ▼
immutable published version
    │
    ├── Control preview
    └── Player runtime
```

Live control state is intentionally separate from presentation content. RTDB coordinates publication/version identity, slide identity, revisions, commands, and ACK state; it does not redefine the presentation document model.

## Canonical document principles

- The structured document is the source of truth.
- Renderer implementation details should not leak into the document without a concrete reason.
- Prefer semantic, readable JSON over persisted derived HTML/CSS.
- Do not duplicate two canonical representations for the same intent.
- Keep layout, visual styling, typography, effects, content, and behavior responsibilities explicit.
- Do not persist empty/speculative namespaces merely for symmetry.
- Published versions must be self-contained; Player must not resolve private Studio-only resources at runtime.
- Studio UI vocabulary does not need to map one-to-one to JSON field names.
- Renderer-generated implementation details such as containing blocks, overlays, wrappers, or CSS shorthands do not automatically belong in the canonical contract.

## Authoring capabilities

The current authoring foundation includes:

- hierarchical Containers;
- Text and Textbox elements;
- typography and font management;
- inline rich text;
- safe links / interaction;
- ContentSlots;
- structured Topics;
- structured Tables;
- Image;
- Code and Terminal;
- Divider;
- Gallery;
- Embed;
- visual Blocks;
- sandboxed Scripted content;
- backgrounds, gradients, patterns, borders, gradient border paint, rounded corners, opacity, and shadows.

Some element contracts and UX surfaces remain intentionally minimal and are refined in later roadmap checkpoints.

## Repository structure

PowerShow is a pnpm monorepo:

```text
web-slideshow/
├── apps/
│   ├── studio/
│   ├── player/
│   └── player-legacy/
│
├── packages/
│   ├── document-schema/
│   ├── renderer/
│   ├── firebase/
│   ├── theme/
│   └── ui/
│
├── AGENTS.md
├── DS.RULES.md
├── ROADMAP.md
├── package.json
└── pnpm-workspace.yaml
```

### `packages/document-schema`

Defines what a canonical PowerShow presentation **is**.

### `packages/renderer`

Defines how a validated PowerShow document is rendered.

### `packages/firebase`

Shared Firebase integration. Firebase-specific storage concerns must not become the PowerShow domain model.

### `packages/theme`

Shared theme defaults and presentation visual defaults used across authoring and rendering.

### `packages/ui`

Reusable application UI. Player runtime dependencies should remain lightweight and must not be moved here merely for convenience.

## Development

Requirements:

- Node.js `>=24 <25`;
- pnpm `10.28.0` through Corepack.

Install dependencies:

```bash
corepack enable
pnpm install
```

Run the Studio:

```bash
pnpm --filter @powershow/studio dev
```

Run the Player:

```bash
pnpm --filter @powershow/player dev
```

Repository-wide verification:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Package-scoped verification is preferred during narrow development checkpoints, followed by the relevant broader regression suite before merge.

Firebase environment variables are documented in `.env.example`. Do not commit credentials or private keys.

## Development with coding agents

Agent work in this repository is governed by:

- [`AGENTS.md`](./AGENTS.md) — PowerShow architecture, repository boundaries, and general agent rules;
- [`DS.RULES.md`](./DS.RULES.md) — DeepSeek-specific execution policy.

Architecture and product behavior should be decided before delegating narrow implementation tasks. Agents should prefer minimal deltas, preserve unrelated behavior, test their changes, commit/push the requested checkpoint, and stop for review.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for completed milestones, the current canonical-contract work, and future product cycles.
