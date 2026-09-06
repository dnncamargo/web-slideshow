# PowerShow Roadmap

This document records the **PowerShow execution path from the canonical-document foundation to the current work area**.

Merged code in `main` remains authoritative. Every new work area begins by revalidating the real repository state.

## Status legend

- ✅ complete / merged
- 🟡 useful operational base complete; future expansion exists
- ← NEXT current planned execution area
- planned future checkpoint
- deferred intentional backlog/future work

## Execution policy

PowerShow uses audit-first, checkpoint-driven development:

```text
AUDIT current code
→ collect EVIDENCE
→ freeze the smallest DECISION
→ IMPLEMENT narrowly
→ TEST
→ inspect the real remote SHA / diff / files
→ manual acceptance when visual/runtime behavior requires it
→ PR / merge
→ return local repository to updated main
```

Core rules:

- `schemaVersion` stays literally `1`;
- no migration, dual schema, compatibility layer or generic abstraction without a concrete requirement;
- current code in `main` is the first authority for implementation details;
- tests are contractual evidence but do not replace manual visual/runtime acceptance when acceptance is required;
- search/reuse existing ownership before creating another state, protocol or abstraction;
- branch names and historical SHAs are evidence only — always fetch and revalidate;
- completed architecture should not be reopened speculatively.

### Post-merge closure — mandatory

After every PR + merge:

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

Do not begin a new work area or create a new feature branch from a stale local `main`. If fetch/switch/pull fails or the worktree is unexpectedly dirty, stop and report instead of repairing history automatically.

---

# P0–P8 — Foundation history ✅

## P0 — Canonical document foundation ✅

Reference: PR #2.

Established strict `@powershow/document-schema`, recursive semantic elements, runtime validation and `schemaVersion: 1`.

## P1 — Renderer and Player foundation ✅

References: PRs #3–#5.

Established the shared rendering boundary:

```text
canonical Presentation
→ shared renderer
→ Studio preview / Player runtime
```

## P2 — Studio Editor V0 ✅

References: PRs #6–#13.

Delivered the first visual authoring shell, slide CRUD/navigation, recursive element selection/update, inspectors, presets and localization.

## P3 — Visual authoring vocabulary ✅

References: PRs #14–#29.

Expanded typography, gradients, fonts, reusable colors, Image sizing and style authoring.

## P4 — Hierarchy, positioning and Canvas authoring ✅

References: PRs #30–#38.

Delivered Container Flow/Stack, hierarchy operations, Canvas move/resize, Image proportional resize and focal authoring.

Canonical placement after later cleanup:

```text
Flow
→ no authored layout.position

Absolute
→ layout.position: "absolute"
→ direct top/right/bottom/left edges
```

## P5 — Firebase persistence, Library and autosave ✅

References: PRs #39–#41.

Established user-scoped Firestore drafts, Library workflows, repository-backed Editor loading and debounced/explicit save.

## P6 — Immutable publishing ✅

Reference: PR #42.

Existing published versions are immutable.

## P7 — Authentication, public pointer and remote-control base ✅

References: PRs #43–#44.

Delivered Studio authentication, public publication pointer, Control boundary and RTDB remote-navigation base.

## P8 — Live activation and Library entry ✅

References: PRs #45–#46.

Established Library Present / Control / End lifecycle. Publish and Present remain separate operations.

---

# P9 — Live presentation foundation ✅

References: PRs #47–#57 and later hardening.

Delivered Player live entry, immutable-version loading, logical `pageId` navigation, Control desired state, Player applied state / ACK, latency evidence, reconnect convergence, staged publication promotion, private Notes and Watch following actual Player-applied state.

Core flow:

```text
Control desired state
→ RTDB
→ Player applies immutable published state
→ Player applied state / ACK
→ Control + Watch observe convergence
```

---

# P10 — Canonical Authoring & Import Foundation ✅

| Checkpoint | Area | Status | Main references |
|---|---|---:|---|
| P10.1 | Typography & Fonts refinement | ✅ | #58–#59 |
| P10.2 | Links / Interaction | ✅ | #60–#62 |
| P10.3 | ContentSlot foundation | ✅ | #63 |
| P10.4 | Topics | ✅ | #64–#66 |
| P10.5 | Structured Table | ✅ | #73 |
| P10.6 | Inline Text / Rich Text foundation | ✅ | #74 |
| P10.7 | Gallery minimum | ✅ | #75 |
| P10.8 | Embed minimum | ✅ | #76 |
| P10.9 | Blocks + Code semantics | ✅ | #77–#78 |
| P10.10 | Scripted minimum | ✅ | #79 |
| P10.11 | Canonical Contract Cleanup | ✅ | #80–#83 |
| P10.12 | JSON Import / Export | ✅ | #84 |

