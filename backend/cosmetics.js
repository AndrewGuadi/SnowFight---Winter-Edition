// Cosmetic inputs are identifiers from a closed palette; never trust raw client CSS.
const PALETTES = Object.freeze({
    skin: Object.freeze(['#F7D7BA', '#DEAC82', '#B87853', '#75442F']),
    jacket: Object.freeze(['#E4545B', '#367FB6', '#57A77C', '#A073C4', '#DB9D36']),
    hat: Object.freeze(['#DB4E51', '#346CB3', '#51A46E', '#793E95', '#313C4F'])
});
const DEFAULT_APPEARANCE = Object.freeze({
    skin: PALETTES.skin[1],
    jacket: PALETTES.jacket[1],
    hat: PALETTES.hat[0]
});
function sanitizeAppearance(input) {
    const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const safe = {};
    for (const key of Object.keys(PALETTES)) {
        safe[key] = PALETTES[key].includes(raw[key]) ? raw[key] : DEFAULT_APPEARANCE[key];
    }
    return safe;
}
module.exports = {PALETTES, DEFAULT_APPEARANCE, sanitizeAppearance};
