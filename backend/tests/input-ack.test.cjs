const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { io } = require('socket.io-client');

const PORT = 3467;
let proc;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

before(async () => {
    proc = spawn('node', [path.join(__dirname, '..', 'server.js')], {
        env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe']
    });
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('server start timeout')), 5000);
        proc.stdout.on('data', data => {
            if (String(data).includes('running on port')) { clearTimeout(timeout); resolve(); }
        });
        proc.on('exit', reject);
    });
});
after(() => { if (proc && !proc.killed) proc.kill(); });

test('snapshots acknowledge the newest processed sequence and ignore stale packets', async t => {
    const socket = io(`http://127.0.0.1:${PORT}`, { transports: ['websocket'], reconnection: false });
    t.after(() => socket.disconnect());
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    socket.emit('join', { mode: 'multi', blue: 1, red: 1 });
    await new Promise(resolve => socket.once('init', resolve));
    let latest;
    socket.on('state', state => { latest = state; });
    const waitAck = async ack => {
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
            if (latest && latest.players[socket.id] && latest.players[socket.id].ack >= ack) return latest.players[socket.id];
            await sleep(25);
        }
        assert.fail(`ack ${ack} not observed`);
    };
    socket.emit('input', { seq: 7, moveX: 1, moveY: 0, angle: 0 });
    await waitAck(7);
    socket.emit('input', { seq: 8, moveX: 0, moveY: 1, angle: 0 });
    await waitAck(8);
    socket.emit('input', { seq: 3, moveX: -1, moveY: 0, angle: 0 });
    await sleep(150);
    const p = await waitAck(8);
    assert.equal(p.ack, 8);
    assert.equal(p.inputs.moveX, 0);
    assert.equal(p.inputs.moveY, 1);
});
