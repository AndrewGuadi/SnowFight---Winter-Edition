# 01 — Prebuild research, current code audit and binding decisions

## Existing code observed

At rebuild baseline `8c929c973869becaf8244c3ebc085cc6f77588b3`:

| Component | Evidence | Consequence |
| --- | --- | --- |
| `backend/server.js` | `createMatch`, `tickMatch`, `matchStateInfo`, `endMatch`, `join`, room-code matching, hill-score tracking and 60Hz loop all live together | Extract mode-specific rules with small seams; avoid a single giant switch scattered everywhere |
| `backend/gameplay.js` | Input sanitizer + swept projectile collision | Reuse combat validation for top-down Brawl/POW |
| `backend/neighborhood.js` | `makeNeighborhood` mirrored arena, 3000×2000 world | New POW map must define prison/gate/trigger geometry independently and preserve spawn fairness |
| `assets/recruits.js`, `assets/animation.js` | Existing original customizable kid presentation and animation | Preserve it, share sprite identity with later platformer |
| `index.html` | Large Canvas client has menu, network, game loop and gameplay drawing together | Use additive modular mode selector; extract isolated UI components before editing more renderer logic |
| `backend/missions.js` | Existing solo objective presets, not side-scroller physics | Do **not** reinterpret these as platformer missions |
| `backend/tests/` | Node test runner and actual browser tests | Add mode-specific tests rather than replace existing suites |
| Network | Socket.IO `join`/`init`/`state`/`effect`/`hit`/`matchEnd` and room isolation | Use backwards-compatible `gameMode` field, retain all existing room events |

### Key hazards

1. The existing `mode` field identifies **`single` or `multi`**, not gameplay rules. Do **not** overwrite it with `pow` or `adventure`. Introduce a new `gameMode` property.
2. Existing `match.hill` and `match.score` have different meanings from prison captures. Keep their original meaning in Brawl and add separate `pow` state for POW.
3. Existing timeout logic includes overtime and mission overrides. It must not decide POW match outcomes.
4. Existing `isFrozen` represents temporary incapacitation. POW prisoners need a **separate** `captured` boolean/state and designated spawn/exit.
5. Existing bots can pursue nearest enemy and hill goals. They cannot use POW geometry unchanged; restrict initial POW mode to human private rooms, then add policy-aware bots.
6. Existing `index.html` is a shared hotspot. Centralize field rendering or UI changes in one integration branch per stage.

## Verified external technology

- Socket.IO has server-only rooms and scoped broadcasts (`io.to(room).emit(...)`), making per-match rule isolation consistent with the existing architecture: https://socket.io/docs/v4/rooms/
- Phaser provides Arcade Physics with simple circle/rectangle collision and gravity suitable for a **separate** platformer scene, plus extensive tilemap examples: https://phaser.io/oss/docs/phaser/concepts/physics and https://phaser.io/oss/examples/v4.1.0/tilemap/collision.
- Phaser's example source is MIT, while its bundled examples' **assets are not reusable merely because the source is MIT**: https://github.com/phaserjs/examples.
- A browser-platformer vertical slice can also use a small custom fixed-timestep AABB engine. We should first reuse current character art and minimize dependencies; import Phaser only if a two-day sandbox spike demonstrates a benefit over a tiny isolated platformer physics module.
- No external game repository has been verified as a better complete starting point for these three modes. The current authoritative SnowFight server is the recommended base.

## Architecture decisions locked for the first build

**ADR-GM-001:** `mode` remains `single|multi`; `gameMode` becomes `brawl|pow` for server top-down matches. `adventure` is a browser scene, not a `ServerPlayer` mode.

**ADR-GM-002:** Default Brawl rules unchanged: retain established hill, freeze, overtime, rematch and existing 90-second clock. No new multiplayer class balance.

**ADR-GM-003:** POW uses a newly authored mirrored arena, a capture state distinct from freeze, server-owned rescue progress, team-wide capture-win evaluation, and explicit timed score.

**ADR-GM-004:** POW flag is **zone control and power-up generation** in v1, not a carried flag. Player requests call it SnowFort Flag / Power Zone. Actual carried-flag mechanics are deferred.

**ADR-GM-005:** POW v1 uses private human-vs-human rooms, 5v5 maximum **capacity**, with a minimum of 2 actual humans (one per team). Never advertise 5v5 human population when only two are connected. A 1v1 game can end on first capture; rescue primarily becomes meaningful in 2v2+.

**ADR-GM-006:** POW gets its own win/scoring handler. No conditional reuse of Brawl's `endMatch` scoring.

**ADR-GM-007:** POW rescue is 120 **server simulation ticks** (2 seconds nominal at 60Hz) with server validation on every tick. Do not trust a client-sent `rescueComplete` event.

**ADR-GM-008:** Captured player cannot throw, collide with active projectiles, leave prison bounds, control center or activate a rescue. On rescue they exit by a server-validated safe spawn and receive 2 seconds of one-time invulnerability that ends on offensive throw.

**ADR-GM-009:** The platformer uses a distinct camera, gravity/jump collision, deterministic level state and no live competitive network for v1. After one working solo mission, consider cooperative play with a separate authority decision.

**ADR-GM-010:** Mode choices are clear on the main menu, with Brawl the default and POW friend matches explicit. Advanced mission presets remain available without being the new platformer.

## Explicit non-goals for the first implementation

- 30v30 live humans, account or battle-pass system.
- Cross-mode progression or currencies.
- Massive procedural platformer generator.
- Complex combat classes and shop mechanics within POW.
- Full client rewrite, Phaser migration of existing top-down modes.
- Dedicated fleet/orchestration service at runtime.
- Production deploy based only on mocked tests.

## Decisions not requiring new research next build

- Network library: existing Socket.IO.
- Multiplayer authority: existing Node server with a per-mode rule registry.
- PW state: distinct captured state and geometry.
- Prison gate rescue: server-owned 2s channel.
- Power-zone v1: occupancy grants one controlled team buff periodically.
- Platformer scene: isolated first, only original/licensed art.
- Test runner: existing Node tests + Playwright.
- Rollback: preserve original main and isolated PRs.

## Open tuning choices (not blockers)

Exactly **two things** should be playtested before locking final values: team power-up cycle (proposed 20s) and POW timeout scoring weights (proposed below). The code should make these configuration values constants, not hardcoded dispersed across methods.
