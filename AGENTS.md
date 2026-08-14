# AGENTS.md — PowerShow

This file defines the rules for AI coding agents working in this repository.

Repository: `web-slideshow`
Product: **PowerShow**

Read this file before editing code.

---

# 1. Project

PowerShow is a cloud-based system for creating, publishing, displaying, and remotely controlling interactive web presentations.

The system has distinct runtime surfaces:

* **Studio** — presentation management.
* **Editor** — slide authoring.
* **Control** — presenter remote control.
* **Player** — main presentation display.
* **Player Legacy** — compatibility runtime.
* **Audience** — read-only presentation follower.

The architectural priority is:

> Rich authoring, predictable documents, lightweight playback.

---

# 2. Repository Structure

PowerShow is a pnpm monorepo.

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
│   └── ui/
│
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

Responsibilities:

### `packages/document-schema`

Canonical definition of PowerShow presentation documents.

This package defines what a presentation **is**.

### `packages/renderer`

Transforms a validated PowerShow document into presentation output.

This package defines how a presentation is **rendered**.

### `packages/firebase`

Firebase persistence, authentication, storage, and live-session integration.

Firebase-specific types must not become the PowerShow domain model.

### `packages/ui`

Reusable application UI.

Do not move Player runtime dependencies here merely for reuse.

### `apps/studio`

Presentation library, Editor, Control, and administrative interfaces.

### `apps/player`

Modern presentation runtime.

Must remain lightweight and independent from Studio.

### `apps/player-legacy`

Compatibility-oriented presentation runtime for constrained or older browsers.

---

# 3. Core Architecture

PowerShow separates authoring from playback.

```text
PowerShow Document
       │
       ▼
   Validation
       │
       ▼
    Renderer
       │
       ▼
HTML + CSS + lightweight JavaScript
       │
       ▼
     Player
```

The structured document is the source of truth during authoring.

The presentation runtime should use native browser capabilities wherever practical.

Do not turn the Player into a second Editor.

---

# 4. Document Model

Current schema version:

```text
schemaVersion: 1
```

A presentation contains slides.

Slides contain elements.

Containers may recursively contain other elements.

```text
Presentation
└── Slide[]
    └── Element[]
        ├── text
        ├── textbox
        ├── image
        ├── code
        ├── terminal
        ├── table
        ├── chart
        ├── interactive
        └── container
            └── Element[]
```

The document schema is an architectural contract.

Do not change it unless the task explicitly authorizes a schema change.

---

# 5. Container Model

Containers are the fundamental layout primitive.

A column is a container.

A row is a container.

Main, header, footer, and content areas are containers with structural roles.

Do not create content-specific container types such as:

```text
ImageColumn
TextColumn
CodeColumn
ChartColumn
```

Use generic containers instead.

Example:

```text
Slide
├── Header
├── Main
│   ├── Column
│   │   └── Image
│   │
│   └── Column
│       ├── Textbox
│       ├── Terminal
│       └── Chart
│
└── Footer
```

A container may contain mixed content.

This is valid:

```text
Column
├── Text
├── Image
├── Terminal
├── Table
└── Chart
```

Containers may also contain nested containers.

---

# 6. Layout Presets

Layouts are presets, not document restrictions.

Examples:

* media + content;
* content + media;
* single centered column;
* three centered columns;
* title + content;
* hero;
* code;
* technical demonstration.

A preset creates an initial container tree.

After creation, the resulting document tree is authoritative.

Do not encode assumptions that prevent the user from modifying the preset structure later.

---

# 7. Rendering Rules

Document semantics must remain independent from rendering libraries.

For example:

A chart element stores chart semantics and data.

It must not require Chart.js, D3, React, Canvas, or SVG as part of its canonical schema.

The renderer decides the implementation.

Prefer, in order:

1. HTML;
2. CSS;
3. SVG;
4. small event-driven JavaScript;
5. Canvas only when justified.

Avoid unnecessary continuous rendering loops.

An inactive slide should consume almost no CPU.

---

# 8. Player Rules

Player is performance-sensitive.

It may run on:

* interactive displays;
* Chromebooks;
* phones;
* tablets;
* constrained hardware.

Player must not depend on Studio.

Avoid adding large runtime dependencies without explicit architectural approval.

Prefer:

* small bundles;
* shallow DOM trees;
* native browser APIs;
* event-driven behavior;
* CSS animations where appropriate;
* pausing interactive elements when their slide is inactive.

Do not introduce background animation or polling without a clear requirement.

---

# 9. Player Legacy

Legacy support is intentional.

Do not:

* remove Player Legacy;
* silently merge it with the modern Player;
* assume all modern browser APIs are available;
* make modern functionality mandatory without considering fallback behavior.

A feature may have:

```text
Modern: full implementation
Legacy: simplified implementation
```

as long as the presentation remains understandable and usable.

---

