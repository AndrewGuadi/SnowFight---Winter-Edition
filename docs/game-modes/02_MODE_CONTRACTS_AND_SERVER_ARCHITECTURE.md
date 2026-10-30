# 02 — Technical architecture and event contracts

## The minimum safe extraction

Introduce a pure **mode rules interface** under `backend/modes/` without changing existing combat physics or the Socket.IO transport. New mode code must not create a second server loop.

### Suggested files

```text
backend/
  modes/
    index.js               # validate gameMode, resolve rules, default brawl
    brawl.js               # wrapper around legacy hill/score/mission result
    pow.js                 # prison state machine, score, rescue/flag authority
    pow-map.js             # generated mirrored static geometry + trigger regions
    pow-powerups.js        # finite bounded buffs and exact expiration rules
  tests/
    pow-rules.test.cjs
    pow-map.test.cjs
    pow-network.test.mjs
assets/
  modes/
    mode-picker.js         # truthful mode choice, no duplicated Socket code
    pow-render.js          # jail/gate/flag/invulnerability presentation
    platformer/            # separate scene in later PR
docs/game-modes/           # this packet
```

### Rule interface (pseudocode; freeze contract before implementation)

```js
const rules = {
  id: 'pow',
  setup(match) {},              // map, player state, clock, objectives
  onJoin(match, player) {},
  onLeave(match, player) {},
  preTick(match) {},            // progress rescue, buff durations, gate state
  onSnowballHit(match, hit) {}, // decide capture vs frozen, authoritative
  postTick(match) {},           // flag occupancy, win checks
  getPublicState(match) {},    // serialize only public state
  getResult(match) {}          // sole authority for mode-specific result
}
```

For Brawl: keep current algorithms while wrapping their entry points with minimal delegation. Route only where required; initial compatibility PR should produce **identical** Brawl match results for the same inputs.

## Join schema

Existing fields retained:
```json
{"mode":"multi","blue":5,"red":5,"room":"SNOW42","classId":"classic","streamlined":true}
```

New optional field:
```json
{"gameMode":"pow"}
```

If absent, server uses `brawl`. Invalid gameMode is rejected with `joinError` rather than silently placing a client in a different game. Do not accept `adventure` in the server arena join route.

**Room invariant:** shared room code cannot mix `brawl` and `pow`, or mismatch team-size settings. On an existing code, either adopt the host's mode **only when explicitly confirmed by UI** or return clear `joinError` including the required gameMode; never silently cross modes.

## Public state — additive, bounded

```js
match: {
  gameMode: 'pow',    // brawl when omitted by legacy clients
  phase: 'waiting'|'active'|'ended',
  score: {blue: 0, red: 0},
  timeLeft: 240,
  pow: {
    captured: {blue: 0, red: 0},
    rescue: {
      blue: {ownerId: null, progressTicks: 0},
      red: {ownerId: null, progressTicks: 0}
    },
    gates: {
      blue: {openUntilTick: 0},
      red: {openUntilTick: 0}
    },
    flag: {holder: null, blueTicks: 0, redTicks: 0, buff: null}
  }
}
players[id]: {
  captured: false,
  invulnerableUntilTick: 0,
  // existing player fields preserved
}
```

Never serialize private server timers/secrets or change existing player position/hitbox ownership. Keep snapshot payload bounded; avoid attaching entire map geometry every tick. Send fixed map geometry with `init`, changing state with `state`.

## Input and region authority

The client sends normal `input`, including movement and throw. For rescue use an optional **`interact` held boolean**, sanitized by server, not an `openGate` event. Server validates identity, not-captured status, team, position within trigger, alive/not-frozen, held duration and match phase. Disconnection/stale input releases channel.

For solo platformer, **do not** reuse server `input.moveY` as a gravity/jump action. A separate controller owns `moveLeft`, `moveRight`, `jumpPressed`, `throwPressed`.

## Result shape

Maintain existing `matchEnd` event envelope. Add `gameMode`, `reason` (`allCaptured`, `timer`, `forfeit`), scoreboard, and POW-specific summary. Older Brawl clients continue to receive original fields. Results are emitted once and terminal state is idempotent.

## Timing/security

- 60Hz server simulation remains authoritative.
- Capture events occur only from validated server snowball collision.
- Rescue progress uses tick increments and resets on interrupted control.
- Gate releases, powers and expiry checked by exact server ticks.
- Disconnect and rejoin cannot create a free-player duplicate or count a player twice.
- All POW interactive zones are derived from server map; UI uses those same coordinates.
- No client-sent buff selection or prison exit coordinates.

## Milestone for this document

Before implementing POW gameplay, land a separate mode-protocol PR where **existing Brawl tests are unchanged and green**, new fields are inert for Brawl, and matching-room mode conflicts are rejected.
