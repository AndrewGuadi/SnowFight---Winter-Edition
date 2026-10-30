// Game-modes tests for the Snowbrawl server (backend/server.js).
//
// Covers the join protocol the client depends on:
//   client -> server: 'join' { mode: 'single' | 'multi', blue, red,
//                              difficulty?: 'easy' | 'normal' | 'hard' }
//   server -> client: 'init' { id, team, match: { mode, blueCap, redCap,
//                              difficulty }, ... }
//                     or 'joinError' { message }
//   server -> client: 'state' { players, snowballs,
//                              match: { timeLeft, score, overtime,
//                                       ended, winner } }
//                     at 60 TPS, match-room only.
//   server -> client: 'matchEnd' { winner, score, hill } when the
//                     90-second match timer expires (winner = most hill
//                     points banked, then most freezes inflicted).
//                     A full tie at the buzzer starts sudden-death
//                     overtime (overtime: true) instead: the next freeze
//                     wins at once; if the overtime cap expires it ends
//                     in a draw.
//   Multiplayer rooms: 'join' may carry an optional 'room' code
//                     (multi only; normalized server-side to 1-8 uppercase
//                     alphanumerics). Same code = same match; open joins
//                     never enter a private room; a full room rejects
//                     with 'joinError'. 'init' echoes roomCode (null for
//                     open matches) and 'state' carries match.hill.
//   Center hill: the team with strictly more alive, unfrozen players
//                     inside the center circle banks 1 hill point per
//                     second of holding; match.hillHolder names the
//                     holder (null when tied or empty).
// Difficulty applies to single-player bots only (multiplayer has no bots);
// invalid or missing values default to 'normal'. The match length is
// MATCH_DURATION_TICKS (default 5400 = 90 seconds at 60 TPS).
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

