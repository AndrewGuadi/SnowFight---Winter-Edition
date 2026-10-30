# 10 — Architecture Decisions, Unresolved Questions and Risk Register

**Status:** INITIAL DECISION LOG. Decisions marked ACCEPTED mean accepted as **planning policy for this documentation branch**, not a shipped implementation or approval to merge/deploy product code.  
**Latest source baseline recorded:** main be4797ab0bee88c139de3867379fc362bcff8853 at branch creation.

## Architecture decisions

### ADR-001: Keep a working original multiplayer baseline

**Status:** ACCEPTED AS SAFETY POLICY.  
**Context:** Current Node/Socket.IO game has online rooms, timed scoring and tests. The contest window is short and users care about a complete multiplayer experience.  
**Decision:** Preserve current main behavior and a rollback revision until an alternative passes legal/build/two-client performance gates.  
**Consequence:** Slower-looking modernization is acceptable if it protects functionality. No speculative full-stack replacement.

### ADR-002: Reuse-first, but only with rights and proof

**Status:** ACCEPTED AS POLICY.  
**Decision:** Prefer existing licensed modules/systems to reinventing them; run a bounded audit and build test before wholesale forks.  
**Rejected extremes:** "Write everything from scratch" and "fork any visually impressive public GitHub demo."  
**Consequence:** Track license, source SHA, asset credits and test evidence in a candidate ledger.

### ADR-003: Browser and no-account first

**Status:** ACCEPTED PRODUCT DIRECTION.  
**Decision:** Phone/laptop browser, friend links, guest play and 90-second matches before native app stores or mandatory identity.  
**Consequence:** No third-party login/payment/auth services in the contest-critical path.

### ADR-004: Server authoritative

**Status:** ACCEPTED TECHNICAL INVARIANT.  
**Decision:** Client displays immediate feedback; server controls movement validity, projectiles, hits, freeze state, score and winner.  
**Consequence:** Prediction must reconcile instead of allowing local hit spoofing. Keep protocol backwards compatible during migration.

### ADR-005: Phaser 4 is an experiment, not a migration mandate

**Status:** PROPOSED / EVIDENCE PENDING.  
**Context:** Current Canvas client is monolithic. Phaser 4.2.1 is available and suitable for browser 2D games; importing an entire Phaser 3 repo may require significant conversion.  
**Decision:** Test modular Phaser client on isolated branch against unchanged/test backend after contest stabilization; compare same scenario and device.  
**Exit criteria:** measurable benefit in rendering/workflow, no protocol regression, legal assets, manageable bundle/cold load, and owner approval.  
**Fallback:** keep and modularize Canvas, or evaluate PixiJS only if measured requirements justify it.

### ADR-006: Hide complexity without breaking game rules

**Status:** ACCEPTED PRODUCT DIRECTION.  
**Context:** Removing a gather button without adding auto-reload on server can make the game unplayable.  
**Decision:** Default UI should focus Move + Throw, but change backend mechanics explicitly and test before removing a required interaction.  
**Consequence:** Transitional contextual gather button may remain until server-authoritative auto reload is implemented.

### ADR-007: Fix bot goals, not only difficulty sliders

**Status:** PROPOSED IMPLEMENTATION.  
**Context:** Bot code directs many actors toward nearest enemy or identical hill center; lacks separation.  
**Decision:** First implement bounded separation, unique objective slots and stuck recovery, then tactical roles/navigation as needed.  
**Consequence:** Need fixed-seed tests, hill scoring parity and CPU measurements.

### ADR-008: No copy of commercial game IP

**Status:** ACCEPTED LEGAL/CREATIVE POLICY.  
**Decision:** SnowFight's art, names, audio, gameplay presentation and content must be original or properly licensed. Study other games for design principles, not copied characters, asset rip, private protocols or brand identity.

### ADR-009: Multi-agent work requires bounded ownership

**Status:** ACCEPTED WORKFLOW POLICY.  
**Decision:** GPT-6 integrates; GPT-6.1-Sol leads server/net AI; Kimi visual; Meta Muse UX/QA; Andrew product/release. PRs scoped with tests, independent reviews and no direct main commits.  
**Consequence:** No assumption of shared tool context or that agents have been dispatched.

### ADR-010: Contest outcome vs long-term scale are distinct

**Status:** ACCEPTED SCOPE POLICY.  
**Decision:** Contest: working, original short-session human multiplayer. Future: larger human rooms, account system, new modes and performance architecture.  
**Consequence:** Do not make 30v30 humans or Phaser adoption a contest precondition.

## Open product/technical questions

