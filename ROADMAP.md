# PowerShow Roadmap

This document is the current execution order for PowerShow.

## Numbering policy

Historical checkpoint references remain historical and are not retroactively renamed.

From P9 onward, the roadmap is renumbered to reflect product priority rather than the order in which ideas were originally proposed.

### Previous planned number → current number

| Previous label | Current label | Area |
|---|---:|---|
| P12 | **P9** | Control commands, live publishing, fullscreen |
| P13 | **P10** | Audience presence |
| P9 | **P11** | PowerShow Studio / Library redesign |
| P10 | **P12** | Folders + persistence |
| P11 | **P13** | Saved Styles / reusable libraries |

P8 remains the completed Control shell / responsive presenter milestone.

---

## P8 — Control shell and responsive presenter ✅

Status: **complete and merged**.

Delivered:

- authenticated `/control` surface;
- Current and Next previews;
- private Notes;
- read-only Summary;
- ACK-authoritative current slide and counter;
- Previous/Next boundary handling;
- Live sync / latency status;
- End presentation;
- Editor-aligned visual shell;
- responsive desktop/mobile composition;
- mobile Library access;
- inline local clock;
- final Summary parity with Editor.

Deferred intentionally:

- functional fullscreen;
- session timer without a canonical persisted `startedAt`;
- richer Control commands.

---

# P9 — Live presentation operations ← NEXT

P9 is now the highest-priority product cycle.

Its purpose is to make PowerShow safe and practical during a real presentation, especially when the operator edits and republishes while a Player is already live.

## P9.0 — Staged Live Publish

### Product contract

PowerShow distinguishes:

```text
latest published version
        │
        └── what Control should preview

live/current version
        │
        └── what Player is currently projecting
```

A new Publish must not immediately replace the projected Player content.

Flow:

```text
Editor publishes V2
       │
       ├── immutable V2 is created
       └── public pointer moves to V2
                    │
                    ▼
            Control observes V2
            automatically
                    │
                    │ operator reviews
                    ▼
             [Update Player]
                    │
                    ▼
              live/current → V2
                    │
                    ▼
              Player reloads V2
```

No modal is used.

The Control's existing excess action-area space is the canonical location for version-state messages and the **Update Player** button.

### Frozen behavior

- Control always follows the latest published pointer.
- Player stays on the currently released `live/current.currentVersionId` until authorized.
- Multiple publishes while Player remains old collapse to the latest version.
- No intermediate version queue.
- Previous/Next are disabled while Control and Player reference different versions.
- End presentation remains available.
- The operator does not choose whether Control updates; Control represents the latest publication.
- The operator only decides when the Player is promoted.
- Structural changes produce an inline warning, not a modal.
- If the currently projected slide was removed, show a stronger inline warning.
- Promotion keeps the same Live activation/session identity.
- Version promotion is not a new presentation activation.
- Stale `slideCommand` / `slideAck` state must not leak across a version promotion.

### Slide preservation

Version changes must preserve the logical slide whenever possible.

Example:

```text
V1: A B C D
        ^
        C projected

V2: A X B C D
          ^
          preserve C
```

Mapping rule:

1. take the Player ACK-confirmed index in the currently projected version;
2. resolve the corresponding `slide.id`;
3. find the same `slide.id` in the latest publication;
4. use that mapped index in the new version;
5. if the slide no longer exists, fall back to a valid clamped index.

Control uses the same mapping while previewing a newer version than Player.

### Structural warning detection

Warn when the ordered slide-id sequence differs because of:

- insertion;
- removal;
- reordering.

Simple content edits to an existing slide do not require a structural warning.

### P9.0-A — Dual-version Control state

Goal: Control knows both the version on Player and the latest published version.

Required behavior:

- observe `live/current`;
- observe the public publication pointer for the same `publicationId`;
- load the exact latest published version;
- derive `hasPendingVersion`;
- Control preview updates automatically when the pointer changes;
- Player remains unchanged;
- multiple Control tabs/devices converge from shared persisted state.

Do not change Player promotion yet.

### P9.0-B — Version mapping and pending-version UX

Goal: make the divergence understandable and safe.

Required behavior:

- map Player ACK-confirmed slide → `slide.id` → latest published index;
- detect structural slide-id changes;
- render inline pending-version information in the existing Control action area;
- show **Update Player**;
- show structural warning when needed;
- show stronger warning when the projected slide was removed;
- disable Previous/Next during version divergence;
- keep End available;
- no modal;
- no fake local selection state.

### P9.0-C — Atomic Player promotion and hot reload

