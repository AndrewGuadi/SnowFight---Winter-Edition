# SnowFight — Rebuild Program (planning branch)

**Status:** PROPOSED / NOT IMPLEMENTED  
**Plan version:** 1.0, October 30, 2026  
**Source baseline:** main at be4797ab0bee88c139de3867379fc362bcff8853 when this documentation branch was created  
**Branch:** docs/rebuild-reuse-first-2026-10-30  
**Decision authority:** Andrew (product owner)  
**Release status:** No code migration, merge, production deployment or contest submission authorized by these documents.

## Executive decision

SnowFight is being redirected from a menu-heavy, mission/class-oriented arena prototype toward a **low-friction, browser-first, human-centered neighborhood snowball fight**.

The objective is not to make a Brawl Stars clone. It is to recover the joyful childhood fantasy of a large snowball fight with real friends and strangers: choose how your kid looks, enter a snowy playground almost immediately, move and throw instinctively, and play another short match.

**Reuse before rebuild.** We should prefer legally reusable, proven engines, libraries, systems and patterns when they reduce integration risk and lead time. A full-game fork is permitted as a candidate, but only after licensing, originality, multiplayer compatibility, asset provenance, and a timeboxed build test. Source availability alone is not reuse permission. Do not replace today's functioning multiplayer foundation merely because a demo looks impressive.

**Two tracks must remain separate:**

1. **Contest rescue (timeboxed):** ship the smallest enjoyable, original, reliable multiplayer experience with the existing SnowFight baseline unless a competing authorized foundation demonstrably wins the first-hour assessment.
2. **Strategic rebuild (after contest):** evaluate a Phaser 4 client prototype and stronger server systems without committing to a migration until measurements justify it.

The mission today is a competitive and reliable game, not a new engine for its own sake.

## Read in this order

| Document | Purpose | Primary decision |
| --- | --- | --- |
| [00_PRODUCT_DIRECTION.md](00_PRODUCT_DIRECTION.md) | Vision, experience contract, scope, player journey | What are we making? |
| [01_OPEN_SOURCE_REUSE_AUDIT.md](01_OPEN_SOURCE_REUSE_AUDIT.md) | Candidate projects, license gates, adopt/fork/build test | What should we reuse? |
| [02_TECHNICAL_ARCHITECTURE.md](02_TECHNICAL_ARCHITECTURE.md) | Current code map, architecture, client/server boundaries, Phaser experiment | How should it work? |
| [03_SIX_HOUR_CONTEST_PLAN.md](03_SIX_HOUR_CONTEST_PLAN.md) | Timeboxes, dependencies, cut line, contest-ready deliverables | What can ship quickly? |
| [04_MULTI_AGENT_CHARTER.md](04_MULTI_AGENT_CHARTER.md) | Role boundaries, review authority, handoffs, branch discipline | Who does what? |
| [05_GAMEPLAY_AND_DESIGN_SPEC.md](05_GAMEPLAY_AND_DESIGN_SPEC.md) | Character creator, controls, maps, combat and accessibility | What should play feel like? |
| [06_AI_NETWORK_AND_PERFORMANCE.md](06_AI_NETWORK_AND_PERFORMANCE.md) | Bot clustering, movement, networking, performance investigation | What systems need repairs? |
| [07_TEST_AND_BENCHMARK_PLAN.md](07_TEST_AND_BENCHMARK_PLAN.md) | Test matrix, metrics, objective go/no-go gates | How do we verify claims? |
| [08_RELEASE_AND_CONTEST_CHECKLIST.md](08_RELEASE_AND_CONTEST_CHECKLIST.md) | Safety, contest rules, owner approval, production verification | When may we ship? |
| [09_PRIORITIZED_BACKLOG.md](09_PRIORITIZED_BACKLOG.md) | Dependency-ordered implementation tickets, owners, definition of done | What is the next executable task? |
| [10_DECISION_LOG_AND_RISKS.md](10_DECISION_LOG_AND_RISKS.md) | Architecture decision records, unresolved questions, risk register | What must be decided explicitly? |

## Existing repository truths

- Original project: https://github.com/AndrewGuadi/SnowFight---Winter-Edition
- Frontend: index.html with inline JavaScript, assets/recruits.js, assets/neighborhood.js, assets/ui.css.
- Server: backend/server.js (Node, Express, Socket.IO), backend/gameplay.js, backend/classes.js, backend/missions.js.
- The current authoritative server simulates at 60 Hz and publishes room state at approximately 30 Hz during active play.
- Existing game modes include solo bots and human multiplayer; **30v30 is documented as single-player bot mode, not proven 30v30 online humans**.
- Current bot AI targets the nearest unfrozen enemy, and when it needs the hill it steers toward the same center coordinates, explaining the observed clustering.
- Open PR #17, **Improve multiplayer responsiveness with client prediction**, already proposes sequence-acknowledged input, local prediction/reconciliation and reduced DTO snapshots. Inspect and reconcile its actual current status before assigning duplicate work.
- Existing governance in collaborators/README.md forbids using the parked full-stack rewrite (PR #2 / feature/fullstack-rewrite), requires branches and PRs and reserves merges/deployments for owner authorization. This plan does not supersede those guardrails.
- Existing production client and backend are described in collaborators/README.md. **Do not test load against production or touch hosting/secrets.**

## Program rules

1. **Working multiplayer is sacred.** Keep a known-good version available until replacements pass actual two-client tests.
2. **Originality is nonnegotiable.** Reuse licensed mechanisms, not copyrighted brands, characters, proprietary game assets, music, or private server emulators.
3. **The fastest legal, reliable solution wins.** Assess integration effort rather than counting visible features or source lines.
4. **The first 15 seconds matter.** The default experience must not require learning classes, aggression, missions, or advanced controls.
5. **Human play is the product.** Bots are honest substitutes for missing players and practice—not falsely presented as humans.
6. **Measure before declaring a bottleneck fixed.** Every claimed FPS or latency gain needs a baseline and repeatable evidence.
7. **Independent branch work, one integration owner.** No agent edits another agent's files without coordination.
8. **No unapproved production operations.** Docs and draft PRs do not constitute approval to merge, deploy, or submit.

## Approval checkpoints

- **Foundation gate:** retain current baseline / import licensed module / fork another game. Requires evidence.
- **Experience gate:** two independent devices can join the same room and play an understandable complete round.
- **Performance gate:** tested desktop and physical-mobile behavior meets the acceptance criteria or documents a narrowly accepted exception.
- **Release gate:** Andrew explicitly approves merging/deployment; Andrew performs contest submission.

## Status legend

- **VERIFIED SOURCE:** observed in linked repository/code/docs, not necessarily tested live.
- **CANDIDATE:** technically interesting, not build-tested or approved.
- **PROPOSED:** intended behavior or target, not implemented.
- **MEASURED:** recorded reproducible local or real-device data with test environment.
- **SHIPPED:** independently verified production behavior after owner-approved deployment.

Nothing in this planning branch should be represented as SHIPPED.
