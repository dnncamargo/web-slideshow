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

AI agents are expected to reason about the current code, not merely apply
literal edits.

The operating principle is:

> Preserve frozen architecture. Use sound engineering judgment inside it.

For implementation work, an agent may autonomously:

* inspect the relevant implementation and nearby dependencies;
* choose local implementation details;
* reuse or introduce small internal helpers when justified;
* make minimal adjacent changes required for correctness;
* adapt tests to an explicitly changed contract;
* fix direct type, lint, build, or test consequences of its patch;
* identify simpler implementations that preserve the accepted architecture.

Task scope describes the intended change, not necessarily an exhaustive list
of every file that may be touched.

Do not broaden a task into unrelated cleanup or redesign.

Architectural and product decisions explicitly declared frozen remain
constraints. If the implementation reveals a genuine conflict with one of
them, report the conflict rather than silently changing the architecture.

---

# 25. PowerShow Agent Protocol (PSAP/1)

PSAP/1 is a compact task description format.

It exists to communicate the delta for the current checkpoint without
repeating repository policy.

A task may begin with:

```text
PSAP/1
mode=<patch|implement|review|decide>
scope=<expected-files-or-area>
validate=<profile-or-commands>
rules=<optional-task-specific-rules>
base=<optional-commit-or-current>
```

Fields may be omitted when they do not add useful information.

The protocol is model-neutral. Model selection, reasoning effort, and execution
cost are concerns of the execution environment, not repository architecture.

## 25.1 Scope behavior

By default, `scope` describes the expected implementation boundary, not an
absolute file whitelist.

The agent should keep changes focused and reviewable.

If correctness requires a small adjacent change outside the expected scope,
the agent may make it when all of the following are true:

* it is a direct consequence of the requested change;
* it preserves established architecture and external contracts;
* it does not expand product behavior;
* it is reported in the final summary.

Do not use this permission for opportunistic refactoring.

When a task uses `scope-strict`, scope becomes a closed modification boundary.

## 25.2 Architecture

Existing architectural invariants remain binding unless the task explicitly
delegates a change to them.

Agents may reason freely about local implementation details that do not alter:

* document schema or schema versions;
* persistence boundaries;
* Firebase architecture;
* publication/version semantics;
* authentication or authorization boundaries;
* Studio/Player separation;
* public/private data boundaries;
* Live protocol semantics;
* ACK authority;
* renderer ownership;
* canonical state ownership.

Difficulty alone is not a reason to redesign architecture.

## 25.3 Existing implementation

For continuation work:

1. inspect the current implementation before editing;
2. understand existing contracts and tests;
3. preserve accepted behavior outside the requested delta;
4. prefer integration with existing patterns over parallel infrastructure;
5. do not rebuild working code merely because another design is possible.

The current repository is evidence and context for the implementation.

## 25.4 Tests

Tests are contract evidence.

Do not weaken a valid requirement test merely to obtain a passing suite.

Tests may be changed when:

* the task intentionally changes the behavior being tested;
* new behavior requires new coverage; or
* the existing test is demonstrably inconsistent with the accepted contract.

When validation fails, determine whether the current change caused the
failure. Fix failures caused by the patch when doing so remains within the
accepted architecture.

Do not silently repair unrelated pre-existing failures.

## 25.5 Modes

### `mode=review`

Inspect and report.

Do not modify files unless the task explicitly asks for changes after the
review.

Use for:

* repository reconnaissance;
* code review;
* architecture mapping;
* checkpoint analysis;
* implementation-path discovery.

Prefer concrete findings from the current repository over generic advice.

### `mode=patch`

Use when the semantic change is precise and localized.

Preserve surrounding behavior, but use normal engineering judgment for direct
implementation consequences.

### `mode=implement`

Use when desired behavior and architecture are known but implementation still
requires engineering work.

The agent may:

* choose local implementation details;
* introduce small internal helpers when justified;
* make minimal adjacent changes required for correctness;
* adapt tests to the explicitly changed contract;
* resolve direct type, lint, build, and test consequences of the change.

Do not interpret `mode=implement` as permission for unrelated redesign.

### `mode=decide`

Use when the task explicitly delegates an architectural or product decision.

The result should state:

1. the chosen approach;
2. relevant tradeoffs;
3. resulting invariants;
4. affected implementation boundaries.

A decision made and accepted at this stage becomes an invariant for subsequent
implementation work until explicitly revised.

---

# 26. Optional Task Rules

`rules=` is used only for restrictions or execution constraints that are
specific to the current task.

