// Game-modes tests for the Snowbrawl server (backend/server.js).
//
// Covers the join protocol the client depends on:
//   client -> server: 'join' { mode: 'single' | 'multi', blue, red }
//   server -> client: 'init' { id, team, match: { mode, blueCap, redCap }, ... }
//                     or 'joinError' { message }
//   server -> client: 'state' { players, snowballs } at 60 TPS, match-room only.
//
// Run: npm test   (from backend/)
// Requires socket.io-client (devDependency). The server under test is
// spawned as a child process on a test port, so these tests never touch
// the live Render deployment.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_FILE = path.join(HERE, '..', 'server.js');
const PORT = 3457;
const URL = `http://127.0.0.1:${PORT}`;

let serverProc;

// --- helpers ---------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitForServerReady(proc) {
    return new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('server did not start')), 10000);
        proc.stdout.on('data', (d) => {
            if (String(d).includes('running on port')) {
                clearTimeout(to);
                resolve();
            }
        });
        proc.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
        proc.on('exit', (code) => {
            clearTimeout(to);
            reject(new Error(`server exited early with code ${code}`));
        });
    });
}

async function connectClient() {
    return new Promise((resolve, reject) => {
        const socket = io(URL, { transports: ['websocket'], reconnection: false });
        const to = setTimeout(() => reject(new Error('connect timeout')), 5000);
        socket.on('connect', () => {
            clearTimeout(to);
            resolve(socket);
        });
        socket.on('connect_error', (e) => {
            clearTimeout(to);
            reject(e);
        });
    });
}

// Join and resolve with { kind: 'init' | 'joinError', data }.
async function join(socket, mode, blue, red) {
    return new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('join timed out')), 5000);
        const done = (kind) => (data) => {
            clearTimeout(to);
            socket.off('init', onInit);
            socket.off('joinError', onErr);
            resolve({ kind, data });
        };
        const onInit = done('init');
        const onErr = done('joinError');
        socket.on('init', onInit);
        socket.on('joinError', onErr);
        socket.emit('join', { mode, blue, red });
    });
}

// Track the latest state snapshot on a socket.
function trackState(socket) {
    const box = { latest: null };
    socket.on('state', (s) => {
        box.latest = s;
    });
    return box;
}

// Wait until predicate(box.latest) is true, or throw on timeout.
async function waitForState(box, predicate, label, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (box.latest && predicate(box.latest)) return box.latest;
        await sleep(50);
    }
    throw new Error(`timed out waiting for state: ${label}`);
}

function playersOf(state) {
    return Object.values(state.players || {});
}
function botsOf(state) {
    return playersOf(state).filter((p) => p.isBot);
}

// --- lifecycle -------------------------------------------------------------

