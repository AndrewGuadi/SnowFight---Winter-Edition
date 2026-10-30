# 11 — SnowFight Next Playable Foundation: Implementation Report

**Status:** IMPLEMENTED ON ISOLATED BRANCH; NOT MERGED; NOT DEPLOYED; NOT CERTIFIED ON REAL DEVICES.  
**Branch:** docs/rebuild-reuse-first-2026-10-30  
**Draft PR:** https://github.com/AndrewGuadi/SnowFight---Winter-Edition/pull/20  
**Mainline baseline at branch creation:** be4797ab0bee88c139de3867379fc362bcff8853  
**Owner:** Andrew; implementation/integration: GPT-6.  
**Intent:** Establish the next usable baseline **before visual polish and engine migration**.

## Executive implementation decision

The project now has an **opt-in streamlined classic kid experience** while preserving the original advanced modes and old protocol behavior for older clients. The branch includes a guest-first entry screen, a three-choice kid creator, cosmetic data transmitted to/validated by the server, a childhood winter kid sprite with team markings, automatically re-rolled snowballs for the streamlined kid, less cluttered controls, solo practice tap-aim assistance, a more informative waiting state in online matches, and bot steering that no longer sends every bot to one precise hill-center point.

This is deliberately **not** a switch to Phaser 4. The major performance and prediction code in open PR #17 needs a separate compatibility and test review, and the contest's multiplayer requirements favor preserving our functioning authoritative simulation for now.

## Actual changes in this branch (not all feature-complete)

| Area | Files | What changed |
| --- | --- | --- |
| Main front door | assets/foundation-ui.js, assets/foundation.css, index.html | Play Online (5v5 human room), Practice with Bots, Play With Friends, Make Your Kid; older complexity moved behind Advanced |
| Cosmetics | backend/cosmetics.js, assets/foundation-ui.js, backend/server.js | Four selectable skin tones, five jackets, five hats, validated on the server, saved locally for guests; server snapshots expose visual choices to other players |
| Sprite art | assets/recruits.js, index.html | Original winter kid avatar displayed for streamlined Classic, independently chosen colors and a blue/red team indicator ring |
| Controls | index.html, backend/server.js | Default desktop WASD+mouse, touch move-and-throw, server-driven automatic snowball replenishment for Classic joins with streamlined:true; PACK/DASH are hidden for streamlined Classic |
| Beginner assist | index.html | Solo-practice **tap** auto-orients toward a close enemy; dragging still aims manually; multiplayer does not auto-snap |
| Bot movement | backend/bot-steering.js, backend/server.js | Deterministic hill slots, teammate repulsion and nearby obstacle avoidance; existing server physics/collision and difficulty tuning preserved |
| Test coverage | backend/tests/rebuild-foundation.test.cjs, backend/tests/foundation-browser.cjs and two updated legacy smoke scripts | Regression cases for input compatibility, cosmetics, center clustering and guest entry |
| CI | .github/workflows/foundation-checks.yml | GitHub Actions for backend npm tests plus Chromium Playwright browser suites on PR / rebuild-branch pushes |

**The original single-player missions/classes, manual packing and advanced controls were not deleted.** Older clients still omit streamlined:true and therefore retain manual pack semantics. Importantly, this makes the new interface possible without turning other existing modes into incompatible experiences.

## Actual default behavior

1. Open page: guest-first front door. No account and no install.
2. "PLAY ONLINE": joins a public 5v5-capable **human-only** room (the currently available backend mode). It **does not** silently insert bots. When no opponent has joined, the HUD explicitly says it is waiting.
3. "PRACTICE WITH BOTS": enters existing solo mission flow using the streamlined Classic kid, optional practice aim assistance and auto reload.
4. "PLAY WITH FRIENDS": create or enter room code, copy share URL, then enter the private human match. Room-link landing uses a 5v5 default; existing room owner capacity still governs where a room exists.
5. "MAKE YOUR KID": choose skin/jacket/hat. Appearance persists in this browser and is sent as a validated appearance payload. Other clients see the colors when snapshots arrive.
6. "ADVANCED GAME OPTIONS": retains legacy class selection, mission presets and options for existing power-user functionality and regression tests.

## Compatibility contract

### New optional join fields

Client may send:
~~~json
{
  "streamlined": true,
  "appearance": {
    "skin": "#DEAC82",
    "jacket": "#367FB6",
    "hat": "#DB4E51"
  }
}
~~~

These fields are server-validated. Only the Classic class receives automatic reloading under streamlined:true. The optional appearance fields are constrained to palettes in backend/cosmetics.js. Unrecognized color inputs fall back to safe defaults. Neither appearance nor palette changes affect team, collision, movement speed, aim, damage or winner.

### Existing authoritative events retained

