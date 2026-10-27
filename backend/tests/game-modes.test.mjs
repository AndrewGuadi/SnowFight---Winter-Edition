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
//   server -> client: 'matchEnd' { winner, score } when the 3-minute
//                     match timer expires (winner = most freezes inflicted).
//                     A tie at the buzzer starts sudden-death overtime
//                     (overtime: true) instead: the next freeze wins at
//                     once; if the overtime cap expires it ends in a draw.
// Difficulty applies to single-player bots only (multiplayer has no bots);
// invalid or missing values default to 'normal'. The match length is
// MATCH_DURATION_TICKS (default 10800 = 3 minutes at 60 TPS).
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
