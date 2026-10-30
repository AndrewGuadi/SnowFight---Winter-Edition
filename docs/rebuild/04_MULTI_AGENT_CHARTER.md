# 04 — Multi-Agent Collaboration Charter and Division of Authority

**Status:** PROPOSED ROLE ASSIGNMENTS. Agents are not automatically connected or operating because this file exists.  
**Participants:** Andrew (owner); GPT-6 (creative/technical director and integration); GPT-6.1-Sol (backend/network/AI); Kimi.ai (art and visual engineering); Meta Muse (UX and independent QA).

## Authority model

**Andrew is the only final product/release decision-maker.** He approves material scope/creative changes, foundation forks, merge/deploy and public contest submission. If a previous standing authorization exists for a particular agent, it does not expand the rights of other agents under this charter.

**GPT-6 is the systems integrator.** Responsible for coherence, design/spec ownership, conflict review, reused-code evaluation, PR sequencing, test evidence and recommendations. GPT-6 may create documentation and isolated branches as authorized; no agent is allowed to infer merge/deployment consent from a planning request.

Every agent is accountable for its own changes and evidence. Peers are not subordinates who can rewrite each other's work without consultation.

## RACI-style responsibility map

| Workstream | Accountable | Responsible | Independent reviewer | Owner approval |
| --- | --- | --- | --- | --- |
| Core vision and game mode priorities | Andrew | GPT-6 drafts | Muse, Kimi, Sol | Yes |
| Open-source architecture/fork evaluation | GPT-6 | Sol + GPT-6 | Muse (usability), Kimi (asset rights) | Yes to adopt |
| Client framework / Phaser POC | GPT-6 | Kimi (rendering), GPT-6 (adapter) | Sol (protocol), Muse (devices) | Yes to adopt/deploy |
| AI steering, navigation and bot fairness | Sol | Sol | GPT-6 + Muse | Yes to gameplay rules change |
| Server networking, snapshot and authority | Sol | Sol | GPT-6 + Muse | Yes to merge/deploy |
| Kid visual direction and sprite pipeline | Kimi | Kimi | Muse + GPT-6 | Yes to final look |
| Onboarding, menu, input affordances | Muse | Muse | Kimi (visual), GPT-6 (integration) | Yes to major UX change |
| Browser E2E and accessibility testing | Muse | Muse | Sol for server cases | Evidence gate |
| Build/release integration | GPT-6 | GPT-6 (coordination) | Sol + Muse | **Andrew only** |
| Contest entry submission | Andrew | Andrew | Team may review materials | **Andrew only** |

## Agent-specific contracts

### GPT-6 — game director / integrator

**Owns:** docs/rebuild/, integration plans, cross-functional interface contracts, risk register, final reviewer report.

**Must do:** establish testable specification; prevent duplicate work; verify licenses and cited provenance; review diffs and actual tests; resolve integration conflicts; choose the smallest reversible implementation; record open decisions.

**Must not:** invent performance data, silently change the chosen foundation, rewrite a teammate's area without attribution or ship to production without approval.

**Deliverables:** integration checklist, decision records, reviewed PR dependencies, observed metrics, precise owner approval request.

### GPT-6.1-Sol — backend, AI, networking and performance owner

**Owns:** backend/server.js, backend/gameplay.js, backend/missions.js, backend/classes.js, backend tests, isolated network instrumentation. Be careful of changes to modules used by open PRs.

**Must do:** evaluate PR #17 before designing prediction anew; diagnose bot center convergence using deterministic tests; preserve hit/score authority and 60 Hz tick semantics; document compatibility for any changed input or snapshots; run 5v5, 10v10 and isolated 30v30 bot stress tests.

**Deliverables:** backend-focused PR, test run log, measured before/after tick costs, protocol-compatibility notes and rollback path.

**Must not:** edit menu CSS or art, add a second authoritative physics implementation, change production Render config, falsify human/bot counts.

### Kimi.ai — original art director / visual engineering

**Owns:** visual references, original kid character/sprite system, skins/jackets/hats, environment layers, optimized animation atlases, lightweight particles and sound direction. Own visual files in a branch or its existing collaborators/kimi workspace.

**Must do:** produce legally traceable art; make silhouettes readable at mobile sizes; define sprite dimensions/origin/animation states; deliver assets with attribution, file sizes, tested browsers and proposed draw budgets; avoid sprites that copy recognizable commercial characters.

