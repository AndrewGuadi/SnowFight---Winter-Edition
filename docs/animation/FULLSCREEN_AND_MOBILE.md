# Fullscreen and mobile presentation

## Controls

The game HUD now groups Sound, FX, and Fullscreen controls in a bottom-centered, safe-area-aware container. The fullscreen button has visible enter/exit text and an `aria-pressed` state. Gameplay does not require fullscreen.

`assets/presentation.js` uses the standard browser APIs, with the existing WebKit method names as a compatibility fallback:

- `document.documentElement.requestFullscreen({ navigationUI: 'hide' })` where accepted;
- `document.exitFullscreen()` for the visible exit action;
- `fullscreenchange` events to synchronize label, accessibility state, and resize;
- `screen.orientation.lock('landscape')` only after fullscreen and only where exposed.

Fullscreen and orientation requests are initiated by a user click. Browser refusal is caught and reported by the control; there is no security bypass or repeated prompt loop.

## Expected browser behavior

| Environment | Behavior |
| --- | --- |
| Desktop browsers with Fullscreen API | Enter/exit control is available; resize follows the new viewport |
| Android browsers with Fullscreen API | Same standard path; landscape lock is attempted and may be refused |
| Browser without tab fullscreen | Control is disabled with an explanatory title; normal play remains available |
| iOS browser tab | No unsupported fullscreen behavior is forced; normal play remains available |
| Installed compatible web app | Manifest requests fullscreen with standalone fallback and landscape orientation |

Fullscreen support and orientation lock remain browser/user controlled. Headless Chromium enter/exit was tested; physical Android and iOS behavior was not.

## Manifest and installation metadata

`assets/manifest.webmanifest` provides:

- `display: "standalone"`;
- `display_override: ["fullscreen", "standalone"]`;
- `orientation: "landscape"`;
- root-relative-to-assets start URL and scope (`../`);
- theme/background colors and an original SVG icon.

`index.html` also includes theme color, iOS standalone metadata, manifest, and icon links.

This is install metadata, not offline support. No service worker, cache strategy, install prompt, or offline claim is included. Some platforms may require PNG icons or additional installation metadata; those should be added only with device-specific verification.

## Canvas sizing and safe areas

Only `#gameCanvas` is fixed to the full viewport. Creator and recruit preview canvases retain their own dimensions and aspect ratios.

The backing store uses CSS viewport dimensions multiplied by device pixel ratio:

- normal mode: DPR capped at 2;
- low-effects mode: DPR capped at 1.5;
- Canvas context transform is reset to the selected DPR after every resize;
- gameplay coordinates continue to use CSS pixels.

The existing viewport meta includes `viewport-fit=cover`; the presentation controls add `env(safe-area-inset-bottom)`. Resize, orientation change, and fullscreen change trigger resizing. Active controls reset on resize so a transition cannot leave movement, charge, dash, gather, throw, or ability input stuck.

## Camera and viewport

The selected Close/Wide/Far zoom is multiplied by a responsive factor:

`clamp(min(viewportWidth / 844, viewportHeight / 390), 0.85, 1.15)`.

Camera tracking uses dt-based exponential damping with an 85 ms time constant. The initial camera position snaps to its valid target to avoid a long opening drift. Camera bounds remain clamped to the arena.

Aim lead is:

- 28 world units normally;
- 12 units in low-effects mode;
- zero with reduced motion.

Vertical lead is 65% of horizontal lead. Local hit shake starts at 6 px, decays exponentially, and is disabled by reduced motion or low-effects mode.

## Aim correctness

Mouse aim uses `STATE.renderCamera`, which contains the same camera x/y, responsive zoom, and shake used for the current rendered frame. The player's rendered screen position is reconstructed before computing the pointer angle. This prevents smooth tracking, zoom, or impact shake from silently rotating the intended shot.

Touch aiming retains the established drag/release controls. Actual throw release, movement, collisions, and scoring still use the existing authoritative Socket.IO protocol.

## Verification and remaining device work

The Chromium browser suite verifies:

- real touch joystick movement and throw release;
- fullscreen entry and exit, including accessible label state;
- low-effects toggling;
- DPR-aware resize at 1024 x 600;
- mobile 844 x 390 gameplay and creator-preview aspect ratio;
- reduced-motion behavior;
- manifest retrieval and required display/orientation values;
- no JavaScript page errors.

Still required before a production mobile claim: physical iOS Safari and Android Chrome testing, home-screen installation checks, rotation during active touch, notched-device safe-area review, browser UI expansion/collapse, audio interruption, and human touch/motion-comfort evaluation.
