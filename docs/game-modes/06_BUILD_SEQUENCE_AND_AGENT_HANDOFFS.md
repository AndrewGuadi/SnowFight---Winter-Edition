# 06 — Build sequence, ownership, files, dependencies and exact exit gates

**This is the next build's executable work order.** No broad comparative-engine research needed. All production changes are withheld pending review and approval. Each ticket lives in a separate branch/PR against the current rebuild integration branch.

## Preflight (do once, no research sprint)

1. Capture exact head SHA of `docs/rebuild-reuse-first-2026-10-30`, current `main` SHA, open PRs and any in-flight Kimi/Muse/Sol changes; merge/rebase none blindly.
2. Run `npm ci --prefix backend && npm test --prefix backend` and existing four/five Chromium suites as available; link CI receipt. Confirm there is a known-good two-browser room on an isolated test backend.
3. Assert no accidental production Vercel/Render routing; test on isolated Render preview and Vercel preview if needed.
4. Establish file ownership per stage, mark `index.html` **one-writer only**. No one needs to research engine selection again; decision in 01 is binding for v1.
5. Check the current codebase for mode registry seams and update proposed filenames if exact names conflict. Do not replace existing authoritative mechanics.

## Wave 0 — compatibility and user navigation (tickets GM-001..GM-004)

| Ticket | Owner | Target files | Implementation | Acceptance |
| --- | --- | --- | --- | --- |
| GM-001 | GPT-6 / Sol | `backend/modes/index.js`, `backend/modes/brawl.js`, `backend/server.js` | Introduce new optional `gameMode` field and mode registry, default `brawl`. Do not reuse participant `mode` field. | Existing Brawl results identical for fixture inputs; legacy join accepted |
| GM-002 | Sol | `backend/server.js`, tests | Reject cross-mode reuse of room codes; bounded mode serialization in `init`/`state`; no time/score change yet | Mixed-mode join returns helpful error, Brawl old clients remain compatible |
| GM-003 | Muse | `assets/modes/mode-picker.js`, `assets/foundation-ui.js` | Three mode cards with accurate enabled/coming-soon statuses; keep guest+friend flows | Can select Brawl and access correct lobby; inactive modes clearly labeled |
| GM-004 | GPT-6 QA | `backend/tests/game-mode-contract.test.cjs` | Protocol compatibility, invalid mode, no room crossover and host capacity tests | Entire Node+browser baseline green |

**Release gate W0:** only safe mode registry and truthful UI, no POW mechanics yet; rollback to known-good.

## Wave 1 — POW pure rules and map (GM-010..GM-014)

| Ticket | Owner | Scope | Implementation | Acceptance |
| --- | --- | --- | --- | --- |
| GM-010 | Sol | `backend/modes/pow-map.js` | Mirrored spawn, prison, exit gate, rescue pads and center zone geometry with derived collider list | 30 map seeds symmetric; no spawn trapping; two safe rescue approaches |
| GM-011 | Sol | `backend/modes/pow.js` | Captured state, player restriction, prison teleport, one-time capture scoring, server hit callback | Prisoners cannot shoot/leave/get re-tagged/score |
| GM-012 | Sol | `backend/modes/pow.js` | Server tick 120 channel and 240 gate timer, release queue and exit protection | Exactly 119/120-tick boundary and interruption cases pass |
| GM-013 | Sol | `backend/modes/pow-powerups.js` | Center occupation, buff rotation, 20-second charge, one timed team effect | Buff server-owned, finite and respects prisoner/invulnerability rules |
| GM-014 | GPT-6 + Sol | `backend/modes/pow.js`, `backend/server.js` | Match 240s, all-captured winner, tiebreak, disconnect grace | No double matchEnd, ghost forfeit or false team wipe |

**Release gate W1:** deterministic pure/server tests green with no UI work required; record head SHA. Do not merge all five features as unreviewed giant PR.

## Wave 2 — POW playable integration (GM-020..GM-024)

