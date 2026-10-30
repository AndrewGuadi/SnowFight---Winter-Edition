# 05 — SnowFight Gameplay, UX, Art and Character Design Specification

**Status:** PROPOSED. Some rules require changes to the authoritative server; UI changes alone do not implement gameplay rules.  
**Creative owner:** Andrew; visual: Kimi; first-time UX/controls: Meta Muse; integration: GPT-6; server balance: GPT-6.1-Sol.

## Creative north star

**Snow day: the whole neighborhood is outside.**

Kids in colorful jackets are running between houses, hiding behind forts, diving through drifts, and pelting each other with snowballs. It is funny, competitive, readable, and energetic. It should never read as military simulation, fantasy ability spreadsheet, RPG stat management, or a lobby that demands studying before playing.

Distinctive SnowFight design language:
- Friendly exaggerated proportion, visible winter wear, expressive reactions.
- Cool snow and sky contrasted with warm coat/hat colors.
- Original houses, fences, streets, trees, sled hills, snow piles and snow forts.
- Anticipation -> launch -> air travel -> snow impact -> reaction -> instant recovery loop.
- Clear team silhouette and indicator independent of user-selected cosmetic colors.
- Original sounds; avoid cloning signature audio or animation from existing games.

## User journey and screens

### Screen 1 — Welcome / return visit

Primary CTA: **PLAY**. Secondary CTAs: **Play with Friends**, **Make Your Kid**. Guest is automatic or selectable with no forced registration. For a first visit, a welcome sheet may show Create / Continue as Guest, but must have a clear bypass.

Avoid surfacing in the first viewport: class roster, manual difficulty toggles, bot aggression, different keyboard schemes, mission ladder, advanced room caps, achievement selectors.

### Screen 2 — Kid creator

Exactly three cosmetic controls in initial release:
1. Skin tone from a thoughtful range of visible tones, clearly named/accessibly labeled.
2. Jacket color, high-contrast choices.
3. Hat color, high-contrast choices.

Large 3/4 or slightly from-behind animated kid preview; rotate or switch front/back if feasible. Selecting a swatch updates preview immediately. Include "Randomize" only if it does not crowd the view. No gender assumption, no body measurements, no paywall, no combat advantage. Default avatar looks good even with zero interaction.

Store a guest appearance locally using a versioned key and a constrained schema. Malformed data falls back to a safe default. Never treat localStorage as a secure account. Player's chosen palette must not override team identification or alter physics.

**Multiplayer-visible cosmetics** are later server-protocol work; client-local preview is not a complete multiplayer feature.

### Screen 3 — Lobby and friend invite

One PLAY action can start the next suitable game; Play with Friends creates/joins a room. Short code and share link should be visible, copyable and return to the same room regardless of device. Explain if server is sleeping and show a retry. Do not pretend a solo bot match is public human matchmaking.

### Screen 4 — In match

A compact top HUD: clock, blue vs red score, short objective cue. Controls at thumb-safe bottom edges. Avoid four or more combat buttons. Background scenery should never cover players or projectiles.

### Screen 5 — Match result

Show winner/loser unambiguously, small personal contribution, "Play Again" primary, "Invite Friend" secondary. End state comes from server, not client timer guess.

## Controls

### Touch / mobile landscape

- Left circular movement zone, generous forgiving radius; independent pointer capture.
- Right thumb throw control: tap for immediate quick throw; drag to aim, release to throw once.
- Clear aim indicator, projected direction not guaranteed hit through cover.
- Controls cancel safely on pointercancel, lostpointercapture, orientation change, blur, disconnect and game end.
- Optional haptic feedback only when supported and permitted, never required.
- Avoid blocking swipe from browser/system gestures when possible; respect safe area and screen notch.

### Desktop

- WASD moves; pointer aims; left click/hold/release throws.
- Default scheme must be sensible without asking for keyboard mode choice.
- No mandatory G/E/Shift memorization for a first match.
- Escape pauses only if server semantics allow it; don't pause multiplayer simulation for one client.
- Provide accessible remapping and optional advanced options later.

### Accessibility

- Focus-visible and keyboard navigable menu controls; minimum comfortable touch areas.
- Team distinction via indicator/shape/outline plus color.
- Motion reduction: reduced camera shake, simplified screen effects and no essential information conveyed solely by animation.
- Audio mute and status cues with redundant visible feedback.
- Captions/labels for essential actions and status; text sized/readable on 390x844 portrait menus and 844x390 landscape play.

## Mechanics: baseline versus proposed