Permanent P10 invariants include:

- `schemaVersion` remains `1`;
- strict responsibility-specific contracts;
- no universal persisted style bag;
- Player independent of Studio-private resources;
- `textbox` is not canonical; boxed text is `Container + Text`;
- import/export operates directly on the canonical Presentation.

---

# P11 — Resources, Organization & Text Styles ✅

References: PRs #69–#71, #85–#105, with later refinement in PRs #125 and #129.

Delivered shared Studio/Library shell, private folders, Custom Library resources, Presentation-local Palette/FontResources/Text Styles, Linked Styles, refined usage/navigation and compact shared resource actions.

Text Style precedence:

```text
Theme role baseline
→ Text Style
→ local Text override
```

Linked Style precedence:

```text
Theme / defaults
→ Linked Style
→ local Container override
```

---

# P12 — UX / Properties refinement ✅

Delivered shared logical slide geometry, Player/Editor/Presenter/Watch geometry convergence, Palette/gradient corrections, Container overflow/Fit/Preserve size, Image inspector refinements, Delete→Enter confirmation and related authoring polish.

Direct Canvas manipulation inside transformed fitted Containers remains deferred until inverse transformed-authoring geometry is deliberately implemented.

---

# Runtime and product surfaces ✅

```text
PowerShow
│
├── Public Portal        /
├── Studio
│   ├── Library          /studio/library
│   ├── Editor           /studio/editor
│   └── Control          /studio/control
│       └── Maintenance  /studio/control/maintenance
└── Live Runtime
    ├── Player
    └── Watch
```

Canonical product names are PowerShow Library, PowerShow Editor, PowerShow Control, PowerShow Player and PowerShow Watch.

Public Portal / Live Cover is complete; Cover remains static/read-only while Watch follows real Player state.

---

# Gallery V1 ✅

References: PRs #114–#115.

Gallery is one semantic media frame with ordered items. Studio, Player local behavior and one-way Control commands through `live/galleryControl/<slot>` are complete.

---

# Maintenance & Diagnostics — first operational slice ✅

References: PRs #116–#119, #121, Suite-chrome PR #127 and later Player-logs work in PR #134.

Delivered:

- Player presence/current report and boot-scoped leases;
- Control/Maintenance status evidence;
- remote reload;
- same-boot presentation retry;
- real browser-cache clear path;
- Player-local recovery options;
- Maintenance under PowerShow Control;
- remote activation-scoped Player logs mode for already-open Players.

Diagnostics remains bounded. Do not turn it into a generic fleet/admin console or broad automatic repair system.

---

# Persistence serialization hardening ✅

Reference: PR #120.

Firestore persists canonical Presentation content as `presentationJson`, parsed and validated through `PresentationSchema` on read.

---

# Blocks — grammar-based didactic visual authoring ✅

References: PRs #122–#123.

Canonical Blocks persists a single `source` string. A handwritten parser creates transient structure for shared static rendering. Blocks is static/didactic, not executable.

---

# Editor Resource Controls polish ✅

Reference: PR #129.

Merged Preserve size grammar, compact Add/Apply actions, projected Text Styles count and related resource-control polish.

---

# Scripted controlled interaction ✅

Reference: PR #133.

Scripted enhancement is complete and no longer the active queue.

Delivered:

- declared action ports;
- declared boolean and number state ports;
- `input`, `output` and `input-output` direction where applicable;
- Player-owned transient runtime identity;
- strict Player↔sandbox message validation;
- Scripted-specific RTDB input/runtime/report state;
- Control stateful controls generated from declarations;
- desired/reported/pending/divergent semantics;
- retained renderer-owned sandbox and fixed CSP boundary.

Permanent constraints remain:

- no `allow-same-origin` for Scripted;
- no Firebase SDK/tokens/session exposure inside authored code;
- no parent DOM access;
- no top navigation/forms/popups/downloads/storage;
- no `eval` / `Function`;
- no JavaScript payload delivered through RTDB;
- runtime state never persists into the Presentation.

---

# Player presentation options + remote logs ✅

Reference: PR #134.

Delivered:

- slide transition: Fade / Slide / None;
- Player control position;
- Player control style;
- counter On / Off;
- control-bar animation;
- activation-scoped `live/slideTransition`;
- activation-scoped `live/playerControls`;
- activation-scoped `live/playerLogs`;
- Maintenance connected-Player discovery from boot-scoped leases;
- remote logs On/Off without sending arbitrary Player URLs through RTDB.

RTDB rules for these contracts were validated and explicitly deployed.

---

# Mobile Library / Control recovery ✅

Current `main` recovers the previously accepted mobile Library and Control behavior after PR #134.

Current rule:

- compact Player Settings is desktop-only;
- Previous, Next, Fullscreen and End remain part of mobile Control;
- responsive ownership stays in layout/CSS rather than user-agent detection.

An iPhone 14 Plus is a concrete mobile acceptance device in the current workflow, but breakpoint changes remain evidence-driven.

---

# Terminal / Code / Table typography and layout refinement ✅

References: PRs #138–#141.

Completed refinement of existing canonical elements without creating new
element types or duplicate style contracts:

- Terminal, Code and Simple Table typography/color refinement (#138);
- Terminal title appearance and typography (#139);
- shared inline RichText authoring foundation (#140);
- Terminal title font size (#141).

The former TCL audit/checkpoint plan is complete and retained only as
historical context below; it is no longer the active queue.

The completed work refined typography and layout through existing canonical
and shared renderer responsibilities. TCL0–TCL4 are retained only as
historical planning labels and are not future checkpoints.

---

# Plot V1 ✅

Reference: PR #142.

Plot V1 is the merged restricted mathematical plotting surface. Its persisted
discriminator is `type: "plot"`.

The current V1 contract includes:

- mathematical `source` and optional `fitToAxes`;
- `@powershow/math-source` support for explicit-y, explicit-x and implicit-2d
  sources;
- bounded evaluation and a shared 2D renderer;
- Studio authoring and Player rendering.

The package owns tokenization, parsing, semantic analysis, bounded evaluation,
sampling and math-space geometry. The renderer owns the 2D SVG projection and
axes presentation. Interactive remains a separate element and runtime
surface. Parametric and 3D plotting are future expansion, not incomplete V1
requirements.

---

# Current-main deterministic Studio test debt

The current main baseline has known deterministic Studio debt in:

- Custom Library editor Apply-button failures;
- Gallery default alt mismatch;
- persistence/publish/read expectations around Scripted `ports: []`;
- Studio test-compilation/typecheck debt in Gallery/tree-panel tests.

The Player full suite currently passes. This note records the maintenance
work area; it does not diagnose or fix the failures.

---

# Future / deferred

## Embed adjustments — future as promoted

Embed exists canonically. Resume only from a concrete provider/runtime audit. Do not expose authored sandbox/Permissions Policy internals merely for convenience.

## publishNow — deferred

The proposed fast-live Editor mode remains intentionally paused.

## Topics consuming Typography Styles — deferred concept

Topics currently owns its typography context; future direct Typography Style consumption is not frozen.

## P13 — Production Readiness — planned

Promote from concrete deployment/reliability needs: Studio→publish→Control→Player E2E, auth/rules review, deploy/smoke/rollback, constrained-hardware performance, responsive acceptance and security review.

## P14 — Maintenance & Diagnostics 🟡

D0–D2 plus remote logs are operational. Further expansion remains evidence-driven and bounded.

## P15 — Audience / Watch expansion — future

Watch already follows Player-applied state. Viewer presence/count/nickname and richer audience behavior remain future candidates and must never grant audience clients shared presentation control.

Other future candidates include bounded Undo/Redo, AI Import into the existing canonical Presentation, Player offline continuity, Custom Library portability refinements and remaining WYSIWYG/Text improvements.

---

# Current execution summary

```text
P0    Canonical document foundation                         ✅
P1    Renderer + Player foundation                          ✅
P2    Studio Editor V0                                      ✅
P3    Visual authoring vocabulary                           ✅
P4    Hierarchy / positioning / direct Canvas              ✅
P5    Firebase persistence / Library / autosave             ✅
P6    Immutable publishing                                  ✅
P7    Auth / publication pointer / remote-control base      ✅
P8    Live activation / Library Present-Control-End         ✅
P9    Live presentation foundation                          ✅
P10   Canonical Authoring & Import Foundation               ✅
P11   Resources, Organization & Text Styles                 ✅
P12   UX / Properties refinement                            ✅
       Gallery V1                                           ✅
       Maintenance & Diagnostics                            ✅
       Persistence serialization hardening                  ✅
       Blocks visual authoring                              ✅
       Editor Resource Controls polish                      ✅
       Scripted controlled interaction (#133)                 ✅
       Player options + remote logs (#134)                    ✅
       Mobile Library / Control recovery                      ✅
       Terminal / Code / Table refinement (#138–#141)         ✅
       Plot V1 (#142)                                         ✅

NEXT:
  Current-main Studio test debt closure

THEN:
  P13 Production Readiness — next major product/reliability candidate after
  the deterministic baseline debt is addressed

DEFERRED / FUTURE:
  Embed adjustments
  publishNow
  Topics → Typography Style consumer concept
  Audience / Watch expansion
```

The next implementation session must begin by completing post-merge local closure and auditing the **real current `main`** before taking on the deterministic Studio test debt.
