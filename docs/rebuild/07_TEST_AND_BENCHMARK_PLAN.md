# 07 — Test Matrix, Benchmark Methodology and Go/No-Go Gates

**Status:** TEST SPECIFICATION. None of the proposed benchmarks in this document have been run as part of this documentation work.  
**QA lead:** Meta Muse; backend/network: GPT-6.1-Sol; visual/performance: Kimi; final integration: GPT-6.

## Testing philosophy

Automated green checks are necessary but insufficient. A game with passing unit tests can still feel laggy, require six controls and be incomprehensible to a first-time player. We require reliable functionality, reproducible performance **and** observed player comprehension.

Always compare the **same** map, players, effect density, camera zoom, simulation/network conditions, browser version and device. Comparing an empty Phaser scene to a fully populated Canvas battle is not a performance test.

## Test environment capture sheet

For every report record:

- Date/time, local timezone, git branch and full commit SHA.
- Client/server build versions, Node, browser and OS versions.
- Device model, RAM, screen resolution, device pixel ratio, power-saving mode and refresh rate.
- Network path (same machine, LAN, WAN), injected latency/loss/jitter and measurement tool.
- Match mode, human/bot count, map seed, effect load, round count and duration.
- Whether tests are emulated, real device, automated or manually observed.
- Exact command or reproduction steps, raw outputs and screenshots.

## Functional baseline

Existing test command:

~~~sh
npm ci --prefix backend
npm test --prefix backend
~~~

Existing optional browser scripts (require Playwright and local test server per existing docs):
- backend/tests/browser-smoke.cjs
- backend/tests/mission-browser.cjs
- backend/tests/recruits-browser.cjs
- backend/tests/prediction-browser.cjs is proposed in open PR #17, **not present on main at baseline**.

Do not silently mark optional browser tests as passed if Playwright or browsers are not installed. Install tools only in approved local/test environment. Run scripts against isolated ports, never production.

## Scenario matrix

| Scenario | Bots/humans | Critical assertions | Evidence |
| --- | --- | --- | --- |
| Guest startup | 1 human | Can reach playable state without account or excessive setup | video/screenshots + time |
| Character creator | 1 human | Skin/jacket/hat preview and local persistence, safe defaults | screenshots + reload |
| Desktop interaction | 1 human | WASD, pointer aim, throw on release, cancel on blur | input log |
| Mobile touch | 1 human | Two thumbs, pointercancel, safe-area, orientation | real device video |
| Standard bots | 5v5 solo | AI moves, throws, spreads, match ends | bot trace + tick metrics |
| Medium load | 10v10 solo | Frame time / server tick / bandwidth | repeatable benchmark |
| Large bot stress | 30v30 solo | No unbounded stack/stall; capacity hypothesis | trace & p50/p95/p99 |
| Two-player private | 2 humans | Same room ID, team scores, round end and rematch agree | two sessions + server trace |
| Human capacity | 10v10 actual clients if feasible locally | Seat rejection/limits, packet quality, connection stability | synthetic clients + sample real clients |
| Disconnect/reconnect | 2 humans | No ghost seat; no stuck movement; clear UI | reconnection trace |
| Bad network | 2 humans | 80/150/250 ms RTT, jitter, loss; corrections bounded | packet/position trace |
| Page lifecycle | 1+ | background, foreground, rotate, refresh and focus | device logs |
| Game end/OT | 2+ | correct winner/hill, draw, sudden death, rematch | authoritative snapshot |
| Accessibility | relevant devices | visible focus, readable HUD, reduced motion, non-color-only teams | manual audit |

## Devices and viewports

Required minimum target coverage:
- Desktop Chrome and Firefox at 1280x800; Safari desktop when available.
- Real iOS Safari and Android Chrome (record models/versions). Emulator tests are additional, not replacements.
- 390x844 portrait for menus, 844x390 landscape gameplay, and a larger tablet landscape viewport.
- 60 Hz and, if accessible, 120 Hz displays.
- Limited memory/battery saver and reduced-motion modes.

## Performance targets (proposed)

