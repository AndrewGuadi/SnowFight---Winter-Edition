// Public, bounded snapshot DTOs. Never serialize authoritative player objects
// directly: timers, input timestamps and other server internals are not client
// state and materially increase every 30 Hz packet.
const round = value => Math.round(value * 100) / 100;

function publicPlayer(p) {
    return {
        id: p.id,
        team: p.team,
        isBot: p.isBot,
        classId: p.classId,
        skinColor: p.skinColor,
        hatType: p.hatType,
        x: round(p.x),
        y: round(p.y),
        vx: round(p.vx),
        vy: round(p.vy),
        isFrozen: p.isFrozen,
        freezeTicks: p.freezeTicks,
        hasBall: p.hasBall,
        chargeLevel: p.chargeLevel,
        gatherProgress: p.gatherProgress,
        abilityCooldown: p.abilityCooldown,
        guardTicks: p.guardTicks,
        dashCooldownTimer: p.dashCooldownTimer,
        dashTimer: p.dashTimer,
        stats: p.stats,
        inputs: {
            moveX: p.inputs.moveX,
            moveY: p.inputs.moveY,
            angle: round(p.inputs.angle)
        },
        ack: p.lastInputSeq
    };
}

function publicSnowball(b) {
    return {
        ownerId: b.ownerId,
        team: b.team,
        x: round(b.x),
        y: round(b.y),
        z: round(b.z),
        vx: round(b.vx),
        vy: round(b.vy),
        radius: round(b.radius),
        kind: b.kind
    };
}

module.exports = { publicPlayer, publicSnowball };
