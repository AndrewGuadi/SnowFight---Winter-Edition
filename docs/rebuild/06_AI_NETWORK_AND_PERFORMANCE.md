# 06 — Bot AI, Network Responsiveness and Performance Repair Plan

**Status:** DIAGNOSIS + PROPOSED WORK, not an implemented fix.  
**Primary engineering owner:** GPT-6.1-Sol. **Peer reviewer:** GPT-6. **QA:** Meta Muse.

## Root problem: bot stacking

Observed directly in backend/server.js computeBotInput() at the reviewed main commit:

1. Each unfrozen bot selects the nearest unfrozen opposing player.
2. The bot steers directly toward that player when outside attack range.
3. During regulation, when its team hasn't banked hill points and its nearest opponent is out of throw range, it instead steers toward the **exact same HILL_CENTER_X, HILL_CENTER_Y** coordinates.
4. Once inside hill radius it stops while that hill-seeking state applies.
5. The function contains no clear teammate avoidance force, per-bot hill slots, formation roles or obstacle-aware routing.

This produces correlated paths and pile-ups. It also occurs away from the hill because many bots pursue the same nearest enemy. Raising aggression or adding randomness to aim alone cannot fix it.

## Bot architecture — staged repair

### Stage 1: fast bounded separation (contest candidate)

Preserve server movement authority and tick cadence. For each bot:
- Choose a goal: engagement target or hill capture.
- Add repulsion away from nearby teammates within a documented personal-space radius.
- Assign an individual hill ring/sector destination (stable per team and bot ID) instead of one center point.
- Respect world boundaries and nearby solid cover, using a simple short-range avoidance term.
- Add a low-frequency stuck detector: movement input requested but distance traveled remains below threshold; try alternate slot/waypoint.
- Clamp acceleration and normalize the resultant steering vector before sending through existing player physics.
- Ensure frozen bots and bots with no enemy don't generate NaN or wander forever.
- Do not accidentally change how the hill scoring code decides occupancy.

Example conceptual steering:
    
    desired = normalize(
        w_goal * goalDirection
      + w_separation * sum(teammateRepulsion)
      + w_obstacle * obstacleAvoidance
      + w_flank * tacticalLaneOffset
    )

These are weighted directions, **not** raw positional teleports; test priority weighting under crowded/hill scenarios.

### Stage 2: simple tactical policy

Introduce explicit states such as CAPTURE, DEFEND, FLANK, ENGAGE, RELOAD, RESCUE, RETREAT and STUCK_RECOVERY. The first pass may implement only CAPTURE, ENGAGE and RELOAD. Use stable role allocation and transitions; don't switch state every tick because one other bot crossed a tiny threshold.

- Capture: occupy a suitable point inside hill radius; spread over valid slots.
- Defend: watch approach lanes near a claimed hill, don't sit stacked on flag.
- Engage: choose enemy based on range, line of sight and teammate targeting, not nearest-distance alone.
- Reload: use an available safe route while gathering; avoid suicidal direct enemy pursuit.
- Flank: choose alternative approach if frontal corridor is crowded.
- Rescue: if it is part of server rules, approach a frozen teammate only when reasonable and safe.

### Stage 3: advanced navigation (after contest)

Consider a small grid/A* waypoint planner for static obstacles or a carefully licensed navmesh library. Evaluate VOIDSTRIKE's published navigation techniques at https://github.com/braedonsaunders/voidstrike, but do not transplant its RTS/WebGPU/WebAssembly stack just to fix a few steering vectors. Use only source verified as licensed and relevant. Prefer deterministic seeded behavior for repeatable bot tests.

## Bot difficulty contract

Difficulty should affect:
- Response delay / decision interval.
- Aim noise and target prediction skill.
- Attack opportunity evaluation.
- Tactical coordination and mistake frequency.
- Navigation strategy under pressure.

Difficulty should **not** silently increase movement speed beyond human fairness limits or exploit unseen state in ways that feel like cheating. First-time bots must miss sometimes, telegraph throws and give recovery opportunities.

## Required deterministic AI tests

1. **Shared-center:** 10 same-team bots approaching hill end in different viable positions; no persistent single coordinate.
2. **Shared-target:** bots attacking one enemy maintain minimum usable separation where space exists.
3. **Cover:** bots route around fixed obstacles with no wall-driving loop longer than a defined stuck threshold.
4. **Spawn:** team units have non-overlapping safe initial positions; no spawn pileups.
5. **Frozen:** no movement or attack while frozen; resume reasonably afterward.
6. **Hill score:** contest/hold states preserve center scoring and overtime rules.
7. **No enemy:** non-NaN idle/patrol behavior.
8. **Mixed classes:** correct radius/speed/ability constraints under all allowed classes.
9. **Crowding:** 30v30 solo simulation records overlap counts, average separation, stuck count and tick duration over a fixed seed/period.
10. **Fairness:** benchmark bot hit frequency and win rates against fixed novice/expert scripts.

