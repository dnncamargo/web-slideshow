# PowerShow — Current Handoff

This handoff records the operating workflow and the project state at the end of the current refinement cycle. It is a navigation document, not a competing source of truth.

**Authority order when evidence conflicts:**

```text
current code in main
→ tests
→ canonical contracts / renderer ownership
→ ROADMAP / README / this handoff
→ historical branches / old handoffs / memory
```

Always revalidate the remote repository before starting work.

---

# 1. Baseline at handoff creation

Repository:

```text
dnncamargo/web-slideshow
```

Current `main` observed while this handoff was created:

```text
41128d06965a2f6751b11c774219c9348a832114
```

The product-code baseline immediately after Maintenance PR #127 is:

```text
dfcef0b4ea67d1940d3b5efdc308dd20588f5d07
```

`41128d...` is two housekeeping commits ahead but has no file diff from `dfcef0b4...`; a temporary file was accidentally created and immediately removed without history rewriting. Future work must use the real fetched `origin/main`, not either SHA from memory.

Recent merged product PRs:

```text
#125  Typography Style usage / associations
#126  Image + element-delete ergonomics
#127  Maintenance PowerShow Suite chrome
```

Do not assume a historical feature branch remains aligned after these squash merges.

---

# 2. Product architecture

Current product surfaces:

```text
PowerShow
│
├── Public Portal        /
│
├── Studio               authenticated
│   ├── Library          /studio/library
│   ├── Editor           /studio/editor
│   └── Control          /studio/control
│       └── Maintenance  /studio/control/maintenance
│
└── Live Runtime         public
    ├── Player
    ├── Watch            /watch
    ├── Demo             /demo
    └── Cover            /cover
```

Canonical names:

- PowerShow
- PowerShow Library
- PowerShow Editor
- PowerShow Control
- PowerShow Player
- PowerShow Watch

Do not use “PowerShow Studio Library/Editor/Control” as product names.

Responsibility split:

```text
Presentation schema  = canonical authored document
Studio UI            = transient authoring state + canonical writes
Firestore draft      = private persisted draft metadata/content
Published version    = immutable self-contained Presentation snapshot
RTDB Live            = transient runtime/operator state
shared renderer      = semantic visual/runtime rendering
Player               = real projection
Watch                = actual audience follower
Control              = operator intent
Maintenance          = bounded operational evidence/recovery
Custom Library       = private reusable masters; never Player dependency
```

---

# 3. Permanent architectural invariants

- `schemaVersion` remains literally `1`.
- Do not create schema v2, migration, dual-schema readers or compatibility aliases without an explicit separately approved requirement.
- Zod schemas remain strict and responsibility-specific.
- One canonical representation per authored intention is preferred.
- Studio transient state does not enter the canonical Presentation.
- Published versions are immutable and self-contained.
- Player never depends on private Custom Library data.
- Shared renderer ownership must be reused across Editor preview / Player / Watch where applicable.
- `textbox` is not canonical; boxed text is `Container + Text`.
- Hierarchy is the nested document tree; do not introduce `parentId`/parallel ordering models.
- Flow is the absence of authored absolute positioning; absolute positioning uses the canonical layout contract.
- Fix shared-infrastructure bugs at the shared owner rather than patching each surface.
- Avoid speculative abstractions, compatibility layers, dependencies and runtime protocols.

Guiding principle:

> O simples é o mais alto grau de sofisticação.

---

# 4. Mandatory working method

Every meaningful/structural feature follows:

```text
AUDIT
→ EVIDENCE
→ DECISION
→ IMPLEMENT
→ TEST
→ REMOTE REVIEW
→ MANUAL ACCEPTANCE when needed
→ PR / MERGE
```

## 4.1 AUDIT

Before implementation:

1. fetch the real remote state;
2. confirm branch, HEAD, `origin/main`, merge-base and clean worktree;
3. read root `AGENTS.md`;
4. locate current owners in code/tests/contracts;
5. verify whether the capability already exists;
6. identify existing abstractions/protocols to reuse;
7. inspect relevant visual/runtime surfaces;
8. identify security/persistence boundaries before changing them.

Never start from an old handoff’s SHA as if it were guaranteed current.

## 4.2 EVIDENCE

Collect concrete evidence from:

- canonical schema;
- renderer;
- Studio authoring owner;
- Player/Control/RTDB where relevant;
- existing tests;
- current browser/manual behavior;
- remote branch ancestry/diff.

