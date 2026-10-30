# 08 — Release, Attribution and Contest Submission Runbook

**Status:** PROPOSED RUNBOOK ONLY. No deployment or submission is authorized by this documentation.  
**Final decision-maker and submitter:** Andrew.

## Authoritative scope

The submission must be a **public, replayable, real multiplayer browser game**, with shareable room code/link and no account/app installation requirement. Accessible on phone and laptop. The Handshake mission page is:
https://joinhandshake.com/learn/create-a-multiplayer-game-8d7d59b5/

Project documents quote the challenge's official rules deadline as **October 30, 2026 at 11:59 PM Pacific** (October 31 at 2:59 AM Eastern). The mission landing page uses October 31. Use the earlier specific deadline for scheduling, but check the official rules and user's actual submission eligibility and account before submitting. Official page may change.

Judging criteria documented in existing project files: Execution (25%), Creativity (25%), Usefulness/Value (25%), Polish & Thoughtfulness (25%). This is contest context, not a guarantee that any specific scoring or award will apply to this entry.

## Release authorization

No agent, collaborator or documentation reader may:
- Merge into main based on this runbook alone.
- Trigger Vercel/Render production deploys.
- Alter hosting project settings, secrets, domains or SSO.
- Submit on Andrew's behalf.
- Contact players, publish personal data, start paid services or run stress/load against the live server.
- Replace production with an untested open-source fork or a Phaser prototype.

Andrew must explicitly approve the exact branch/commit for merge and the subsequent deployment. Approval for one action does not imply permission for unrelated future changes.

## Release candidate required evidence

- [ ] Base SHA recorded, code review complete, all intended file changes reviewed.
- [ ] No changes from the parked feature/fullstack-rewrite branch or PR #2.
- [ ] Open PR #17 prediction status inspected; no silent overlapping prediction implementations.
- [ ] Existing automated backend tests PASS from exact candidate commit.
- [ ] Browser smoke tests run against a local isolated server.
- [ ] At least two independent devices/browsers join the same room using one actual link/code.
- [ ] Both clients see consistent player positions, objective/score and winner at match end.
- [ ] One-tap rematch works after the completed round.
- [ ] Input reset works after pointercancel, lost capture, app background and reconnect.
- [ ] One real mobile browser and one laptop/desktop browser complete the core path; record models.
- [ ] No P0 defects; any remaining P1 risks are identified to Andrew.
- [ ] Bundled assets are original or legally reusable; license/attribution documents included.
- [ ] Public page does not demand login, installation or subscription.
- [ ] No credentials, secrets, internal hostnames, unsafe console logs or development-only APIs included.
- [ ] Production and test endpoints are unambiguously separated.
- [ ] One known-good rollback commit and procedure are documented.
- [ ] Owner explicitly approves deployment.

## Git and build verification

Suggested before a **future owner-approved** merge:

~~~sh
git status --short
git log -1 --format="%H %s"
npm ci --prefix backend
npm test --prefix backend
# Run required browser smoke script(s) against an isolated local server
~~~

If branch work imports a separate JS/TS frontend, run its package's locked install, lint/typecheck/test/build commands too. Record exact commands and process exit codes; do not assume CI green means manually verified hardware.

Never perform an unapproved force merge or overwrite deployment keys.

## Owner-approved deployment sequence (conditional)

1. Reviewer marks the exact commit and candidate PR as release ready.
2. Andrew grants specific merge/deploy approval in the relevant task/PR.
3. Confirm target environment, current live commit and rollback version.
4. Merge via authorized normal GitHub process only after full tests pass.
5. Trigger deploy through the existing approved pipeline; watch its result and logs.
6. Open public site in a fresh browser on desktop and mobile.
7. Check website availability **and websocket connection**, not just HTTP 200.
8. Create a test private room, join from another independent browser/network, throw, score, finish and rematch.
9. Confirm no unexpected version mismatch or stale client cache.
10. If live test fails, roll back to documented known-good revision and reverify.
11. Inform Andrew precisely which version is live and its remaining limitations.
12. Andrew performs contest entry submission.

**Production smoke probes must stay lightweight.** Performance/stress testing remains on an isolated test server.

## Contest package

Minimum human-readable entry material:

- Title: SnowFight — Winter Edition (or owner-approved final name).
- Cover graphic: original child winter neighborhood action scene, legible title, no borrowed commercial characters or logos.
- Concise description: a fast no-install online snowball fight; share a room link/code, play from phone/laptop, rematch.
- Public URL: exact verified deployment URL that works with no account wall.
- Optional 15–30 second video/screen capture: welcome -> invite -> two players throw -> winner -> rematch.
- Credits: open-source modules, asset creators, and other contributors where required.
- Collaboration narrative: accurate explanation of how different AI agents and original work contributed; no invented testing achievements.
- Eligibility and submission confirmation: Andrew verifies terms and saves receipt/confirmation.

### Example factual description (revise after verifying final build)

"SnowFight is a browser-based neighborhood snowball brawl you can start with a friend from one link. Move, aim and throw, compete in short rounds, and rematch without downloading an app or making an account. Built with an authoritative real-time multiplayer server and tested on desktop and mobile browsers."

Remove "tested on desktop and mobile" if real-device verification is not achieved. Do not advertise custom skins or huge human lobbies unless the live game actually supports them.

## Live failure triage

**Cannot connect:** verify WebSocket handshake, DNS/HTTPS, CORS/origin and server startup; don't display a false in-game connected state.  
**Room code mismatch:** verify join routing and current host session, fresh and reused invite links.  
**Server state mismatch:** halt release; compare authoritative snapshots, stale client deployment and protocol versions.  
**Bad mobile controls:** halt if throws/movement are unusable or stuck.  
**Unexpected latency:** measure actual RTT/cold start rather than assume a rendering regression.  
**Asset license concern:** stop inclusion until rights and attribution are established.

## Rollback runbook

Store, before merge:
- Previous known-good Git SHA and deployed asset/build ID.
- Candidate SHA and expected artifacts.
- Source-control rollback method (revert or redeploy prior version), authorized account/owner.
- Health and multiplayer smoke steps to confirm restored state.

If deployment fails, immediately prioritize restoring playable multiplayer and informing Andrew; don't run speculative migrations on production.

## Post-contest separation

After submission, resume strategic work: Phaser 4 proof-of-concept, stronger AI navigation, auto-reload, matchmaking and long-term cosmetic/account features. Contest pressure does not justify permanently entangling experimental systems with the production release branch.

## Final release sign-off form

~~~text
Release candidate SHA:
PR URL:
Reviewer/test owner:
Backend test command/result:
Real mobile model/browser/result:
Desktop model/browser/result:
Two-player invite/rematch evidence:
Licenses and art provenance checked:
P0 count:
Open P1/P2:
Rollback SHA/build:
Andrew approved merge? YES/NO + reference:
Andrew approved deploy? YES/NO + reference:
Live smoke result:
Contest submission performed by Andrew? YES/NO:
~~~

No filled fields should be invented or backfilled from intentions.