# 10. Interactive Elements

PowerShow is intended to support interactive educational and technical content.

Examples:

* function plots;
* sine waves;
* linear functions;
* quadratic functions;
* square waves;
* PWM demonstrations;
* electrical circuits;
* current-flow visualization;
* geometry demonstrations;
* interactive diagrams.

Official interactive components should eventually have explicit schemas.

Do not execute arbitrary user-authored JavaScript directly in the Player application context.

Custom scripts require an explicit sandbox architecture.

---

# 11. Publishing

Draft editing and presentation playback are separate concerns.

```text
Draft
  ↓
Publish
  ↓
Version
  ↓
Session
```

Published versions are immutable.

Editing a presentation must not silently change a presentation already being displayed.

Do not alter this behavior without architectural approval.

---

# 12. Live Sessions

A live session references a published presentation version.

```text
Published Version
       │
       ▼
    Session
   ↙   ↓   ↘
Player Control Audience
```

Player and authorized Control clients may update shared presentation state.

Audience clients are read-only with respect to shared state.

Audience local navigation, when enabled, must not modify the main presentation.

Never rely only on hidden UI controls for authorization.

Permissions must be enforced at the data/security layer.

---

# 13. Offline Behavior

A presentation should not require a network request for every slide change.

Published presentation data and assets should be cacheable.

Temporary network loss should not immediately prevent local presentation navigation.

Do not introduce designs where the Player depends continuously on server round trips for basic playback.

---

# 14. TypeScript

Use strict TypeScript.

The project intentionally uses strict compiler options including:

```text
strict
noUncheckedIndexedAccess
exactOptionalPropertyTypes
```

Do not disable strictness to fix a type error.

Correct the type.

Avoid:

```ts
any
```

Prefer `unknown` followed by validation or narrowing.

---

# 15. Zod

Persisted or external PowerShow documents must be validated.

Be aware that Zod defaults affect parsed output types.

Example:

```ts
z.boolean().default(false)
```

means the parsed output contains a boolean even if the input omitted it.

Distinguish between:

* raw input;
* validated output;
* domain types.

Do not weaken validation merely to satisfy TypeScript.

---

# 16. Dependencies

Do not add core dependencies without explicit approval.

This rule is especially strict for:

* `document-schema`;
* `renderer`;
* `player`;
* `player-legacy`.

Before adding a package, ask:

1. Can the browser/platform already do this?
2. Does this dependency affect Player bundle size?
3. Does this dependency constrain our document model?
4. Does Legacy need an alternative?

Dependencies used only by Studio have more flexibility, but still require justification.

---

# 17. Security

Never commit:

```text
.env
.env.local
service account files
private keys
API secrets
authentication tokens
Firebase Admin credentials
```

Do not weaken:

* Firebase security rules;
* document validation;
* audience read-only access;
* session authorization;
* script sandboxing;
* immutable publishing.

---

# 18. File Encoding

Source and configuration files must use:

```text
UTF-8 without BOM
```

Do not generate UTF-16 source files.

Do not add UTF-8 BOM markers to JSON files.

Relevant files include:

* `.json`;
* `.ts`;
* `.tsx`;
* `.js`;
* `.css`;
* `.html`;
* `.yaml`;
* `.yml`;
* `.md`.

---

# 19. Testing

Run tests appropriate to the affected package.

For the document schema:

```bash
pnpm --filter @powershow/document-schema typecheck
pnpm --filter @powershow/document-schema test
```

When appropriate, run repository-wide:

```bash
pnpm typecheck
pnpm test
```

Never report tests as passing unless they were actually executed.

Schema changes require tests.

Important areas include:

* valid documents;
* invalid documents;
* defaults;
* recursive containers;
* mixed content;
* layout structures;
* serialization compatibility.

---

# 20. Agent Authority

Agents MAY autonomously:

* implement a clearly specified interface;
* create tests;
* create fixtures;
* fix mechanical TypeScript errors;
* perform scoped refactors;
* update imports;
* implement explicitly designed components;
* improve internal documentation;
* run builds, tests, and typechecks.

Agents MUST NOT autonomously:

* change `schemaVersion`;
* redesign the PowerShow document model;
* add or remove core element types;
* redesign container semantics;
* change publishing/version rules;
* redesign Firebase architecture;
* change session authorization;
* change audience permissions;
* merge Studio and Player;
* merge Modern and Legacy Player;
* remove Legacy support;
* introduce unrestricted user JavaScript;
* introduce major core dependencies.

If implementation reveals that one of these changes is needed, stop and report the architectural issue.

---

# 21. Scope

Respect task boundaries.

If the task says:

```text
Work only in packages/document-schema
```

do not modify unrelated packages.

Do not opportunistically refactor unrelated code.

Avoid repository-wide formatting changes unless explicitly requested.

Keep diffs small and reviewable.

---

# 22. Git

