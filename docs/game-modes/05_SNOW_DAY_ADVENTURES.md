# 05 — Snow Day Adventures: isolated side-view platformer

## Product goal
A tightly produced 90–150 second solo platformer level that feels like a funny childhood winter mishap, not a second giant multiplayer engine. Reuse the current customizable winter kid, sprite animations, snowball particles and soundtrack approach. Side-on camera/physics are **separate** from top-down match simulation.

## Vertical slice #1 — Save Mr. Frosty
**Premise:** The neighborhood snowman is under attack from goofy snowball-throwing kids. Run across short rooftops, slide under a snowbank, cross an icy driveway and protect Mr. Frosty before the snowballs knock off his hat.

### Concrete 120-second level
- 4 horizontally sequenced scenes in one continuous tilemap: backyard (tutorial), snowbank hop, slippery driveway, snowman defense.
- Controls: Left/Right move, Jump, Throw. Touch: left thumb directional + right Jump/Throw with large separate hit areas. Keyboard: A/D or arrows, Space jump, mouse click or F throw.
- Movement: horizontal acceleration/friction; capped run; one jump; **coyote time 6 simulation ticks**, jump buffering **6 ticks**, predictable variable-height jump when held up to 10 ticks. No double-jump in v1.
- Icy surface lowers deceleration and carries horizontal momentum; visible sparkly blue tint and audible cue.
- Mistakes: falling into snow returns to nearest checkpoint (no graphic harm), 3 retries per segment and light comedic reaction.
- Objective: recover **three missing snowman accessories**, then defend Mr. Frosty for **20 seconds** from a bounded wave of 3 low-intensity opponents. A counter states 0/3 collected.
- Victory: all accessories restored + defense timer completed; a silly victory celebration and "one more round" prompt.
- Failure: timer expires or snowman loses 3 hats/health ticks, with an instant restart/checkpoint option.
- Intro and outro text <=2 short lines each. No exposition wall.

## Implementation architecture
- Add `assets/platformer/scene.js`, `assets/platformer/physics.js`, `assets/platformer/levels/frosty.json`, `assets/platformer/renderer.js`, `assets/platformer/input.js`.
- Isolate game state, RAF loop ownership, collision and menu teardown; **do not run two active render loops** or retain background input handlers when returning to PvP.
- Use a single fixed simulation step with an accumulator and cap catch-up work to prevent giant tab-resume jumps.
- Physics v1: axis-aligned boxes, gravity, vertical tile collision, horizontal solid obstacles, friction/ice modifiers, discrete jump and checkpoint rules. Use 32 or 48 world-unit tiles, explicitly documented in level JSON.
- Player appearance from shared guest palette; animated kid from `assets/recruits.js` / `assets/animation.js` through a consistent adapter; no copying the top-down player's authoritative movement logic.
- Refactor common presentation utilities only after the isolated scene passes tests. Prefer wrapper adapter over a new game engine dependency.
- Store optional completed-level flags in versioned `localStorage`, with validation and reset capability; do not pretend progress syncs across devices.
- Platformer v1 is **offline/local solo gameplay** in the browser; no Socket.IO room joins or backend leaderboards. Must still load when gameplay backend is unavailable, unless shared site shell needs assets.

## Reuse research and decision
Phaser Arcade Physics and tilemap examples are supported options for a later spike (https://phaser.io/oss/docs/phaser/concepts/physics and https://phaser.io/oss/examples/v4.1.0/tilemap/collision). Official examples source is MIT but the example assets are **not** broadly licensed for reuse (https://github.com/phaserjs/examples).

**Default build choice:** a small Canvas2D fixed-step AABB platformer module to avoid introducing a second heavyweight framework into a previously tested application. Revisit Phaser 4 only if physics/tiles/platform tools become a demonstrated bottleneck. No need to research engines again for the first vertical slice.

## Asset checklist
- Animated left/right locomotion, jump ascent/apex/fall, landing bounce, slippery slide and snowball recoil.
- Tile variations for snowy ground, ice, fence, driveway, rooftops, snowbank and snowman.
- 3 collectible accessory icons and a clear HUD indicator.
- Original 3 enemy silhouettes/poses or one original enemy with safe variants.
- Accessibility: clearly differentiated ice, reduced shake, captions for essential cues, accessible controls and pause/resume.

## Test gates
- Deterministic physics at different simulated render framerates.
- No through-wall tunneling at high horizontal velocity.
- Coyote/buffer input works across checkpoint and device performance changes.
- Touch input release/reset and browser backgrounding.
- Enemy shots cannot damage player while in checkpoint reset/transition.
- Collected objects cannot be collected twice; completion only when 3/3 and defense done.
- Frame-time targets and memory usage recorded independently from existing arena mode.
- Loading/quitting platformer doesn't corrupt Brawl Socket.IO session, menu states or audio.
- One recorded novice playthrough complete without reading external instructions.

## Future mission concepts (not first build)
Don't Wake the Neighbor (stealth), The Great Sled Escape (sliding physics), Fort Builders (defense), Snowball Delivery (precision). Add only after player comprehension test for Save Mr. Frosty.
