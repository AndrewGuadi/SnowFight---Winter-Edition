# 03 — Six-Hour Contest Rescue Plan

**Status:** PROPOSED TIMEBOX, not a promise of asynchronous delivery and not evidence of implementation.  
**Scope:** a contest-quality, original, browser-accessible SnowFight slice using the most reliable foundation.  
**Final operator:** Andrew authorizes merging and deployment and personally submits the entry.

## Why the contest changes the optimization

The available window is too small to re-engineer a major 30v30 network shooter, replace its engine, write an account system and undertake a clean-room art overhaul. Success depends on hard prioritization, not volume of agent output.

The Handshake "Create a Multiplayer Game" page describes a publicly accessible replayable multiplayer experience using room codes, requiring no account or install, playable on phones and laptops:
https://joinhandshake.com/learn/create-a-multiplayer-game-8d7d59b5/

The existing project handoff quotes official contest rules with a deadline of **October 30, 2026, 11:59 PM Pacific** (October 31, 2026 at 02:59 EDT). The mission page loosely says October 31. Independently verify the official terms before submission; use the earlier specific deadline for planning. No prize, judging result or eligibility is guaranteed.

## Critical path

A functioning real two-client snowball fight is P0; presentation and custom characters are P1; 30v30, a new engine and persistent accounts are P2. Changes that jeopardize the critical path are cut.

### T0–T+45 min — Inventory, baseline, and legal gate

Owner: GPT-6 coordinating; Sol on backend; Kimi on art; Muse on UX.

- Record current main SHA and enumerate active PRs; note PR #17 prediction work, PR #6 and parked PR #2.
- Run current unit/integration/browser smoke tests locally; record failures honestly.
- Verify that two clients on local/test infrastructure can join a room and finish/rematch.
- Screenshot portrait and landscape screens, record startup friction, minimum device and tested network conditions.
- Audit leading fork candidates: Claude of Legends and open-games first, alongside SnowFight; check root/asset licenses and install steps. Classify Skirmio as reference-only pending licensing.
- Identify the smallest playable demo with reliable room behavior; do not start importing source during research.

**Gate 1 — foundation (by T+45–60):** retain current SnowFight unless a licensed fork has already built cleanly, hosted locally, passed two-client validation and offers clear integration cost savings. Owner approval required for switching foundations.

### T+45–T+105 min — First-play simplification

Owner: Muse (UX), Kimi (art integration), GPT-6 integration.

- Make the first screen unambiguous: Play; Play with Friends; guest/create kid.
- Hide classes, aggression, missions and alternative input schemes from the default flow. Preserve advanced features behind optional advanced UI or flags; don't delete server implementation under time pressure.
- Provide a tiny cosmetic selection, only if it can be completed and tested without breaking join. If not, ship a distinct attractive default kid and a post-contest character creator.
- Ensure touch hit targets, landscape orientation and readable results.

**Gate 2:** a novice reaches a throw and a complete match without an explanation longer than a sentence.

### T+105–T+190 min — Core combat and bot fixes

Owner: Sol, reviewed by GPT-6; Kimi adds feedback effects.

- Evaluate whether current controls can be simplified **without a risky wire-protocol rewrite**. Do not promise automatic packing/reload until server semantics and deterministic tests support it.
- Target the bot convergence bug: nearest enemy + exact hill center. Add a bounded, deterministic spacing/slot offset for contest-sized bot matches and an unsticking fallback if feasible.
- Tune beginner bot pursuit/reaction within server-controlled limits. Don't make bots cheat.
- Add small, deliberate feedback: snow puff, throw sound with mute, clear frozen/respawn state.
- Test the exact fixed scenario and verify no hill-control regression or AI deadlock.

**Gate 3:** bots no longer persistently stack, humans can move/throw, and the match still ends reliably. If gates fail, revert the risky change rather than destabilize existing production.

