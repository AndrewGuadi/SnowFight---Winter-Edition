# 09 — Contest Intensity Pass: Gameplay Additions and Release Gates

**Status:** IMPLEMENTED ON AN ISOLATED REVIEW BRANCH; NOT MERGED OR DEPLOYED  
**Branch:** feature/contest-intensity-pass-2026-10-30  
**Parent:** PR #24, feature/three-modes-aaa-foundation at dc120e5e63862f71d0c4fe991168a53e5b1e53ac  
**Scope:** Moment-to-moment action across the three original SnowFight modes, without adding required controls or rebuilding the renderer.

## Interaction 1 — Snowball versus snowball (Brawl and POW)

Opposing throws can intercept one another midair. Their relative swept trajectories are tested at the authoritative 60Hz server simulation step. If the shots meet at comparable heights, both snowballs burst in a room-scoped snow clash effect.

**Crucial fairness rule:** a collision against a player or solid cover earlier in the tick takes precedence over a later clash. There are no awarded hit points, movement boosts, or client-side hit claims. Friendly projectiles do not cancel each other.

The client renders a pooled snow burst, a brief impact sound, and a "SNOWBALL CLASH" message when one of the interacting snowballs belongs to the local player. Effects obey low-FX and reduced-motion controls where applicable.

Files: backend/combat-interactions.js; backend/server.js; assets/intensity-ui.js; assets/intensity.css.

## Interaction 2 — Close-call dodges (Brawl and POW)

A true near miss is detected when an opponent's projectile passes the player's closest approach **outside** the actual hit circle but inside an additional danger margin. The server emits close_call with a per-player cooldown, avoiding per-frame spam. No invisible stat advantage is granted. Local feedback is "NICE DODGE", compact particles, a short tone, and a tiny optional camera response.

This provides an exciting moment without asking players to learn an extra dodge/pack/ability button.

Files: backend/combat-interactions.js; backend/server.js; assets/intensity-ui.js.

## Interaction 3 — SnowFort rescue showdown (POW)

The server announces when only one player remains free on a team and when a gate rescue reaches its last second. Finishing a rescue triggers a **defensive breakout snowburst** that clears enemy projectiles within 215 world units of the released players' exit gate. Friendly and distant projectiles continue unaffected.

The wave creates a genuine counterplay opportunity against a fortified POW exit without damaging enemies or changing the existing rescue +2 points, invulnerability, two-second hold, or prison rules. It is emitted and resolved on the server, not in a local animation.

Files: backend/pow.js; assets/intensity-ui.js.

## Interaction 4 — Snow Day enemy volleys and countershots

The solo platformer gains an encounter along the approach and another before the finale, plus snowman-siege opponents. Snow enemies telegraph and throw directed projectiles that can be jumped or avoided. The player starts with **three hearts**; getting hit costs one heart, triggers brief recovery protection, and produces a small knockback. Enemy volleys can be blocked by a player snowball, or the enemy can be temporarily stunned with a countershot.

One player throw button remains sufficient. Enemies are never permanent damage sinks: stuns end after a short duration, and the existing collectibles/checkpoints/goal remain.

The stage HUD now shows hearts; snow impact/interception cues stay on screen briefly. Combat logic lives in a separately testable zero-dependency module.

Files: assets/adventure-combat.js, assets/snow-adventure.js.

## Fidelity / security constraints

- No copied external game assets, no new runtime package, no new login, no payment features.
- No extra mandatory battle buttons.
- Existing real-human room join, timer, scoring, class and rematch protocols remain unchanged.
- Projectiles, POW rescue wave, and narrow misses are authoritative.
- Older clients can ignore new effect types.
- Original POW mode and solo platformer remain distinct. The platformer is not claimed to be online co-op.
- The live preview and production are not automatically updated by this branch.

## Verification plan

### Backend unit and integration

- Head-on enemy snowballs clash exactly once and do not score.
- Allied shots and shots at different heights do not clash.
- Earlier obstacle or human impact cannot be canceled by later projectile clash.
- Legitimate near misses cause one feedback event and no score change.
- A live tick from server.js produces clash/near-miss events.
- POW last-free and last-second gate alerts fire once each at correct thresholds.
- Breakout wave clears nearby enemy shots but no friendly/distant shots.
- Adventure enemy projectile collision, grace period, jump evasion, snowball interception, temporary enemy stun.

### Browser integration

- All existing foundation, Brawl, mission, recruits, animation, and three-mode browser tests (when present).
- New Chromium smoke: visual clash/dodge event reaction and real enemy encounter in Snow Day.
- On actual phones: touch directional control and throwing, rescue hold/release, no blocked touch zones, no stuck movement, game UI readable in landscape.
- Real two-client online capture/rescue -> flag -> win, in separate environments with the POW backend from this feature branch.

**CI and actual device outcomes must be recorded before release.** A clean test run on headless Chromium is not a physical-phone or production load claim.

## Release ordering

1. Review this feature branch as a PR targeting feature/three-modes-aaa-foundation, **not** main.
2. Verify GitHub Actions against the exact latest SHA. Fix red tests before requesting promotion.
3. If green, have a reviewer validate rescue balance, projectile clash fairness, mobile input and new adventure difficulty.
4. After Andrew approves, integrate it into the three-mode preview branch, build the matching preview frontend + backend, and smoke test live.
5. Only with separate approval promote the confirmed build to production. Andrew submits the contest.

## Current limitations

The browser uses the existing Canvas renderer and the new visual callout; this is not a graphics engine rewrite. Snowball clashes add additional server collision computations and require 5v5/10v10/30v30 solo profiling before any claim of a frame-rate or server-capacity improvement. Snow Day enemy difficulty is deliberately moderate and needs novice user testing. There is no new dedicated public matchmaking or 30v30 real-human claim.

Do not merge, deploy or submit solely because this document exists.
