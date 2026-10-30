# 04 — SnowFort: Capture & Rescue — frozen v1 gameplay rules

**Role:** signature top-down competitive team game with playground tag + protected POW fort + center flag power zone.  
**Implementation:** same authoritative server and customizable kids as Brawl, new rule module and mirrored level.  
**First release:** private human rooms, up to 5v5 seat capacity, 2+ actual participants spanning both teams. POW is not a solo mission and must not implicitly populate with bots.

## Match configuration
- Regulation duration: **240 seconds** (14,400 server ticks at 60Hz), stored in mode config; not Brawl's 90-second timer.
- Recommended minimum for exciting rescues: 2v2. 1v1 allowed as test/tutorial but first tag immediately wins.
- Each team starts in a safe side spawn area with the center SnowFort Flag between them.
- Distinct team-owned POW enclosures, behind symmetrical cover on each team's half. A team member captured by opponents is teleported into **their own team's POW enclosure**. Label clearly "BLUE POW" / "RED POW" rather than ambiguously swapping the prison owner.
- Only members of the owning team may occupy their POW enclosure. Enemy players cannot walk inside or fire into it.
- Rescue trigger lies just outside the owning team's prison gate; free players from the same team may hold it.

## Capture state machine
`ACTIVE -> CAPTURED -> RELEASE_PENDING -> ACTIVE_PROTECTED -> ACTIVE`

- **ACTIVE:** valid target of enemy snowballs and allowed to fight. May trigger rescue.
- **CAPTURED:** immediate server-validated POW on eligible snowball collision. Clear charge, velocity, projectile and movement action edges. Teleport to a collision-free interior jail slot. No throws/abilities/dash/scoring, no hits from outside, cannot leave jail bounds.
- **RELEASE_PENDING:** all currently captured teammates are queued when a rescue completes; server chooses non-overlapping safe spawn positions outside gate, not inside overlapping enemy colliders.
- **ACTIVE_PROTECTED:** 120 ticks of invulnerability to hostile hits. Ends immediately on first offensive action (throw/ability). Status icon and visible shield ring, no scoring exploits.
- **ACTIVE:** protection expired or consumed.

Prison occupants may **walk within the enclosure** to keep them engaged but may not jump, rescue, trigger flag, or block gates. A trapped player sees teammate rescue progress and a silly "HELP! I'M SNOWED IN!" animation. They should not need to stare at an empty screen.

## Rescue mechanism
- An **uncaptured**, unfrozen teammate holds **Interact** while their authoritative server position overlaps the team's exterior rescue pad.
- Only one eligible rescuer advances channel progress per team at a time; deterministic priority if multiple players overlap. No boost from 2+ rescuers. Another rescuer may start a fresh channel if the first leaves.
- **120 consecutive server ticks = 2 seconds**. Progress is reset immediately if the rescuer releases interaction, leaves radius, gets captured/frozen, disconnects, or a match ends. Client latency/clock cannot advance progress.
- Completing the channel opens the owning gate for **240 ticks / 4 seconds**, releases all teammates captured at that tick, and resets channel. Gate opening is a dramatic synchronized animation, but visual animation is not authoritative.
- The rescue pad cannot be operated if no teammates are captured.
- Rescuer can move out after channel completes. Repeated interaction cannot spam releases while gate is already open; cooldown until closed.
- Prison physical gate state must never leave an occupant stuck in wall geometry. Release occurs server-side, independent of gate animation frame.
- A rescued player may not reenter jail via gate or use the inside to hide. Gate entry is visually protected and server-validated as **exit-only**.

## Snowball tagging and scoring
- Each successful server-confirmed **enemy snowball hit on an ACTIVE, unprotected player** captures exactly one eligible target, once per hit event. Ignore friendly fire for v1.
- No duplicate capture, no repeated score for hitting prisoners, no self-capture from own projectile. Existing swept collision tests remain intact.
- Each captured opponent credits **1 capture point** to the hitting team and increments the thrower's personal capture stat. Score is cumulative.
- Each successful full rescue channel credits **2 rescue points** to the rescuing team, only if at least one teammate actually left jail. Personal rescues counts number of teammates freed; scoring is flat 2 points per completed gate release to discourage farming.
- Match immediately ends when **all registered, connected team members of one team** are captured simultaneously, *only if both teams initially had at least one confirmed human occupant* and the match was active. If both teams somehow become fully captured during same server tick, determine outcome deterministically using hit event order or declare draw and test it.
- Disconnect cannot be a way to wipe an entire team unfairly. An active player who disconnects in an ongoing match remains a reserved non-scoring ghost seat for up to **15 seconds**, after which forfeit resolution is evaluated. A missing team cannot instantly claim a win via zero remaining opponents.
- At 240 seconds: highest total **capture + rescue + flag control points** wins. Exact additive scoring described below. Ties break by fewer currently captured players, then total captures, then **draw**; no sudden death in POW v1.

