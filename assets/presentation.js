/* Fullscreen, installability and motion-safe presentation controls. */
(function () {
    'use strict';
    function boot() {
        const fullscreen = document.getElementById('fullscreen-toggle');
        const effects = document.getElementById('effects-toggle');
        const root = document.documentElement;
        const fullscreenSupported = !!(root.requestFullscreen || root.webkitRequestFullscreen);
        const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
        const updateFullscreen = () => {
            if (!fullscreen) return;
            const active = !!fullscreenElement();
            fullscreen.textContent = active ? 'EXIT FULLSCREEN' : 'ENTER FULLSCREEN';
            fullscreen.setAttribute('aria-pressed', String(active));
            fullscreen.title = active ? 'Return to the browser window' : 'Use the whole screen';
            window.dispatchEvent(new Event('resize'));
        };
        if (fullscreen) {
            if (!fullscreenSupported) {
                fullscreen.textContent = 'FULLSCREEN UNAVAILABLE';
                fullscreen.disabled = true;
                fullscreen.title = 'This browser does not expose tab fullscreen. Play still works; on iOS, Add to Home Screen for standalone mode.';
            } else {
                fullscreen.addEventListener('click', async () => {
                    try {
                        if (fullscreenElement()) {
                            await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
                        } else {
                            await (root.requestFullscreen || root.webkitRequestFullscreen).call(root, { navigationUI: 'hide' });
                            // Orientation lock is permitted only in some fullscreen contexts.
                            if (screen.orientation && screen.orientation.lock) {
                                try { await screen.orientation.lock('landscape'); } catch (_) { /* Browser choice; no bypass. */ }
                            }
                        }
                    } catch (_) {
                        fullscreen.textContent = 'FULLSCREEN BLOCKED';
                        fullscreen.title = 'The browser declined fullscreen. The game remains playable in this tab.';
                    }
                    updateFullscreen();
                });
            }
            document.addEventListener('fullscreenchange', updateFullscreen);
            document.addEventListener('webkitfullscreenchange', updateFullscreen);
            updateFullscreen();
        }
        if (effects) {
            let low = false;
            try { low = localStorage.getItem('snowfight-effects-v1') === 'low'; } catch (_) {}
            const apply = () => {
                if (window.STATE) STATE.lowEffects = low;
                if (window.SNOW_EFFECTS) SNOW_EFFECTS.lowQuality = low;
                effects.textContent = low ? 'FX LOW' : 'FX HIGH';
                effects.setAttribute('aria-pressed', String(low));
                effects.title = low ? 'Reduced particles and trails' : 'Full snow effects';
                window.dispatchEvent(new Event('resize'));
            };
            effects.addEventListener('click', () => {
                low = !low;
                try { localStorage.setItem('snowfight-effects-v1', low ? 'low' : 'high'); } catch (_) {}
                apply();
            });
            apply();
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
})();
