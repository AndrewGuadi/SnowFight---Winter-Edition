# 02 — Technical Architecture, Migration Contracts and Compatibility

**Status:** PROPOSED. All code paths below are observed on main at be4797ab0bee88c139de3867379fc362bcff8853 unless marked as a future location.  
**Architecture lead:** GPT-6; server authority: GPT-6.1-Sol; rendering lead: Kimi; experience/QA: Meta Muse.

## Current architecture — facts, not proposals

### Frontend

- index.html contains markup, inline styles, inline JavaScript and the main HTML canvas. On review it was approximately 84 KB / 1,377 lines.
- assets/recruits.js draws player/recruit illustrations to Canvas.
- assets/neighborhood.js draws the decorative snow neighborhood.
- assets/ui.css is compiled frontend CSS.
- assets/socket.io.min.js is the vendored Socket.IO browser client.
- Browser game state, menu state, movement/throw controls, snapshot listeners and rendering are tightly coupled within index.html.
- Client input movement sends at roughly 30 Hz; action edges are sent immediately when present. The existing game renders through requestAnimationFrame.

### Backend

- backend/server.js owns the authoritative Node.js + Express + Socket.IO game simulation, rooms, players, bot AI, movement and scoring.
- backend/gameplay.js validates input and performs swept segment-circle collision math.
- backend/classes.js owns server-side character movement/weapon tuning, ability behavior and shot definitions.
- backend/missions.js supplies mission presets/progress.
- backend/tests/ includes network, mission, mode, class, arena and browser regression suites.
- Simulation uses a nominal 60 Hz timer; active state broadcast is every 2 ticks (~30 Hz). Those are configured cadences, not independently measured production rates.
- Match dimensions are presently 3000 x 2000 world units; player speed, collision and timing depend on tick-owned server constants.
- Full room state contains players, snowballs, structures, tick/serverTime and match metadata.

### Multiplayer limits

- Join recognizes single or multi, with size constraints. Human multiplayer seats are humans only in the current server; no universal public bot backfill is implemented.
- Supported shared sizes include 1v1, 1v5, 5v5, 10v10. 30v30 is for solo bots only.
- Private room codes are supported; no full persistent accounts or large-scale matchmaking architecture should be assumed.
- A real 30v30 humans launch is a separate load, networking, operations, abuse, identity and moderation project.

## Critical related work: PR #17

https://github.com/AndrewGuadi/SnowFight---Winter-Edition/pull/17

At the time of this plan, PR #17 is **OPEN**, not incorporated into baseline main. Its description/files claim to introduce:
- assets/prediction.js for local movement prediction/reconciliation.
- Server input sequencing and acknowledgment.
- backend/snapshot.js for lean player/projectile DTOs.
- Regression tests for physics parity, stale packets and two-browser behavior.

**Avoid duplicate work.** GPT-6.1-Sol must inspect current PR status, current head SHA, diff and any merge conflicts with main. No one may assume its code is live or duplicate the system in a new Phaser client without a decision record. Recommended order: evaluate PR #17 independently, confirm test results and evaluate its compatibility contract, then decide whether to base a future client prototype on it. No unapproved merge.

## Architecture strategy: two tracks

### Track A — contest stability

Keep server and existing working entry point. Make narrowly scoped changes on isolated feature branches; merge only by owner approval. Prefer small, reversible, explainable changes. This path does not require Phaser.

### Track B — future browser client proof of concept

Phaser 4.2.1 + Vite + modern JS/TypeScript can replace custom Canvas drawing and event handling **without rewriting the authoritative server**. Start the client in a separate directory; don't replace index.html on main. The POC should use a local/test backend and follow the same wire protocol.

Suggested later directory layout (NOT CREATED IN THIS DOCS BRANCH):