Goal: release the reviewed publication to Player.

Required behavior:

- operator clicks **Update Player**;
- promote `live/current.currentVersionId` to the latest published version;
- preserve the same Live activation/session revision;
- clear stale navigation command/ACK state as part of the promotion boundary;
- Player detects the new version through its existing reactive `live/current` subscription;
- Player remounts the new immutable version;
- preserve the logical current slide by `slide.id` when possible;
- emit the new baseline ACK only after the new Player position is established;
- Control returns to normal navigation after the new ACK.

Promotion should be atomic at the Live-state boundary.

### P9.0-D — Concurrency, reload, and E2E hardening

Validate:

- Editor + Control + Player on separate devices/tabs;
- multiple Controls open simultaneously;
- Publish while Player is active;
- several publishes before promotion;
- content-only edit;
- inserted slide before current slide;
- reordered slides;
- current slide removed;
- Control reload while update is pending;
- Player reload while update is pending;
- Player reload after promotion;
- promotion failure and retry;
- End during pending update;
- new Live session after previous update;
- no stale command/ACK reuse.

---

## P9.1 — Extensible Live command contract

After Staged Live Publish is stable:

- review current `live/slideCommand`;
- define how additional commands fit without ad-hoc parallel channels;
- separate durable state from transient commands;
- preserve ACK authority for state that must be confirmed by Player;
- keep R1 single-operator semantics.

Architecture must be frozen before implementation.

---

## P9.2 — New Control commands

Add the highest-value presentation commands after the protocol supports them.

Exact command set is intentionally not frozen yet.

Requirements:

- commands must have explicit semantics;
- command state must survive/recover appropriately across reloads;
- no command may silently pretend browser-restricted behavior succeeded;
- desktop and mobile Control surfaces share the same command semantics.

---

## P9.3 — Fullscreen

Fullscreen is handled separately because native browser fullscreen requires user activation and cannot be assumed to work as an arbitrary remote RTDB command.

This checkpoint must distinguish, if needed:

- Player display/presentation mode;
- browser native fullscreen;
- local Player user gesture;
- remote Control intent.

Do not conflate these concepts.

---

## P9.4 — Control command UX and integrated E2E

Finalize:

- command button states;
- pending / confirmed / failed status;
- desktop/mobile behavior;
- reload recovery;
- Player/Control synchronization;
- Live termination;
- production E2E.

---

# P10 — Audience presence

Goal: allow public Watch/Audience clients to register lightweight presence for the active session.

Planned concepts:

- public viewer/session id;
- optional nickname without account;
- heartbeat / TTL;
- `onDisconnect` where appropriate;
- viewer count in Control;
- optional viewer list;
- privacy boundaries;
- multi-tab behavior.

Audience remains unable to control the shared presentation.

---

# P11 — PowerShow Studio / Library redesign

Functional live presentation work takes priority over this visual/organizational cycle.

Planned direction:

- UI title **PowerShow Studio**;
- file-manager style presentation list;
- presentation thumbnail;
- selection-first UX;
- contextual action toolbar;
- flat Editor/Control visual language;
- sidebar navigation;
- archived presentations;
- responsive behavior.

Contextual actions:

```text
no selection
→ New / New folder

inactive presentation
→ Present / Edit / Archive

active presentation
→ Control / End / Edit

archived presentation
→ Restore
```

Folder persistence is not introduced here.

---

# P12 — Folders and persistence

Add private Studio organization metadata.

Requirements:

- folders are Studio metadata;
- folders are never part of the published Presentation document;
- folders are never required by Player;
- exact Firestore path/schema must be designed before implementation;
- maintain clean separation between authoring organization and publication.

---

# P13 — Saved Styles and reusable libraries

Introduce reusable authoring assets.

Core distinction:

```text
Theme
→ presentation-wide visual/structural identity

Saved Style
→ reusable element-level style configuration
```

Frozen concept:

- Saved Styles are private Studio/account metadata;
- Player must never resolve a private Saved Style id at runtime;
- applying a Saved Style materializes effective values into the Presentation;
- published snapshots remain self-contained.

Potential future library areas:

- Styles;
- Colors;
- Fonts.

Exact persistence schema is not yet frozen.

---

# Later / not yet numbered

These remain valid future product areas but should not distract from P9:

- dedicated PowerShow documentation page;
- broader Watch/Audience experience;
- legacy runtime expansion;
- reusable custom color palette;
- border-color reuse;
- additional interactive element libraries;
- release hardening and offline resilience work.

The documentation page should be created when product terminology and workflows are closer to their final form.