Tests are evidence, not proof of visual browser behavior. A previous Delete→Enter checkpoint passed automated tests while failing in the real browser; manual evidence correctly overruled the test design.

## 4.3 DECISION

Freeze the smallest correct contract before editing.

Explicitly state:

- ownership;
- invariants;
- scope;
- non-goals;
- test contract;
- manual acceptance contract;
- Git baseline/branch.

Do not let implementation agents invent architecture when the decision can be reduced first.

## 4.4 IMPLEMENT / TEST

Prefer small checkpoints and WIP commits.

Use semantic regression tests. Avoid brittle full snapshots and literal CSS-source assertions when stable DOM/state behavior can prove the contract.

Visual layout remains a manual acceptance gate.

## 4.5 REMOTE REVIEW

Never approve from an agent report alone.

After push, inspect the actual remote:

```text
branch HEAD
parent / merge-base
main...head diff
changed files
core implementation
focused tests
CI/check state where available
```

If the report and remote differ, the remote wins.

---

# 5. Agent / Git operating contract

## ChatGPT / Sol responsibility

- understand system architecture;
- freeze invariants and reduce scope;
- define checkpoints;
- write narrow GPT/OpenCode prompts;
- review actual remote code/diffs;
- preserve roadmap coherence;
- separate blockers from backlog;
- approve only after evidence.

## GPT/OpenCode responsibility

- perform directed reading;
- implement the approved checkpoint;
- run focused tests;
- perform explicitly authorized Git actions;
- report conflicts rather than inventing repairs/architecture.

Every GPT/OpenCode work-area prompt should explicitly say:

```text
NEW GPT/OpenCode SESSION
```

or:

```text
REUSE GPT/OpenCode SESSION
```

and should tell GPT/OpenCode to read/reconfirm root `AGENTS.md`.

Do **not** instruct GPT/OpenCode to read `DS.RULES.md`.

## Git safety

Normal safe flow:

```text
git status --short
git branch --show-current
git fetch origin --prune
git rev-parse HEAD
git rev-parse origin/main
```

Use explicit staging only.

Never:

```text
git add .
git add -A
```

Do not reset, rebase, amend, stash, clean, force-push, delete branches or rewrite history unless the user explicitly authorizes that exact action.

Unexpected dirty/divergent state or fetch failure:

```text
STOP + REPORT
```

Do not “repair” it automatically.

Squash merge is normal for approved feature PRs. Preserved feature branches naturally diverge after squash; do not reset/rebase them merely to make history look linear.

---

# 6. Current merged state

## Canonical / persistence / Live

- strict canonical Presentation, `schemaVersion: 1`;
- shared renderer;
- Firestore private drafts;
- `presentationJson` serialization boundary with parse + schema validation;
- immutable published versions;
- RTDB Live activation/navigation;
- desired/applied slide convergence and ACK;
- version promotion while Live;
- private Notes sidecar;
- Watch follows actual Player-applied state;
- Public Portal / Cover split.

## Gallery

Gallery V1 is merged and closed as the current first slice:

- semantic ordered media frame;
- Studio item authoring;
- local Player next/wrap/expanded behavior;
- one-way Control desired state through `live/galleryControl/<slot>`;
- no Gallery ACK or Player→Control sync.

## Blocks

Blocks is merged and closed:

```text
source:string
→ handwritten parser
→ transient AST
→ static shared renderer
```

No compiler/interpreter/runtime execution exists.

## Typography / Linked Styles

PR #125 added:

- real Text Style usage locations;
- click-to-select associated Text;
- usage count for fundamental/custom styles;
- target-aware Text/Container association copy;
- correct detached predicate:

```text
element.type === "text"
&& element.variant === textStyleId
&& element.styleDetached !== true
```

- detached Text excluded from usage/removal safety;
- impact-confirmed Reset for fundamental Text Styles.

Linked Styles remain Presentation-local Container relationships; Text Style and Linked Style contracts are not interchangeable.

## Editor ergonomics

PR #126 added:

- Image `Preserve proportion` checkbox on the left;
- Image Inspector order:

```text
Source
Size
Appearance
Effects
Interaction
```

- element deletion confirmation with initial focus on the native destructive button, enabling real browser `Delete → Enter` without a custom global Enter shortcut.

## Maintenance

PR #127 added the final PowerShow Suite chrome:

```text
PowerShow Control                    <<< Back to presentation

Maintenance & Diagnostics
```

