# 03 — Neighborhood Brawl (existing live PvP)

## Identity
The shortest mode: move, aim, throw, hold the snow-fort hill, rematch. Human 1v1 and group-vs-group should have transparent room occupancy. Brawl remains the default and existing server match logic is the source of truth.

## Scope and behavioral freeze
- Preserve `mode=single|multi` meaning network participants, plus `gameMode=brawl`.
- Existing supported player capacities: 1v1 / 1v5 / 5v5 / 10v10 (30v30 solo bots only). Avoid offering asymmetrical 1v5 as a default human match.
- Public Play Online chooses a real-human 5v5-capable room; **no claim that it contains 10 people**. Display `2/10 connected` from authoritative state.
- Friend Play creates short code and copyable invite; joining an existing code follows the owner's actual match rule and capacity, never silently changes them.
- Team assignment remains server-owned and balanced.
- Keep current 90-second hill clock, score/hill tiebreaker, overtime, client hit/freeze, reloading, and Kimi's visual presentation.
- Bots may appear in a separate clearly labeled practice flow; no fake-human bots in live matches.

## Implementation tickets
**BR-01 — Extract rule seams (Sol + GPT-6).** Wrap legacy `tickMatch` scoring/outcome calls in `modes/brawl.js` without changing observed behavior. Assert identical snapshot/result fixtures pre/post change. Do not rewrite the physics.

**BR-02 — Add game-mode selector (Muse).** Three readable entry cards: Neighborhood Brawl (primary), SnowFort Capture & Rescue (friend rooms / coming when supported), Snow Day Adventures (solo). Cards must reflect server feature availability, not advertise unimplemented modes as playable.

**BR-03 — Accurate lobby (Muse + Sol).** Show current human count, room code, game type, controls and waiting status; keep invite/return pathway on mobile.

**BR-04 — Network smoke (Sol).** Two independently connected users join a 5v5-capable or 1v1 Brawl room, throw/score, agree on results, rematch. Existing old join clients omit gameMode and still play Brawl.

## Gate
62+ backend tests and current four browser suites remain green (adjust baseline to exact selected commit), no new permanent UI blockage, no cross-mode room contamination, no accidental POW state in Brawl. Full player occupancy tests must distinguish room **capacity** from attendance.

## Not in scope
Skill ranking, spectator service, matchmaking leagues, bot backfill, real 30v30 humans, multiple scoring modes on one screen.
