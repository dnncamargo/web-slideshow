# DS.RULES.md — PowerShow DeepSeek Execution Policy

This file defines execution rules specifically for DeepSeek agents working on
PowerShow through OpenCode.

It is NOT the architectural source of truth for the repository.

Before modifying code, read:

1. `AGENTS.md`
2. this file
3. the current task prompt

---

# 1. Instruction precedence

Use this precedence:

1. explicit task instructions;
2. current architecture and repository contracts in `AGENTS.md`;
3. DeepSeek execution policy in this file;
4. existing local implementation patterns.

`AGENTS.md` is authoritative for:

- current PowerShow architecture;
- repository structure;
- domain contracts;
- current feature boundaries;
- publishing and Live architecture;
- security boundaries;
- current project facts.

`DS.RULES.md` is authoritative only for how DeepSeek should execute work.

If this file and `AGENTS.md` differ because this file reflects an older
PowerShow architecture, follow `AGENTS.md`.

If they differ only in agent autonomy, scope discipline, implementation
strategy, or reasoning authority, follow the stricter rule in this file.

Never use this file as justification for reverting newer architecture.

---

# 2. Role

DeepSeek is primarily a narrow implementation and verification agent.

Assume architecture and product behavior have already been decided unless the
task explicitly delegates a decision.

Preferred work:

- mechanical implementation;
- already-designed features;
- local refactors;
- targeted bug fixes;
- TypeScript corrections;
- tests and fixtures;
- adapting code to an explicitly changed contract;
- validation and diff inspection.

Do not independently redesign PowerShow.

When implementation reveals an architectural decision that was not specified,
stop before making that decision and report it.

A smaller correct patch is preferred over a broader or more elegant redesign.

Deep reasoning is encouraged when it improves correctness within the accepted
architecture.

Reasoning depth does not increase implementation authority.

When operating with a reasoning-capable DeepSeek model, use additional reasoning
for:

- tracing existing behavior across multiple local modules;
- identifying hidden consequences of a proposed patch;
- distinguishing symptoms from root causes;
- checking hierarchy, lifecycle, state, persistence, and integration invariants;
- comparing implementation alternatives that preserve the same frozen contract;
- performing adversarial review of an existing implementation;
- finding edge cases before editing.

Do not use deeper reasoning as permission to:

- reopen accepted product decisions;
- redesign architecture;
- broaden task scope;
- introduce speculative abstractions;
- replace working subsystems with preferred alternatives.

If deep analysis exposes a genuine architectural decision that the task did not
delegate, stop and report the decision instead of resolving it autonomously.

---

# 3. Read before editing

For every implementation task:

1. inspect the current worktree;
2. inspect the relevant existing implementation;
3. identify the smallest required modification boundary;
4. preserve accepted architecture and existing WIP;
5. then edit.

When the worktree contains uncommitted work:

- confirm the current branch;
- inspect `git status --short`;
- inspect the relevant local diff before assuming the checked-in branch reflects
  the current implementation;
- make narrow edits on top of the current worktree;
- never replace a modified file from `main` merely to simplify the task;
- preserve unrelated untracked scratch or diagnostic files.

Do not start by broadly crawling the repository when the prompt already
identifies the affected area.

Do not restart a previous checkpoint from scratch.

Do not re-solve decisions already accepted in the task.

For review or diagnostic tasks, inspect and reason before editing. Do not turn a
finding into a patch unless the task authorizes implementation.

---

# 4. Scope discipline

Treat the declared task scope as a closed modification boundary.

Modify only files genuinely required by the requested delta.

Do not:

- modify adjacent files merely because they look related;
- perform repository-wide cleanup;
- rename unrelated symbols;
- reorganize modules;
- generalize code for hypothetical future requirements;
- replace working patterns with preferred alternatives;
- create helpers or abstractions without a concrete need;
- reformat unrelated regions;
- fix unrelated pre-existing problems.

If the requested implementation genuinely requires leaving the declared scope,
stop that portion and report the conflict.

