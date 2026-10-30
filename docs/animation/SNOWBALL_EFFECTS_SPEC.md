# Snowball effects specification

## Authority boundary

The server remains the sole authority for spawn, velocity, arc/height, hitboxes, collision results, damage/freeze results, and score. This iteration changes only how the client draws snapshots and server events. No server packet or gameplay module was changed.

## Projectile presentation

`ProjectileVisualizer` adds four visual layers:

1. A soft ellipse at ground position, separate from snowball height.
2. A bright procedural snowball body with a team-colored outline.
3. A small white highlight.
4. A short, translucent team-tinted trail using recent snapshot positions.

The existing server `z` value supplies the visible arc. The render position uses the existing bounded visual extrapolation of at most 33 ms between snapshots; this does not alter the server projectile. Reduced-motion mode removes trails. Low-effects mode retains at most the latest two history points instead of the full trail.

### Tracking without projectile IDs

The current snapshots do not include snowball IDs. The client therefore matches visual tracks by `ownerId`, `team`, `kind`, and proximity within 95 world units. Each track stores at most five history points. Snapshot snowball objects are used as keys in a client-only map and are never mutated.

This is a presentation heuristic, not a protocol replacement. Dense simultaneous same-owner volleys can make trail identity ambiguous. Stable server projectile IDs would improve continuity, but that is a protocol change and is intentionally deferred for review rather than introduced here.

## Event vocabulary

| Server-driven event | Client response |
| --- | --- |
| Throw / cannon effect | Throw pose, recoil, three release flakes; existing throw/cannon audio remains synchronized to the event |
| Player `hit` | Mark impact, 19-flake white burst plus expanding ring, 340 ms hit reaction, existing popup, sound, and local vibration |
| `obs_hit` | Mark impact and emit nine icy-blue scenery flakes |
| `guard_hit` | Mark impact and emit a 12-piece cyan blocked burst plus ring; retain blocked popup/audio |
| Snowball disappears without a recent marked impact | Five-flake white miss puff at its last visual position |
| Dash, reload, thaw, cover, and other existing events | Retain their established presentation, now using the bounded effect pool where applicable |

A marked impact is remembered for 250 ms. A disappearing projectile within 90 world units of that mark does not also produce a miss puff. At most 24 recent impact marks are retained.

## Pooling and bounds

`EffectPool` preallocates 240 reusable records. Spawning past capacity overwrites the oldest cursor position rather than growing an array. Expired items are skipped and reused. Updates and draws iterate only this fixed collection.

Normal burst counts are event-specific and intentionally small. Low-effects mode multiplies requested flake counts by 0.45, rounds the result, and keeps a minimum of two flakes. Player and blocked hits may add one ring in either mode. There is no full-screen particle overlay.

The previous per-frame particle array filtering is removed. Other existing bounded feedback, including combat popups and footprints, remains separate.

## Miss and impact acceptance behavior

- A tracked snowball that disappears with no nearby impact mark creates a miss puff.
- A tracked snowball that disappears near a fresh impact mark creates no duplicate miss puff.
- Projectile tracking does not change the snapshot object.
- Pool capacity remains fixed even when a burst requests more items than capacity.
- Expired effects become inactive, and low-effects bursts contain fewer flakes.

These behaviors are covered by `backend/tests/animation.test.cjs`. Live bot benchmark scenes also exercise normal projectile and impact rendering, but the current measurements are whole-frame results, not an isolated particle microbenchmark.

## Audio and haptics

No new audio files or third-party sounds were introduced. Existing synthesized throw, hit, dash, reload/collect, guard, and cannon cues remain attached to their existing server events. Existing 15 ms vibration for a successful local owner hit is retained where the browser supports it.

A future audio pass may add distinct soft scenery and blocked-impact timbres, but new sound design was outside this visual iteration.

## Known visual limits

- Projectile trails can swap identity in crowded same-owner volleys because the protocol has no IDs.
- Ground-miss puffs are inferred from disappearance and recent event proximity, not from a dedicated server miss event.
- Hit flash and popup behavior remain globally visible as in the existing client; this pass does not redesign combat UI.
- Particle randomness is visual only and is not part of deterministic server simulation.
