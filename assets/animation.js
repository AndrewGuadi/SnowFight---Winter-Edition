/* SnowFight original presentation systems. No external code or assets.
 * Rendering only: no gameplay position, hit, score, or projectile authority.
 */
(function (root) {
    'use strict';

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    class AnimationStateMachine {
        constructor() {
            this.state = 'idle';
            this.enteredAt = 0;
            this.wasFrozen = false;
            this.hitUntil = 0;
            this.recoverUntil = 0;
            this.throwUntil = 0;
            this.throwStarted = -Infinity;
            this.throwKind = 'quick';
        }
        triggerThrow(charge, now) {
            // A server effect can arrive just after the immediate local pose.
            // Do not restart the same arm motion twice.
            if (now - this.throwStarted < 100) return;
            this.throwStarted = now;
            this.throwKind = charge >= 24 ? 'charged' : 'quick';
            this.throwUntil = now + (this.throwKind === 'charged' ? 340 : 240);
        }
        triggerHit(now) { this.hitUntil = now + 340; }
        update(sample, now) {
            if (this.wasFrozen && !sample.isFrozen) this.recoverUntil = now + 480;
            this.wasFrozen = !!sample.isFrozen;
            let next = 'idle';
            if (sample.ended && sample.winner === sample.team) next = 'victory';
            else if (now < this.hitUntil) next = 'hit';
            else if (sample.isFrozen) next = 'frozen';
            else if (now < this.recoverUntil) next = 'recovery';
            else if (now < this.throwUntil) next = 'throw';
            else if (sample.chargeLevel > 0 || sample.localAim) next = 'aiming';
            else if (sample.speed > 3.05) next = 'running';
            else if (sample.speed > 0.22) next = 'walking';
            if (next !== this.state) {
                this.state = next;
                this.enteredAt = now;
            }
            return { state: next, stateTime: Math.max(0, now - this.enteredAt), throwKind: this.throwKind };
        }
    }

    class EffectPool {
        constructor(capacity) {
            this.capacity = capacity || 240;
            this.items = Array.from({ length: this.capacity }, () => ({ active: false }));
            this.cursor = 0;
            this.activeCount = 0;
            this.lowQuality = false;
        }
        clear() {
            for (const item of this.items) item.active = false;
            this.activeCount = 0;
        }
        spawn(x, y, color, options) {
            const item = this.items[this.cursor];
            this.cursor = (this.cursor + 1) % this.capacity;
            const o = options || {};
            item.active = true;
            item.x = x; item.y = y; item.color = color;
            item.vx = o.vx || 0; item.vy = o.vy || 0;
            item.gravity = o.gravity || 0;
            item.life = item.maxLife = o.life || 420;
            item.size = o.size || 3;
            item.kind = o.kind || 'flake';
        }
        burst(x, y, color, count, kind) {
            const scaled = Math.max(2, Math.round(count * (this.lowQuality ? 0.45 : 1)));
            for (let i = 0; i < scaled; i++) {
                const angle = (i / scaled) * Math.PI * 2 + Math.random() * 0.35;
                const speed = 0.025 + Math.random() * 0.085;
                this.spawn(x, y, color, {
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 0.035,
                    gravity: 0.00022,
                    life: 300 + Math.random() * 260,
                    size: 1.8 + Math.random() * 3.3,
                    kind: kind || 'flake'
                });
            }
            if (kind === 'blocked' || kind === 'player') {
                this.spawn(x, y, color, { life: kind === 'blocked' ? 300 : 220, size: 10, kind: 'ring' });
            }
        }
        update(dt) {
            let count = 0;
            for (const item of this.items) {
                if (!item.active) continue;
                item.life -= dt;
                if (item.life <= 0) { item.active = false; continue; }
                item.x += item.vx * dt;
                item.y += item.vy * dt;
                item.vy += item.gravity * dt;
                count++;
            }
            this.activeCount = count;
        }
        draw(ctx, cx, cy) {
            ctx.save();
            for (const item of this.items) {
                if (!item.active) continue;
                const alpha = clamp(item.life / Math.min(180, item.maxLife), 0, 1);
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = ctx.fillStyle = item.color;
                const x = item.x - cx, y = item.y - cy;
                if (item.kind === 'ring') {
                    const progress = 1 - item.life / item.maxLife;
                    ctx.lineWidth = 2.5 * (1 - progress) + 0.5;
                    ctx.beginPath(); ctx.arc(x, y, item.size + progress * 30, 0, Math.PI * 2); ctx.stroke();
                } else if (item.kind === 'blocked') {
                    ctx.save(); ctx.translate(x, y); ctx.rotate(item.life * 0.01);
                    ctx.fillRect(-item.size, -1, item.size * 2, 2); ctx.restore();
                } else {
                    ctx.beginPath(); ctx.arc(x, y, item.size, 0, Math.PI * 2); ctx.fill();
                }
            }
            ctx.restore();
        }
    }

    class ProjectileVisualizer {
        constructor(effects) {
            this.effects = effects;
            this.tracks = [];
            this.current = new Map();
            this.impacts = [];
            this.serial = 0;
        }
        clear() { this.tracks.length = 0; this.current.clear(); this.impacts.length = 0; }
        markImpact(x, y, now) {
            this.impacts.push({ x, y, until: now + 250 });
            if (this.impacts.length > 24) this.impacts.shift();
        }
        sync(balls, now) {
            this.current.clear();
            const matched = new Set();
            for (const ball of balls) {
                let best = null, bestDistance = 95;
                for (const track of this.tracks) {
                    if (matched.has(track) || track.ownerId !== ball.ownerId || track.team !== ball.team || track.kind !== ball.kind) continue;
                    const distance = Math.hypot(ball.x - track.x, ball.y - track.y);
                    if (distance < bestDistance) { best = track; bestDistance = distance; }
                }
                if (!best) {
                    best = { id: ++this.serial, ownerId: ball.ownerId, team: ball.team, kind: ball.kind, history: [] };
                    this.tracks.push(best);
                }
                matched.add(best);
                best.x = ball.x; best.y = ball.y; best.z = ball.z; best.lastSeen = now;
                if (!best.history.length || Math.hypot(ball.x - best.history[best.history.length - 1].x, ball.y - best.history[best.history.length - 1].y) > 5) {
                    best.history.push({ x: ball.x, y: ball.y, z: ball.z });
                    if (best.history.length > 5) best.history.shift();
                }
                this.current.set(ball, best);
            }
            for (let i = this.tracks.length - 1; i >= 0; i--) {
                const track = this.tracks[i];
                if (matched.has(track)) continue;
                this.tracks.splice(i, 1);
                const impact = this.impacts.some(hit => hit.until >= now && Math.hypot(hit.x - track.x, hit.y - track.y) < 90);
                if (!impact && Number.isFinite(track.x) && Number.isFinite(track.y)) {
                    this.effects.burst(track.x, track.y, '#f7fdff', 5, 'miss');
                }
            }
            this.impacts = this.impacts.filter(hit => hit.until >= now);
        }
        draw(ctx, ball, cx, cy, dx, dy, reducedMotion, lowQuality) {
            const track = this.current.get(ball);
            const radius = ball.radius || 6;
            if (track && !reducedMotion) {
                const history = track.history;
                const start = lowQuality ? Math.max(0, history.length - 2) : 0;
                const length = history.length - start;
                for (let i = start; i < history.length; i++) {
                    const point = history[i];
                    const alpha = (i - start + 1) / (length + 1) * 0.2;
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = ball.team === 'blue' ? '#78b9dc' : '#e7a6aa';
                    ctx.beginPath(); ctx.arc(point.x - cx, point.y - cy - point.z, Math.max(1, radius * (i + 1) / (history.length + 2)), 0, Math.PI * 2); ctx.fill();
                }
                ctx.globalAlpha = 1;
            }
            // Ground shadow stays on the ground while the snowball follows its arc.
            ctx.fillStyle = 'rgba(20,55,72,0.20)';
            ctx.beginPath(); ctx.ellipse(ball.x - cx, ball.y - cy + 3, radius * 1.1, radius * 0.55, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = ball.kind === 'cannon' ? '#ffe5a8' : ball.kind === 'needle' ? '#e7ddff' : '#f8fdff';
            ctx.strokeStyle = ball.team === 'blue' ? '#70a9c8' : '#ce8e96';
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(dx, dy, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath(); ctx.arc(dx - radius * 0.3, dy - radius * 0.35, Math.max(1.2, radius * 0.28), 0, Math.PI * 2); ctx.fill();
        }
    }

    class PerformanceMonitor {
        constructor(capacity) {
            this.capacity = capacity || 600;
            this.frames = new Float32Array(this.capacity);
            this.render = new Float32Array(this.capacity);
            this.index = 0; this.count = 0;
        }
        add(frameMs, renderMs) {
            this.frames[this.index] = frameMs;
            this.render[this.index] = renderMs;
            this.index = (this.index + 1) % this.capacity;
            this.count = Math.min(this.capacity, this.count + 1);
        }
        percentile(source, p) {
            if (!this.count) return null;
            const values = Array.from(source.slice(0, this.count)).sort((a, b) => a - b);
            return Math.round(values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))] * 100) / 100;
        }
        snapshot(players, effects) {
            const nav = performance.getEntriesByType('navigation')[0];
            return {
                samples: this.count,
                frameMs: { p50: this.percentile(this.frames, 0.5), p95: this.percentile(this.frames, 0.95), p99: this.percentile(this.frames, 0.99) },
                renderMs: { p50: this.percentile(this.render, 0.5), p95: this.percentile(this.render, 0.95), p99: this.percentile(this.render, 0.99) },
                players: players || 0,
                activeEffects: effects || 0,
                loadMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
                heapBytes: performance.memory ? performance.memory.usedJSHeapSize : null
            };
        }
    }

    root.SnowAnimation = { AnimationStateMachine, EffectPool, ProjectileVisualizer, PerformanceMonitor, clamp };
})(typeof window !== 'undefined' ? window : globalThis);
