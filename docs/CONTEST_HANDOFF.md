# SnowFight — contest handoff

Based on `main` 5449bd9; read `collaborators/README.md` for the vision and project guardrails. Do not merge, deploy, submit an entry, or change hosting/secrets without Andrew's instruction. Do not use the parked fullstack rewrite.

## What the competition asks for

Handshake's [mission](https://joinhandshake.com/learn/create-a-multiplayer-game-8d7d59b5/) asks for a reusable, publicly accessible multiplayer game with room codes, no login or installation, playable on phones and laptops. The [official rules](https://go.joinhandshake.com/rs/390-ZTF-353/images/%5BAI_Skills_Studio_Challenge%5D_Contest_Official_Rules.pdf?version=0) say October 30, 2026 at 11:59 p.m. Pacific; the mission page says October 31, so use the earlier official deadline. Submission requires project title, cover image, description, and a working link. Four equally weighted criteria are execution, creativity, usefulness/value, and polish/thoughtfulness. No particular score, award, or eligibility is guaranteed.

## This PR

- A private code now resolves to its live room regardless of the joining player's selected team sizes; the existing host's team caps govern assignments and full-room rejection. Open matchmaking remains size-based.
- Switching hill control resets partial progress before counting the new team's ticks. Ties and uncontested periods also clear progress.
- The minimap marks the hill and an on-field arrow points toward the offscreen objective. Desktop front-door content spans the card instead of occupying half its width.
- Browser smoke scripts explicitly open Custom after the front-door redesign. Added regression cases cover invite size mismatch and immediate control transfer.

## Next, ordered by contest value

1. **Validate the live friend journey end to end.** After an explicitly approved deployment, use two devices and different networks to create a room, copy its link, join, finish a round and rematch. Check 1v1 and larger room configurations, fresh and reused links, capacity, network disconnects and server cold start. Never run load tests on production. A public project URL must work without login.
2. **Make the first 15 seconds fun.** Keep the one-button front door. Test a small orientation cue, clear hold/contest states, a faster first engagement, and audio/haptic feedback. Add one designed, symmetric arena with protected spawn lanes, intelligible cover and routes to the hill; do not rely on 60 random obstacles for competitive fairness. Avoid confusing the existing 90-second rules.
3. **Improve bots around the objective.** The current bots pursue the hill only until their team scores its first point. Give them clear capture/defend/contest/attack decisions and a limited rescue behavior; test both team sizes and overtime to prevent deadlocks or bots idling off objective. Preserve difficulty and player control.
4. **Measure real synchronization before optimizing.** Physics is 60Hz, authoritative state 30Hz. Full room snapshots still include every player. Run local repeatable 2/10/20 player load and network-jitter tests, record server tick p50/p95/p99, bytes per player/second, packet cadence, frame times and input-to-feedback. Exercise 80/150/250ms RTT, jitter, packet loss and reconnects. Movement prediction/reconciliation and entity deltas need sequence numbers, determinism, correction bounds and fairness tests; do not promise a latency number from a local benchmark.
5. **Presentation and submission.** Produce a clear cover and a concise description, show the friend-link-to-rematch experience, and check a real phone and laptop. Andrew submits the official entry. Confirm mission eligibility and all requirements directly in Handshake.

## Suggested responsibilities (not dispatched)

- **GPT / direction:** own the play loop, protocol contracts, acceptance thresholds, integration and independent review. Keep a working branch from current `main` and test before requesting merge.
- **Kimi / visual engineering:** propose one top-down arena layout and lightweight effects under a fixed frame-time budget. Deliver exact geometry, colliders and screenshots, including mobile and reduced-motion behavior. Avoid a 3D rewrite unless measured benefits outweigh delivery and synchronization risk.
- **Muse / bounded implementation and QA:** implement one agreed task per branch, such as hill indicators, fixed arena colliders, or browser regression coverage. Include reproducible two-client tests, changes limited to the assigned files, and a PR that identifies assumptions. Run the whole suite and report failures, not just successes.

Recommended acceptance: two independent clients join the same room with one link and agree on the winner, objective ownership and rematch; real-device controls remain usable; no stuck movement after interruption; changes do not increase state cadence. Set actual latency and frame-time targets only after collecting a baseline. No measured production RTT, mobile FPS, or release-readiness claim is made here.
