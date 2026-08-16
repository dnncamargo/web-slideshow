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

PSAP/1 is the compact execution protocol used for agent tasks in PowerShow.

Its purpose is to minimize repeated prompt context while keeping implementation
scope, architecture, tests, and repository behavior under strict control.

This protocol does not replace the architectural rules in this file.
It assumes the agent has read and follows all preceding sections of `AGENTS.md`.

---

## 25.1 Task header

A task should normally begin with:

```text
PSAP/1
mode=<patch|implement|decide|review>
model=<DS|TD|TP>
scope=<files-or-area>
validate=<profile-or-commands>
rules=<optional-task-specific-rules>
```

Optional fields:

```text
base=<commit-or-current>
```

Model tags are advisory:

```text
DS = DeepSeek V4 Flash
TD = GPT-5.6 Terra Default
TP = GPT-5.6 Terra Pro
```

The model tag does not grant architectural authority.

`DS` should normally be used for narrow, mechanical, already-decided work.

`TD` or `TP` may be used when the task explicitly requires broader reasoning,
but architecture is still controlled by `mode` and by the task contract.

---

## 25.2 Default execution contract

Unless a task explicitly overrides a rule below, every PSAP/1 task inherits
these defaults.

These defaults do not need to be repeated in individual prompts.

### Closed scope

The declared `scope` is a closed modification boundary.

The agent must:

* modify only files explicitly included in scope;
* treat a scoped directory as permission only for files genuinely required by
  the stated goal;
* avoid modifying adjacent files merely because they appear related;
* avoid creating helper files unless the task explicitly permits them;
* avoid renaming or moving files unless explicitly requested;
* stop the conflicting part and report it if the requested change requires
  leaving scope.

The agent must never silently broaden scope.

### Minimal delta

Implement the smallest code change that satisfies the stated goal and
invariants.

Do not perform unrelated cleanup while touching a file.

Do not change code merely because another implementation appears cleaner,
newer, more generic, or more elegant.

A successful patch is measured by correctness and narrowness, not by how much
surrounding code was improved.

### No opportunistic refactoring

Unless explicitly requested, do not:

* reorganize modules;
* rename unrelated symbols;
* split unrelated components;
* merge unrelated components;
* introduce new abstractions;
* generalize code for possible future requirements;
* replace established patterns;
* reorder unrelated code;
* reformat unrelated regions;
* rewrite working code for style;
* move code outside the requested extraction boundary;
* refactor another subsystem encountered during implementation.

If the task asks for an extraction, move only the specified responsibility.

An extraction is not permission to redesign the surrounding architecture.

### Preserve behavior by default

Unless the task explicitly requests a behavior change, all behavior outside the
stated delta must remain unchanged.

Preserve existing:

* public APIs;
* component contracts;
* UI markup;
* labels and translations;
* CSS behavior;
* routing;
* persistence behavior;
* publication semantics;
* authentication and authorization behavior;
* Live protocol behavior;
* renderer ownership;
* loading behavior;
* error behavior;
* timing behavior;
* debounce behavior;
* scheduling behavior;
* cleanup behavior.

Do not bundle product improvements into a behavior-neutral implementation task.

### Architecture is frozen unless delegated

`mode=patch` and `mode=implement` do not grant architectural authority.

The agent must not independently change:

* document schema or schema versions;
* persistence boundaries;
* Firebase architecture;
* Firestore paths;
* publication/version architecture;
* authentication architecture;
* authorization boundaries;
* Studio/Player separation;
* public/private data boundaries;
* Live protocol semantics;
* ACK semantics;
* renderer ownership;
* canonical state ownership;
* established feature/module boundaries.

If implementation exposes an unresolved architectural decision:

1. implement any unambiguous portion that remains inside the task contract;
2. stop before making the architectural decision;
3. report the decision point.

Only `mode=decide` explicitly delegates an architectural decision.

### Existing implementation is the starting point

For continuation and checkpoint work:

1. inspect the current worktree before editing;
2. inspect the relevant existing implementation before proposing changes;
3. treat previously accepted architecture as frozen;
4. continue the current implementation instead of rebuilding it from another
   design;
5. do not re-solve decisions already made;
6. preserve existing WIP unless the task explicitly replaces it;
7. keep the diff narrow.

Do not discard an existing implementation simply because another approach
would also work.

### Tests are contract evidence

Existing tests must not be weakened merely to make an implementation pass.

When a test expectation represents:

* an explicit task requirement;
* an established PowerShow invariant;
* documented existing behavior;
* behavior intentionally preserved by a behavior-neutral task;

the implementation must be fixed instead of changing the expectation.

Do not:

