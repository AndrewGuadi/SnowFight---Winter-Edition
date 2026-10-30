# Character animation specification

## Scope

This specification covers the Classic customizable kid in `assets/recruits.js`, its state selection in `assets/animation.js`, and the presentation integration in `index.html`. Glacier, Snowbug, and Frostweaver retain their existing procedural renderers. Shared frozen and hit-outline overlays continue to work for all recruits.

The implementation uses immediate Canvas drawing rather than texture atlases. A `VisualPlayer` owns one `AnimationStateMachine`; snapshots update gameplay-facing values, while the render loop selects and draws the pose.

## State inputs

The state machine consumes only presentation-safe values:

- `speed`: server snapshot velocity magnitude;
- `chargeLevel`: current server-owned charge value;
- `localAim`: a short local input pose window;
- `isFrozen`: server-owned frozen status;
- `ended`, `winner`, and `team`: server match result;
- throw and hit triggers from local input and server events.

It does not calculate hits, award points, move collision bodies, or change snowball physics.

## Priority and timing

Higher rows take precedence:

| Priority | State | Entry condition | Duration or exit |
| --- | --- | --- | --- |
| 1 | Victory | Match ended and `winner === team` | Until match/reset state changes |
| 2 | Hit | Server `hit` event calls `triggerHit` | 340 ms; intentionally visible before Frozen |
| 3 | Frozen | Server snapshot has `isFrozen` | While frozen, after Hit timing expires |
| 4 | Recovery | Frozen transitions to not frozen | 480 ms |
| 5 | Throw | Local release or server throw effect | 240 ms quick; 340 ms charged |
| 6 | Aiming | Charge is positive or local aim is active | Until release/cancel or charge ends |
| 7 | Running | Speed is greater than 3.05 | While condition holds |
| 8 | Walking | Speed is greater than 0.22 | While condition holds |
| 9 | Idle | Default | Until another condition holds |

A charge of 24 or greater selects the charged throw treatment. A repeated throw trigger within 100 ms is ignored so immediate local release and the following server effect do not restart the same arm swing. State time resets only when the selected state changes.

## Pose specification

| State | Required visual behavior | Implementation |
| --- | --- | --- |
| Idle | Gentle breathing and subtle life | 0.55 px sinusoidal vertical motion; face and clothing stay stable |
| Walking | Expressive, economical steps | Opposing boot offsets, arm counter-motion, 1.2 px bob |
| Running | Faster, bouncier cadence | Larger stride, 2.2 px bob, faster walk-cycle advance |
| Direction change | Natural transition without angle snapping | Shortest-angle interpolation with a 55 ms exponential time constant |
| Aiming | Body language points at target | Directional gaze, extended throwing arm, charge-sensitive held ball |
| Quick throw | Immediate arm release | 240 ms swing and recoil; gameplay release still travels through the server |
| Charged throw | Stronger reach and follow-through | 340 ms swing with greater arm extension |
| Hit | Squash, recoil, surprise | Up to 17% horizontal squash, 13% vertical compression, -0.13 rad recoil, widened eyes and open mouth |
| Frozen | Snow-covered, readable status | Existing translucent ice silhouette plus snow patches on hat, torso, and boots |
| Recovery | Shake off snow and resume | 480 ms decaying rotation and two small snow flakes |
| Victory | Short playful celebration | Both mittens raised and a 5 px bounce; results overlay waits 750 ms normally or 100 ms with reduced motion |

## Customization and rendering contract

`drawSnowRecruit(ctx, player, time)` accepts the existing appearance fields:

- `skinColor`
- `jacketColor`
- `hatColor`
- `team`
- `classId`

Every animation reads those fields at draw time. No appearance choice changes collision, team identity, or animation timing. Shared geometry supports all 100 skin/jacket/hat combinations in every state.

The browser regression test draws all 100 combinations across idle, walking, running, aiming, throw, hit, frozen, recovery, and victory: 900 render calls. This verifies renderability and customization coverage, not human aesthetic approval of every combination.

## Network synchronization

- Remote throw effects and all hit reactions originate from server events.
- The local player may show aim/release anticipation immediately after input, but the actual throw is emitted through the existing input protocol.
- Existing bounded dead reckoning remains a visual interpolation aid only; this iteration does not implement prediction/reconciliation and does not overlap PR #17.
- Facing is smoothed visually from the input/server angle. Mouse aim is calculated against the actual rendered camera transform.
- Match reset clears animation effects and projectile tracks; server results control victory.

## Accessibility and quality tiers

With `prefers-reduced-motion: reduce`, idle/locomotion bob, recovery shake, victory bounce, and pom-pom swing are removed. Directional state, facial feedback, frozen status, and held-ball readability remain. Camera shake/lead, footprints, and trails are handled by the presentation and effects systems.

Low-effects mode does not remove animation states; it reduces surrounding particles, trails, footprints, shake, lead, and render pixel ratio.

## Acceptance checks

1. A server hit shows Hit before Frozen, then Recovery after thaw.
2. Quick and charged releases have distinct durations and cannot be double-triggered by local plus server feedback.
3. All 100 appearance combinations render in all nine states without additional image assets.
4. Movement and throwing still work through real Socket.IO sessions.
5. Creator preview keeps its 260:180 aspect ratio.
6. Reduced motion preserves essential gameplay information while removing nonessential motion.