Do not repeat repository-wide rules unnecessarily.

Task rules refine execution behavior. They do not override architectural,
security, persistence, or product invariants defined elsewhere in this file.

Available rules:

### `scope-strict`

Treat the declared `scope` as a closed modification boundary.

The agent may inspect adjacent code when necessary to understand contracts,
but must not modify files outside the declared scope.

If correctness requires an out-of-scope modification, report the requirement
instead of making the change.

Use this primarily for tightly controlled mechanical tasks.

---

### `no-arch`

Architecture and product behavior are already decided.

The agent may make local implementation choices, but must not change:

* architectural boundaries;
* persistence ownership;
* public/private data boundaries;
* canonical state ownership;
* protocol semantics;
* publication/version semantics;
* renderer ownership;
* authentication or authorization structure.

A local helper, internal type, or implementation strategy is not considered
an architectural change when it preserves these contracts.

---

### `no-git`

Do not perform Git write operations.

This includes:

* stage;
* commit;
* push;
* merge;
* rebase;
* stash;
* reset;
* restore;
* amend;
* branch creation;
* branch switching;
* history rewriting.

Read-only Git inspection remains allowed when useful.

---

### `no-install`

Do not install, remove, upgrade, downgrade, or migrate dependencies.

Use only packages and tooling already available in the repository.

If a new dependency appears genuinely necessary, report the reason instead of
adding it.

---

### `no-ui`

Do not change user-facing UI.

This includes:

* visible markup;
* labels;
* translations;
* layout;
* styling;
* interaction behavior.

Internal state or infrastructure may change only when it does not alter the
visible experience.

---

### `no-schema`

Do not modify the canonical PowerShow document schema, schema version, element
types, persisted document shape, or serialization contract.

---

### `no-player`

Do not modify Player or Player Legacy runtime code.

Public presentation behavior must remain unchanged unless another task
explicitly covers it.

---

### `no-firebase-sdk`

Do not introduce direct Firebase SDK access outside the established persistence
or live infrastructure boundaries.

Prefer existing repositories, readers, services, and adapters.

---

### `behavior-neutral`

Preserve externally observable behavior except for the exact delta requested
by the task.

This includes, where applicable:

* UI behavior;
* persistence behavior;
* routing;
* protocol semantics;
* timing;
* loading states;
* error behavior;
* cleanup behavior;
* authentication;
* authorization.

Internal implementation may change when the observable contract remains the
same.

---

### `extract-only`

Move only the explicitly identified responsibility into the requested
boundary.

Do not use the extraction as an opportunity to redesign adjacent code,
generalize unrelated behavior, or introduce broader abstractions.

---

### `no-new-files`

Do not create new files unless the task explicitly names or authorizes them.

---

### `no-test-changes`

Do not modify existing test files.

Use only when the current tests already encode the desired behavior and no new
coverage is required.

This rule must never be used to avoid updating tests for an intentionally
changed contract.

---

### `report-conflicts`

When a requested change conflicts with an established invariant, architecture,
test contract, security boundary, or declared scope, identify the conflict
explicitly.

Complete any unambiguous portion that remains valid, but do not invent a
workaround that changes the contract.

---

### `report-short`

Keep the completion report concise.

Include only:

* files changed;
* behavior implemented;
* validation executed;
* deviations or unresolved issues.

---

Rules may be combined:

```text
rules=scope-strict,no-arch,no-git,no-install,report-short
```

Use restrictive combinations when the execution environment benefits from a
tightly bounded task.

For agents capable of broader reasoning, prefer only the restrictions that are
actually necessary for the checkpoint.

---

# 27. Context and Execution Discipline

Use reasoning where it improves correctness, but do not spend context
rediscovering decisions that the task or repository already establishes.

For continuation work:

1. inspect the current worktree and relevant implementation first;
2. continue from the existing code rather than reconstructing the feature
   from assumptions;
3. treat accepted architectural decisions as constraints unless the task
   explicitly reopens them;
4. inspect adjacent code when it is useful to understand contracts or direct
   consequences;
5. avoid broad repository exploration when the relevant boundary is already
   clear;
6. distinguish between a local implementation choice and a genuine
   architectural decision.

Deep reasoning is encouraged for:

* implementation quality;
* debugging;
* edge cases;
* concurrency;
* lifecycle behavior;
* asynchronous behavior;
* cleanup;
* integration consequences;
* maintainability within established boundaries.

Do not use additional reasoning as justification for unrelated redesign.

