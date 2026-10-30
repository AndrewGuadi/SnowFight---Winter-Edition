# 09 — Dependency-Ordered Implementation Backlog

**Status:** PROPOSED, NOT ASSIGNED OR STARTED.  
**Task ID convention:** SF-###. Every task requires a branch, PR and acceptance evidence unless it is a read-only investigation.  
**Time horizon:** C0 contest candidate; C1 next stable iteration; C2 strategic growth.

## Rules for agent selection

- A ticket is not complete because an AI says "done"; tests and reviewer evidence are mandatory.
- An agent's name in this backlog does not imply access, active job execution or authorization to deploy.
- Owners must select a current main SHA before code changes and avoid overlapping file edits.
- Any external source file requires a reuse/license decision first.
- If C0 scope fails a gate, ship the known-good fallback rather than stack unfinished changes.

## C0 — six-hour contest critical path

| ID | Priority | Owner | Dependencies | Target | Acceptance |
| --- | --- | --- | --- | --- | --- |
| **SF-001** | P0 | GPT-6 + Muse | none | Baseline/code inventory | Record main SHA, open PRs, tests, first-run screenshots, exact failures. |
| **SF-002** | P0 | Sol + GPT-6 | SF-001 | Reuse/fork foundation gate | Audit licenses, clean-build top contenders, prove two-client match or retain SnowFight. |
| **SF-003** | P0 | Muse + GPT-6 | SF-001 | Guest/Play/Friends main screen | No mandatory mission/class/settings barrier; guest enters match and invitation flow remains intact. |
| **SF-004** | P0 | Muse + Sol | SF-003 | Mobile/desktop throw controls | Move+throw reliably; no stuck input under pointer cancel, blur or disconnect. |
| **SF-005** | P0 | Sol | SF-001 | Private room correctness | Two distinct clients, same room, one score/winner, results and rematch; test full room. |
| **SF-006** | P0 | Muse | SF-003–005 | End-to-end browser tests | Fresh browser, friend link, 90s match, rematch, mobile touch; repeatable evidence. |
| **SF-007** | P1 | Kimi | SF-001 | Original default kid + snow hit feedback | Clear silhouette, local asset rights, screenshot on mobile; effects bounded. |
| **SF-008** | P1 | Sol | SF-001 | Bot clustering minimal fix | Distinct center slots/separation; fixed-seed 5v5 and 30v30 solo no persistent pileup; hill scoring intact. |
| **SF-009** | P1 | Muse + Kimi | SF-003 | Minimal 3-choice guest customization | Skin/jacket/hat, safe defaults, saved locally, does not change physics or pretend remote sync. |
| **SF-010** | P0 | GPT-6 + Muse | SF-003–009 | Final release-candidate verification | All necessary tests PASS, known-good rollback, no P0, distinct device evidence. |
| **SF-011** | P0 / Owner | Andrew | SF-010 | Approved deployment/submission | Explicit owner merge/deploy approval, live smoke, owner submits. |

**C0 scope cutting:**
- SF-007/008/009 can be reduced or postponed if they endanger SF-005/006.
- SF-003 cannot remove necessary PACK behavior without server-supported auto-reload; retain a contextual workable gather pathway until SF-020.
- No implicit public human/bot matchmaking if server multi mode remains humans-only.
- No Phaser migration dependency for any C0 ticket.

## C1 — after reliable contest baseline

