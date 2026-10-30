# 07 — Deterministic test matrix, performance budgets and release gates

## Commands and test environments

Current backend supports `npm ci --prefix backend` and `npm test --prefix backend`. Preserve all existing test files. Existing browser suites include `foundation-browser.cjs`, `browser-smoke.cjs`, `mission-browser.cjs`, `recruits-browser.cjs`; PR #22 added `animation-browser.cjs`. Use actual CI availability and exact branch SHA to determine which suites run.

**Do not make these claims before running tests on the implementation:** stable 60 FPS mobile, production 10v10, live 30v30 humans, browser-tab fullscreen on iOS or bug-free rescue under latency.

## 1. Mode and compatibility tests (mandatory)

| Test ID | Scenario | Pass condition |
| --- | --- | --- |
| M-01 | Older join omits `gameMode` | Original Brawl 1v1/5v5 results preserved |
| M-02 | `gameMode='pow'` with same room code as Brawl | Explicit joinError, no state crossover |
| M-03 | Invalid or `adventure` gameMode on arena server | Rejected safely |
| M-04 | Two real independent players join Brawl | Both see same room, scores, finish and rematch |
| M-05 | POW lobby missing opponent | WAITING, no false all-captured victory |
| M-06 | Room full or mismatched team size | Clear reject, no extra/ghost player |
| M-07 | Network interruption in either mode | No stale movement, duplicate join, score or winner |

## 2. Capture & Rescue tests (mandatory)

| Test ID | Exact event | Expected |
| --- | --- | --- |
| P-01 | Unprotected active player hit | Single capture, prison spawn, one capture score |
| P-02 | Same player hit again while captured | No duplicate capture/score |
| P-03 | Captured player moves toward wall or throws | Remains in prison, cannot attack or control flag |
| P-04 | Enemy enters prison or shoots across boundary | Prevented server-side |
| P-05 | Rescuer holds button inside pad 119 ticks | No release |
| P-06 | Rescuer reaches 120 consecutive ticks | Gate opens, all available prisoners release |
| P-07 | Rescuer exits pad/lets go/frozen/disconnect at tick 119 | Progress resets |
| P-08 | Two rescuers simultaneously | No stacking progress or duplicate release award |
| P-09 | Empty prison pad / gate still open | No bonus points or repeated release |
| P-10 | Rescued player under shield | Enemy hit ignored; first offensive throw removes protection |
| P-11 | All active members of one team tagged | Exactly one correct instant winner |
| P-12 | Last remaining player disconnects | 15s reservation, deterministic forfeit, no instant false result |
| P-13 | Timeout score tie | Fewer captured -> more captures -> draw |
| P-14 | Team hold flag 1199 ticks | No buff |
| P-15 | Team hold flag 1200 accrued ticks | One correct active team buff |
| P-16 | Equal center occupancy / captives in center | No zone accrual |
| P-17 | Buff expiry / new buff | One active buff, correct server timer and no stacking |
| P-18 | POW mirror map / exits | Symmetric lanes, non-overlap exit and reachable rescue pads |
| P-19 | 150ms RTT and ~2% loss in local impairment | No client-side completion, no double gate, consistent outcome |
| P-20 | MatchEnd event and rematch | Exactly-once outcome and clean new state |

## 3. Platformer tests

- S-01: physics deterministic across 30/60/120 FPS rendering and tab-resume time clamp.
- S-02: coyote time 6 ticks, buffered jump 6 ticks, no unintended double jump.
- S-03: collision prevents tunneling through 32/48-unit tiles during run/slide.
- S-04: ice surface retains momentum visibly, with safe stopping and no endless slide.
- S-05: checkpoints prevent unfair spawn loops and reset appropriately on fall.
- S-06: accessories collected once; 3/3 needed to enter 20s snowman defense.
- S-07: defensive wave bounded, no infinite enemy spawn; fail and win both reachable.
- S-08: touch and keyboard input can jump+throw while running; blur resets.
- S-09: quitting platformer returns to Brawl with no duplicate animation loops or listeners.
- S-10: platformer runs when Socket.IO server unavailable; does not claim cloud persistence.

## 4. Performance and UX

- Server 60Hz nominal; measure p95 work-time under representative Brawl/POW 5v5 and 10v10 capacity (real human traffic separately).
- Client test 390×844 menu, 844×390 gameplay, tablet, 1280×800 desktop; at least one actual iOS Safari and Android Chrome when available.
- Target p95 frame <=16.7ms on chosen midrange mobile 5v5 scene. Document p99 and thermal limitations.
- Log network RTT, packet sizes, state arrival frequency, status of client prediction (PR #17 remains separately scoped).
- Focus on animation + prison HUD legibility under dense overlapping players. Prison visuals must never imply erroneous passability.
- Test missing audio, reduced motion, fullscreen enter/exit/rotation and touch cancellation.
- Run a small moderated session with at least five novices; record first throw, understanding of prison/gate/flag, completion, and voluntary rematch rather than claiming unmeasured retention.

## 5. Release gates

**G0:** existing Brawl tests unchanged; mode schema backward compatible.  
**G1:** POW pure rule tests pass, including exploit, disconnect and 120-tick rescue.  
**G2:** client/server POW end-to-end with two browsers passes with no JS exceptions.  
**G3:** original platformer vertical slice completes, no corruption of PvP sessions.  
**G4:** all automated tests + available real device testing and matched perf results documented.  
**G5:** staging Vercel + Render are tied to an exact common version; two-client cross-network check and rollback verified.  
**G6:** Andrew approves specific merge and coordinated production deploy; only then deploy.

Stop on any P0 failure: room contamination, false capture/winner, prisoner free-movement exploit, unusable controls, lost reload, non-returning platformer, or a license breach.

## Raw evidence template

```text
Test:
Mode:
Commit SHA:
Server/client build IDs:
Device / browser / network:
Human + bot count:
Map seed:
Steps and exact command:
Expected:
Actual:
Pass / Fail / Blocked:
p50 p95 p99 frame and server tick:
Screenshot or trace:
Owner and reviewer:
```

## Immediate handoff statement

This PR has **only designed and researched** the next implementation. It is NOT a code-complete implementation or a production release. Re-run all applicable tests on future change commits; prior PR #22 benchmark data do not certify the new modes.
