# SnowFight — Collaborators

This folder is the shared workspace for everyone building on SnowFight.
Read this document first. It states what the game is, why it exists,
what it takes inspiration from, and what the finished version looks like.

## What the game is — the goal

SnowFight is a **90-second snowball brawl you can start with a friend
from one link**.

- Hit **PLAY** and you are straight into a match. No setup, no account.
- **Hold the center hill to bank points.** The most hill points at the
  buzzer wins. A full tie goes to **sudden-death overtime**.
- **PLAY WITH FRIENDS** creates a private room: share the link or the
  room code and your friend lands in your match.
- **CUSTOM** holds the configuration: class picks (Glacier, Snowbug,
  Frostweaver, Classic fallback), single-player vs bots or multiplayer,
  match sizes 1v1 / 1v5 / 5v5 / 10v10 in both modes plus 30v30
  single-player only, and bot difficulty (single-player only).
- **One-tap REMATCH** keeps the next round a tap away.

Live game: https://snowfight-winter-edition-andrewguasch-2344.vercel.app/
(Server: https://snowbrawl-server.onrender.com/ — it auto-deploys from
`main`. The in-game title is "Snowbrawl"; the repo and challenge entry
title is "SnowFight — Winter Edition".)

## Why the game exists

SnowFight is Andrew's entry for the Handshake AI Skills Studio
"Create a Multiplayer Game" challenge (with OpenAI). Entry deadline:
**October 30, 2026, 11:59 PM PT**. Round 1 judging scores four criteria
at 25% each: Execution, Creativity, Usefulness/Value, and Polish &
Thoughtfulness. The top 20 go to a Round 2 panel; top 3 win $1,000 each.

The game's reason for being is simple: a multiplayer game that is
instantly understandable, instantly playable, and fun with a friend —
no tutorial, no lobby friction, no account wall. Every design decision
is judged against that: if it makes the first 90 seconds slower or
more confusing, it does not belong in the front door.

Internal self-score at last review (Oct 29, 2026): **17/20**
(Execution 5, Creativity 4, Usefulness/Value 4, Polish 4).

Submission itself is always Andrew's step — collaborators never submit
to Handshake or touch his Handshake account. The submission package is
title + cover image + description + working link.

## Inspiration — what it plays like

The closest playability comparisons, in order:

1. **Brawl Stars, Hot Zone mode** — the nearest overall. Top-down
   arena, short timed matches, stand in the zone to bank score,
   distinct characters, one-thumb mobile controls, party rooms,
   instant rematch. SnowFight's rethink is basically Hot Zone with
   snowballs.
2. **Splatoon, Splat Zones** — the closest objective ruleset in a
   casual package. Hold the zones, your side's score moves while you
   hold, and if the losing side is contesting at the buzzer it goes to
   overtime. Same shape as SnowFight's hill points plus sudden-death
   overtime.
3. **Team Fortress 2, King of the Hill** — the closest in structure
   plus classes. A central point, a timer that only moves while your
   team holds it, overtime on contest, and distinct character classes
   — the same skeleton as Glacier / Snowbug / Frostweaver holding the
   center hill.

One real difference: SnowFight banks points *up* while you hold, and
most points at the buzzer wins. TF2 and Splat Zones run a timer *down*
while you hold. Same hold-to-win shape, different scoreboard — and
SnowFight's version is the friendlier one for a 90-second casual match.

## The optimal version — what "done" looks like

The target is the rethink, fully live and verified:

- One PLAY button front door; center-hill objective with hill HUD and
  results; shareable room links on every multiplayer match; one-tap
  rematch; everything else behind the Custom screen.
- Bots contest the center hill in single-player, so the objective is
  not hollow solo.
- Full test suite green before any merge; live verification after
  every deploy (websocket probe, not polling); client on Vercel
  byte-identical to `main`; server on Render auto-deployed from `main`.
- Submission package complete: title "SnowFight — Winter Edition",
  cover image, description, working link.

## Guardrails (non-negotiable)

- **OG mainline only.** Never touch `feature/fullstack-rewrite`,
  PR #2, or the rewrite in any form. It is parked and does not build.
- **Branch + pull request, never direct to `main`.** Merges need
  Andrew's say-so (the challenge reviewer agent holds a separate,
  standing build-and-deploy authorization; that is not a general
  permission).
- **Tests before merge, live verification after deploy, rollback if
  verification fails.**
- Never touch hosting project settings, secrets, or SSO settings.
- Load tests run against a local test server only, never against
  production. Light live probes are fine.
- Never submit to Handshake. Never message players or change account
  settings without Andrew's explicit approval.

## Folders

- `kimi/` — workspace for kimi.
- `omyg/` — workspace for omyg.
- `AD/` — workspace for Authentic Dynamics (Andrew's own
  contributions).

Each folder is its owner's drop zone: notes, drafts, and
work-in-progress. Roles for kimi and omyg are set by Andrew. Anything
that should land in the game itself still goes through branch + PR
with tests, per the guardrails above.