before(async () => {
    serverProc = spawn('node', [SERVER_FILE], {
        env: { ...process.env, PORT: String(PORT) },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForServerReady(serverProc);
});

after(() => {
    if (serverProc && !serverProc.killed) serverProc.kill();
});

// --- tests -----------------------------------------------------------------

describe('single player (vs AI bots)', () => {
    test('1v1: human on blue, exactly 1 bot opponent', async (t) => {
        const s = await connectClient();
        t.after(() => s.disconnect());
        const res = await join(s, 'single', 1, 1);
        assert.equal(res.kind, 'init');
        assert.equal(res.data.match.mode, 'single');
        assert.equal(res.data.match.blueCap, 1);
        assert.equal(res.data.match.redCap, 1);
        assert.equal(res.data.team, 'blue');

        const box = trackState(s);
        const state = await waitForState(box, (st) => playersOf(st).length === 2, '2 players');
        assert.equal(botsOf(state).length, 1);
        assert.ok(state.players[s.id], 'human is in the match');
    });

    test('1v5: 6 players total, 5 bots', async (t) => {
        const s = await connectClient();
        t.after(() => s.disconnect());
        const res = await join(s, 'single', 1, 5);
        assert.equal(res.kind, 'init');
        const box = trackState(s);
        const state = await waitForState(box, (st) => playersOf(st).length === 6, '6 players');
        assert.equal(botsOf(state).length, 5);
    });

    test('5v5: 10 players total, 9 bots', async (t) => {
        const s = await connectClient();
        t.after(() => s.disconnect());
        const res = await join(s, 'single', 5, 5);
        assert.equal(res.kind, 'init');
        const box = trackState(s);
        const state = await waitForState(box, (st) => playersOf(st).length === 10, '10 players');
        assert.equal(botsOf(state).length, 9);
    });

    test('10v10: 20 players total, 19 bots', async (t) => {
        const s = await connectClient();
        t.after(() => s.disconnect());
        const res = await join(s, 'single', 10, 10);
        assert.equal(res.kind, 'init');
        const box = trackState(s);
        const state = await waitForState(box, (st) => playersOf(st).length === 20, '20 players');
        assert.equal(botsOf(state).length, 19);
    });

    test('30v30 (single-only): 60 players total, 59 bots', async (t) => {
        const s = await connectClient();
        t.after(() => s.disconnect());
        const res = await join(s, 'single', 30, 30);
        assert.equal(res.kind, 'init');
        assert.equal(res.data.match.blueCap, 30);
        assert.equal(res.data.match.redCap, 30);
        const box = trackState(s);
        const state = await waitForState(box, (st) => playersOf(st).length === 60, '60 players');
        assert.equal(botsOf(state).length, 59);
    });

    test('bots move toward the human', async (t) => {
        const s = await connectClient();
        t.after(() => s.disconnect());
        await join(s, 'single', 1, 1);
        const box = trackState(s);
        const first = await waitForState(box, (st) => playersOf(st).length === 2, '2 players');
        const bot = botsOf(first)[0];
        const start = { x: bot.x, y: bot.y };
        await sleep(3000);
        const later = box.latest;
        const botNow = later.players[bot.id];
        const moved = Math.hypot(botNow.x - start.x, botNow.y - start.y);
        assert.ok(moved > 100, `bot moved only ${moved.toFixed(0)}px in 3s`);
    });

    test('a bot throws a snowball', async (t) => {
        const s = await connectClient();
        t.after(() => s.disconnect());
        await join(s, 'single', 1, 1);
        const box = trackState(s);
        const first = await waitForState(box, (st) => playersOf(st).length === 2, '2 players');
        const botId = botsOf(first)[0].id;
        // Run east toward the bot so it gets in range quickly.
        const drive = setInterval(() => {
            s.emit('input', { moveX: 1, moveY: 0, angle: 0, dash: false, gather: false });
        }, 50);
        t.after(() => clearInterval(drive));
        const state = await waitForState(
            box,
            (st) => (st.snowballs || []).some((b) => b.ownerId === botId),
            'bot snowball',
            20000,
        );
        assert.ok((state.snowballs || []).some((b) => b.ownerId === botId));
    });
});

describe('multiplayer (vs live humans)', () => {
    test('two players joining 5v5 land in the same match, blue then red, no bots', async (t) => {
        const a = await connectClient();
        const b = await connectClient();
        t.after(() => {
            a.disconnect();
            b.disconnect();
        });
        const ra = await join(a, 'multi', 5, 5);
        assert.equal(ra.kind, 'init');
        assert.equal(ra.data.team, 'blue');
        const rb = await join(b, 'multi', 5, 5);
        assert.equal(rb.kind, 'init');
        assert.equal(rb.data.team, 'red');

        const boxA = trackState(a);
        const boxB = trackState(b);
        await waitForState(boxA, (st) => playersOf(st).length === 2, 'A sees 2 players');
        const stateB = await waitForState(boxB, (st) => playersOf(st).length === 2, 'B sees 2 players');
        assert.equal(botsOf(stateB).length, 0);
        assert.ok(stateB.players[a.id] && stateB.players[b.id], 'both players in one match');
    });

    test('1v1 and 10v10 multiplayer accept humans with no bots', async (t) => {
        const s1 = await connectClient();
        const s2 = await connectClient();
        t.after(() => {
            s1.disconnect();
            s2.disconnect();
        });
        await join(s1, 'multi', 1, 1);
        const box1 = trackState(s1);
        const st1 = await waitForState(box1, (st) => playersOf(st).length === 1, '1v1 solo');
        assert.equal(botsOf(st1).length, 0);

        await join(s2, 'multi', 10, 10);
        const box2 = trackState(s2);
        const st2 = await waitForState(box2, (st) => playersOf(st).length === 1, '10v10 solo');
        assert.equal(botsOf(st2).length, 0);
    });
});

describe('validation and match hygiene', () => {
    test('multi 30v30 is rejected (single-only size)', async (t) => {
        const s = await connectClient();
        t.after(() => s.disconnect());
        const res = await join(s, 'multi', 30, 30);
        assert.equal(res.kind, 'joinError');
    });

    test('invalid joins are rejected: bad mode, 5v1, 0v0, non-integer', async (t) => {
        const cases = [
            ['bogus', 5, 5],
            ['multi', 5, 1],
            ['single', 0, 0],
            ['single', 'abc', 5],
        ];
        for (const [mode, blue, red] of cases) {
            const s = await connectClient();
            t.after(() => s.disconnect());
            const res = await join(s, mode, blue, red);
            assert.equal(res.kind, 'joinError', `expected joinError for ${mode} ${blue}v${red}`);
        }
    });

    test('no init is sent before join (join protocol is required)', async (t) => {
        const s = await connectClient();
        t.after(() => s.disconnect());
        let gotInit = false;
        s.on('init', () => {
            gotInit = true;
        });
        await sleep(1000);
        assert.equal(gotInit, false);
    });

    test('two single 1v1 matches are isolated (no shared player ids)', async (t) => {
        const a = await connectClient();
        const b = await connectClient();
        t.after(() => {
            a.disconnect();
            b.disconnect();
        });
        await join(a, 'single', 1, 1);
        await join(b, 'single', 1, 1);
        const boxA = trackState(a);
        const boxB = trackState(b);
        const stA = await waitForState(boxA, (st) => playersOf(st).length === 2, 'A 2 players');
        const stB = await waitForState(boxB, (st) => playersOf(st).length === 2, 'B 2 players');
        const idsA = new Set(Object.keys(stA.players));
        const idsB = new Set(Object.keys(stB.players));
        const shared = [...idsA].filter((id) => idsB.has(id));
        assert.equal(shared.length, 0, `matches leaked players: ${shared}`);
    });

    test('an emptied match is deleted: next joiner gets fresh obstacles', async (t) => {
        const a = await connectClient();
        t.after(() => a.disconnect());
        const ra = await join(a, 'multi', 5, 5);
        assert.equal(ra.kind, 'init');
        const obstaclesA = JSON.stringify(ra.data.obstacles);
        a.disconnect();
        await sleep(300);
        const b = await connectClient();
        t.after(() => b.disconnect());
        const rb = await join(b, 'multi', 5, 5);
        assert.equal(rb.kind, 'init');
        assert.notEqual(JSON.stringify(rb.data.obstacles), obstaclesA, 'joiner reused a dead match');
        const boxB = trackState(b);
        const stB = await waitForState(boxB, (st) => playersOf(st).length === 1, 'fresh match, solo');
        assert.equal(botsOf(stB).length, 0);
    });

    test('re-joining moves the client to a fresh match', async (t) => {
        const s = await connectClient();
        t.after(() => s.disconnect());
        const r1 = await join(s, 'single', 1, 1);
        assert.equal(r1.kind, 'init');
        const r2 = await join(s, 'single', 1, 1);
        assert.equal(r2.kind, 'init');
        assert.notEqual(
            JSON.stringify(r2.data.obstacles),
            JSON.stringify(r1.data.obstacles),
            're-join stayed in the old match',
        );
        const box = trackState(s);
        const st = await waitForState(box, (stt) => playersOf(stt).length === 2, '2 players after re-join');
        assert.equal(botsOf(st).length, 1);
    });
});