| ID | Owner | Dependencies | Target / proposed file areas | Definition of done |
| --- | --- | --- | --- | --- |
| **SF-020** | Sol | SF-004 | Server-authoritative automatic snowball replenishment in backend/server.js and tests | Consistent ammo/cooldown across clients, no double-shot, no stuck empty hand, balanced timing. |
| **SF-021** | Sol | SF-001 | Review open PR #17 (assets/prediction.js, backend/snapshot.js, index.html) | Rebase/merge evaluation, all tests independently reproduced, latency improvement measured, owner decision. |
| **SF-022** | Sol | SF-008 | Bot role states + lane/obstacle routing | Bot navigation benchmark, hill fairness, deterministic tests, no runaway CPU. |
| **SF-023** | Kimi + GPT-6 | SF-001, SF-002 | Phaser 4.2.1 isolated client/ folder with Vite | Renders the same arena and joins local server; benchmark apples-to-apples vs Canvas. |
| **SF-024** | Kimi | SF-007, SF-009 | Layered sprite/atlas and pose pipeline | Cosmetics visible on all players after protocol support, consistent animation, asset budgets. |
| **SF-025** | Sol + GPT-6 | SF-009, SF-021 | Cosmetic join/state extension | Server validation, backwards compatibility, no ability to spoof physics/team, size limits. |
| **SF-026** | Sol | SF-005 | Public matchmaking/bot backfill | Humans given priority, bots disclosed, room filling + leaving + reconnect tested. |
| **SF-027** | Muse | SF-003, SF-006 | Tutorial and accessibility | Time-to-first-throw measured, keyboard/touch paths, contrast/motion review. |
| **SF-028** | GPT-6 + Sol | SF-023 | Engine go/no-go report | Same device/map/effects; p50/p95/p99, memory/network, migration cost and fallback. |
| **SF-029** | Kimi + Muse | SF-007 | Authored neighborhood arena(s) | Static obstacle visual/collider parity, spawn fairness, lanes, mobile readability. |
| **SF-030** | Sol | SF-005 | More robust match lifecycle | Reconnection, rejoin, stale bot seat handling, server restart/timeout tests. |

**SF-023 is a proof of concept**, not authorization to ship Phaser. It must not overwrite root index.html or call production server for load tests.

## C2 — long-term feature and scale roadmap

| ID | Owner | Objective | Proof needed |
| --- | --- | --- | --- |
| SF-040 | Sol | 15v15, then 30v30 real-human capacity | Load and fairness tests, bandwidth/serialization, hosting/abuse strategy. |
| SF-041 | Sol | Network interest management, delta snapshots if needed | Measured bandwidth win and no desynchronization. |
| SF-042 | Sol | AI objective director, navmesh/waypoint library if needed | Improved match outcomes without bots swarming or cheating. |
| SF-043 | Kimi | Multiple original seasonal/neighborhood arenas | Visual identity, balance/spawn/cover proofs. |
| SF-044 | Muse | Full UX system, player retention/feedback research | Cohort-level observation with privacy-first measurement. |
| SF-045 | GPT-6 + Sol | Optional persistent identity/friends/social features | Security/privacy plan, moderation, account recovery, consent. |
| SF-046 | Kimi + GPT-6 | Native wrapper or engine alternative evaluation | Real player need and quantified distribution/maintenance benefit. |
| SF-047 | GPT-6 | Third-party components/attribution inventory | SBOM, attribution, library updates and auditability. |

## Ticket template (use in GitHub issues/PRs)

~~~text
ID / title:
Player problem:
Current observed behavior (source + evidence):
Desired behavior:
Scope / non-goals:
Owner:
Reviewer:
Branch + base SHA:
Affected files:
Existing solutions examined:
Chosen implementation and legal basis:
Protocol/backward-compatibility impact:
Unit tests:
E2E and physical device tests:
Performance/bandwidth budget:
Before/after evidence:
Rollback method:
Decision needed from Andrew:
~~~

## Proposed PR sequence

1. Baseline/research issue and current test evidence (SF-001/002).
2. UX front door and control safety in their own small PRs (SF-003/004).
3. Multiplayer correctness and browser smoke (SF-005/006).
4. Visual and modest bot improvements as independent PRs (SF-007/008/009).
5. Owner-approved contest release branch after tests (SF-010/011).
6. **After contest:** independently inspect PR #17 and decide integration before beginning a different prediction design; run Phaser POC separately.

Do not batch six unrelated systems into one PR. A small high-confidence improvement is preferable to a large partially tested rewrite.

## Team blockers and escalation

- License unavailable -> no reuse; seek alternative.
- Another agent edits same file -> stop and coordinate merge order.
- Needed server behavior not supported -> do not disguise with client UI; raise dependency.
- Performance measurement unavailable -> mark hypothesis, not PASS.
- Owner approval missing -> hold branch/draft PR, no deploy.
- Deadline approaches -> freeze scope, ship known-good tested candidate only.