* delete failing assertions to obtain green tests;
* replace strict expectations with weaker expectations;
* redefine expected behavior to match an incorrect implementation;
* remove edge-case coverage because the implementation does not support it;
* rewrite a test simply because production code changed shape;
* duplicate production logic inside a test to manufacture agreement.

A test may be changed when:

* the task explicitly changes the behavior it covers; or
* the test is demonstrably incorrect relative to the frozen contract.

If there is uncertainty, report the conflict instead of silently redefining
the behavior.

### Dependencies

Do not install packages or add dependencies unless explicitly authorized.

Do not introduce a new test library, state library, utility package, or runtime
dependency merely to complete a checkpoint.

Prefer the libraries and patterns already used in the repository.

### Git

Agents leave implementation uncommitted unless a task explicitly says
otherwise.

Do not:

* stage files;
* commit;
* push;
* merge;
* rebase;
* switch branches;
* checkout another branch;
* stash;
* reset;
* restore files;
* amend commits;
* alter Git history.

Read-only Git commands are allowed when useful, including:

```text
git status
git diff
git diff --check
git log
git show
git branch --show-current
```

### Conflict rule

Never reinterpret a requirement merely to make implementation easier.

If the requested change conflicts with:

* the declared scope;
* an established invariant;
* existing architecture;
* an existing test that encodes required behavior;
* a public/private boundary;
* a protocol contract;

do not resolve the conflict by broadening scope or redefining behavior.

Stop the conflicting portion and report the conflict explicitly.

---

## 25.3 Modes

### `mode=patch`

Use when the exact semantic change is already decided.

The agent acts as a narrow executor.

The agent may:

* apply the stated delta;
* resolve direct syntax consequences;
* resolve direct TypeScript consequences;
* update imports directly caused by the patch;
* update tests directly covering the changed contract when authorized.

The agent may not:

* redesign the surrounding code;
* create additional abstractions unless explicitly requested;
* expand the feature;
* improve adjacent behavior;
* make architectural decisions.

Prefer this task shape:

```text
PSAP/1
mode=patch
model=DS
scope=<exact files>
validate=<profile>

goal:
<one precise outcome>

change:
- <required delta>
- <required delta>

keep:
- <behavior/invariant that must not change>

expected-semantic-difference:
<none or exact intended difference>
```

For extraction tasks, prefer:

```text
rules=extract-only,behavior-neutral
```

---

### `mode=implement`

Use when architecture and product behavior are already decided, but a bounded
implementation still needs to be created.

The agent may choose local implementation details only when those choices do
not alter the declared architecture, external contract, or established module
boundaries.

Prefer this shape:

```text
PSAP/1
mode=implement
model=DS
scope=<files-or-bounded-area>
validate=<profile>

goal:
<implementation outcome>

inputs:
- <existing inputs/contracts>

outputs:
- <required outputs/files/API>

invariants:
- <must remain true>
- <must remain true>

implementation:
- <required responsibility>
- <required responsibility>

keep:
- <existing behavior that must remain unchanged>
```

Do not use `mode=implement` as permission for exploratory redesign.

If architecture is not sufficiently decided, stop at the unresolved decision
instead of inventing it.

---

### `mode=review`

Use for inspection, code review, architecture mapping, or checkpoint analysis
where no files should be modified.

The agent must not edit files.

Prefer this shape:

```text
PSAP/1
mode=review
model=DS
scope=<area to inspect>

goal:
<what must be understood>

inspect:
- <specific concern>
- <specific concern>

report:
- <specific requested findings>
```

Review tasks should prefer concrete findings from the current repository over
generic recommendations.

Do not propose unrelated refactors.

If asked to identify an implementation path, distinguish clearly between:

* reuse unchanged;
* extraction required;
* new code required;
* architectural conflict.

---

### `mode=decide`

Use only when the task explicitly delegates an architectural decision.

Do not infer `mode=decide` merely because implementation is difficult.

Prefer:

```text
PSAP/1
mode=decide
model=<TD|TP>

problem:
<decision to make>

constraints:
- <frozen constraint>
- <frozen constraint>

known-options:
- <option>
- <option>

decision-required:
<exact decision>
```

The result must:

1. state the chosen option;
2. explain the relevant tradeoff;
3. state resulting invariants;
4. identify the implementation boundary;
5. avoid implementing unrelated work unless explicitly requested.

Architecture decided in `mode=decide` becomes frozen for subsequent
`mode=implement` and `mode=patch` checkpoints unless later explicitly revised.

---

## 25.4 Compact rule tokens

`rules=` is for restrictions that are specific to the current checkpoint.

Do not repeat defaults from section 25.2 unnecessarily.

### `extract-only`

Move only the explicitly identified responsibility into the requested
boundary.

