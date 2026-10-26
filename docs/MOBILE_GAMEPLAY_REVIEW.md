# Snowbrawl: mobile combat enhancement

Base: `50a23ca2fd914183866d48679f79a9af726d506d` (latest merged main at review time). Work branch: `enhancement/mobile-snowbrawl-polish`. The older, open fullstack rewrite PR #2 is deliberately not mixed into this implementation.

## Creative direction

A tactile, readable winter playground: move, pack, charge, release, dodge, repeat. Keep the current top-down characters, snowball arcs, freeze/thaw rules, bot difficulties, match sizes, three camera views and three-minute rounds. Quality should come from control and readable consequences before adding more menus or monetization.

This pass adds independently captured move/aim pointers, drag-to-aim throws, an aim line, charge/reload/freeze feedback, dash availability, team freeze scores, confirmed hit rewards, projectile trails, calmer icy art direction, sound controls, and viewport safe-area layout. Scout / Striker / Snow Ace are optional per-round personal objectives (3 / 6 / 10 freezes). Device-local round count, assignment medals and personal best provide a small replay loop. These are challenge objectives, not a campaign or a trusted online progression system.

## Synchronization and fairness

- Preserve 60Hz simulation and all existing per-tick physics constants. Do not slow the simulation to reduce traffic.
- Broadcast volatile authoritative snapshots every two simulation ticks (30Hz). Ended rooms publish at 2Hz rather than continuously sending the frozen scene at 60Hz.
- Client movement packets are paced at 30Hz, independent of display refresh rate; throw and dash edges bypass the cadence. Never buffer gameplay inputs during a disconnect.
- Render interpolation runs each animation frame with a time-based blend; short bounded velocity extrapolation bridges snapshot gaps (50ms players / 33ms projectiles). This is **not** full local prediction and reconciliation.
- Preserve server hit/score authority. Swept projectile collision chooses only the first target or cover impact; no tunneling or one snowball freezing multiple overlapping players.
- Validate finite numeric input, normalize move vectors, consume dash once, clear stale movement/charge after 500ms, and reject gameplay in finished matches.
- Frozen recovery is simulation-tick state, not a timeout that can mutate a finished match. Results use the final authoritative snapshot, including personal stats.
- Display measured round-trip time. A lower packet count is not a measured improvement in Internet latency. Deployment geography, cold starts, mobile radio quality, server load and jitter still matter.

## Run and review

```sh
cd backend
npm ci
npm test
npm start
```

Visit `http://localhost:3000`. The server serves the game at `/` and health metadata at `/health`. Localhost automatically connects to the same origin; production keeps the existing Render endpoint. Deploy the frontend and backend together; an old backend lacks stats, freeze countdown and the ping acknowledgement used here. No deployment or merge is included in this branch.

Before production: real iOS Safari and Android Chrome; portrait 390×844 and landscape 844×390; 60/120Hz screens; simultaneous move/aim/pack/dash; interrupted touches and backgrounding; reconnect during a match; match-end/rematch. Test two independent mobile devices at 80/150/250ms RTT with jitter and loss, plus 10v10 humans and 30v30 bots. Record p50/p95 frame time, room tick duration, bytes/sec and RTT. Target 60fps on the selected midrange device, p95 server simulation below 16.7ms and no stuck controls. These are acceptance targets, not measured results.

## Next quality milestones

1. **Combat playtest:** tune charge/range and camera zoom with users; compare the new aiming gesture against a fixed right-stick variant. Keep tap throws useful and charged throws visibly different.
2. **Prediction with reconciliation:** input sequence acknowledgements and shared deterministic movement, bounded pending-input replay, tested collision agreement. Add only after instrumentation; do not make client hits authoritative.
3. **Authored arenas:** a compact training snowyard, symmetric team park, and larger forest. Protected spawns, readable lanes, flank routes and fair cover spacing. Replace the current random obstacle layout only with dedicated balance testing.
4. **Actual missions:** deterministic solo challenges such as accuracy course, dodge survival, and escalating squads; explicit success/failure conditions and curated difficulty. Cosmetic rewards with no combat advantage.
5. **Performance:** profile 30v30 before introducing a spatial grid, entity deltas, interest management or pooled particles. Current effects are capped and offscreen characters culled; collision scans are still linear per projectile.
6. **Presentation:** depth-sorted environment and characters, authored animation poses, layered snow audio, proper first-time tutorial, accessibility/control remapping. Keep gameplay silhouettes readable over decoration.

No battle pass, payments, account system or new hosting service is introduced.

### Static assets

The Tailwind runtime CDN has been replaced with compiled `assets/ui.css` and the Socket.IO client is vendored with its MIT license. This removes third-party CDN requests on the initial game page. To rebuild utility CSS after changing class names:

```sh
npx tailwindcss@3.4.17 -i assets/input.css -o assets/ui.css --content index.html --minify
```

`assets/socket.io.min.js` is copied from the locked backend Socket.IO package's `client-dist/` directory; refresh it together with the server dependency. Its source-map comment is upstream metadata; a map is not required to play.

### Automated browser smoke test

With Playwright installed in the backend development environment (`npm install --no-save --package-lock=false playwright` and `npx playwright install chromium`), run `node tests/browser-smoke.cjs` from `backend/`. It starts an isolated short-match server on port 3460, drives two simultaneous touch points, tests release/pack/cancel and final results/rematch, and captures portrait/landscape screenshots in the OS temporary directory. `CHROMIUM_EXECUTABLE` can select an existing Chromium binary. This test is separate from `npm test` so the server suite does not require a browser installation.

Review evidence: the final server suite passed all 28 cases (23 existing and five new pure/integration regressions). Chromium mobile emulation verified two-thumb movement/aim, release-to-throw, gathering, canceled charges, deduplicated device progression and rematch with no JavaScript errors. Portrait and landscape screenshots were inspected. Hardware mobile performance and wide-area multiplayer latency are not measured by these checks.
