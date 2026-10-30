# SnowFight: Three Modes — implementation-ready build packet

**Status:** Design + technical research complete; NOT implemented by this PR.  
**Base:** `docs/rebuild-reuse-first-2026-10-30` after PR #22 (`8c929c973869becaf8244c3ebc085cc6f77588b3`).  
**Branch:** `docs/three-game-modes-implementation-2026-10-30`.  
**Authority:** Andrew decides final game rules, merge/deploy. No production edits or server migration authorized by this planning PR.

## The three product experiences

| Mode ID | Player name | Camera and physical model | Win condition | Release order |
| --- | --- | --- | --- | --- |
| `brawl` | **Neighborhood Brawl** | Existing top-down Canvas / 60Hz authoritative Node server | Existing hill points, then freezes, with existing overtime | 1 — preserve and simplify |
| `pow` | **SnowFort: Capture & Rescue** | Same top-down engine, authored mirrored prison/flag arena | Capture entire enemy team, else score at time | 2 — signature mode |
| `adventure` | **Snow Day Adventures** | Separate side-view, gravity/jump scene and controller | Short level-specific objectives | 3 — separate vertical slice |

**Definitions are deliberately frozen for the first build** in the linked specs. Later tuning is controlled by explicit versioned game-mode configs; the next coding session should not need to reopen the conceptual research.

## Read / build in order

1. [01_RESEARCH_AND_DECISIONS.md](01_RESEARCH_AND_DECISIONS.md) — verified existing code, technology choices, reuse and rejected approaches.
2. [02_MODE_CONTRACTS_AND_SERVER_ARCHITECTURE.md](02_MODE_CONTRACTS_AND_SERVER_ARCHITECTURE.md) — exact shared API/state/event plan.
3. [03_NEIGHBORHOOD_BRAWL.md](03_NEIGHBORHOOD_BRAWL.md) — preserve PvP and make the mode choice truthful.
4. [04_SNOWFORT_POW_SPEC.md](04_SNOWFORT_POW_SPEC.md) — prison, rescue trigger, power zone, scoring and exploit rules.
5. [05_SNOW_DAY_ADVENTURES.md](05_SNOW_DAY_ADVENTURES.md) — original platformer physics, mission slice and progression.
6. [06_BUILD_SEQUENCE_AND_AGENT_HANDOFFS.md](06_BUILD_SEQUENCE_AND_AGENT_HANDOFFS.md) — sequenced tickets, file ownership, scope cuts and PR gates.
7. [07_TEST_MATRIX_AND_RELEASE_GATES.md](07_TEST_MATRIX_AND_RELEASE_GATES.md) — deterministic rule cases, real multiplayer end-to-end and device validation.

## Non-negotiable principles

- **One lobby, three distinct game types.** Do not pretend PvP, side-scroller and POW are one rule set.
- **Authoritative game results.** No client-generated captures, releases, zone control or power-up grants.
- **No silent regression.** Existing PvP rooms, throw/reload, invitation links, customization, classic characters, animation and fullscreen must remain working.
- **No copy of protected art or gameplay branding.** Licensed source examples are not licensed asset packs.
- **No in-match login or install requirement** for PvP or POW.
- **No unnecessary overhaul.** Reuse the current server for top-down modes; a platformer scene is isolated.
- **No deploying until production/backend match is verified.**
- **No 30v30 human claims.** Capacity requires independent stress and UX testing.

## Build acceptance in one sentence

Two real clients can enter the same selected top-down mode and agree on its match outcome; prisoners cannot interfere with play, an uninterrupted two-second rescue works, the center grants bounded power-ups, and the platformer can complete one original funny short mission without corrupting arena play.

## Research source register

- Primary code: `backend/server.js`, `backend/gameplay.js`, `backend/neighborhood.js`, `index.html` and `docs/rebuild/` in this repository.
- Socket.IO room scope and server-only membership: https://socket.io/docs/v4/rooms/
- Phaser official physics: https://phaser.io/oss/docs/phaser/concepts/physics
- Phaser tilemap collision examples: https://phaser.io/oss/examples/v4.1.0/tilemap/collision
- Phaser official examples license warning (code MIT, **assets not**): https://github.com/phaserjs/examples
- No third-party code or artwork imported in this planning branch.