### T+190–T+270 min — Friend-session polish and cross-device validation

Owner: Meta Muse owns QA; GPT-6 fixes integration blockers; Kimi owns visibility/animation.

- Two independent browsers with distinct connections join one room by code/link.
- Validate team caps, invitation mismatch, empty/full room, timeout/reconnect, round end and rematch.
- Test real phone + desktop if hardware is available; desktop emulation is supplemental.
- Exercise network conditions with local throttling. Record failure and fixes with commit SHA.
- Test at least one 5v5 solo-bot scenario and one human match.
- Check accessibility: focus visibility, reduced motion, readable score and non-color-only team markers.

**Gate 4:** zero known P0 defects in the exact submit flow.

### T+270–T+330 min — Feature freeze and release candidate

- Stop adding features; retain only reproducible release-blocking fixes.
- Run backend tests and browser scripts; capture screenshot/movie evidence for the entry.
- Confirm imported code/art license documentation, attribution and absence of copied character IP.
- Produce a release candidate branch/PR and a clear rollback path. No unattended merge.
- Verify no secrets, credentials or local-only endpoints are committed.

**Gate 5:** release checklist passes, reviewer signs test evidence, owner reviews candidate.

### T+330–T+360 min — Owner-approved release and submission preparation

- After explicit Andrew approval only: merge/deploy the accepted candidate using existing authorized flow.
- Check live page, websocket handshake, private invite, round, rematch and real-device join on production (lightweight probes only).
- If live verification fails, roll back using known-good commit; don't continue to submit a broken link.
- Prepare project title, working public URL, original cover image, concise description, collaboration disclosure and attribution.
- Andrew alone completes the contest submission.

**Note:** These timeboxes are planning targets. They are not guaranteed completion estimates; whenever a gate fails, cut scope rather than compress QA.

## Stop-doing list (hard cut line)

No full engine migration, large map generator, 30v30 humans, accounts, skill ranking, microtransactions, mission campaign expansion, deep inventory, new host or backend framework, unauthorized contest submission, full-client refactoring, fork without license, or last-minute speculative performance optimization.

## Parallel work without collisions

- Sol: backend AI and network correctness; no UI edits.
- Kimi: original kid asset/snow effect and performance-conscious visual notes; no server edits.
- Muse: onboarding/interface and browser tests; no server gameplay edits.
- GPT-6: branch integration, protocol compatibility, evidence and final gate reports.
- Andrew: creative decisions and release permissions.

Parallel work cannot assume agents share runtime or branch access. Every external collaborator needs the actual repository access and must report a branch/PR or patch. No automatic cross-agent assignment is implied by this plan.

## Success requirements

**Required:** game opens via link; no login; two players in one private room; keyboard + mobile operability; recognizable snowball interaction; a visible win/loss; rematch; consistent server authority; legal original presentation; a verifiable submission URL.

**Strongly desirable:** intuitive kid appearance customization, satisfying snow effects, bot separation improvements, usable public quick play and improved local responsiveness. Do not misrepresent an isolated solo bot game as human online matchmaking.

**Not required:** top-three win, Brawl Stars-equivalent content breadth, 30v30 humans, migration to Phaser 4.

## Timebox exit report template

At each gate record:
- Timestamp, commit SHA, owner/agent.
- Tasks completed with links.
- Test environment and exact command.
- Objective result PASS/FAIL/BLOCKED.
- Observed defects, severity and responsible owner.
- Scope cut and fallback.
- Decision taken and approval identity (if merge/deploy).

## If the clock runs out

Priority order: real-room reliability > access on phone/laptop > original enjoyable throwing > correct round/rematch > UI clarity > visual polish > optional extras.

Use current verified multiplayer baseline and prepare submission if it passes gates; do not replace it with an unfinished fork or experimental Phaser client just to claim novelty.

**Separate longer-term track:** Phaser 4 may be tested after the contest without making contest readiness depend on it.
