# Performance results

## Conclusion

The final matched local Chromium runs show no material frame-pacing regression: both baseline and candidate remain around 16.7–16.8 ms at p50/p95/p99 in the tested 5v5, 10v10, and 30v30 scenes. Whole-client requestAnimationFrame callback cost remains below 1.1 ms at p99 in these final samples.

This is not a claim that the candidate is faster, and it is not certification of stable 60 FPS on midrange physical phones. Run-to-run callback variation is visible, especially in the 30v30 stress scene. The result supports “no measured frame-pacing regression in this environment,” nothing stronger.

## Method

- Final rounds: `e` and `f`, run in alternating baseline/candidate order.
- Baseline: required rebuild branch at SHA `4423d84c276b0a13174bccb48f21877a7f809a56`.
- Candidate: final animation-polish source.
- Browser: Chromium `141.0.7390.37`, headless.
- Runtime: Node `v20.20.2`; real local Express/Socket.IO server.
- Viewport: 844 x 390; desktop headless browser, not mobile emulation for these benchmark rounds.
- Scenes: real solo-bot 5v5 (10 players), 10v10 (20 players), and 30v30 (60 players).
- Warm-up: 1.5 seconds after the requested player count is present.
- Sample: 5 seconds per scenario, approximately 300 frames per scenario per run.
- Both versions run the same server simulation, arena, bots, projectiles, and impacts; neither comparison uses an empty scene.
- Frame percentiles come from requestAnimationFrame timestamps. Callback percentiles wrap client RAF callbacks and include update/render JavaScript work, not GPU completion time.

Raw final data is in `docs/animation/evidence/`:

- `baseline-e-benchmark.json`, `candidate-e-benchmark.json`
- `baseline-f-benchmark.json`, `candidate-f-benchmark.json`

The harness also writes matched-scene PNGs to its evidence output directory for visual inspection; those reproducible test outputs are not runtime assets.

Reproduce from the repository root with the backend dependencies and Playwright Chromium installed:

```sh
BENCHMARK_LABEL=candidate-local EVIDENCE_DIR=/tmp/snowfight-benchmark \
  node backend/tests/visual-benchmark.cjs
```

Run the same command from the baseline checkout with a different label. Keep viewport, duration, browser, server settings, and scene sizes matched. Alternating several rounds is preferable to drawing conclusions from one run.

## Frame-time results

Values below are medians of final rounds e and f. Frame times are milliseconds; lower is better, but tiny differences are not treated as meaningful wins.

| Scenario | Version | p50 | p95 | p99 |
| --- | --- | ---: | ---: | ---: |
| 5v5 | Baseline | 16.70 | 16.75 | 16.80 |
| 5v5 | Candidate | 16.70 | 16.80 | 16.80 |
| 10v10 | Baseline | 16.70 | 16.75 | 16.80 |
| 10v10 | Candidate | 16.70 | 16.70 | 16.80 |
| 30v30 | Baseline | 16.70 | 16.70 | 16.80 |
| 30v30 | Candidate | 16.70 | 16.75 | 16.80 |

The values are consistent with a 60 Hz headless scheduling environment. They do not measure physical-device refresh behavior, thermal throttling, or GPU presentation latency.

## Client callback cost

Whole-client RAF callback cost in milliseconds:

| Scenario | Version | p50 | p95 | p99 |
| --- | --- | ---: | ---: | ---: |
| 5v5 | Baseline | 0.10 | 0.55 | 0.60 |
| 5v5 | Candidate | 0.10 | 0.70 | 0.80 |
| 10v10 | Baseline | 0.10 | 0.60 | 0.75 |
| 10v10 | Candidate | 0.10 | 0.60 | 0.65 |
| 30v30 | Baseline | 0.10 | 0.90 | 0.95 |
| 30v30 | Candidate | 0.10 | 0.85 | 0.95 |

The added character layers and effects have a real rendering cost; the small 5v5 p95 increase should not be hidden. Other small decreases are within observed run variance and are not presented as optimizations.

## Load and memory observations

DOMContentLoaded load timing is captured once per navigation and repeated for that run's scenarios:

| Version | Round e | Round f | Median |
| --- | ---: | ---: | ---: |
| Baseline | 235 ms | 212 ms | 223.5 ms |
| Candidate | 228 ms | 234 ms | 231.0 ms |

The final median difference is +7.5 ms for the candidate. Two local runs are insufficient for a load-time regression claim, and this metric is not a cold-network asset breakdown. The candidate adds three small local source/manifest requests and one SVG icon link; no large sprite sheets or texture downloads are introduced.

Chromium reported `usedJSHeapSize` as exactly 10,000,000 bytes for every final scenario in both versions. That constant value is non-diagnostic, so no heap improvement or regression claim is made. Fixed-capacity typed arrays and effect records bound the new monitor/pool allocations, but a controlled garbage-collection and GPU/resource-memory study remains outstanding.

## Effects and stress coverage

The live bot scenes include normal snowball travel and collision effects, so their whole-frame measurements include impact rendering. They do not isolate the marginal cost of one particle burst. Unit tests separately verify fixed pool capacity, expiry, reduced low-effects burst density, and miss/impact deduplication.

Low-effects mode is manually selectable and persists in this browser's localStorage. Reduced-motion behavior follows the browser media preference. No automatic device-speed detection or default quality downgrade is claimed.

## Required follow-up measurements

1. Ordinary 5v5 on selected physical midrange Android and iOS devices, with device model, OS, browser, power mode, and thermal conditions recorded.
2. Real-network multiplayer testing, separate from rendering cost.
3. Longer cold/warm load runs with transferred bytes and per-resource timing.
4. Controlled heap/resource measurements after garbage collection where tooling permits.
5. An isolated burst benchmark for player, scenery, blocked, and miss effects in both FX tiers.
6. Human review of animation clarity and motion comfort; frame percentiles alone cannot establish presentation quality.
