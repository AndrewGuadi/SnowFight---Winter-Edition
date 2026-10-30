const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const prediction = require('../../assets/prediction.js');
const { ServerPlayer, createMatch, matches } = require('../server');
const { CLASSES } = require('../classes');

afterEach(() => matches.clear());
const input = (extra = {}) => ({ moveX: 1, moveY: 0, dash: false, gather: false, ...extra });
const world = (match, classes = CLASSES) => ({ width: 3000, height: 2000, obstacles: match.obstacles, structures: match.structures, classes });

test('prediction responds to movement in the same local tick', () => {
    const body = { x: 200, y: 500, vx: 0, vy: 0, classId: 'classic', dashTimer: 0, dashCooldownTimer: 0, gatherProgress: 0, hasBall: true, isFrozen: false };
    prediction.step(body, input(), { width: 3000, height: 2000, obstacles: [], structures: [], classes: CLASSES });
    assert.ok(body.x > 200);
    assert.ok(body.vx > 0);
});

test('predicted movement, gathering and dash match authoritative server physics', () => {
    for (const classId of Object.keys(CLASSES)) {
        for (const controls of [input(), input({ gather: true }), input({ dash: true })]) {
            const match = createMatch('multi', 1, 1);
            match.obstacles = [{ x: 420, y: 500, radius: 30 }];
            const server = new ServerPlayer('p', 'blue', false, classId);
            server.x = 200; server.y = 500;
            server.inputs = { ...server.inputs, ...controls };
            if (controls.gather) server.hasBall = false;
            match.players.p = server;
            const client = {
                x: server.x, y: server.y, vx: 0, vy: 0, classId,
                dashTimer: 0, dashCooldownTimer: 0, gatherProgress: 0,
                hasBall: server.hasBall, isFrozen: false
            };
            for (let tick = 0; tick < 100; tick++) {
                // Dash is an edge on the server, so model the same consumption.
                server.update(match);
                server.inputs.dash = false;
                prediction.step(client, controls, world(match));
                controls.dash = false;
            }
            assert.ok(Math.abs(client.x - server.x) < 0.001, `${classId} x: ${client.x} vs ${server.x}`);
            assert.ok(Math.abs(client.y - server.y) < 0.001, `${classId} y: ${client.y} vs ${server.y}`);
            assert.equal(client.hasBall, server.hasBall, classId);
            assert.equal(client.dashCooldownTimer, server.dashCooldownTimer, classId);
        }
    }
});

test('reconciliation drops acknowledged ticks and replays only pending input', () => {
    const body = { classId: 'classic' };
    const authoritative = {
        x: 500, y: 500, vx: 0, vy: 0, dashTimer: 0, dashCooldownTimer: 0,
        gatherProgress: 0, hasBall: true, isFrozen: false, ack: 2
    };
    const history = [
        { seq: 1, ...input() },
        { seq: 2, ...input() },
        { seq: 3, ...input({ moveX: 0, moveY: 1 }) }
    ];
    prediction.reconcile(body, authoritative, history, { width: 3000, height: 2000, obstacles: [], structures: [], classes: CLASSES });
    assert.equal(history.length, 1);
    assert.equal(history[0].seq, 3);
    assert.equal(body.x, 500);
    assert.ok(body.y > 500);
});

test('an unhealthy replay backlog snaps to the authoritative position', () => {
    const body = { classId: 'classic' };
    const authoritative = { x: 900, y: 800, vx: 0, vy: 0, hasBall: true, isFrozen: false, ack: 0 };
    const history = Array.from({ length: 181 }, (_, seq) => ({ seq: seq + 1, ...input() }));
    prediction.reconcile(body, authoritative, history, { width: 3000, height: 2000, obstacles: [], structures: [], classes: CLASSES });
    assert.equal(history.length, 0);
    assert.equal(body.x, 900);
    assert.equal(body.y, 800);
});