| System | Current baseline | Proposed ideal | Implementation note |
| --- | --- | --- | --- |
| Match | 90s center hill, bank score; sudden-death tie | Keep for contest; revisit simple knockout mode later | Changing scoring is backend protocol/rules work. |
| Movement | Accelerate/friction, 60 Hz server rules | Responsive, controllable with thumb or WASD | Measure before touching constants. |
| Throw | Start/charge/release with server-confirmed ball | Tap quick throw or drag precise shot | Preserve charge/release events until reviewed change. |
| Reload | Manual pack/gather | Auto replenishment | Requires server behavior and balance tests, not just hiding PACK. |
| Dash | Dedicated control | Not primary beginner control | Preserve behind advanced flag or remove via deliberate server change. |
| Classes | Glacier/Snowbug/Frostweaver/Classic | One equal-stat kid avatar at first | For baseline, can join with classId=classic; don't delete classes blindly. |
| Abilities | Class-specific server cooldown actions | Hide from default beginner UX | Server must not infer cosmetic choices as a class selection. |
| Knockout | Temporary freeze and rescue | Playful snow-covered state and fast recovery | Check existing 5-second thaw before changing rules. |
| Bot difficulty | Easy/Normal/Hard + aggression | Player should not configure this before playing | Tune defaults; preserve options for QA/advanced use. |
| Team size | 1v1, 1v5, 5v5, 10v10; 30v30 solo | 5v5 human-first; someday 15v15/30v30 humans | 30v30 humans needs substantial server/operations work. |

**Mandatory distinction:** hiding PACK is not equivalent to auto reloading. A contest UI must still provide a workable path to gather a new snowball if server rules remain unchanged. Two valid transitional designs are (a) keep a contextual simple reload action with clear explanation or (b) implement server-authoritative timed reload with tests. Never ship an unwinnable interface.

## Combat feel targets (to test, not asserted current values)

- A throw produces immediate local wind-up, audio/visual response, clear trajectory and authoritative impact confirmation.
- Movement supports purposeful dodging and clear braking, without unnaturally heavy friction.
- Aim assist, if used, must be bounded by distance/visibility, symmetric across input types and tested for unfair target snapping.
- Beginner opponents are less accurate through reaction delay and trajectory noise—not unnatural speed cheats.
- First meaningful throw within 15 seconds of returning guest play on warm infrastructure.
- A single snowball cannot register hits on multiple overlapped players unless the intended weapon expressly supports it.

Any tuning change needs exact before/after parameter values and two-device tests.

## Art production contract

### Character silhouette

Original child-like winter figure, seen in 3/4 top-down view with a back-facing readable hat/jacket. Proportions favor a large head, visible pom-pom or brim, simple mittens, chunky boots, expressive pose and readable throw arm.

### Required sprite poses

Idle front/side/back if needed; walk cycle (minimum 4–6 frames or skeletal equivalent); aim; throw windup; release/recoil; hit/freeze reaction; recovery; short victory celebration. Texture atlases should contain padding to avoid sprite bleeding; origin/pivot points documented. Kimi delivers transparent source and exports, metadata, license/creation note and file size totals.

### Color layering

Prefer separate base skin, jacket, hat overlays or recolorable indexed masks. Avoid baking every permutation into unique full-size files. Verify any tint APIs against Phaser 4 if that client is later used; don't assume Phaser 3 tint behavior is identical.

### Environment

One authored symmetric neighborhood arena with:
- Clear protected spawn edges and two meaningful flank lanes.
- Center snow fort/capture area, unobstructed signage or flag.
- Cover that corresponds to actual server collision objects.
- Streets, fences, house edges and tree silhouettes providing familiar neighborhood charm.
- Low contrast background snow and high contrast player/projectile separation.
- Wide enough paths for bots/humans not to funnel into a single chokepoint.

### Animation and VFX budgets

Pool snow particles, snow puffs and footprints; avoid unbounded arrays. Maintain independent tiers for lower-power devices. Disable expensive postprocessing if frame budget is exceeded. Screen shake must be brief, motion preference respected and not obscure scores.

## Modes roadmap

**First:** 90-second center objective (existing server-tested rules).  
**After playtests:** 5v5 neighborhood knockout brawl with short respawn and simple scoring.  
**Future signature mode:** larger player counts, human-first, honest bot backfill, larger authored arenas.  
**Optional practice:** tiny solo "throw three snowballs" course or existing mission mode behind a separate screen.

Do not surface more than one primary mode on first visit.

## Content/UX acceptance

1. First-time test player can explain the goal and throw without opening Help.
2. Guest can play without signing up, and a friend's invite opens the right room.
3. User may customize skin/jacket/hat in no more than three simple steps; default works if skipped.
4. On mobile, both thumbs can move and aim at once, release correctly, and recover after interrupted touches.
5. Server-side hit and score agree across two independent players.
6. A player's customization cannot make the silhouette disappear against snow or be confused for team color.
7. Celebrations and sound are playful but skippable and mutable.
8. All art is original or correctly licensed/attributed.

## Illustrative storyboard

0s: snowy neighborhood opens; snowball fight visible.  
2s: guest clicks Play, or edits skin/jacket/hat first.  
6s: joins room; camera frames bundled-up kid and opponents.  
8s: translucent MOVE and THROW cues.  
12s: snowball arcs across a driveway, snow puff on impact.  
45s: tense center control changes; score HUD readable.  
90s: results appear; "Play again" invites another round.

This storyboard is **a target**, not a measured existing player journey.
