const { test } = require('node:test');
const assert = require('node:assert/strict');
const { publicPlayer, publicSnowball } = require('../snapshot');
const { ServerPlayer, ServerSnowball } = require('../server');

test('public snapshots expose gameplay state without server internals', () => {
    const p = new ServerPlayer('secret-socket-id', 'blue', false, 'glacier');
    p.lastInputSeq = 42;
    p.x = 123.4567; p.y = 765.4321;
    const dto = publicPlayer(p);
    assert.equal(dto.ack, 42);
    assert.equal(dto.dashTimer, 0);
    assert.equal(dto.x, 123.46);
    assert.equal(dto.inputs.angle, 0);
    for (const internal of ['lastInputAt', 'radius', 'abilityCooldownTimer', 'ended']) {
        assert.ok(!Object.hasOwn(dto, internal), internal);
    }
});

test('player DTOs materially reduce recurring snapshot bytes', () => {
    const p = new ServerPlayer('multiplayer-socket-id', 'blue', false, 'frostweaver');
    p.lastInputSeq = 100;
    const before = Buffer.byteLength(JSON.stringify(p));
    const after = Buffer.byteLength(JSON.stringify(publicPlayer(p)));
    const reduction = 1 - after / before;
    assert.ok(reduction > 0.15, `expected >15% reduction, got ${(reduction * 100).toFixed(1)}% (${before} -> ${after})`);
});

test('snowball DTOs retain rendering and ownership fields only', () => {
    const b = new ServerSnowball(100, 200, 0, 12, 'owner', 'blue', 30);
    b.kind = 'snow';
    const dto = publicSnowball(b);
    assert.equal(dto.ownerId, 'owner');
    assert.equal(dto.kind, 'snow');
    assert.ok(!Object.hasOwn(dto, 'vz'));
    assert.ok(!Object.hasOwn(dto, 'active'));
});