Maintenance uses Suite tokens, square diagnostic cards and existing bounded Recovery behavior.

---

# 7. Unmerged branch to remember

The following branch was reviewed but is not merged:

```text
fix/editor-resource-control-polish
43eb5641a62477d2ea3199f792f27c88301c292f
```

Observed contents:

- Container `Preserve size` checkbox on the left;
- `+ Add Linked Style` using shared `resourceAction` styling;
- intrinsic `+ Add Style`;
- `Apply to selected` / `Aplicar à seleção` using the shared Resources action visual;
- Text Styles count pill using `listPresentationTextStyles(...).length`;
- CSS-specificity cleanup so embedded Apply exclusively receives the external resource-action style while Retry/non-embedded picker actions keep their local fallback.

Important: this branch was based on the pre-Maintenance `main`. Before integrating it:

```text
fetch
→ compare real current main...branch
→ inspect conflicts/overlap
→ choose a safe integration path
```

Do not assume it can be merged/cherry-picked unchanged.

---

# 8. Active next work area — Scripted enhancement

Scripted is already implemented. Do **not** create a new Scripted element or parallel runtime.

## Current canonical contract

Audited in `packages/document-schema/src/elements.ts`:

```text
ScriptedElement
├── id
├── hidden
├── layout?
├── style?
├── effect?
├── type: "scripted"
├── title        required, default "Scripted content"
├── html         string
├── css          string
└── script       string
```

## Current Studio authoring

`scripted-inspector.tsx` already provides local drafts for:

```text
title
html
css
script
```

Important behavior:

- typing does not write canonical state on every keystroke;
- drafts hydrate per selected element/canonical values;
- **Apply / Run** performs one canonical update for all authored source fields;
- Reset only resets local drafts;
- the Inspector never executes authored JavaScript itself.

Do not regress this lifecycle while adding interaction authoring.

## Current renderer/security boundary

`render-scripted.ts` owns a fixed sandboxed iframe:

```text
sandbox="allow-scripts"
referrerpolicy="no-referrer"
fixed renderer CSP
```

The renderer:

- denies same-origin;
- denies network connections;
- denies nested frames/objects/forms/top navigation;
- exposes no storage/Firebase/session access;
- transports authored HTML/CSS/script as encoded data;
- inserts them using a fixed renderer bootstrap;
- does not use `eval`, `Function`, `document.write` or string timers.

These are permanent safety invariants unless a separately approved security design explicitly changes them.

## Desired enhancement direction — not yet frozen schema

The next product direction is controlled Scripted interactivity driven from Control without exposing PowerShow internals to authored code.

Conceptual controls:

```text
{ stable id/name, operator label, kind }

kind:
- action
- boolean state
```

Candidate V1 examples:

```text
action:
  scroll up
  scroll down
  reset
  next step

boolean state:
  switch on/off
  play/paused
  visible/hidden
```

This declaration shape is conceptual. S0/S1 must audit/freeze the actual minimal canonical contract before implementation.

## Planned bridge direction

Conceptually:

```text
Control intent
→ Scripted-specific RTDB command/state
→ Player validates active presentation/version/page/slot/element/control
→ Player postMessage to mounted Scripted iframe
→ authored script handles only the fixed Scripted API
→ optional explicit state report via postMessage
→ Player validates event.source + strict envelope
→ Control observes valid state where required
```

The bridge must not become:

- parent DOM access;
- arbitrary RPC;
- Firebase access from the sandbox;
- code delivery through RTDB;
- application/session token exposure;
- a generic event bus.

Runtime state belongs to the active Player/mount, not to persisted Presentation state.

Delayed/stale commands must be rejected across activation/version/page/element/remount changes.

## Scripted checkpoint plan

```text
S0 — audit real current Scripted + Player lifecycle + tests
S1 — freeze action/boolean declaration contract
S2 — fixed sandbox bridge / message API / source validation
S3 — Studio declaration authoring
S4 — RTDB + Player routing + Firebase rules
S5 — contextual Control UI + state/pending semantics
S6 — classic scroll/circuit acceptance + security hardening
```

Always review the remote SHA after each checkpoint before issuing the next.

---

# 9. Next after Scripted — Embed adjustments

Embed is also an existing minimum element, not a new feature family.

## Current canonical contract

```text
EmbedElement
├── id
├── hidden
├── layout?
├── style?
├── effect?
├── type: "embed"
├── src      absolute http/https URL
└── title    required, default "Embedded content"
```

