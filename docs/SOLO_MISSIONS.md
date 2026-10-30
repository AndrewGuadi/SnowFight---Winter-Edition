# Single-player missions and bot aggression

Built from main f5c3538 (campaign-lite). The existing device-local campaign checklist remains available in free play. Selected missions now have server-controlled setups, objectives, progress, terminal win/loss outcomes, retry and next-mission navigation. The mission HUD replaces the optional freeze assignment so players see one active objective.

| Mission | Setup | Win | Opponent |
| --- | --- | --- | --- |
| Light the beacon | 1v1 | Bank 5 hill points before the buzzer | Easy / Relaxed |
| Win the snow fight | 1v1 | Inflict 3 freezes before the buzzer | Easy / Balanced |
| Take the neighborhood | 5v5 | Win the round by hill points, then freezes | Normal / Balanced |

Targets end the first two missions immediately on success. Incomplete objectives lose at the buzzer even if the player leads on an unrelated metric. A tied squad round is a failed mission to retry; mission rounds do not enter overtime. Standard free play and multiplayer retain ordinary hill scoring and overtime. Match duration remains 90 seconds (the existing environment override is honored for tests).

Quick play defaults to mission 1. The mission selector offers Free play, which enables existing size/difficulty settings and the new aggression selector. Mission settings are locked and synchronized to their presets. Mission presets are validated and enforced on the server; joining a mission cannot supply easier goals or a different team size. Multiplayer ignores solo mission/aggression settings.

## Easier and more distinct bots

Easy now uses a longer 50-tick charge, 370px engagement range, 0.72 speed multiplier and broader aim noise. Normal is gentler too: 40-tick charge, 470px range, 0.9 speed multiplier and broader aim noise. Hard retains its earlier tuning. These difficulty multipliers stack with class movement tuning.

Aggression is separate:

- Relaxed (`chill`): half pursuit input, no chase dash, no class special abilities, 90-tick firing recovery after the packing interval.
- Balanced: full pursuit, existing difficulty dash chance and abilities, 30-tick recovery after packing.
- Relentless: full pursuit, existing difficulty dash chance and abilities, no extra recovery after packing.

Pauses are applied after including the class's gather duration so reloading does not silently erase the intended recovery difference. Bot attack tests confirm the order of sustained attack rates. Existing hill-contest behavior is retained; no claim of smarter pathfinding is made.

Mission wins are saved only on this device and are cosmetic progress, not a trusted account system. Existing campaign achievements now update only in single player. Multiplayer rules and the 60Hz simulation/30Hz state cadence are unchanged.

## Verification

`npm test --prefix backend` covers existing behavior plus deterministic mission success, timeout failure, draw handling and bot recovery tests. Browser scripts use the Playwright setup from MOBILE_GAMEPLAY_REVIEW.md. `node backend/tests/mission-browser.cjs` runs an isolated short-clock server on 3478 and checks briefing, authoritative presets, live HUD, timeout failure, retry and squad roster. The recruit browser script now explicitly selects WASD before checking the E shortcut, matching the new control-scheme feature on main.

Deploy client and server together after review. Device-local progress is not uploaded. Physical mobile playtesting and class balance feedback remain useful; no production latency or win-rate measurement is claimed. No merge/deployment is performed by this branch.
