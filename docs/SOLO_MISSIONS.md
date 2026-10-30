# Solo missions and bot aggression

The single-player front door offers three winnable missions. Mission presets set the roster and difficulty on the server; the client cannot override them with menu values.

| Mission | Roster | Difficulty / aggression | Win condition |
| --- | --- | --- | --- |
| Light the beacon | 1v1 | Easy / Relaxed | Bank 5 hill points before the 90-second buzzer |
| Win the snow fight | 1v1 | Easy / Balanced | Land 3 freezes before the buzzer |
| Take the neighborhood | 5v5 | Normal / Balanced | Win the round; a draw is a retry |

Target missions end as soon as their target is reached. Mission rounds always end at the buzzer rather than entering ordinary sudden-death overtime. The squad mission uses the normal hill-first, freeze-tiebreak result rule, except a draw counts as a loss so the player can retry.

**Free play** exposes the ordinary roster and difficulty controls plus a bot-aggression selector:

- **Relaxed:** half-speed pursuit, long firing breaks, no class abilities.
- **Balanced:** normal pursuit and a short firing break.
- **Relentless:** normal pursuit with no extra firing break.

Difficulty still controls aim, charge time, throw range, dash frequency, and speed. Aggression independently controls pursuit, firing recovery, and whether bots use class abilities. Multiplayer never creates bots and ignores these settings.

Mission wins are remembered on the current device. Campaign progress is also device-local; authoritative mission objectives and match outcomes come from the server.
