# 00 — Product Direction and Experience Contract

**Status:** PROPOSED — supersedes older *design priorities*, not existing functionality or production permissions.  
**Product:** SnowFight / SnowFight — Winter Edition (final branding to be selected by owner).  
**Player promise:** "Make your kid. Join the neighborhood. Throw snowballs with real people."

## The strategic correction

The original fantasy is a joyful, large, multi-player snowball fight. Over successive iterations, the game accumulated decision-heavy features—classes with special abilities, multiple control schemes, solo mission presets, team caps, aggression settings, a center-hill scoring explanation, charging and manual packing. Each may be a legitimate feature individually; collectively they obscure the fantasy and create unnecessary learning and maintenance burdens.

The rebuild must be **subtractive before additive**. A developer must demonstrate why an additional button, resource, screen, persistent system or rule belongs in the first match. If that explanation is unclear, the feature belongs behind an advanced menu, in a later phase, or nowhere.

The target is comparable to the **clarity, responsiveness and repeatability** of excellent short-session mobile action games. SnowFight must have its own name, aesthetic, character shapes, sounds, rules and underlying licensed code; it is not intended as a replica of Brawl Stars or any other title.

## Audience and target platforms

1. First-time casual player, phone in landscape: touch controls; no external controller; joins quickly; understands how to throw.
2. Desktop player using WASD + mouse; movement and throwing feel accurate without advanced key bindings.
3. Friend group joining through room link or short code with no required registration.
4. Player who prefers a short solo practice round while human match population is low.
5. Browser users on modest laptops and tablets; the fallback experience is playable, not just a crash-free loading screen.

Browser first. Do not require installation, native app stores, third-party login, payments or a WebGPU-only device to play the first match.

## First-run journey (target)

**Open -> Play as Guest or Customize -> Play -> Understand -> Smile -> Rematch.**

- Default **Play as Guest** must be immediate; creation is optional and never a blocker for joining friends.
- **Create Your Kid** presents exactly three initial cosmetic dimensions: skin tone, jacket color, hat color. Live preview updates instantly. Optional friendly nickname may be added, with sensible privacy/moderation constraints; avoid collecting real names.
- Persist guest choices locally. Do not claim cross-device identity or guest recovery without an implemented account service.
- Game opens on a recognizable snowy neighborhood with a clear event or objective and an almost-immediate first snowball interaction.
- First-time instruction is spatial and contextual: MOVE, AIM, THROW; no text wall.
- Results are playful and unambiguous. "Play again" is the primary post-match action.

**Time-to-action goal (proposed):** a returning player should be able to launch a match and perform a meaningful throw in 15 seconds under warm-server conditions. A cold-start alternative must inform the user what is happening rather than silently hanging.

## Core gameplay principles

### 1. Simplicity
Movement plus throwing are the default active actions. Manual gathering/packing, dash, special abilities, charging and class tradeoffs are removed from the primary *UI*. Changing server rules (for example automatic reload) is a separate compatibility task, not a hidden renderer modification.

### 2. Readability
Big unique kid silhouettes, bright jackets and hats against clean snow, clearly differentiated team affiliation, readable projectiles, unmistakable hit feedback. Avoid visual noise that hides enemy trajectories. Team identification cannot depend on jacket color alone.

### 3. Responsive fairness
Movement should react instantly on the local screen without inventing hits. Server confirms damage, state and outcomes. Touch controls and keyboard/mouse must permit comparable competitive play. Assisted targeting may be introduced after explicit balance tests.

### 4. Human-centered multiplayer
The headline mode is playing **against and with real humans**. Rooms and links are critical. If bots fill a public match, the UI must identify bot seats truthfully. A 30v30 human mode is **a later aspiration**, not an existing capability.

### 5. Childhood identity
The game's unique emotional dimension is play in an ordinary winter neighborhood: snowbanks, driveways, backyards, sled hills, forts, bundled-up kids, laughter and surprise. No generic sci-fi military HUD.

### 6. Short, repeatable sessions
The present 90-second hill battle is the baseline; do not change its scoring on the contest branch without an explicit gameplay decision and corresponding tests. A future snowball-knockout mode may become the primary mode after real playtesting.

## Scope tiers

### Tier C0 — contest candidate (highest urgency)
- Instant Play and Friends link pathways.
- Stable real-human two-client multiplayer and room-code join.
- Simple kid appearance creation or guest default.
- Beginner-friendly move/throw instructions and forgiving controls.
- One polished, fair arena and a satisfying throw/hit/round-end loop.
- Basic bot anti-stacking and manageable challenge, **if safely testable before deadline**.
- Known-good match result, retry/rematch, responsive mobile UI.
- Attribution and contest submission package.

### Tier C1 — after stable baseline
- Automatic replenishment and simplified charge behavior (server-rule change).
- Better tactical bot navigation with obstacle/path planning.
- Truly public quick-match with bot backfill and explicit lobby composition.
- Cross-device synced cosmetics, with optional account consent.
- More original map variants, sound layers, accessibility settings.
- Full client prediction/reconciliation once PR #17 is reviewed and safely integrated.

### Tier C2 — long-term
- 15v15 and 30v30 real-human rooms, only after load and abuse testing.
- Skill-sensitive matchmaking, moderation, reporting, friends and identity.
- Native app packaging where user demand justifies it.
- More modes and cosmetic progression without pay-to-win.
- Live operations, analytics, content moderation and security hardening.

## Explicit non-goals for the contest sprint

No engine migration as a prerequisite; no 30v30 online-human promise; no battle pass or cash shop; no elaborate mission campaign; no combat advantage from cosmetics; no login requirement; no copied Brawl Stars art or borrowed IP; no production database replacement; no speculative full-stack rewrite.

## Design acceptance

The game should pass observed human sessions, not only automated smoke tests:

| Criterion | Proposed success condition |
| --- | --- |
| Understandability | 8 of 10 first-time testers can explain how to move, throw and win after one short match with only on-screen cues. |
| Time to first action | Returning guest reaches first meaningful interaction within 15 seconds on warm local/test infrastructure; cold starts separately measured. |
| Controls | No stuck inputs after pointercancel, blur, reconnection and orientation change. |
| Engagement | Testers voluntarily choose another round; record rate rather than promising a threshold without sample size. |
| Fairness | Human and bot identifiers are transparent; cosmetic settings never change hitbox or speed. |
| Responsiveness | Input-to-local-response and input-to-authoritative-confirmation measured separately. |
| Cross-device | Desktop, tablet and real mobile browser sessions complete a round. |

## Design decision tree

When an idea arises, ask:
1. Does it make the first match easier or the core loop more joyful?
2. Could a less complex visual or rule achieve the same outcome?
3. Is a proven, licensed solution already available?
4. Can we test it safely on a branch?
5. Does it jeopardize the known-good multiplayer flow?
6. Is it a contest necessity or a later milestone?

If questions 1, 4 or 5 fail, postpone. Andrew settles unresolved creative tradeoffs.

## Example game flow

Welcome: "SnowFight" / "Play as Guest" / "Make Your Kid" -> simple jacket/hat/skin choices with clear preview -> "Play" or "Play with Friends" -> snowy neighborhood arena with on-screen MOVE and THROW cues -> 90-second round -> winner, personal contribution and "Play Again".

The character creator may be skippable for the contest; guest play must remain functional with no character creation. This is a **goal specification**, not a statement of what today's branch already does.