join/init/state/input/effect/hit/matchEnd/latency plus existing room and mission behavior. Server side hit and scoring logic remain authoritative; no new client-authoritative projectile decisions were introduced. Older clients require neither new field.

### Honest multiplayer caveat

"PLAY ONLINE" uses existing public **human-only** matches. Room capacities are up to 5v5 for this path, but a lobby might contain only two people. It is not presently an intelligent queue with bot backfill and persistent matchmaking. **30v30 real human multiplayer is not implemented.**

## Verification obtained so far

**Validated in an isolated JavaScript execution harness with mocked Express/Socket.IO (not a full Node or real-browser run):**
- Cosmetics reject invalid/untrusted input and preserve valid palette selections.
- Thirty distinct deterministic bot hill positions are produced.
- Classic auto-reload completes without manual pack when opted in.
- Legacy Classic without the flag still requires packing.
- Bots from the same starting location generate distinct steering vectors.
- Two distinct human sockets entering one room code share the same match and receive correct player appearance and opt-in controls.
- Front-door dynamic menu generates the expected palette choices, stores guest look locally, starts online 5v5, starts solo practice and creates/joins friend rooms.
- A 600-tick isolated 30v30 solo simulation (59 bots and one human) finished without non-finite positions or close-range same-team pairs in that final sample; coarse timing in this harness is **not a deploy or device performance benchmark**.
- All modified source scripts were syntax-parsed in the JavaScript runtime.

**NOT VERIFIED by this work session:** npm test on a real Node installation; Chromium/Playwright screenshots and touch tests; real iOS/Android performance; the actual GitHub Actions jobs' conclusion; WebSocket latency under real Internet conditions; accessibility review by human testers; production deployment. Keep the PR in draft until these checks are complete.

The CI workflow is configured to run:
~~~sh
npm ci --prefix backend
npm test --prefix backend
cd backend && npm install --no-save --package-lock=false playwright
cd backend && npx playwright install --with-deps chromium
node backend/tests/foundation-browser.cjs
node backend/tests/browser-smoke.cjs
node backend/tests/mission-browser.cjs
node backend/tests/recruits-browser.cjs
~~~

**Do not claim these commands passed until their exit codes and CI logs are verified.**

## What still needs development before calling this polished

P0 — verify all CI and browser tests, fix regressions, test two independent humans and their private invite/rematch path, test mobile hardware, ensure no stuck controls or showstopper lag. Owner reviews and approves the eventual release.

P1 — run real measurements and review PR #17's existing prediction/reconciliation approach; improve the bot obstacle planner if steering traps remain; add clarity to first-hit and game-objective cues; visually inspect all skin/outfit permutations and performance on midrange devices; trim unnecessary in-match HUD.

P2 — public bot-backfilled quick matchmaking, more authored arenas, original high-quality animation/audio, optional persistent accounts, 15v15/30v30 humans, Phaser 4 client pilot with apples-to-apples benchmarks.

## Next implementation iteration — measurable gates

Before more graphics or a wholesale engine migration:
1. **CI gate**: backend suite and Chromium browser smoke all green at exact branch SHA.
2. **Real device gate**: mobile landscape (iOS Safari + Android Chrome when available), keyboard/mouse desktop, interrupt/resume and repeated touch throws.
3. **Human multiplayer gate**: two different devices/networks enter same shared room; winner and rematch agree, no misleading AI indication.
4. **Responsiveness gate**: record current input latency and frame-times, and evaluate PR #17 rather than duplicate it.
5. **Bot gate**: fixed-seed tests plus multi-map video; measure clustering, CPU and pathfinding failures.
6. **Owner gate**: explicit approval of exact commit to merge/deploy. This branch remains a draft until then.

## Known risks / technical debt

- The frontend remains an older monolithic Canvas app with an additive script replacing its first screen. This is a controlled bridge, **not** the desired final modular client architecture.
- The new menu is dynamically composed and needs real Playwright/physical-device validation.
- Only Classic joins with streamlined:true get automatic snowball replenishment; other classes intentionally retain advanced controls.
- Peer availability is low if few humans are online. Public bot backfill is future server work and must be disclosed honestly.
- The simplified frontend currently still contains legacy modes and UI code; extraction/removal should happen after a verified playable baseline, not during contest-critical stability work.
- PR #17 includes potentially useful prediction code and remains a separate branch. Do not implement an incompatible second netcode system.

## Branch safety

No change to main, no merge, no Render/Vercel deployment, no settings/secrets changes and no contest submission. External collaborators have not been automatically assigned work. PR #20 provides the review and integration context.

**Decision for this update:** the next foundation exists as code and tests on a separate branch. It is a **candidate baseline**, not a verified release. Polish only after evidence gates pass.