Record test seed, map layout, tick count, wall-clock measurement and pass threshold. Static screenshots alone cannot prove AI is improved.

## Network: existing state and PR #17

Server today:
- 60 nominal simulation ticks/second.
- Active match snapshots at 30 nominal snapshots/second.
- Client movement packets paced at roughly 30 Hz; action edges immediate.
- Server authoritative hit, freeze, score, room membership and match result.
- Client interpolation/extrapolation present in baseline, but full movement prediction absent on main at branch creation.

PR #17 https://github.com/AndrewGuadi/SnowFight---Winter-Edition/pull/17 proposes local prediction/reconciliation, acknowledgment, stale input rejection, slimmer DTO payloads and regression tests. Its own PR description reports test runs and a fixture reduction; these are **PR author claims, not our independently reproduced production measures**.

**Work order:** (1) fetch current PR revision; (2) run its tests locally in isolation; (3) compare against main; (4) resolve any conflicts in a review branch; (5) request owner permission for merge before treating prediction as shipped.

### Do not confuse three latency quantities

- **Input-to-local-response:** perceived responsiveness; prediction can improve this.
- **Round-trip time (RTT):** physical path and server response; rendering cannot remove it.
- **Authoritative confirmation/correction:** depends on snapshot cadence, server work, RTT and loss.

Do not make "zero latency" claims. More frequent packets may increase cost without improving useful feedback.

### Proposed netcode invariants

- Move input is normalized/finite and sequenced.
- Actions such as THROW are reliable or explicitly deduplicated, never silently lost.
- Server doesn't trust client hits or speed/position.
- Old clients remain compatible until a coordinated deployment completes.
- Reconnect doesn't duplicate player, scores or match membership.
- Stale snapshots don't roll state backward.
- Prediction history is bounded, replay deterministic enough for correction.
- No movement continuing after blur/disconnect/pointercancel.
- Match end freezes authoritative outcomes and prevents late actions.

## Performance diagnostic workflow

### Measure components separately

**Server:** event-loop delay, simulation tick p50/p95/p99, collision CPU cost, bot decision time, serializing room state, room count, clients per room, out bytes/sec, memory use.

**Client:** FPS, frame time distribution, draw calls where available, heap growth, asset load time, responsiveness, time spent rendering entities/VFX/HUD, device and DPR, reduced motion setting.

**Network:** RTT p50/p95/p99, snapshot arrival interval/jitter, state payload size, dropped packets, delayed input effects and corrections.

### Hypotheses to test

| Hypothesis | Evidence to collect | Candidate intervention |
| --- | --- | --- |
| Canvas repeated geometry costs CPU | Frame profiles, paint/draw hotspots | Cache layers, batch repeated geometry, sprite atlases, or Phaser POC |
| 30v30 bot decisions cost too much | Bot computation time/tick by count | Reduce strategic decision cadence, spatial neighbor lookup |
| Collision scans grow with entities | Profiling of projectile/obstacle queries | Uniform grid or broadphase after proof |
| Full snapshots are too large | Actual bytes/client/sec at 5v5,10v10,30v30 | PR #17 DTOs, then deltas/interest management if warranted |
| Input feels late despite good FPS | Input-to-local response and RTT traces | Prediction/reconciliation, input cleanup |
| Server cold start delays Play | Startup timing on test deployment | Warmup/status UX and appropriate hosting review after permission |

### Frame-rate and network targets (proposed, not measured)

- Selected midrange mobile device: ideally 60 FPS at 5v5, p95 frame <=16.7 ms.
- Server: target p95 simulation work <=8 ms per 16.7 ms tick, leaving scheduling/serialization headroom.
- No new p95 regression >~2% in controlled A/B tests unless justified by visual/perceived improvements.
- Test 80/150/250 ms RTT, jitter and 1–3% loss; expose state changes and movement feedback separately.
- 30v30 bot stress should never be used to claim online 30v30 human scale.
- Production use must also consider cold starts, bandwidth cost and concurrency; local benchmark cannot prove worldwide playability.

Acceptance thresholds are goals and may need revision after baselining chosen devices; do not massage measurements to force a PASS.

## Failure containment

- AI steering changes behind a reviewed commit/flag; can revert without modifying core scoring.
- Prediction optional/compatible during rollout; clear pending inputs on disconnect/rejoin.
- No load tests on Render production or other public service.
- Test with a local isolated server and recorded network impairment, then lightweight live connectivity checks only after owner-approved deploy.
- On unexplained desync, remove experimental client prediction before weakening server authority.

## Exit evidence

A reviewer needs:
1. Before/after deterministic bot movement video or captured position trace, fixed seed.
2. Overlap and stuck statistics, defined test duration.
3. CPU tick and bandwidth before/after for identical entity count.
4. Two-device shot/result consistency, reconnect and end-state results.
5. All regression test commands and exit codes.
6. Explicit statement of what remains untested on real mobile/WAN hardware.

Without those, this is an engineering hypothesis, not a verified fix.