Do not:

* perform adjacent cleanup;
* redesign the code;
* extract additional responsibilities;
* rename unrelated APIs;
* introduce generalized infrastructure.

### `behavior-neutral`

No externally observable behavior may change beyond the explicitly stated task
delta.

Existing UI, protocol, persistence, timing, error, and cleanup behavior must
remain unchanged.

### `no-new-files`

Do not create files beyond those explicitly listed in scope.

### `no-test-changes`

Production code may change, but existing test files must remain unchanged.

Use only when existing tests already represent the desired contract and no new
coverage is required.

### `report-conflicts`

If any part of the requested change cannot be completed without violating the
declared scope or invariants, leave that part unchanged and report the conflict.

Do not invent a workaround outside the contract.

---

## 25.5 Validation profiles

When `validate=` references a named profile, the agent must run the commands in
that profile unless a command is unavailable or clearly unrelated.

Do not claim a validation passed unless it was actually executed.

### `studio-check`

Run:

1. Studio typecheck;
2. existing focused tests relevant to the changed area, when such tests exist;
3. full Studio test suite;
4. focused eslint for changed Studio source files when practical;
5. `git diff --check`.

Typical commands:

```text
pnpm --filter @powershow/studio typecheck
pnpm --filter @powershow/studio test
git diff --check
```

Use existing focused Vitest commands where appropriate.

Do not introduce new testing infrastructure to satisfy this profile.

### `focused-check`

Run only:

1. typecheck for the affected package/app when applicable;
2. relevant focused tests;
3. `git diff --check`.

Use for narrow mechanical checkpoints where the task explicitly does not
require the full suite.

### `diffcheck`

Run:

```text
git diff --check
```

Use only for changes where broader execution validation is explicitly
unnecessary.

---

## 25.6 Validation behavior

When validation fails:

1. determine whether the failure was introduced by the current patch;
2. fix failures caused by the current patch when the fix remains in scope;
3. do not fix unrelated pre-existing failures;
4. report unrelated pre-existing failures separately;
5. do not broaden scope merely to obtain an all-green repository.

If a focused test reveals that implementation violates a task invariant, fix
the implementation.

Do not weaken the test.

---

## 25.7 Final report

For `mode=patch` and `mode=implement`, keep the final report concise.

Report:

```text
changed:
- <files>

implemented:
- <actual completed delta>

validation:
- <command>: PASS|FAIL
- <command>: PASS|FAIL

diff-check:
PASS|FAIL

semantic-deviation:
none
```

If there is a conflict or incomplete portion, add:

```text
conflict:
- <exact unresolved issue>
```

Do not repeat the entire prompt or provide a long architecture recap.

For extraction checkpoints, also report the net line change in the original
file when useful.

---

## 25.8 DeepSeek execution guidance

When `model=DS`, assume the architecture and contract are already decided
unless `mode=review` is used for inspection.

DeepSeek should prefer:

* literal interpretation of the requested delta;
* existing repository patterns;
* narrow diffs;
* direct code reuse;
* local implementation over generalized infrastructure;
* compiler/test feedback for mechanical corrections.

DeepSeek must not compensate for uncertainty by:

* broadening scope;
* redesigning architecture;
* adding abstractions;
* changing tests to match its implementation;
* creating fallback behavior not requested;
* performing unrelated cleanup.

When uncertain about a requirement, preserve existing behavior and report the
uncertainty instead of inventing a new contract.

For PowerShow, a smaller correct patch is preferred over a broader
architecturally ambitious patch.

---

## 25.9 Prompt minimization principle

PSAP/1 prompts should describe the checkpoint delta, not repeat repository
policy.

A good task prompt should normally contain only:

```text
PSAP/1
mode=
model=
scope=
validate=
rules=

goal:

change: / implementation: / inspect:

keep:

expected-semantic-difference:
```

Do not repeat rules already defined by PSAP/1 unless the task requires an
exception or unusually important emphasis.

Example:

```text
PSAP/1
mode=patch
model=DS
scope=
  apps/studio/src/features/control/control-page.tsx
  apps/studio/src/features/control/use-live-session-control.ts
validate=studio-check
rules=extract-only,behavior-neutral

goal:
Extract the existing Studio Control Live lifecycle into
useLiveSessionControl.

change:
- move live/current subscription lifecycle
- move activation-scoped ACK subscription lifecycle
- move LiveControl creation/destruction
- move command writer wiring
- expose existing previous/next actions
- expose existing send-failure state

keep:
- ControlPage JSX
- current UI behavior
- existing LiveControl semantics
- existing ACK semantics

expected-semantic-difference:
none
```

This is the preferred PSAP/1 style for narrow DeepSeek checkpoints.

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
