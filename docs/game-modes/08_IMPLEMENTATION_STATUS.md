# 08 — Three-mode implementation status and playtest handoff

**Build status:** Feature branch — NOT MERGED / NOT DEPLOYED.  
**Working branch:** feature/three-modes-aaa-foundation  
**Draft PR:** https://github.com/AndrewGuadi/SnowFight---Winter-Edition/pull/24  
**Source of prior rules:** docs/game-modes/README.md through 07_TEST_MATRIX_AND_RELEASE_GATES.md  
**Rebuild base:** docs/rebuild-reuse-first-2026-10-30

## Implemented on this branch

### Neighborhood Brawl
- Remains default game type, using the original server-authoritative simulation, snowballs, hill score, team sizes and rematch.
- An additive \`gameMode\` join field defaults to \`brawl\`; the existing \`mode=single|multi\` contract is preserved.
- Real-player public matches remain humans-only and capacity is not actual occupancy.

### SnowFort Capture & Rescue
- New server-owned \`backend/pow.js\` rules, optional \`gameMode=pow\` join, guarded room mode consistency.
- Server-owned capture on projectile impact, POW relocation and prisoners confined to protected interior coordinates.
- Prisoners cannot throw, score flag presence, or reenter open play until released. Nonprison players are rejected from protected prison space.
- One free teammate holds rescue interaction for 120 consecutive server ticks; progress resets on release/exit/freeze/disconnect; gate opens for four seconds and releases available prisoners at safe outside exit points.
- Rescued players get a two-second hit shield that expires on offensive throw.
- Central flag control awards periodic score and one of three finite server-enforced buffs: faster packing, snow boots or one-hit team shield.
- Four-minute authoritative POW clock, all-team-captured winner, score/tiebreak at expiration.
- Static mirrored cover for the POW arena, original client-side forts, pad circles, progress rings, team flag, minimap and capture/release/power effects.
- A compact rescue HUD and touch/keyboard R held interaction.
- Invite URLs preserve \`gameMode=pow\`, avoiding accidental cross-mode joins.

### Snow Day Adventures
- Isolated standalone \`assets/snow-adventure.js\` Canvas side-scroller; launches from new mode picker and exits back to the main menu without entering a Socket.IO match.
- Original winter kid uses saved skin/jacket/hat choices.
- A first 120-second "Save Mr. Frosty" mission with run/jump/throw, ice sliding, checkpoints, three collectible accessories, three cartoon opponents, a snowman and victory/retry flow.
- Desktop and touch controls; solo local progression only. **No networked platformer co-op is claimed.**

## QA / build instructions

- \`npm ci --prefix backend && npm test --prefix backend\`
- Existing Chromium checks: \`foundation-browser.cjs\`, \`browser-smoke.cjs\`, \`mission-browser.cjs\`, \`recruits-browser.cjs\`.
- New Chromium check \`backend/tests/modes-browser.cjs\` starts a local Node server, joins a real two-browser POW match, checks POW HUD/minimap and launches/exits platformer.
- New unit tests \`backend/tests/pow.test.cjs\` check capture, two-second channel, interrupt/reset, prison bounds, flag buff and end conditions.
- CI workflow \`.github/workflows/foundation-checks.yml\` includes the new mode browser smoke.

**Evidence rules:** Do not describe tests as passing until GitHub Actions for the *exact* current SHA finishes green. Prior earlier successful runs are historical evidence only.

## Known limitations / next polish pass

- POW fort is a protected collision region, but has no sophisticated line-of-sight/navmesh; revisit projectile visibility around fort boundaries, wall art/collider consistency and anti-camping based on human playtesting.
- POW v1 supports human private/public rooms without bot backfill; no claim of 10 simultaneous players in every lobby.
- No account, level unlock economy, player moderation or multi-stage matchmaking.
- The platformer is intentionally one small complete mission prototype, **not yet a professionally balanced campaign**. Its physics and enemy behaviors need real-device and novice playtesting before using premium-quality claims.
- PWA fullscreen behavior comes from earlier Kimi's animation branch and browser support varies.
- No comparative benchmark for 5v5/10v10 power-zone rendering has been completed; no 60FPS midrange device claim.
- Need real two-phone test of captured player being released, spawn shielding and join/rejoin via shared POW invite.
- The more advanced cooperative multiplayer platformer and additional funny missions are future work.
- Live production is intentionally unchanged; merge/release requires Andrew's explicit approval and matching frontend/backend deployments.

## Follow-up quality priorities

1. Real-device game modes test across iOS Safari and Android Chrome; landscape touch, rescue pad button and seamless full-screen.
2. A complete two-friend "tag -> jail -> hold R -> jail break -> flag buff -> win" recorded playtest, with the same match state on both clients.
3. Tighten arena visual art and obstruction geometry, original gates, team banners, camera movement and celebration moments.
4. Polish platformer jump response, slip handling, enemy behavior, checkpoints and mission success/failure clarity.
5. Measure CPU/render cost and tune to maintain Brawl's prior baseline.
6. Only then consider adding more platformer missions, POW power-up balancing, optional matchmaking changes and production rollout.

No AI agent is automatically dispatched by these documents.