async function connectClient(url = URL) {
    return new Promise((resolve, reject) => {
        const socket = io(url, { transports: ['websocket'], reconnection: false });
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

// Join with extra fields (e.g. a private-room code for multiplayer).
async function joinExtra(socket, fields) {
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
        socket.emit('join', fields);
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

// Join with an arbitrary payload (for difficulty tests; join() above
// sends only mode/blue/red).
async function joinWith(socket, payload) {
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
        socket.emit('join', payload);
    });
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

describe('bot difficulty, snowball lob, and hit bonus', () => {
    test('difficulty echoes in init; invalid/missing values default to normal', async (t) => {
        const cases = [
            [{ mode: 'single', blue: 1, red: 1, difficulty: 'hard' }, 'hard'],
            [{ mode: 'single', blue: 1, red: 1, difficulty: 'easy' }, 'easy'],
            [{ mode: 'single', blue: 1, red: 1, difficulty: 'bogus' }, 'normal'],
            [{ mode: 'single', blue: 1, red: 1 }, 'normal'],
            [{ mode: 'multi', blue: 1, red: 1, difficulty: 'hard' }, 'normal'],
        ];
        for (const [payload, expected] of cases) {
            const s = await connectClient();
            t.after(() => s.disconnect());
            const res = await joinWith(s, payload);
            assert.equal(res.kind, 'init');
            assert.equal(res.data.match.difficulty, expected, `difficulty for ${JSON.stringify(payload)}`);
        }
    });

    test('easy and hard bots still throw', async (t) => {
        for (const difficulty of ['easy', 'hard']) {
            const s = await connectClient();
            t.after(() => s.disconnect());
            await joinWith(s, { mode: 'single', blue: 1, red: 1, difficulty });
            const box = trackState(s);
            const first = await waitForState(box, (st) => playersOf(st).length === 2, '2 players');
            const botId = botsOf(first)[0].id;
            // Run east toward the bot so it gets in range quickly.
            const drive = setInterval(() => {
                s.emit('input', { moveX: 1, moveY: 0, angle: 0, dash: false, gather: false });
            }, 50);
            const state = await waitForState(
                box,
                (st) => (st.snowballs || []).some((b) => b.ownerId === botId),
                `${difficulty} bot snowball`,
                25000,
            );
            clearInterval(drive);
            assert.ok((state.snowballs || []).some((b) => b.ownerId === botId));
        }
    });

    test('snowball lob peaks above the old ~28px and lands within ~0.9s', async (t) => {
        const s = await connectClient();
        t.after(() => s.disconnect());
        await join(s, 'single', 1, 1);
        const box = trackState(s);
        await waitForState(box, (st) => playersOf(st).length === 2, '2 players');
        let maxZ = 0;
        const onState = (st) => {
            for (const b of st.snowballs || []) {
                if (b.z > maxZ) maxZ = b.z;
            }
        };
        s.on('state', onState);
        t.after(() => s.off('state', onState));
        // Throw immediately: the human spawns holding a ball. The bot is
        // ~2600px away and cannot throw within this test's window.
        s.emit('input', { moveX: 0, moveY: 0, angle: 0, dash: false, gather: false, throwStart: true, throwRelease: false });
        await sleep(50);
        s.emit('input', { moveX: 0, moveY: 0, angle: 0, dash: false, gather: false, throwStart: false, throwRelease: true });
        await waitForState(box, () => maxZ > 30, 'lob above 30px', 3000);
        assert.ok(maxZ > 30, `lob peak ${maxZ} should exceed the old ~28px peak`);
        await sleep(900);
        assert.equal((box.latest.snowballs || []).length, 0, 'ball should have landed');
    });

    test('single-player: human graze throw at ~25px hits the bot (hit bonus)', async (t) => {
        const s = await connectClient();
        t.after(() => s.disconnect());
        await join(s, 'single', 1, 1);
        const box = trackState(s);
        const first = await waitForState(box, (st) => playersOf(st).length === 2, '2 players');
        const botId = botsOf(first)[0].id;
        // The human stands still; the bot closes in on its own. A 25px
        // graze hits only with the +6px single-player bonus (human throw
        // threshold ~26px) and misses at the original ~20px radius.
        const deadline = Date.now() + 45000;
        let threw = false;
        while (Date.now() < deadline) {
            const st = box.latest;
            const me = st && st.players[s.id];
            const bot = st && st.players[botId];
            if (!me || !bot) { await sleep(100); continue; }
            // Re-gather after a previous attempt's throw.
            if (!me.hasBall) {
                const g = setInterval(() => {
                    s.emit('input', { moveX: 0, moveY: 0, angle: 0, dash: false, gather: true });
                }, 50);
                await sleep(1100);
                clearInterval(g);
                continue;
            }
            // Frozen: wait out the 5s thaw, then retry.
            if (me.isFrozen) { await sleep(1000); continue; }
            const D = Math.hypot(bot.x - me.x, bot.y - me.y);
            // Attempt only with a stationary, charging bot at grazeable range.
            if (!(bot.hasBall && bot.chargeLevel > 0 && D >= 60 && D <= 250)) {
                await sleep(100);
                continue;
            }
            const base = Math.atan2(bot.y - me.y, bot.x - me.x);
            const aim = base + Math.asin(25 / D);
            s.emit('input', { moveX: 0, moveY: 0, angle: aim, dash: false, gather: false, throwStart: true, throwRelease: false });
            await sleep(50);
            s.emit('input', { moveX: 0, moveY: 0, angle: aim, dash: false, gather: false, throwStart: false, throwRelease: true });
            threw = true;
            const hitDeadline = Date.now() + 2000;
            let hit = false;
            while (Date.now() < hitDeadline) {
                const cur = box.latest;
                if (cur && cur.players[botId] && cur.players[botId].isFrozen) { hit = true; break; }
                await sleep(50);
            }
            if (hit) return; // bonus confirmed
            await sleep(200);
        }
        assert.ok(threw, 'never got a clean graze attempt in 45s');
        assert.fail('bot never froze from a 25px graze throw (expected hit with +6px bonus)');
    });

    test('multiplayer: same 25px graze throw misses (no bonus)', async (t) => {
        const a = await connectClient();
        const b = await connectClient();
        t.after(() => {
            a.disconnect();
            b.disconnect();
        });
        await join(a, 'multi', 1, 1);
        await join(b, 'multi', 1, 1);
        const boxA = trackState(a);
        const boxB = trackState(b);
        await waitForState(boxA, (st) => playersOf(st).length === 2, '2 players');
        // B stands still; drive A into graze range, then throw.
        const deadline = Date.now() + 20000;
        let threw = false;
        while (Date.now() < deadline) {
            const st = boxA.latest;
            const me = st && st.players[a.id];
            const target = st && st.players[b.id];
            if (!me || !target) { await sleep(100); continue; }
            const D = Math.hypot(target.x - me.x, target.y - me.y);
            if (D > 250 || D < 60) {
                const dir = D > 250 ? 1 : -1;
                const move = setInterval(() => {
                    const cur = boxA.latest;
                    const m = cur && cur.players[a.id];
                    const tg = cur && cur.players[b.id];
                    if (!m || !tg) return;
                    const d = Math.hypot(tg.x - m.x, tg.y - m.y) || 1;
                    a.emit('input', { moveX: dir * (tg.x - m.x) / d, moveY: dir * (tg.y - m.y) / d, angle: 0, dash: false, gather: false });
                }, 50);
                await sleep(500);
                clearInterval(move);
                continue;
            }
            const base = Math.atan2(target.y - me.y, target.x - me.x);
            const aim = base + Math.asin(25 / D);
            a.emit('input', { moveX: 0, moveY: 0, angle: aim, dash: false, gather: false, throwStart: true, throwRelease: false });
            await sleep(50);
            a.emit('input', { moveX: 0, moveY: 0, angle: aim, dash: false, gather: false, throwStart: false, throwRelease: true });
            threw = true;
            const seenDeadline = Date.now() + 2000;
            let sawBall = false;
            while (Date.now() < seenDeadline) {
                const cur = boxA.latest;
                if (cur && (cur.snowballs || []).some((bb) => bb.ownerId === a.id)) { sawBall = true; break; }
                await sleep(50);
            }
            assert.ok(sawBall, 'throw produced no ball in state');
            await sleep(1000);
            const after = boxB.latest;
            assert.ok(after && after.players[b.id] && !after.players[b.id].isFrozen, 'B froze from a 25px graze in multi (bonus must not apply)');
            return;
        }
        assert.ok(threw, 'never got a graze attempt in 20s');
    });
});

describe('timed matches and results', () => {
    // Short-clock server (2-second matches) so timer tests don't wait
    // 3 minutes. The main suite server keeps the default duration.
    const SHORT_PORT = 3459;
    const SHORT_URL = `http://127.0.0.1:${SHORT_PORT}`;
    let shortProc;

    before(async () => {
        shortProc = spawn('node', [SERVER_FILE], {
            env: { ...process.env, PORT: String(SHORT_PORT), MATCH_DURATION_TICKS: '120', OVERTIME_CAP_TICKS: '120' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        await waitForServerReady(shortProc);
    });

    after(() => {
        if (shortProc && !shortProc.killed) shortProc.kill();
    });

    // Resolve with the next matchEnd payload on a socket.
    function waitForMatchEnd(socket, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            const to = setTimeout(() => reject(new Error('matchEnd timed out')), timeoutMs);
            socket.once('matchEnd', (data) => {
                clearTimeout(to);
                resolve(data);
            });
        });
    }

    test('a scoreless match goes to sudden-death overtime, then draws at the overtime cap', async (t) => {
        const s = await connectClient(SHORT_URL);
        t.after(() => s.disconnect());
        await join(s, 'single', 1, 1);
        const box = trackState(s);
        // Tie at the buzzer: overtime starts, match not yet ended.
        const ot = await waitForState(box,
            (x) => x.match && x.match.overtime === true && x.match.ended === false,
            'overtime state');
        assert.equal(ot.match.timeLeft, 0);
        assert.deepEqual(ot.match.score, { blue: 0, red: 0 });
        // Nobody scores in the (2-second) overtime window: a draw.
        const end = await waitForMatchEnd(s);
        assert.equal(end.winner, 'draw');
        assert.deepEqual(end.score, { blue: 0, red: 0 });
        const st = await waitForState(box, (x) => x.match && x.match.ended === true, 'ended state');
        assert.equal(st.match.winner, 'draw');
        assert.equal(st.match.overtime, true);
        assert.equal(st.match.timeLeft, 0);
    });

    describe('sudden-death overtime win', () => {
        // Long overtime window so the bots have time to land a freeze.
        const OT_PORT = 3461;
        const OT_URL = `http://127.0.0.1:${OT_PORT}`;
        let otProc;

        before(async () => {
            otProc = spawn('node', [SERVER_FILE], {
                env: { ...process.env, PORT: String(OT_PORT), MATCH_DURATION_TICKS: '120', OVERTIME_CAP_TICKS: '3600' },
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            await waitForServerReady(otProc);
        });

        after(() => {
            if (otProc && !otProc.killed) otProc.kill();
        });

        test('the first freeze in overtime ends the match with a winner', async (t) => {
            const s = await connectClient(OT_URL);
            t.after(() => s.disconnect());
            await join(s, 'single', 1, 1);
            const box = trackState(s);
            // Stand still: nobody can score in the 2-second regulation
            // window (bots are still ~2600px apart), so overtime starts.
            await waitForState(box,
                (x) => x.match && x.match.overtime === true && x.match.ended === false,
                'overtime state');
            // Then the bots close in and a freeze decides it.
            const end = await waitForMatchEnd(s, 70000);
            assert.notEqual(end.winner, 'draw');
            assert.ok(end.score.blue + end.score.red >= 1, `score ${JSON.stringify(end.score)}`);
            const st = await waitForState(box, (x) => x.match && x.match.ended === true, 'ended state');
            assert.equal(st.match.winner, end.winner);
            assert.equal(st.match.overtime, true);
        });
    });

    test('a freeze scores for the thrower team (bot freezing the human scores red)', async (t) => {
        const s = await connectClient();
        t.after(() => s.disconnect());
        await join(s, 'single', 1, 1);
        const box = trackState(s);
        // Stand still: the bot closes in and throws until it lands a hit.
        const st = await waitForState(
            box,
            (x) => x.players[s.id] && x.players[s.id].isFrozen
                && x.match && x.match.score.red >= 1,
            'human frozen with red on the board',
            30000,
        );
        assert.ok(st.players[s.id].isFrozen);
        assert.ok(st.match.score.red >= 1, `red score ${st.match.score.red}`);
    });

    test('ended multi matches are excluded from matchmaking', async (t) => {
        const a = await connectClient(SHORT_URL);
        const b = await connectClient(SHORT_URL);
        t.after(() => {
            a.disconnect();
            b.disconnect();
        });
        const ra = await join(a, 'multi', 5, 5);
        assert.equal(ra.kind, 'init');
        await join(b, 'multi', 5, 5);
        // The 5v5 room ends on the short clock with open slots remaining.
        await waitForMatchEnd(a);
        const c = await connectClient(SHORT_URL);
        t.after(() => c.disconnect());
        const rc = await join(c, 'multi', 5, 5);
        assert.equal(rc.kind, 'init');
        // A fresh room: different obstacles, solo, and not already ended.
        assert.notEqual(JSON.stringify(rc.data.obstacles), JSON.stringify(ra.data.obstacles),
            'joiner landed in the ended match');
        const boxC = trackState(c);
        const stC = await waitForState(boxC, (x) => playersOf(x).length === 1, 'fresh match, solo');
        assert.equal(stC.match.ended, false);
    });
});


describe('network and input regressions', () => {
    test('30Hz snapshots retain 60Hz simulation, malformed packets stay harmless, idle input expires', async t => {
        const s=await connectClient(); t.after(()=>s.disconnect());
        await join(s,'multi',1,1);
        const box=trackState(s); await waitForState(box,x=>x.players[s.id],'player');
        const ticks=[]; s.on('state',x=>ticks.push(x.tick));
        s.emit('input',null);
        s.emit('input',{moveX:'bad',moveY:0,angle:0});
        s.emit('input',{moveX:0,moveY:1,angle:0,throwStart:true,dash:true});
        await sleep(250);
        assert.ok(box.latest.players[s.id].chargeLevel>0);
        assert.equal(box.latest.players[s.id].stats.dashes,1);
        await sleep(550);
        const p=box.latest.players[s.id];
        assert.equal(p.inputs.moveY,0); assert.equal(p.chargeLevel,0);
        assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
        assert.ok(ticks.length>=12 && ticks.length<=35, `snapshot count ${ticks.length}`);
        assert.ok(ticks.slice(1).every((tick,i)=>tick-ticks[i]===2));
    });
    test('quick charge/release and cancel are preserved between snapshots', async t => {
        const s=await connectClient(); t.after(()=>s.disconnect());
        await join(s,'multi',1,1); const box=trackState(s);
        await waitForState(box,x=>x.players[s.id],'player');
        s.emit('input',{moveX:0,moveY:0,angle:0,throwStart:true});
        s.emit('input',{moveX:0,moveY:0,angle:0,throwRelease:true});
        await waitForState(box,x=>x.players[s.id].stats.throws===1,'one throw');
        assert.equal(box.latest.players[s.id].hasBall,false);
        s.emit('input',{moveX:0,moveY:0,angle:0,gather:true});
        const held=setInterval(()=>s.emit('input',{moveX:0,moveY:0,angle:0,gather:true}),100);
        t.after(()=>clearInterval(held));
        await waitForState(box,x=>x.players[s.id].hasBall,'reloaded');clearInterval(held);
        s.emit('input',{moveX:0,moveY:0,angle:0,throwStart:true});await sleep(100);
        s.emit('input',{moveX:0,moveY:0,angle:0,cancelCharge:true});await sleep(100);
        assert.equal(box.latest.players[s.id].chargeLevel,0);assert.equal(box.latest.players[s.id].stats.throws,1);
    });
});

describe('teammate rescue', () => {
    test('touching a frozen teammate thaws them at once and credits the rescuer', async (t) => {
        const a = await connectClient();
        const b = await connectClient();
        const c = await connectClient();
        t.after(() => { a.disconnect(); b.disconnect(); c.disconnect(); });
        // Join order gives blue, red, blue: a and c are teammates, b is the enemy.
        assert.equal((await join(a, 'multi', 5, 5)).data.team, 'blue');
        assert.equal((await join(b, 'multi', 5, 5)).data.team, 'red');
        assert.equal((await join(c, 'multi', 5, 5)).data.team, 'blue');
        const box = trackState(a);
        await waitForState(box, (st) => playersOf(st).length === 3, '3 players');
        const pos = (st, id) => st.players[id];

        // Drive a socket toward a target position (from a's state view).
        // `stop` is a distance to the target or a predicate (me, target, state).
        // On stopping, just zero the input; the caller waits for friction
        // to settle where the final position matters.
        const driveTo = (sock, targetOf, stop) => new Promise((resolve, reject) => {
            const to = setTimeout(() => { clearInterval(iv); reject(new Error('drive timeout')); }, 30000);
            const iv = setInterval(() => {
                const st = box.latest;
                const me = st && st.players[sock.id];
                const tg = st && targetOf(st);
                if (!me || !tg) return;
                const dx = tg.x - me.x, dy = tg.y - me.y;
                const d = Math.hypot(dx, dy) || 1;
                const done = typeof stop === 'function' ? stop(me, tg, st) : d <= stop;
                if (done) {
                    clearInterval(iv); clearTimeout(to);
                    sock.emit('input', { moveX: 0, moveY: 0, angle: 0, dash: false, gather: false });
                    resolve();
                    return;
                }
                sock.emit('input', { moveX: dx / d, moveY: dy / d, angle: 0, dash: false, gather: false });
            }, 50);
            t.after(() => clearInterval(iv));
        });

        // 1. Park rescuer a next to victim c (a stop on distance, never
        // on an exact point, so the ~13px movement step cannot oscillate).
        await driveTo(a, (st) => pos(st, c.id), 25);
        // 2. Bring enemy b to the far side of c from a (220px past c):
        // b's snowball then reaches c before it could reach a, so the
        // throw freezes c, not the rescuer standing beside them. The
        // 50px tolerance covers a target point that lands inside an
        // obstacle (b is pushed to its edge, ~44px, and can go no closer).
        await driveTo(b, (st) => {
            const ap = pos(st, a.id), cp = pos(st, c.id);
            const dx = ap.x - cp.x, dy = ap.y - cp.y, d = Math.hypot(dx, dy) || 1;
            const ux = d < 1 ? 1 : dx / d, uy = d < 1 ? 0 : dy / d;
            return { x: cp.x - ux * 220, y: cp.y - uy * 220 };
        }, 50);
        // 3. b throws at c while a patrols back and forth across c
        // (perpendicular to the b->c line, so a is off the snowball's
        // path except at the crossing instant). Parking a precisely is
        // not how rescue works in play: a teammate passing through a
        // frozen player thaws them, and the patrol crosses c every
        // ~0.7s, far inside the 5s natural thaw. If a throw catches a
        // at the crossing instead, wait out a's thaw, move b ~60 degrees
        // around c (an obstacle on the old segment would block every
        // identical retry), and try again.
        let frozen = null;
        let patrolIv = null;
        const startPatrol = () => {
            let side = 1;
            patrolIv = setInterval(() => {
                const st = box.latest;
                if (!st) return;
                const bp = st.players[b.id], cp = st.players[c.id], ap = st.players[a.id];
                if (!bp || !cp || !ap) return;
                const dx = cp.x - bp.x, dy = cp.y - bp.y, d = Math.hypot(dx, dy) || 1;
                const px = -dy / d, py = dx / d;
                const tg = { x: cp.x + px * 100 * side, y: cp.y + py * 100 * side };
                const ddx = tg.x - ap.x, ddy = tg.y - ap.y, dd = Math.hypot(ddx, ddy) || 1;
                if (dd < 20) side = -side;
                a.emit('input', { moveX: ddx / dd, moveY: ddy / dd, angle: 0, dash: false, gather: false });
            }, 50);
            t.after(() => clearInterval(patrolIv));
        };
        const stopPatrol = () => {
            if (patrolIv) clearInterval(patrolIv);
            patrolIv = null;
            a.emit('input', { moveX: 0, moveY: 0, angle: 0, dash: false, gather: false });
        };
        for (let attempt = 0; attempt < 3 && !frozen; attempt++) {
            startPatrol();
            const st0 = box.latest;
            const bp = st0.players[b.id], cp = st0.players[c.id];
            const aim = Math.atan2(cp.y - bp.y, cp.x - bp.x);
            b.emit('input', { moveX: 0, moveY: 0, angle: aim, dash: false, gather: false, throwStart: true, throwRelease: false });
            await sleep(50);
            b.emit('input', { moveX: 0, moveY: 0, angle: aim, dash: false, gather: false, throwStart: false, throwRelease: true });
            try {
                frozen = await waitForState(box, (st) => st.players[c.id] && st.players[c.id].isFrozen, 'c frozen', 2000);
            } catch {
                stopPatrol();
                try { await waitForState(box, (st) => st.players[a.id] && !st.players[a.id].isFrozen, 'a thawed', 6000); } catch {}
                const stB = box.latest;
                const ang = Math.atan2(stB.players[b.id].y - stB.players[c.id].y, stB.players[b.id].x - stB.players[c.id].x) + 1.05;
                await driveTo(b, (st) => {
                    const cp = pos(st, c.id);
                    return { x: cp.x + Math.cos(ang) * 220, y: cp.y + Math.sin(ang) * 220 };
                }, 50);
                const held = setInterval(() => b.emit('input', { moveX: 0, moveY: 0, angle: 0, dash: false, gather: true }), 100);
                try { await waitForState(box, (st) => st.players[b.id] && st.players[b.id].hasBall, 'b reloaded', 5000); } finally { clearInterval(held); }
            }
        }
        assert.ok(frozen, 'b froze c within 3 attempts');
        const scoreAtFreeze = { ...frozen.match.score };
        // 4. Rescue is immediate (natural thaw takes 5s): the patrolling
        // rescuer crosses c within ~0.7s, so c unfrozen and a credited
        // within 3s, with the freeze score untouched.
        const rescued = await waitForState(box, (st) => {
            const cp = st.players[c.id], ap = st.players[a.id];
            return cp && !cp.isFrozen && ap && ap.stats.rescues >= 1;
        }, 'c rescued by a', 3000);
        assert.equal(rescued.players[a.id].stats.rescues, 1);
        assert.deepEqual(rescued.match.score, scoreAtFreeze, 'rescue must not change the score');
    });
});

describe('private rooms', () => {
    test('friends with the same code land in the same match', async (t) => {
        const a = await connectClient();
        const b = await connectClient();
        t.after(() => { a.disconnect(); b.disconnect(); });
        const ra = await joinExtra(a, { mode: 'multi', blue: 1, red: 1, room: 'q7rk13' });
        assert.equal(ra.kind, 'init');
        assert.equal(ra.data.match.roomCode, 'Q7RK13');
        const rb = await joinExtra(b, { mode: 'multi', blue: 1, red: 1, room: 'Q7RK13' });
        assert.equal(rb.kind, 'init');
        assert.equal(rb.data.match.roomCode, 'Q7RK13');
        const boxA = trackState(a);
        const st = await waitForState(boxA, (x) => playersOf(x).length === 2, 'room pair together');
        assert.ok(st.players[a.id] && st.players[b.id], 'both room members in one match');
    });

    test('an open join never enters a private room', async (t) => {
        const a = await connectClient();
        const b = await connectClient();
        t.after(() => { a.disconnect(); b.disconnect(); });
        const ra = await joinExtra(a, { mode: 'multi', blue: 1, red: 1, room: 'Q7RK14' });
        assert.equal(ra.kind, 'init');
        const rb = await join(b, 'multi', 1, 1);
        assert.equal(rb.kind, 'init');
        assert.ok(!rb.data.match.roomCode, 'open join has no room code');
        const boxB = trackState(b);
        const st = await waitForState(boxB, (x) => playersOf(x).length >= 1, 'open join state');
        assert.ok(!st.players[a.id], 'open joiner did not land in the private room');
    });

    test('a full private room rejects late joiners', async (t) => {
        const a = await connectClient();
        const b = await connectClient();
        const c = await connectClient();
        t.after(() => { a.disconnect(); b.disconnect(); c.disconnect(); });
        await joinExtra(a, { mode: 'multi', blue: 1, red: 1, room: 'Q7RK15' });
        await joinExtra(b, { mode: 'multi', blue: 1, red: 1, room: 'Q7RK15' });
        const rc = await joinExtra(c, { mode: 'multi', blue: 1, red: 1, room: 'Q7RK15' });
        assert.equal(rc.kind, 'joinError');
        assert.match(rc.data.message, /full/i);
    });

    test('single-player ignores room codes', async (t) => {
        const a = await connectClient();
        t.after(() => a.disconnect());
        const ra = await joinExtra(a, { mode: 'single', blue: 1, red: 1, room: 'Q7RK16' });
        assert.equal(ra.kind, 'init');
        assert.ok(!ra.data.match.roomCode, 'single-player match has no room code');
    });
});

describe('center hill', () => {
    // 10-second matches: steer one player onto the hill and hold it.
    const HILL_PORT = 3463;
    const HILL_URL = `http://127.0.0.1:${HILL_PORT}`;
    let hillProc;

    before(async () => {
        hillProc = spawn('node', [SERVER_FILE], {
            env: { ...process.env, PORT: String(HILL_PORT), MATCH_DURATION_TICKS: '600', OVERTIME_CAP_TICKS: '120' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        await waitForServerReady(hillProc);
    });

    after(() => {
        if (hillProc && !hillProc.killed) hillProc.kill();
    });

    test('holding the hill wins at the buzzer on a scoreless freeze count', async (t) => {
        const a = await connectClient(HILL_URL);
        const b = await connectClient(HILL_URL);
        t.after(() => { a.disconnect(); b.disconnect(); });
        const ra = await join(a, 'multi', 1, 1);
        assert.equal(ra.kind, 'init');
        await join(b, 'multi', 1, 1);
        // First joiner is blue; steer blue to the hill center (1500, 1000)
        // and hold there. Red stands still at spawn, far from the hill.
        const blueId = ra.data.team === 'blue' ? a.id : b.id;
        const blueSocket = ra.data.team === 'blue' ? a : b;
        const box = trackState(blueSocket);
        await waitForState(box, (x) => x.players[blueId], 'blue player in state');
        const steer = setInterval(() => {
            const st = box.latest;
            if (!st || st.match?.ended) return;
            const me = st.players[blueId];
            if (!me) return;
            const dx = 1500 - me.x, dy = 1000 - me.y;
            const len = Math.hypot(dx, dy) || 1;
            blueSocket.emit('input', {
                moveX: dx / len, moveY: dy / len,
                angle: Math.atan2(dy, dx), dash: false, gather: false,
            });
        }, 100);
        t.after(() => clearInterval(steer));
        const end = await waitForState(box,
            (x) => x.match && x.match.ended === true, 'hill match ended', 30000);
        assert.equal(end.match.winner, 'blue');
        assert.ok(end.match.hill.blue >= 1, `hill blue ${JSON.stringify(end.match.hill)}`);
        assert.equal(end.match.hill.red, 0);
        assert.deepEqual(end.match.score, { blue: 0, red: 0 });
    });
});

describe('bot hill contest', () => {
    // The default one-tap PLAY mode is single 1v1 vs a bot. The bot must
    // contest the center hill even when the human avoids it: with no
    // hill steering, a chase-only bot would follow the human to the
    // edge and never bank a hill point.
    const BOT_PORT = 3465;
    const BOT_URL = `http://127.0.0.1:${BOT_PORT}`;
    let botProc;

    before(async () => {
        botProc = spawn('node', [SERVER_FILE], {
            env: { ...process.env, PORT: String(BOT_PORT), MATCH_DURATION_TICKS: '1800', OVERTIME_CAP_TICKS: '120' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        await waitForServerReady(botProc);
    });

    after(() => {
        if (botProc && !botProc.killed) botProc.kill();
    });

    test('a bot with a far, idle human heads for the hill and banks red points', async (t) => {
        const s = await connectClient(BOT_URL);
        t.after(() => s.disconnect());
        const res = await join(s, 'single', 1, 1);
        assert.equal(res.kind, 'init');
        // Human sends no input: stands still at the blue spawn, far
        // from the hill and far from the bot.
        const box = trackState(s);
        const held = await waitForState(box,
            (x) => x.match && x.match.hill && x.match.hill.red >= 1 && x.match.hillHolder === 'red',
            'bot holds hill and banks red', 30000);
        assert.ok(held.match.hill.red >= 1, `hill red ${JSON.stringify(held.match.hill)}`);
        assert.equal(held.match.hillHolder, 'red');
    });
});


describe('contest invite regression', () => {
    test('invite code joins the existing room even when recipient has default team sizes', async t => {
        const host=await connectClient(), guest=await connectClient();
        t.after(()=>{host.disconnect();guest.disconnect()});
        const first=await joinExtra(host,{mode:'multi',blue:5,red:5,room:'INVITE77'});
        const second=await joinExtra(guest,{mode:'multi',blue:1,red:1,room:'INVITE77'});
        assert.equal(first.kind,'init');assert.equal(second.kind,'init');
        assert.equal(second.data.match.blueCap,5);assert.equal(second.data.match.redCap,5);
        const box=trackState(guest);
        await waitForState(box,s=>s.players[host.id]&&s.players[guest.id],'both in same 5v5 room');
    });
});