| Ticket | Owner | Scope | Implementation | Acceptance |
| --- | --- | --- | --- | --- |
| GM-020 | Kimi | `assets/modes/pow-render.js` | Original snowy forts, bars/gates, pads, flag indicator, captured/kid expression, gate burst | Mirror visual geometry matches authoritative init data; low FX supported |
| GM-021 | Muse | `assets/modes/pow-hud.js`, input adapter | Hold-to-rescue visible 2s radial cue; accessible touch interact control and keyboard E | Cancel/disconnect/blur clears interact; no extra permanent action buttons in Brawl |
| GM-022 | GPT-6 | `index.html`, imports | Single integration owner wires selected mode to scene renderer, socket listeners, camera and result overlay | No duplicate RAF, touch pointer cancellation or animation regressions |
| GM-023 | Sol + Muse | Browser tests | Two human clients POW capture, rescue, game-end and rematch in same room | Two independent browser instances agree on score and prison occupancy |
| GM-024 | GPT-6 | PR/QA reports | Test failure fixes, source and asset provenance, rollback and performance baseline | 0 P0, acceptance matrix in 07 passed |

**Release gate W2:** POW is playable locally and via preview with matched client/backend; production remains untouched. Real mobile tests are a separate approval gate.

## Wave 3 — small platformer vertical slice (GM-030..GM-034)

| Ticket | Owner | Scope | Implementation | Acceptance |
| --- | --- | --- | --- | --- |
| GM-030 | GPT-6 / Kimi | `assets/platformer/physics.js` | Separate fixed-step gravity, AABB/collision, coyote/jump buffer, level checkpoints | Deterministic unit tests at 30/60/120 render FPS |
| GM-031 | Kimi | `assets/platformer/levels/frosty.json`, `renderer.js` | Single Save Mr. Frosty level, original art from our kid/arena system | 4 sections, 3 collectibles, 20s defense, no external unlicensed assets |
| GM-032 | Muse | `assets/platformer/input.js`, `scene.js` | Small mobile+desktop input and pause/resume, own loop lifecycle | No stuck controls or concurrent loops after exit |
| GM-033 | Sol QA | Unit/browser tests | Cross-scene transition and progression/achievement consistency | Platformer can play without Socket.IO backend and does not corrupt PvP |
| GM-034 | GPT-6 | Integration docs/demo | One complete beginner 120s mission with repeatable test video | Testers complete mission, retry after fall, clear outcome screen |

**Release gate W3:** platformer as optional solo game scene; do not put incomplete mode on live front door.

## Wave 4 — integrate, certify and release (GM-040..GM-043)

GM-040: Integrator compares branch against known-good main and current rebuild. Resolve conflicts explicitly, never overwrite Kimi's animation/presentation work blindly.  
GM-041: All Node, browser and physical-device tests; latency, power-up fairness, gate exploit tests; accessibility.  
GM-042: Preview deploy complete client + server from **same commit**, test each mode end-to-end, perform rollback rehearsal.  
GM-043: Andrew expressly approves merge/deployment, then release both services in coordinated order and verify actual production.

## Scope cuts if time/complexity grows

In order: freeze platformer after one complete mission; reduce 3 power-ups to one proven buff; reduce POW map variants to one mirrored authored arena; remove public POW matchmaking until private rooms are reliable. Do **not** cut prison confinement, 2-second rescue server authority, human match result accuracy, or Brawl regression testing.

## Collaboration contracts

- **Sol:** owns all authoritative mode rules and network; does not change renderer.
- **Kimi:** produces visuals for POW prison/flag and platformer characters/level; does not change server physics.
- **Muse:** creates entry selection, HUD, safe touch and accessibility; does not change scoring.
- **GPT-6:** owns integration, state schema, review, test reports, PR ordering and safe rollback.
- **Andrew:** approves gameplay/creative deviations, production merge/deploy and product release.

External agents are not dispatched simply by naming them here. If only GPT-6 is executing the build, it follows the same file-by-file ordering and review gates without claiming multi-agent parallelism.

## End-of-ticket handoff

```text
Ticket:
Base and head SHAs:
Branch / PR:
Source files changed:
Reused module/art and license:
Tests actually executed:
Evidence (log or screenshot):
Performance comparison:
New protocol fields:
Known limitations:
Reviewer / owner decision:
```

No performance or availability claim without a source-bound test result.