| ID | Question | Options | Owner | Needed by |
| --- | --- | --- | --- | --- |
| Q-01 | Which contest foundation? | Existing SnowFight (default) vs proven licensed fork | Andrew + GPT-6 | Foundation gate |
| Q-02 | What primary scoring loop later? | Current hill control vs team snowball knockouts | Andrew + Muse | After contest playtest |
| Q-03 | How should guests customize? | Optional first-run editor vs post-Play editor | Andrew + Muse | UX sprint |
| Q-04 | Which cosmetic implementation? | Palette masks, layered sprites, vector draw | Kimi + GPT-6 | Art prototype |
| Q-05 | Is PR #17 ready for integration? | Adopt, amend, defer | Sol + GPT-6, Andrew approves | Network iteration |
| Q-06 | Which renderer? | Canvas modularization / Phaser 4 POC / PixiJS | GPT-6 + Kimi, Andrew approves | Post-contest |
| Q-07 | How should online bots backfill? | Never, opt-in, controlled public casual match | Andrew + Sol | Matchmaking redesign |
| Q-08 | What is "massive"? | 10v10, 15v15, 30v30 human cap | Andrew + Sol | Load-test milestone |
| Q-09 | How does identity/progression work? | Guest-only, optional account with privacy policy | Andrew + Muse | Persistent features |
| Q-10 | Which open-source candidates are actually usable? | See 01 audit | Sol + GPT-6 | Foundation gate |

No question above is secretly resolved by creating this file.

## Risk register

Scales: severity H/M/L; probability H/M/L; owner must attach mitigation evidence.

| Risk | Sev / Prob | Impact | Mitigation / fallback | Owner |
| --- | --- | --- | --- | --- |
| Unlicensed fork/asset import | H/M | Copyright and submission risk | Code+asset license audit, notices, original replacement; no import until cleared | GPT-6 + Kimi |
| Loss of live multiplayer during rewrite | H/H | Submission failure | Preserve main, isolated branch, two-client gate and rollback | GPT-6 |
| PR #17 duplicate/conflicting work | M/H | Wasted work, protocol divergence | Inspect and re-run PR tests; review once before new prediction code | Sol |
| Bot stacking persists | M/H | Unfair/confusing matches | Unique slots, spacing steering, deterministic crowd test | Sol |
| Simplified controls remove needed reload | H/M | Players cannot throw again | Server auto-reload implementation or transitional contextual gather | Muse + Sol |
| Real 30v30 demands exceed host/network | H/H | Lag, cost, crashes | Keep as future milestone; measure 5v5/10v10 first | Sol |
| Phaser/asset bundle slows first play | M/M | High abandonment | Prototype identical scenario and asset size; keep Canvas fallback | Kimi |
| Server cold starts | M/M | Can't join promptly | Measure; display status/retry; authorized host review later | Sol + Muse |
| Mobile-only control breakage | H/M | Key target market blocked | Physical device tests, pointer cancellation and orientation cases | Muse |
| Changing scoring confuses/invalidates tests | M/M | Invisible gameplay regression | Explicit rules PR, full match/outcome tests | GPT-6 + Sol |
| Third-party library security/dependencies | H/M | Vulnerabilities or outages | Pin versions, audit licenses and deps, reject unexplained external calls | Sol |
| AI agents edit same file simultaneously | M/H | Merge conflicts / lost fixes | File owner, worktree/branch discipline, integration gate | GPT-6 |
| Contest rule/date misunderstanding | H/M | Ineligible/late submission | Verify official terms, earlier deadline, owner submits | Andrew |
| No real-player testing | M/H | "Works in tests" but poor game feel | Invite real novice testers, run two-device manual sessions | Muse |
| False benchmark/feature claims | H/M | Wrong deployment decision | Baseline traces, exact SHA/hardware, status words | GPT-6 |

## Decision change procedure

If evidence contradicts the current default:
1. Propose a new ADR with context, alternatives and licenses.
2. Show comparative working demo or repeatable measurements.
3. Identify affected tickets, code paths and reversible rollback.
4. Request owner approval for material changes to vision, foundation or production.
5. Update backlog and charter links; don't erase original reasoning.
6. Announce the revision to all agents with new target commit/branch.

## What this documentation branch actually did

- Added planning, scope, research, agent, technical, QA, release and risk files under docs/rebuild/.
- Did not modify gameplay logic, render code, package manifests, production configuration or secrets.
- Did not import or fork another game.
- Did not run local device performance tests or assert a winning probability.
- Did not merge, deploy or submit a contest entry.
- Does not itself contact or assign tasks to Kimi, Meta Muse or GPT-6.1-Sol.

## Required next approval decisions

1. Approve/revise product direction and exact first-match goals.
2. Approve a timeboxed, evidence-based choice to retain or fork foundation.
3. Explicitly authorize any feature implementation branch work as needed.
4. Explicitly authorize any merge/deploy only after test and release evidence.
5. Submit the contest entry personally.

The long-term purpose is not to maximize code written. It is to maximize SnowFight's original fun per unit of engineering risk.