~~~text
client/
  index.html
  package.json
  vite.config.*
  src/
    main.*
    scenes/BootScene.* MenuScene.* ArenaScene.* ResultsScene.*
    ui/CharacterCreator.* HUD.*
    input/TouchController.* DesktopController.*
    network/SocketAdapter.* SnapshotBuffer.* PredictionAdapter.*
    rendering/KidSprite.* ProjectileView.* VfxPool.*
    assets/sprites/* 
    tests/*
backend/
  server.js             # existing baseline, change only by reviewed compatibility PR
  gameplay.js           # existing input/collision contract
  classes.js            # existing server-tuned values
  missions.js           # existing mission rules
  tests/*
docs/rebuild/
~~~

**Why not copy a Phaser 3 open-source game wholesale into a Phaser 4 client?** Phaser 4 introduced rendering and API changes. First test the precise code against the pinned engine version and official migration guide. A Phaser 3 module should not be treated as a drop-in Phaser 4 component.

## The authoritative protocol — existing baseline

### Client -> server

- Event "join" with mode, blue, red, difficulty, mission, aggression, classId, room.
- Event "input" with finite moveX, moveY, angle; optional dash, gather, ability, throwStart, throwRelease, cancelCharge.
- Event "latency" with acknowledgment callback for RTT measurement.

### Server -> client

- "init" after join, with id, world width/height, obstacles, team, classId, classes, match descriptors including roomCode.
- "state" with players, snowballs, structures, tick, serverTime, match (score/hill/overtime/end state and mission).
- "effect", "hit", "abilityDenied", "joinError", "matchEnd" and normal Socket.IO disconnect/reconnect events.

Client implementations must tolerate optional fields and reflect the server's authority. No client-derived score, collision, hit, or class/ability grant should modify the official result.

### Evolution plan

1. Pin a protocol version and write a fixture representing the existing join/init/state/input exchange.
2. Preserve compatibility when adding cosmetics or input sequence fields: server defaults must keep old clients working until migration.
3. Add optional cosmetic data (skin, coat, hat) only after validation and size limits; don't let client cosmetics dictate player hitbox/team.
4. Acknowledge sequenced input and reconcile only movement; keep hit/score authoritative.
5. Reject stale or out-of-order input without suppressing actual discrete throw events.
6. Do not increase network packet frequency to mask poor interpolation.

## Client prediction

PR #17 is the current candidate; test it rather than rewriting. The correct design includes: local predicted movement, server-sent acknowledgment of last processed input, bounded pending-input replay, correction thresholds, obstacle-parity tests, stale packet rejection, no double-trigger of throw/dash on replay and a stable fallback under loss.

The renderer should keep independent presentation transforms for local predicted position and remote interpolated positions. An avatar should not teleport solely because a visual animation was replaced. Prediction and simulation should not race one another via duplicate client game loops.

## Rendering separation

Scene graph represents:
1. Background / ground tile or cached art.
2. Static obstacle colliders and visual cover.
3. Dynamic players with layer-composed kid sprites.
4. Snowballs and their trails, with pooled effects.
5. HUD as screen-space display, not world-space.
6. Accessibility/reduced-motion alternatives.

The server is the source of obstacle truth; visuals must agree on bounds and passability. Physics engines inside Phaser can help presentation but must not become an independent authority for match collisions.

Render only visible entities; use sprite atlases or cached textures for repeated elements where profiler evidence justifies it. Avoid per-frame allocations and excessive filters. Character customization should be palette/layer-based and not require one full texture atlas per color combination.

## Server + AI performance considerations

- Current room snapshots serialize every player; bandwidth scales with room size and snapshot rate.
- Bot decision and nearest-target loops run in the server simulation; 30v30 bots should be profiled before introducing new navigation libraries.
- Projectile and obstacle collision scans currently include linear searches; a uniform spatial grid is a candidate **only if profiling supports it**.
- A better bot separation algorithm can first be implemented as lightweight vector steering without importing full navmesh/RTS infrastructure.
- Split AI strategic decisions (e.g. 5–10 Hz) from physical steering/inputs (60 Hz) if tests show equivalent behavior and lower cost.
- Add instrumentation to separately measure tick cost, serialization cost, network bytes, event-loop delay and client frame time.

## Future protocol for cosmetics and rooms

### Guest cosmetics (proposed, not yet supported on wire)

- skinTone: validated identifier from a fixed palette, not arbitrary HTML.
- jacketColor: fixed palette ID.
- hatColor: fixed palette ID.
- displayName: optional, length-limited and sanitized.
- guestId: optional locally generated opaque identifier; not proof of authentication or permanent ownership.

When no cosmetics are sent, display defaults. Cosmetic IDs affect visual rendering only.

### Room backfill (future)

Bots in human rooms require explicit server work: choosing seat count and slot semantics, distinguishing disconnected human seats, managing bot removal upon rejoin, no scoring exploit and disclosing player/bot makeup. Do not claim 5v5 with human + bots is implemented in current online multi mode.

## Feature flags and compatibility strategy

Use explicit branch/commit boundaries. Experimental simplified auto-reload, aiming assist and knockout scoring must have separate server/client changes with tests. The default contest build may ship with current hill scoring if that is the only verified mode. Never quietly change simulation semantics while presenting a Phaser renderer proof of concept.

## Build and operations

Current test baseline:

~~~sh
npm ci --prefix backend
npm test --prefix backend
node backend/server.js
~~~

A local backend serves index.html and assets. Later Vite POC needs an isolated dev client with the Socket.IO endpoint explicitly pointed at the local/test server; do not let it default to production Render for load tests. Production build output must have no references to a developer's localhost service.

## Architecture acceptance gate

- Existing tests remain green before and after any backend change.
- Two independently launched browsers join one room, see the same authoritative winner/score, and rematch without stuck controls.
- New client and old client can coexist during a staged compatibility test, or migration is blocked.
- All imported code/assets carry correct licenses and provenance.
- Real mobile device tests cover pointer cancellation, rotation, page backgrounding and reconnect.
- Benchmark and failure evidence are stored with exact commit IDs.

No backend or rendering migration has occurred from these documents alone.