| Metric | Proposed gate | Interpretation |
| --- | --- | --- |
| 5v5 p95 frame duration | <=16.7 ms on selected midrange mobile | 60 FPS ambition; report missing frames and p99 too |
| Server p95 tick work | <=8 ms (goal) | Leave margin in the nominal 16.7 ms tick |
| Input stuck after lifecycle interruption | Zero reproducible cases | Absolute functional gate |
| Authoritative result mismatch | Zero across matched clients | Absolute functional gate |
| Critical runtime JS exceptions | Zero during tested end-to-end paths | Absolute functional gate |
| Snapshot payload and bytes/s | Record actual median and p95; no silent large regression | Capacity evidence, not a fixed universal target |
| Network at 80/150/250 ms RTT | No stuck input or divergent scores; correction bounded | Usability judged alongside logs |
| Asset load | Record first-load, warm-load, bytes transferred, failed requests | Establish actual budget after baseline |
| Repeated matches | No monotonic uncontrolled memory increase after 10 rounds | Detect effect/listener leaks |

A 2% frame-time comparison gate applies only after matched baseline and variance analysis; if the margin is within noise, state **no demonstrated improvement** instead of declaring success.

## Perf test procedure

1. Pin same build, machine, browser and map seed.
2. Warm up for a fixed period to avoid one-time JIT/compiler startup skew.
3. Run multiple timed rounds (minimum three; more when variance is high).
4. Record raw per-frame durations, long tasks, snapshot sizes, network rates, server tick samples.
5. Compute p50/p95/p99 and sample count, plus minimum/maximum.
6. Repeat with old and candidate code in alternating order to mitigate thermal and background process drift.
7. Record median across rounds, variance and limitations.
8. Link raw traces and exact commits; never cherry-pick only the best sample.

For phone hardware, note touch feel, temperature/throttling and network type. Use browser developer tools where possible; do not run invasive stress probes on production.

## Gameplay/UX moderated test

Recruit at least 5–10 first-time players if available. Have them:
- Launch as a guest.
- Identify how to move and throw without instruction.
- Explain current match goal.
- Invite another player.
- Finish a match and choose whether to rematch.
- Report frustration points, clarity, responsiveness and enjoyment.

Collect time to first action, number of wrong taps, requests for help, attempts to throw without ammo, disconnections, and post-round desire to continue. Target 8/10 comprehension when a 10-person sample is available, but report actual numerator/denominator rather than a headline percentage without evidence.

## Security, privacy and asset QA

- Validate all client inputs on server; never trust score/hit/position.
- Test invalid/nonnumeric movement inputs, unexpected room codes, oversized payloads and event rate limits where implemented.
- Inspect third-party packages and asset licenses.
- Guest customization should not contain real-person data, identity claims, inappropriate display names or cross-user leaks.
- Check Content Security Policy, origin handling and socket authentication implications before a scale-up.
- Ensure no secrets, API tokens, service account files or local credentials committed.
- Avoid copyright issues from reused commercial game characters/brands, unlicensed art or private-server code.

## Release-blocking defects (P0)

- Two independent human players cannot reliably join the same room.
- Game crashes or indefinitely hangs on common browser/mobile path.
- Controls stick after touch cancellation or lose essential throw input.
- Winners/scores diverge between client and authoritative server.
- Basic room workflow broken after a change.
- Source/asset licensing not cleared for included third-party code.
- High-severity security flaw exposing users or credentials.
- Production cannot serve public no-login room link required by contest.

P1: severe slowdown, crowded bots, unreadable UI, confusing tutorial or slow reload. P2: missing optional effects/modes.

## Per-PR definition of done

- Scope and rationale in PR body.
- Baseline and current result for any performance claim.
- Unit/regression cases for changed behavior.
- At least one actual end-to-end path tested if touching controls/protocol.
- No cross-system conflicts or missing license notice.
- Explicit unresolved limitations, reviewer names and rollback note.
- P0 = 0. P1 exceptions require product-owner sign-off.

## Evidence report template

~~~text
Scenario:
Build / branch / commit:
Environment/device:
Bots/humans and seed:
Steps / command:
Duration and sample count:
Functional result:
Client p50/p95/p99 frame ms:
Server p50/p95/p99 tick ms:
RTT p50/p95/p99 ms:
Bytes received per client / sec:
Correction/stuck/exception count:
Screenshots/trace links:
Observed limitations:
Verdict: PASS | FAIL | BLOCKED
~~~

The release decision must consider the entire path. A faster scene that cannot join or finish a real multiplayer match is not a better game.