## Current Studio authoring

`embed-inspector.tsx`:

- edits `src` and `title` through local drafts;
- commits valid values on blur/Enter;
- Escape restores canonical value;
- invalid absolute HTTP(S) URL does not enter canonical state;
- sandbox/Permissions Policy are intentionally not authorable.

## Current renderer policy

`render-embed.ts` owns:

```text
sandbox="allow-scripts allow-forms allow-same-origin"
allow="fullscreen"
referrerpolicy="strict-origin-when-cross-origin"
loading="lazy"
```

This supports practical external providers but the combination `allow-scripts + allow-same-origin` is security-sensitive, especially for same-origin URLs. Treat that as a renderer/security audit question, not an invitation to expose sandbox tokens in the Presentation.

## Embed execution plan

Begin with E0 evidence from real provider/use cases:

```text
E0 — audit concrete Embed failures/needs and security boundary
E1 — freeze renderer vs authoring responsibilities
E2 — targeted renderer/provider corrections
E3 — Studio UX adjustments if justified
E4 — Player/Watch/manual provider acceptance
```

Questions for E0:

- Which providers/URLs fail today?
- Do failures come from sandbox, referrer, Permissions Policy, provider URL format, sizing or provider-side frame restrictions?
- What behavior differs on Player versus Editor preview/Watch?
- Is same-origin Embed necessary?
- Is provider-specific URL normalization useful without making provider details canonical?
- Which permissions are actually required?
- Can the generic canonical `{src,title}` contract remain unchanged?

Do not broaden permissions before reproducing a concrete requirement.

---

# 10. Explicitly deferred

## publishNow

The proposed URL mode:

```text
/studio/editor?id=<presentationId>&publishnow=true
```

was discussed and deliberately postponed before implementation. Do not add deferred-revision metadata, hot Live snapshots, Control bypass or Player changes unless the user explicitly resumes it.

## Chart

Chart exists canonically with semantic line/bar/area/scatter data but rendering remains placeholder. The user explicitly deferred Chart. Do not select a library or change the schema until promoted again.

## Topics as Typography Style consumer

A future concept was discussed because detached Topic content Text can hold local typography while the Topics marker remains driven by Topics typography. A possible future direction is:

```text
Typography Style
→ Topics base typography / marker + normal content
→ individual local Text override
```

This is **not implemented or frozen**. Do not change Topics defaults/import semantics incidentally.

## Other future work

- Production Readiness;
- Player offline continuity;
- Audience/Watch expansion;
- Diagnostics D3 only from concrete needs;
- broader WYSIWYG/Editor backlog;
- configurable transitions;
- Undo/Redo;
- AI Import.

---

# 11. Validation baseline

Recent focused checkpoints repeatedly reported the same eight unrelated Studio typecheck failures around Gallery/ElementTree tests.

Do not assume they still exist forever.

For every new checkpoint:

1. run typecheck;
2. record exact failures;
3. compare against current `origin/main` if needed;
4. classify baseline versus introduced;
5. do not fix unrelated baseline errors inside a narrow feature.

The same rule applies to test failures and CI/deploy issues.

---

# 12. Next-session startup checklist

For the next Scripted session:

```text
1. git status --short
2. git branch --show-current
3. git remote -v
4. git fetch origin --prune
5. git rev-parse HEAD
6. git rev-parse origin/main
7. verify clean worktree
8. read/reconfirm root AGENTS.md
9. inspect current Scripted schema/Inspector/renderer/tests
10. inspect Player active-slide iframe lifecycle
11. inspect Control/RTDB precedents and database.rules.json
12. produce S0 evidence only
13. freeze S1 only after S0 review
```

If the local checkout is on a historical branch, do not automatically reset/rebase it. Report the state and create the correct new work area from the current remote main when authorized.

---

# 13. What the next agent must not do

Do not:

- resume `publishNow`;
- implement Chart;
- turn Topics into a Typography Style consumer;
- invent a Scripted compatibility layer;
- weaken Scripted sandbox security;
- expose Firebase/session/application DOM to Scripted code;
- make Embed sandbox tokens authorable without an approved security contract;
- create a generic Control RPC/event bus;
- reopen Blocks/Gallery architecture without concrete evidence;
- assume `fix/editor-resource-control-polish` is merged;
- trust this handoff more than the real current code.

Start with the real repository, then narrow the next checkpoint.