/* Snowbrawl local-player prediction. The server remains authoritative for
 * every hit, score, cooldown and position; this module only replays movement
 * inputs that the latest snapshot has not acknowledged yet. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SnowPrediction = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const PHYSICS = Object.freeze({
        friction: 0.92,
        acceleration: 0.8,
        maxSpeed: 4.5,
        dashSpeed: 12,
        dashDuration: 10,
        dashCooldown: 90
    });
    const DEFAULT_CLASS = Object.freeze({ radius: 14, speed: 1, gather: 45 });

    function classConfig(body, world) {
        return (world.classes && world.classes[body.classId]) || DEFAULT_CLASS;
    }

    function step(body, input, world) {
        if (body.isFrozen) return body;
        const c = classConfig(body, world);
        if (body.dashCooldownTimer > 0) body.dashCooldownTimer--;

        if (input.dash && body.dashCooldownTimer === 0 && (input.moveX !== 0 || input.moveY !== 0)) {
            body.dashTimer = PHYSICS.dashDuration;
            body.dashCooldownTimer = PHYSICS.dashCooldown;
            const angle = Math.atan2(input.moveY, input.moveX);
            body.vx = Math.cos(angle) * PHYSICS.dashSpeed * c.speed;
            body.vy = Math.sin(angle) * PHYSICS.dashSpeed * c.speed;
        }

        if (body.dashTimer > 0) {
            body.dashTimer--;
        } else {
            let accel = PHYSICS.acceleration;
            if (input.gather && !body.hasBall) {
                accel *= 0.5;
                body.vx *= 0.8;
                body.vy *= 0.8;
                body.gatherProgress++;
                if (body.gatherProgress >= c.gather) {
                    body.hasBall = true;
                    body.gatherProgress = 0;
                }
            } else {
                body.gatherProgress = 0;
            }
            body.vx += input.moveX * accel;
            body.vy += input.moveY * accel;
            body.vx *= PHYSICS.friction;
            body.vy *= PHYSICS.friction;
            const speed = Math.hypot(body.vx, body.vy);
            const cap = PHYSICS.maxSpeed * c.speed;
            if (speed > cap) {
                body.vx = body.vx / speed * cap;
                body.vy = body.vy / speed * cap;
            }
        }

        body.x += body.vx;
        body.y += body.vy;
        body.x = Math.max(0, Math.min(world.width, body.x));
        body.y = Math.max(0, Math.min(world.height, body.y));

        // The same circle resolution as the server, without allocating a
        // combined obstacle array in the 60 Hz prediction path.
        for (let group = 0; group < 2; group++) {
            const solids = group === 0 ? world.obstacles : world.structures;
            if (!solids) continue;
            for (const obs of solids) {
                const dx = body.x - obs.x, dy = body.y - obs.y;
                const dist = Math.hypot(dx, dy);
                const minDist = c.radius + obs.radius;
                if (dist >= minDist) continue;
                const angle = Math.atan2(dy, dx);
                const push = minDist - dist;
                body.x += Math.cos(angle) * push;
                body.y += Math.sin(angle) * push;
                body.vx *= 0.8;
                body.vy *= 0.8;
            }
        }
        return body;
    }

    function reconcile(body, authoritative, history, world) {
        body.x = authoritative.x;
        body.y = authoritative.y;
        body.vx = authoritative.vx;
        body.vy = authoritative.vy;
        body.dashTimer = authoritative.dashTimer || 0;
        body.dashCooldownTimer = authoritative.dashCooldownTimer || 0;
        body.gatherProgress = authoritative.gatherProgress || 0;
        body.hasBall = authoritative.hasBall;
        body.isFrozen = authoritative.isFrozen;

        let firstPending = 0;
        while (firstPending < history.length && history[firstPending].seq <= authoritative.ack) firstPending++;
        if (firstPending) history.splice(0, firstPending);
        // Three seconds of unacknowledged input means the connection is not
        // healthy enough to replay safely. Snap to the server and start clean.
        if (history.length > 180) {
            history.length = 0;
            return body;
        }
        for (const input of history) step(body, input, world);
        return body;
    }

    return { PHYSICS, step, reconcile };
});