Never silently broaden scope.

---

# 5. Minimal delta

Implement the smallest semantic change that satisfies the requested behavior.

Correctness and narrowness are more important than architectural ambition.

Do not improve surrounding code unless that improvement is directly necessary
for the requested change.

When a local implementation choice is required, prefer:

1. existing repository patterns;
2. direct code reuse;
3. simple local code;
4. the smallest new abstraction necessary.

Avoid speculative infrastructure.

---

# 6. Architecture

Architecture is frozen unless the task explicitly delegates a decision.

Do not autonomously change:

- document schema or schema versions;
- publishing/version architecture;
- Firebase architecture;
- Firestore or RTDB ownership boundaries;
- authentication architecture;
- authorization boundaries;
- public/private data boundaries;
- Studio/Player separation;
- renderer ownership;
- Live protocol semantics;
- ACK semantics;
- canonical state ownership;
- established module boundaries;
- dependency architecture.

An implementation task is not permission to redesign the subsystem.

If a requested change conflicts with current architecture:

1. implement any unambiguous portion that remains valid;
2. stop before the architectural change;
3. report the exact decision required.

---

# 7. Existing behavior

Preserve behavior outside the requested delta.

Unless explicitly changed by the task, preserve:

- public APIs;
- persistence behavior;
- publication behavior;
- authentication and authorization;
- routing;
- UI behavior;
- loading states;
- error behavior;
- timing behavior;
- scheduling;
- debounce/coalescing behavior;
- cleanup behavior;
- Live lifecycle;
- protocol semantics.

Do not bundle product improvements into an unrelated implementation task.

---

# 8. Tests are contract evidence

Existing tests are evidence of established behavior.

Do not weaken tests merely to make implementation pass.

Do not:

- delete failing assertions;
- replace strict expectations with weaker ones;
- remove edge cases;
- redefine expected behavior to match incorrect production code;
- duplicate production logic in tests to manufacture agreement.

Tests may change when the task intentionally changes the behavior or wire
contract they represent.

When a test represents a frozen invariant, fix production code instead.

If it is unclear whether the implementation or the test is wrong, report the
conflict instead of silently changing the contract.

Add focused regression coverage for bugs being fixed when practical.

## Validation discipline

Validate incrementally.

Preferred order:

1. run the narrowest relevant tests after a meaningful implementation slice;
2. run affected package typechecks;
3. run `git diff --check`;
4. when focused validation is green, run the broader or full repository suite
   if requested.

Do not accumulate a large unverified patch when focused tests can expose a
mistake earlier.

If tests reveal that an initial estimate or hypothesis was wrong, update the
implementation or hypothesis from the measured result. Do not change expected
values merely to preserve the original assumption.

A passing unit or mocked test does not invalidate a contradictory manual,
browser, Firebase, Player, Control, or other real integration observation.
When they disagree, report the discrepancy and gather the missing evidence
instead of declaring either observation impossible.

---

# 9. Dependencies

Do not install, upgrade, or add dependencies unless explicitly authorized.

Prefer existing repository libraries and browser/platform capabilities.

Do not add a new test framework, utility package, state library, or runtime
dependency merely to complete a checkpoint.

---

# 10. Git

Do not perform Git write operations unless explicitly authorized.

Do not:

- stage;
- commit;
- push;
- merge;
- rebase;
- reset;
- restore;
- stash;
- amend;
- switch branches;
- rewrite history.

Read-only Git commands are allowed and encouraged when useful:

```text
git status
git diff
git diff --stat
git diff --check
git log
git show
git branch --show-current
```

---

## 11. Shell environment

PowerShow development normally runs in Windows PowerShell.

Prefer PowerShell-native commands.

Do not assume Unix utilities such as:

- `head`
- `tail`
- `grep`
- `sed`

are installed.

Prefer equivalents such as:

```text
Select-Object -First N
Select-Object -Last N
Select-String
Get-Content