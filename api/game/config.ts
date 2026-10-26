export const GAME_CONFIG = {
  worldWidth: 3000,
  worldHeight: 2000,
  friction: 0.92,
  acceleration: 0.8,
  maxSpeed: 4.5,
  dashSpeed: 12,
  dashDuration: 10,
  dashCooldown: 90,
  gatherTime: 45,
  ballSpeed: 12,
  snowballLife: 100,
  tickRate: 60, // Hz — restored to OG rate: per-tick physics constants are tuned for 60Hz
  broadcastRate: 60, // Hz — stripped payloads still keep bandwidth below OG's full-state 60Hz
  matchDuration: 180, // 3 minutes in seconds
  autoThawTime: 5000, // ms
  chargeMax: 60,
  cellSize: 100, // spatial grid cell size
} as const;

export const SHARED_SIZES = [
  [1, 1],
  [1, 5],
  [5, 5],
  [10, 10],
] as const;
export const SINGLE_ONLY_SIZE = [30, 30] as const;

export function sizeAllowed(mode: string, blue: number, red: number): boolean {
  if (!Number.isInteger(blue) || !Number.isInteger(red)) return false;
  if (SHARED_SIZES.some(([b, r]) => b === blue && r === red)) return true;
  if (mode === "single" && blue === SINGLE_ONLY_SIZE[0] && red === SINGLE_ONLY_SIZE[1])
    return true;
  return false;
}
