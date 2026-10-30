const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const assert = require('node:assert/strict');

(async () => {
    const server = spawn('node', ['backend/server.js'], {
        cwd: path.join(__dirname, '../..'),
        env: { ...process.env, PORT: '3468' }, stdio: 'pipe'
    });
    await new Promise((resolve, reject) => {
        server.stdout.on('data', data => { if (String(data).includes('running')) resolve(); });
        server.on('exit', reject);
    });
    // Chromium's connection throttle does not consistently affect an
    // established WebSocket. A TCP proxy gives this test deterministic
    // server-to-client latency without changing production server code.
    let downstreamDelay = 0;
    const proxy = net.createServer(client => {
        const upstream = net.connect(3468, '127.0.0.1');
        client.on('data', chunk => upstream.write(chunk));
        upstream.on('data', chunk => {
            if (downstreamDelay) setTimeout(() => client.write(chunk), downstreamDelay);
            else client.write(chunk);
        });
        client.on('close', () => upstream.destroy());
        upstream.on('close', () => client.destroy());
        client.on('error', () => upstream.destroy());
        upstream.on('error', () => client.destroy());
    });
    await new Promise(resolve => proxy.listen(3469, '127.0.0.1', resolve));
    const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
        args: ['--no-sandbox']
    });
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        const a = await context.newPage(), b = await context.newPage();
        const errors = [];
        for (const page of [a, b]) {
            page.on('pageerror', error => errors.push(error.message));
            await page.goto('http://127.0.0.1:3469');
            await page.locator('#btn-play-quick:not([disabled])').waitFor();
            await page.evaluate(() => {
                selectMode('multi');
                selectRoom('PREDICT');
                joinGame();
                window.__authoritative = null;
                socket.on('state', state => {
                    if (STATE.id && state.players[STATE.id]) window.__authoritative = state.players[STATE.id];
                });
            });
            await page.locator('#start-screen').waitFor({ state: 'hidden' });
        }
        await a.waitForFunction(() => Object.keys(STATE.players).length === 2);
        await b.waitForFunction(() => Object.keys(STATE.players).length === 2);
        await a.bringToFront();
        assert.equal(await a.evaluate(() => socket.io.engine.transport.name), 'websocket');
        assert.equal(await a.evaluate(() => window.__authoritative.lastInputAt), undefined);
        assert.ok(await a.evaluate(() => Number.isSafeInteger(window.__authoritative.ack)));

        // With server responses delayed, the local player must still move now.
        downstreamDelay = 1000;
        const before = await a.evaluate(() => ({
            x: STATE.players[STATE.id].x,
            serverX: window.__authoritative.x
        }));
        await a.keyboard.down('ArrowRight');
        await a.waitForTimeout(150);
        const during = await a.evaluate(() => ({
            x: STATE.players[STATE.id].x,
            serverX: window.__authoritative.x
        }));
        assert.ok(during.x > before.x + 5, `predicted x moved only ${during.x - before.x}`);
        // Older delayed snapshots may still acknowledge idle packets. The
        // important boundary is that the server has not moved us yet.
        assert.equal(during.serverX, before.serverX);
        downstreamDelay = 0;
        await a.keyboard.up('ArrowRight');
        // A live 60 Hz predictor normally has a few pending ticks between
        // 30 Hz acknowledgements; require the delayed backlog to drain and
        // stay bounded rather than expecting an instantaneous empty array.
        await a.waitForFunction(() => {
            const p = STATE.players[STATE.id], s = window.__authoritative;
            return STATE.inputHistory.length <= 10 && s.ack >= STATE.inputSeq - 5 &&
                Math.hypot(p.vx, p.vy) < 0.05 && Math.hypot(s.vx, s.vy) < 0.05;
        }, {}, { timeout: 8000 });
        const reconciled = await a.evaluate(() => ({
            x: STATE.players[STATE.id].x,
            y: STATE.players[STATE.id].y,
            serverX: window.__authoritative.x,
            serverY: window.__authoritative.y
        }));
        assert.ok(Math.hypot(reconciled.x - reconciled.serverX, reconciled.y - reconciled.serverY) < 1,
            `reconciliation error ${JSON.stringify(reconciled)}`);
        await a.screenshot({ path: path.join(os.tmpdir(), 'snowfight-prediction-multiplayer.png') });
        assert.deepEqual(errors, []);
        console.log('PASS: two-player WebSocket match, lean acknowledged snapshots, delayed-network local prediction, clean reconciliation, no JS errors');
    } finally {
        await browser.close();
        await new Promise(resolve => proxy.close(resolve));
        server.kill();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