## Central SnowFort Flag / Power Zone
- Circular capture zone centered at map midpoint, proposed **radius 210 world units**, distinct from Brawl's hill radius of 260. Draw a flag with team-colored hold ring.
- Only active, uncaptured, non-protected players contribute to center occupancy. Players physically in prison cannot count.
- If strictly more players of one team occupy zone, that team accrues **1 control point per completed 60 ticks** and **1 power-meter tick per server tick**. Equal count or empty zone pauses accumulation; contested state has no owner.
- After **1,200 accrued control ticks (20 seconds)**, grant one team-wide buff to current eligible ACTIVE players and reset the team meter. Meter persists across contested pauses, but resets when the opposing team holds a full uninterrupted 3 seconds, preventing perpetual stockpiling.
- Only **one buff active per team** at a time; new grant replaces the old. Use deterministic rotation seeded by match identity, not client choice.
- Buffs:
  - `snowballFrenzy`: auto-reload/repack cadence ×0.75 for 8 seconds (minimum floor to prevent rapid spam).
  - `snowBoots`: movement cap ×1.12 for 8 seconds, server validated.
  - `fortShield`: absorb the next incoming eligible snowball within 8 seconds, then expire.
- **No teleport, invincibility of entire team, wall-penetration or projectile radius changes.**
- Buff effects apply to prisoners only when they're freed and if the original buff remains active. Do not accumulate reserves.
- HUD shows team buff name and countdown; never let local timers define expiry.

## Arena requirements / anti-exploit
- Mirror all playable cover, prisons, gates and rescue-pad access. Fair spawn distance to center and opposing lanes.
- Prison enclosure is collision solid to non-prison players and projectiles; prisoners are confined by server position clamp/interior collision.
- Two distinct rescue approaches or lanes per jail. Do not place both jail triggers on direct line of fire from the center objective.
- Rescue pad lies **outside** the jail barrier and is reachable without crossing invulnerable spawn ground. No attacking from within protected spawn.
- Spawn protection expires on throw. No lingering shield during flag scoring.
- A player cannot hold a rescue channel while dashing/frozen/captured; confirm movement behavior during channel (proposed: moving allowed *inside pad*).
- **Rescue feedback:** obvious 0–2s radial progress, team notification, gates open particles/sfx, released teammate spawn effect; screen reader-friendly status outside live-combat visual clutter.

## Exact acceptance scenarios
1. Red hits blue -> blue captured once, blue's score not secretly advanced; captured inside BLUE POW.
2. Blue prison player cannot leave jail or shoot, cannot be hit by enemy or stand on center.
3. Free blue teammate holds interact for 119 ticks -> no release; at 120 -> gate opens and all blue captives released.
4. Move 1px outside trigger, release key, get tagged, or disconnect at tick 119 -> reset to 0.
5. Two rescuers on trigger -> no 2× speed; one rescue event and one 2-point team award.
6. Trigger with empty prison -> no score or buff.
7. Hit protected rescued player -> no capture; protected player throws -> protection immediately ends.
8. Red team entirely captured -> blue wins exactly once, regardless of cumulative scoreboard, with a complete result payload.
9. Timeout when two opponents still free -> scoring and specified tiebreak is deterministic.
10. Simultaneous tags, near-timeout gate release, full prison and reconnection -> no duplicate scoreboard or ghost winner.
11. All objects and interactive pad positions are identical in server and client; collisions are not inferred from art.
12. When a human room is not populated, match stays WAITING rather than allowing solo victory.

## Design limitations explicitly accepted
This is a playground game metaphor, not a realistic detention simulator; use funny snow-fort/jailhouse language. v1 power flag grants buffs, **not** carried enemy flags; full capture-the-flag transport/return rules are later optional variants. Team wipe can be abrupt in a 1v1; longer play should emphasize 2v2+ team rescues.