Unless explicitly requested:

* do not commit;
* do not push;
* do not merge;
* do not rebase;
* do not rewrite Git history;
* do not switch branches.

Before completing a task, report:

1. files created;
2. files modified;
3. behavior implemented;
4. commands executed;
5. test results;
6. unresolved issues.

---

# 23. Current Development Order

Unless explicitly instructed otherwise, preserve this implementation order:

```text
Document Schema
      ↓
Tests & Fixtures
      ↓
Renderer
      ↓
Minimal Player
      ↓
Layout Presets
      ↓
Studio
      ↓
Editor
      ↓
Firebase Persistence
      ↓
Publishing
      ↓
Live Sessions
      ↓
Control
      ↓
Audience
      ↓
Legacy Expansion
```

Do not implement later layers merely because they appear straightforward.

---

# 24. Working Principle

The project uses AI agents primarily for execution and verification.

Architectural decisions are reviewed separately.

The operating principle is:

> Write as much code as useful. Make as few architectural decisions as possible.

When the specification is insufficient to make a safe architectural decision, report the ambiguity instead of inventing a new convention.

---

# 25. PowerShow Agent Protocol (PSAP/1)

PSAP/1 is the compact task protocol used to reduce repeated prompt context.

It does not replace the architectural rules in this file. It assumes the agent has read and follows this file.

A task may begin with:

```text
PSAP/1
mode=<patch|implement|decide>
model=<DS|TD|TP>
base=<commit-or-current>
scope=<files-or-area>
rules=<compact-rules>
validate=<commands-or-profile>
```

Model tags are advisory:

```text
DS = DeepSeek V4 Flash
TD = GPT-5.6 Terra Default
TP = GPT-5.6 Terra Pro
```

The model tag does not grant architectural authority.

## `mode=patch`

Use when the exact semantic change is already decided.

The agent must:

* apply only the stated delta;
* avoid redesigning surrounding code;
* resolve only direct syntax/type consequences;
* avoid unrelated refactors.

Example:

```text
PSAP/1
mode=patch
model=DS
scope=firestore.rules
rules=no-git,no-install,scope-strict,no-arch,diffcheck,report-short

change:
- helper receives validated userId
- replace invalid Resource existence check with draft != null
- auth guard occurs before request.auth.uid use

keep:
- existing publication invariants

no-other-changes
```

## `mode=implement`

Use when architecture and contract are already decided, but implementation is still required.

Prefer this shape:

```text
goal:
inputs:
outputs:
invariants:
scope:
tests:
validate:
```

The agent may choose local implementation details only when they do not change the declared architecture or contract.

## `mode=decide`

Use only when a task explicitly delegates an architectural decision.

Prefer this shape:

```text
problem:
constraints:
known-options:
decision-required:
```

Do not infer `mode=decide` merely because implementation is difficult.

---

# 26. Compact Task Vocabulary

Future prompts may use these tokens.

```text
no-git
  apply the repository Git rules in this file

no-install
  do not install, upgrade, or migrate dependencies

scope-strict
  inspect/modify only declared scope except a concrete compile necessity

no-arch
  architecture is already decided; do not redesign

no-ui
  do not modify UI

no-schema
  do not modify the canonical document schema

no-firebase-sdk
  do not introduce direct Firebase SDK use outside persistence infrastructure

no-player
  do not touch Player/runtime delivery code

no-autosave
  do not add autosave, timers, or save-on-change effects

no-fake-tests
  tests must exercise production code or production helpers

diffcheck
  run git diff --check

studio-check
  run:
  pnpm --filter @powershow/studio typecheck
  pnpm --filter @powershow/studio test
  git diff --check

report-short
  provide only files changed, behavior, validation, and a narrow unresolved concern if any
```

A task may combine them:

```text
rules=no-git,no-install,scope-strict,no-arch,no-fake-tests,studio-check,report-short
```

---

# 27. Cost and Context Discipline

Agents should not spend context rediscovering decisions that the task declares accepted.

For continuation tasks:

1. inspect the current working tree or named partial file first;
2. continue from the existing implementation;
3. do not restart the original round from scratch;
4. do not re-evaluate accepted architectural decisions;
5. do not broadly crawl the repository when scope is already known.

If the task can be completed only by introducing a new architectural decision:

1. stop before broad changes;
2. report the exact ambiguity;
3. identify the smallest decision required;
4. wait for the architecture layer to resolve it.

Prefer the cheapest execution mode that fits the task:

```text
patch
  exact change already decided

implement
  contract decided; code remains

decide
  architecture explicitly delegated
```

The normal PowerShow workflow is:

```text
architecture/review
      ↓
small agent task
      ↓
WIP checkpoint
      ↓
code review
      ↓
next smaller task
```

The purpose is to keep diffs reviewable, reduce repeated context, and minimize unnecessary agent reasoning cost.