When the task already establishes a contract, spend reasoning on implementing
and validating that contract rather than repeatedly proposing alternatives.

When a genuine architectural conflict appears:

1. complete any unambiguous work that remains valid;
2. identify the exact conflict;
3. explain its consequences;
4. stop before silently changing the frozen architecture.

A task should not be artificially fragmented merely to prevent an agent from
making ordinary local engineering decisions.

At the same time, checkpoints should remain coherent and reviewable. Prefer a
small complete responsibility over a broad bundle of loosely related changes.

---

# 28. Validation, Git, and Completion Reporting

Validation should be proportional to the risk and surface area of the change.

The goal is not to run every available command after every edit. The goal is
to obtain sufficient evidence that the requested behavior is correct and that
the patch did not introduce relevant regressions.

## 28.1 Validation principles

Run the most relevant focused validation first.

Examples include:

* focused unit tests for the affected behavior;
* package or application typecheck;
* focused linting;
* integration tests for affected boundaries;
* build validation when bundling, framework behavior, or runtime integration
  may be affected.

Run broader validation when:

* the change crosses multiple modules;
* shared contracts changed;
* persistence or protocol behavior changed;
* the affected code has wide reuse;
* focused validation cannot provide sufficient confidence;
* the task explicitly requests it.

Do not run expensive validation merely by habit when it adds no useful signal.

Never report a test, typecheck, lint, or build as passing unless the command
was actually executed successfully.

## 28.2 Tests are evidence

Existing tests are evidence of established contracts.

Do not weaken, delete, or rewrite valid expectations merely to obtain a green
suite.

Tests may be changed when:

* the requested behavior intentionally changes the contract;
* new behavior requires new coverage;
* an existing test is demonstrably incorrect relative to the accepted
  architecture or product requirement.

When implementation and a valid requirement test disagree, fix the
implementation.

Do not reproduce production logic inside tests merely to make both sides agree.

## 28.3 Validation failures

When validation fails:

1. determine whether the failure was introduced by the current change;
2. fix failures caused by the current patch when the fix remains within the
   accepted architecture and task intent;
3. distinguish pre-existing failures from patch regressions;
4. do not broaden the feature merely to obtain an all-green repository;
5. report unresolved or unrelated failures clearly.

A failing command must not be described as passing because the failure appears
unrelated.

## 28.4 Typical validation

For narrow Studio work, useful commands may include:

```bash
pnpm --filter @powershow/studio test -- <focused-test>
pnpm --filter @powershow/studio typecheck
git diff --check
```

For broader Studio work:

```bash
pnpm --filter @powershow/studio test
pnpm --filter @powershow/studio typecheck
pnpm --filter @powershow/studio lint
pnpm --filter @powershow/studio build
git diff --check
```

Use repository or package-specific commands appropriate to the affected area.

The task may explicitly define a smaller or larger validation set.

## 28.5 Git behavior

Unless a task explicitly authorizes Git write operations, implementation
agents must leave changes uncommitted.

Do not:

* stage;
* commit;
* push;
* merge;
* rebase;
* amend;
* stash;
* reset;
* restore;
* switch branches;
* rewrite history.

Read-only commands are allowed and encouraged when they help understand or
review the current worktree, including:

```bash
git status
git diff
git diff --check
git log
git show
git branch --show-current
```

The user or explicitly authorized workflow remains responsible for checkpoint
commits, pushes, pull requests, and merges.

## 28.6 Diff discipline

Before completion, inspect the resulting diff.

Check for:

* unintended files;
* unrelated formatting;
* accidental generated files;
* debug output;
* temporary code;
* weakened tests;
* unexpected dependency changes;
* accidental secrets;
* unnecessary scope expansion.

Use:

```bash
git diff --check
```

when appropriate to detect whitespace errors.

A correct implementation with an unnecessarily broad diff should be narrowed
when practical.

## 28.7 Completion report

At the end of an implementation task, report concisely:

```text
changed:
- <files created or modified>

implemented:
- <actual behavior delivered>

local-decisions:
- <relevant implementation choices, only when useful>

validation:
- <command>: PASS|FAIL
- <command>: PASS|FAIL

deviations:
- none
```

If applicable, also report:

```text
unresolved:
- <specific issue>

out-of-scope:
- <necessary follow-up intentionally not implemented>
```

Do not repeat the entire task specification or provide a long architecture
summary unless the result revealed something that materially changes the next
step.

For review-only tasks, report findings rather than pretending implementation
occurred.
