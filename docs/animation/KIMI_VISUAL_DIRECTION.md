# SnowFight visual direction

## Intent

SnowFight should read as an original childhood neighborhood snowball fight: colorful winter clothes, soft snow, exaggerated reactions, and clear friendly competition. The polish target is expressive timing and readable combat, not visual density or a new rendering engine.

The existing overhead Canvas 2D game remains the foundation. All character and effect art in this iteration is original procedural Canvas geometry. No characters, UI, animation files, sounds, or other proprietary assets were imported from another game.

## Visual pillars

### 1. A kid, not a token

The Classic fighter is built from reusable layers: boots, jacket, mittens, face, knitted hat, pom-pom, scarf, and an optional handheld snowball. Rounded forms, dark boot/jacket anchors, and small bright highlights make the silhouette readable at gameplay scale.

Skin, jacket, and hat choices remain cosmetic. Four skin tones, five jacket colors, and five hat colors share the same geometry and animation logic; no per-combination sprite sheets are generated. Jacket and hat shading is cached by color and shade amount.

### 2. Motion with a reason

- Idle breathing is deliberately small.
- Walking uses opposing boot steps and a restrained body bob.
- Running increases stride and bounce without changing movement speed.
- Aiming extends the throwing arm and turns the gaze toward the target.
- Quick and charged throws have different reach and duration.
- A hit briefly squashes and recoils the body before the snow-covered frozen pose.
- Recovery shakes off the hit; victory raises both arms and adds a short bounce.
- Scarf and pom-pom movement provide secondary motion, not extra gameplay information.

Animation state changes are visual only. Server-owned positions, collisions, freeze state, scores, and projectile physics remain authoritative.

### 3. Team readability is independent of cosmetics

A white-edged blue or red ground ring identifies team membership even when jacket and hat colors overlap. The local player's existing gold marker remains separate. The ring belongs to the ground plane, while the body, face, and held snowball provide the shallow 2.5D character volume.

### 4. Snowball feedback is specific

A player hit, scenery hit, blocked hit, and ground miss must not look interchangeable:

| Event | Visual signature |
| --- | --- |
| Player hit | White snow burst, expanding ring, hit pose, existing combat popup and sound |
| Scenery hit | Compact icy-blue burst |
| Blocked hit | Cyan shards and a ring, with the existing blocked feedback |
| Ground miss | Small white settling puff, with no hit ring |

Snowballs have a ground shadow, bright body, outline, and small highlight. Short team-tinted history trails improve visibility without painting a large opaque path across the arena.

### 5. The camera supports aim

Tracking is smooth but responsive, with a small aim-direction lead. Zoom responds to viewport size within bounded limits. Mouse aiming uses the exact rendered camera position and zoom, including shake, so presentation never silently changes the intended aim angle.

Reduced-motion mode removes camera lead and shake, projectile trails, footprints, idle/running bob, recovery shake, victory bounce, and pom-pom swing. Essential state and impact feedback remains visible.

## Restraint and performance

Effects use a fixed 240-item pool. Low-effects mode reduces burst density to approximately 45%, shortens trails, caps footprints at 80 instead of 180, disables shake, reduces camera lead, and caps device pixel ratio at 1.5 instead of 2. The preference is stored only in the current browser.

No 3D engine, animation runtime, texture pack, font download, or additional production dependency is introduced. Non-Classic recruit rendering and the existing neighborhood, UI, audio, networking, and gameplay systems are reused.

## Review evidence

The browser suite captures a nine-state storyboard, the customized creator preview, and live landscape gameplay. Baseline and candidate benchmark harnesses also capture matched 5v5, 10v10, and 30v30 scenes. These PNGs are reproducible test outputs rather than runtime assets; the branch includes the four final raw benchmark JSON files under `evidence/`.

The captured before/candidate images were inspected during implementation, including a fix for creator-preview stretching. They are illustrative visual evidence, not a claim of human usability approval. Visual judgments still require review on physical phones and tablets; headless screenshots do not establish touch comfort, motion comfort, or production-device quality.