**Deliverables:** visual style guide, one minimal sprite set, layered customization contract, before/after screenshots, performance implications.

**Must not:** introduce heavy 3D dependencies for the contest, add proprietary music/models without licensing, change authoritative collision radii through sprite dimensions, alter server code.

### Meta Muse — UX implementation and independent acceptance QA

**Owns:** first-run flow, touch affordances, controls comprehension, accessibility, concise HUD, Playwright/browser E2E plans, test recordings. Muse may implement a bounded UI PR after agreement; do not presume permission to rewrite all of index.html concurrently.

**Must do:** measure first-15-second experience; maintain touch + keyboard regression scenarios; assert actual two-client match and results, keep bugs reproducible; check usable contrast, focus states, reduced motion and touch cancellation.

**Deliverables:** UX screen map, usability rationale, tested device matrix, QA sign-off with actual evidence, prioritized defects.

**Must not:** silently change authoritative rule definitions, claim a virtual device test is physical hardware validation, approve release in Andrew's place.

## Isolation boundaries and naming

Work from the latest verified main commit unless an integration branch is explicitly selected. Example branches:
- docs/rebuild-reuse-first-2026-10-30 (this charter).
- feat/snowfight-guest-onboarding
- feat/snowfight-bot-separation
- feat/snowfight-original-kid-sprites
- test/snowfight-two-client-smoke
- poc/snowfight-phaser4-client

No direct commits to main. No force-push to another agent's branch. No agent silently rewrites the parked feature/fullstack-rewrite or PR #2.

If work must edit index.html simultaneously, require a named ownership window or extract modules in a coordinated PR. A shared file is not a free-for-all.

## Communication and handoffs

Use one concise handoff message per branch/PR:

~~~text
Workstream:
Owner/agent:
Base SHA:
Branch / PR URL:
Goal and non-goals:
Files changed:
Upstream project/module reused (URL, SHA, license):
Tests executed (exact command + result):
Screenshots/repro steps:
Performance before -> after (environment and sample size):
Risk / compatibility / unresolved decisions:
Reviewer requested:
Would this affect production? YES/NO
Is owner approval needed? YES/NO (and for what)
~~~

A claim like "fixed latency" is invalid without test conditions. A claim like "tested on mobile" must distinguish emulator, real phone and platform. A claim like "MIT" must identify what files and assets are covered.

## Review and integration workflow

1. **Assign bounded ticket** from 09_PRIORITIZED_BACKLOG.md with dependencies.
2. **Research reuse** and record a short adoption/implementation decision.
3. **Create isolated branch**, pin source SHA and scope.
4. **Implement smallest patch**; keep source notices and add tests.
5. **Self-test** with exact command and outputs.
6. **Peer review** by role-specific reviewer.
7. **Integration review** by GPT-6: run dependency/order, conflict and protocol checks.
8. **Owner approval** before merge or deployment.
9. **Live verification** after an approved deploy; rollback on failure.

A red test must not be reclassified as passed because the feature "looks good." If agents disagree, record both interpretations and the evidence, then ask Andrew for a product decision rather than inventing his preference.

## Explicit conflict protocol

- Stop simultaneous writes to the affected file.
- Identify the exact conflicting commits and contracts.
- Agree on one canonical owner and integration ordering.
- Resolve on a new integration branch, not by overwriting individual work.
- Run all affected existing and new tests.
- Preserve change provenance in the PR body.

## Quality gates shared by all agents

- No unauthorized production changes or secret access.
- No copying unlicensed code/art.
- No false availability or latency claims.
- No breaking baseline room join/scoring/rematch without tests.
- No default new buttons/menus without a first-session justification.
- No 30v30 humans claim without load and live-client evidence.
- No user account or privacy-sensitive persistence introduced without consent and policy.

## Coordination cadence during a timeboxed sprint

- At start: baseline SHA, foundation decision, file ownership and cut line.
- At each gate: one result with PASS/FAIL/BLOCKED and test evidence.
- At freeze: stop features, only release-blocking fixes.
- At release: Andrew explicitly authorizes action; no agent assumes a plan is permission.

## Important operational truth

These are role descriptions and work contracts. **The other AI collaborators have not been dispatched by committing this document.** They must be engaged separately, given repository access, and accept their scoped tasks. No automatic shared context or synchronized code changes should be assumed.

The best multi-agent system is not four agents writing code simultaneously. It is four complementary specialists reducing the work and error burden with one clear integration authority and one clear product owner.
