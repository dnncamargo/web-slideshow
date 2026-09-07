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
→ branch closure
→ PR / merge
→ verify the remote merge
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

### Branch closure — mandatory before PR

Before opening a PR for a completed work area:

1. audit the complete branch diff against current `main`;
2. confirm only the intended files/scope changed;
3. run the relevant final suite, typecheck and `git diff --check`;
4. confirm the worktree is clean;
5. confirm the branch is not unexpectedly behind `main`.

If closure reveals a new failure, audit its cause before patching it. A PR is opened only after the branch is technically ready.

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
| P10.4 | Topics minimum | ✅ | #64–#66 |
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

References: PR #133 and HTTPS-image refinement PR #149.

Delivered:

- declared action ports;
- declared boolean and number state ports;
- `input`, `output` and `input-output` direction where applicable;
- Player-owned transient runtime identity;
- strict Player↔sandbox message validation;
- Scripted-specific RTDB input/runtime/report state;
- Control stateful controls generated from declarations;
- desired/reported/pending/divergent semantics;
- retained renderer-owned sandbox and fixed CSP boundary;
- HTTPS image loading in addition to `data:` and `blob:` while general networking remains blocked.

Permanent constraints remain:

- no `allow-same-origin` for Scripted;
- no Firebase SDK/tokens/session exposure inside authored code;
- no parent DOM access;
- no top navigation/forms/popups/downloads/storage;
- no `eval` / `Function`;
- no JavaScript payload delivered through RTDB;
- runtime state never persists into the Presentation.

`img-src https:` is a narrow image capability: sandboxed JavaScript can initiate image GET requests, while `connect-src 'none'` still blocks fetch/XHR/WebSocket/EventSource.

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

Current `main` preserves the accepted mobile Library and Control behavior after PR #134.

Current rule:

- compact Player Settings is desktop-only;
- Previous, Next, Fullscreen and End remain part of mobile Control;
- responsive ownership stays in layout/CSS rather than user-agent detection.

An iPhone 14 Plus is a concrete mobile acceptance device in the current workflow, but breakpoint changes remain evidence-driven.

---

# Terminal / Code / Table typography and layout refinement ✅

References: PRs #138–#141.

Completed refinement of existing canonical elements without creating new element types or duplicate style contracts:

- Terminal, Code and Simple Table typography/color refinement (#138);
- Terminal title appearance and typography (#139);
- shared inline RichText authoring foundation (#140);
- Terminal title font size (#141).

---

# Plot V1 + continuation ✅

References: PRs #142 and #146–#148.

Plot persists restricted mathematical intent; it does not persist generated geometry or arbitrary JavaScript.

Completed capability line:

- explicit-y, explicit-x and implicit-2d sources;
- explicit-z 3D surface geometry;
- static SVG 3D wireframe projection;
- element sizing/positioning through existing shared layout ownership;
- Plot colors/background;
- z-based 3D gradient;
- canonical animation parameter intent with transient runtime bindings;
- Player/Watch/Demo animation playback and Editor local preview;
- Control→Player remote Play/Pause/Reset actions;
- axis color, stroke width and opacity refinement.

Permanent Plot boundary:

```text
restricted mathematical source
→ transient parse / semantic / samples / geometry
→ shared renderer projection
```

No Three.js/WebGL/Canvas/camera/mesh persistence is part of the current architecture.

Physical acceptance on the target Android interactive display with Firefox 116 remains pending because the hardware has not yet been available. This is a release gate, not negative compatibility evidence.

---

# Deterministic Studio test debt ✅

Reference: PR #144.

The post-Plot deterministic Studio debt was closed tests-only. Later feature work has continued to grow the suite; do not treat the historical 185-file baseline as a current expected count.

---

# Font authoring refinement ✅

Reference: PR #150.

Delivered without schema or renderer redesign:

- editable manual `fontFamily` authoring;
- Presentation FontResource families retained as suggestions;
- blank returns to inherited/default behavior;
- Text Styles can author a family even with zero Presentation fonts;
- complete FontResource in-use detection across current canonical typography consumers, including Code, Terminal body/title, Table/Topics ContentSlots, Text Styles and Linked Styles.

Manual family names are system/browser family requests, not automatic downloads. Portable fonts continue to use canonical `Presentation.resources.fonts` and renderer-generated `@font-face`.

Final PR #150 closure evidence included Studio typecheck PASS, full Studio suite **188 files / 2,245 tests / 0 failures**, remote Studio/Player checks PASS and manual acceptance PASS.

Direct This Presentation FontResource authoring is deferred. Library-thumbnail FontResource style injection parity is a separate backlog item.

---

# Topics refinement ← NEXT

Topics minimum authoring was delivered historically in P10.4. The next work area is **refinement of the existing canonical Topics model**, not creation of a second list element or speculative schema replacement.

Current canonical structure:

```text
TopicsElement
→ items: TopicItem[]
   ├── content: ContentSlot
   │   ├── layout?
   │   ├── style?
   │   ├── typography?
   │   └── children: PowerShowElement[]
   └── children: TopicItem[]
```

Current authored Topics intent also includes ordered/unordered kind, root marker style, marker color, item gap, element layout/style/typography and recursive TopicItem hierarchy.

Studio limits **creation** of structural TopicItem nesting to depth 5. This is an authoring limit only: deeper canonical documents remain loadable, renderable and persistable.

## TOPICS-T0 — read-only audit ← NEXT

Before any implementation, audit real `main` across:

- `TopicsElement`, `TopicItem` and `ContentSlot` canonical contracts/invariants;
- shared renderer list structure, marker sequencing, nested levels, ContentSlot styling/typography and arbitrary child rendering;
- Topics Inspector direct-text behavior and non-Text ContentSlot summaries;
- add/remove/create-child operations and the depth-5 authoring rule;
- hierarchy ownership, ID allocation, selection/focus and element-tree representation;
- whether reorder, nest/unnest or ContentSlot editing has a concrete missing product path;
- Canvas behavior and generic position/appearance integration;
- save/reload/import/export/publish preservation;
- Editor/Player/Watch/Cover parity;
- keyboard, touch/mobile and accessibility behavior;
- existing schema/renderer/Studio/Player tests.

T0 must return root causes and classify every proposed change as **required, useful but deferred, or not justified**. Do not implement during T0.

## Candidate Topics checkpoints after T0 — not frozen

Only evidence may promote these categories:

```text
TOPICS-T1 — hierarchy/item lifecycle correction
  add/remove/reorder/nest/unnest only where a real gap is proven

TOPICS-T2 — ContentSlot authoring correction
  selection/editing of arbitrary canonical slot children without flattening them

TOPICS-T3 — appearance/renderer parity correction
  marker/typography/layout behavior only where Studio/runtime evidence diverges

TOPICS-T4 — integration + manual acceptance
  save/reload/import/export/publish and Editor/Player/Watch/Cover acceptance
```

Do not create a generic list abstraction, second Topics schema, migration or compatibility layer. Direct Topics consumption of Presentation Text Styles remains deferred unless T0 plus an explicit product decision promotes it.

### Topics manual acceptance target

When implementation is complete, validate at least:

- ordered and unordered Topics;
- nested items through the supported authoring depth;
- add/remove and any evidence-approved reorder/nest operations;
- direct Text and non-Text ContentSlot children;
- marker and typography behavior;
- save/reload and JSON export/import;
- publish and shared-renderer parity across Editor/Player/Watch/Cover;
- touch/mobile behavior where the changed authoring control applies.

---

# Embed refinement — NEXT AFTER TOPICS

Embed minimum was delivered historically in P10.8. The current element already owns canonical `src`, required accessibility `title`, shared surface appearance/effect and resizable/positioned layout. This is refinement of an existing surface, not a new element.

Current renderer-owned iframe policy is fixed rather than authored:

```text
sandbox="allow-scripts allow-forms allow-same-origin"
allow="fullscreen"
referrerpolicy="strict-origin-when-cross-origin"
loading="lazy"
```

The renderer also contains bounded YouTube URL normalization. Because `allow-scripts + allow-same-origin` is security-sensitive, policy changes must remain renderer-owned and evidence-backed.

## EMBED-E0 — concrete provider/runtime/security audit

Audit before implementation:

- real embeddable HTTPS providers and URLs that fail or behave poorly;
- provider-blocked pages via `X-Frame-Options` or CSP `frame-ancestors`;
- same-origin vs cross-origin behavior;
- current sandbox capabilities and same-origin security implications;
- fullscreen and Permissions Policy requirements;
- referrer requirements;
- iframe sizing, fit, resize and responsive behavior;
- Editor src/title draft/validation ergonomics;
- YouTube normalization behavior and whether any additional provider normalization is actually justified;
- Player, Watch, Cover and Demo shared-renderer paths;
- navigation/top-level escape behavior;
- existing schema/renderer/Studio/Player tests.

E0 must distinguish **provider refusal** from a PowerShow defect. A site that deliberately forbids framing is not automatically something PowerShow should bypass.

## Candidate Embed checkpoints after E0 — not frozen

```text
EMBED-E1 — freeze renderer/security responsibility
  only if E0 exposes a concrete sandbox/referrer/fullscreen gap

EMBED-E2 — targeted provider/runtime correction
  only bounded normalization/policy behavior justified by tested providers

EMBED-E3 — Studio UX correction
  only if src/title/size/preview authoring has a demonstrated gap

EMBED-E4 — runtime/manual acceptance
  embeddable + provider-blocked cases across relevant PowerShow surfaces
```

If E0 finds no PowerShow-owned product defect, Embed may close after audit without forcing E1–E4. Do not expose authored sandbox/Permissions Policy fields merely for convenience, and do not add a new dependency without evidence.

### Embed manual acceptance target

When implementation is required, validate at least:

- one real HTTPS provider that permits embedding;
- one provider/page that intentionally blocks embedding, with graceful PowerShow behavior;
- canonical src/title validation and persistence;
- resize/layout behavior;
- fullscreen/referrer behavior where supported;
- Editor/Player/Watch/Cover shared-renderer parity;
- navigation safety and touch behavior where applicable.

---

# P13 — Production Readiness — planned after Topics + Embed

After Topics refinement and the bounded Embed audit/refinement line, promote Production Readiness from concrete deployment/reliability needs:

- Studio→publish→Control→Player E2E;
- auth/rules review;
- deploy/smoke/rollback;
- constrained-hardware performance;
- responsive acceptance;
- security review;
- Android interactive-display / Firefox 116 physical Player acceptance.

P13 should stabilize the product after the promoted feature-refinement line instead of interrupting it midway.

---

# Future / deferred

## publishNow — deferred

The proposed fast-live Editor mode remains intentionally paused.

## P14 — Maintenance & Diagnostics 🟡

D0–D2 plus remote logs are operational. Further expansion remains evidence-driven and bounded.

## P15 — Audience / Watch expansion — future

Watch already follows Player-applied state. Viewer presence/count/nickname and richer audience behavior remain future candidates and must never grant audience clients shared presentation control.

Other deferred candidates include:

- direct This Presentation FontResource authoring;
- Library-thumbnail FontResource parity;
- Topics → Text Style consumption;
- bounded Undo/Redo;
- AI Import into the existing canonical Presentation;
- Player offline continuity;
- Custom Library portability refinements;
- remaining WYSIWYG/Text improvements.

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
       Scripted controlled interaction (#133)               ✅
       Player options + remote logs (#134)                  ✅
       Mobile Library / Control recovery                    ✅
       Terminal / Code / Table refinement (#138–#141)       ✅
       Plot V1 (#142)                                       ✅
       Studio deterministic test debt closure (#144)        ✅
       Plot continuation / 3D / animation (#146)            ✅
       Plot remote animation controls (#147)                ✅
       Plot axis appearance (#148)                          ✅
       Scripted HTTPS images (#149)                         ✅
       Font authoring + usage protection (#150)             ✅

NEXT:
  Topics refinement
  → TOPICS-T0 read-only audit
  → smallest evidence-backed Topics checkpoints
  → manual acceptance

NEXT AFTER TOPICS:
  Embed refinement
  → EMBED-E0 provider/runtime/security audit
  → smallest evidence-backed Embed checkpoints
  → manual acceptance

THEN:
  P13 Production Readiness

RELEASE GATE STILL PENDING:
  Android interactive display + Firefox 116 physical Player acceptance

FUTURE / DEFERRED:
  P14 bounded Diagnostics expansion
  P15 Audience / Watch expansion
  publishNow
  direct This Presentation FontResource authoring
  Library-thumbnail FontResource parity
  Topics → Text Style consumption
  bounded Undo/Redo
  AI Import
  Player offline continuity
  Custom Library portability
  remaining WYSIWYG/Text improvements
```

The next implementation chat must begin from a fully closed local `main`, revalidate the real remote baseline, and run **TOPICS-T0 as a read-only audit before changing schema, renderer or Studio production code**.
