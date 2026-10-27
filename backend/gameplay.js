// Pure protocol and collision helpers shared by runtime and regression tests.
function sanitizeInput(data) {
    if (!data || !['moveX', 'moveY', 'angle'].every(k => typeof data[k] === 'number' && Number.isFinite(data[k]))) return null;
    const length = Math.max(1, Math.hypot(data.moveX, data.moveY));
    return { moveX: data.moveX / length, moveY: data.moveY / length,
        angle: Math.atan2(Math.sin(data.angle), Math.cos(data.angle)),
        cancelCharge: data.cancelCharge === true,
        ability: data.ability === true,
        dash: data.dash === true, gather: data.gather === true,
        throwStart: data.throwStart === true, throwRelease: data.throwRelease === true };
}
// Earliest intersection of a swept snowball with a circle, or null.
function segmentHit(x0, y0, x1, y1, cx, cy, radius) {
    const dx=x1-x0, dy=y1-y0, ox=x0-cx, oy=y0-cy;
    const c=ox*ox+oy*oy-radius*radius;
    if (c<=0) return 0;
    const a=dx*dx+dy*dy;
    if (!a) return null;
    const b=2*(ox*dx+oy*dy), d=b*b-4*a*c;
    if (d<0) return null;
    const t=(-b-Math.sqrt(d))/(2*a);
    return t>=0 && t<=1 ? t : null;
}
module.exports = { sanitizeInput, segmentHit };

