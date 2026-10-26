import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { GAME_CONFIG, sizeAllowed } from "./config";
import { SpatialGrid } from "./spatial-grid";

/* ------------------------------------------------------------------ */
// Types
/* ------------------------------------------------------------------ */

interface PlayerInputs {
  moveX: number;
  moveY: number;
  angle: number;
  dash: boolean;
  gather: boolean;
  throwStart: boolean;
  throwRelease: boolean;
}

interface ServerPlayerData {
  id: string;
  team: "blue" | "red";
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  skinColor: string;
  hatType: number;
  isFrozen: boolean;
  frozenAt: number | null;
  hasBall: boolean;
  chargeLevel: number;
  gatherProgress: number;
  dashTimer: number;
  dashCooldownTimer: number;
  inputs: PlayerInputs;
  kills: number;
  deaths: number;
}

interface ServerSnowballData {
  id: string;
  x: number;
  y: number;
  z: number;
  vz: number;
  vx: number;
  vy: number;
  radius: number;
  ownerId: string;
  team: "blue" | "red";
  active: boolean;
}

interface Obstacle {
  x: number;
  y: number;
  radius: number;
  type: "tree" | "rock" | "snowman";
}

interface MatchState {
  id: string;
  mode: "single" | "multi";
  blueCap: number;
  redCap: number;
  players: Map<string, ServerPlayerData>;
  snowballs: ServerSnowballData[];
  obstacles: Obstacle[];
  startTime: number;
  endTime: number | null;
  winner: "blue" | "red" | "draw" | null;
  status: "waiting" | "active" | "finished";
  partyCode: string | null;
  spatialGrid: SpatialGrid;
  lastSnowballId: number;
}

/* ------------------------------------------------------------------ */
// Helpers
/* ------------------------------------------------------------------ */

function makeObstacles(): Obstacle[] {
  const obstacles: Obstacle[] = [];
  for (let i = 0; i < 60; i++) {
    const type = Math.random();
    obstacles.push({
      x: Math.random() * GAME_CONFIG.worldWidth,
      y: Math.random() * GAME_CONFIG.worldHeight,
      radius: type > 0.6 ? 30 : 20,
      type: type > 0.6 ? "tree" : type > 0.3 ? "rock" : "snowman",
    });
  }
  return obstacles;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function normalizeInputs(inputs: Partial<PlayerInputs>): PlayerInputs {
  let moveX = clamp(inputs.moveX ?? 0, -1, 1);
  let moveY = clamp(inputs.moveY ?? 0, -1, 1);
  const mag = Math.hypot(moveX, moveY);
  if (mag > 1) {
    moveX /= mag;
    moveY /= mag;
  }
  return {
    moveX,
    moveY,
    angle: clamp(inputs.angle ?? 0, -Math.PI, Math.PI),
    dash: !!inputs.dash,
    gather: !!inputs.gather,
    throwStart: !!inputs.throwStart,
    throwRelease: !!inputs.throwRelease,
  };
}

/* ------------------------------------------------------------------ */
// Player Factory
/* ------------------------------------------------------------------ */

function createPlayer(
  id: string,
  team: "blue" | "red",
  isBot: boolean
): ServerPlayerData {
  const margin = 200;
  return {
    id,
    team,
    isBot,
    radius: 14,
    x: team === "blue" ? margin : GAME_CONFIG.worldWidth - margin,
    y: Math.random() * (GAME_CONFIG.worldHeight - 200) + 100,
    vx: 0,
    vy: 0,
    skinColor: ["#ffdbac", "#f1c27d", "#e0ac69", "#8d5524", "#c68642"][
      Math.floor(Math.random() * 5)
    ],
    hatType: Math.floor(Math.random() * 4),
    isFrozen: false,
    frozenAt: null,
    hasBall: true,
    chargeLevel: 0,
    gatherProgress: 0,
    dashTimer: 0,
    dashCooldownTimer: 0,
    inputs: { moveX: 0, moveY: 0, angle: 0, dash: false, gather: false, throwStart: false, throwRelease: false },
    kills: 0,
    deaths: 0,
  };
}

/* ------------------------------------------------------------------ */
// Bot AI
/* ------------------------------------------------------------------ */

function computeBotInput(bot: ServerPlayerData, match: MatchState) {
  if (bot.isFrozen) {
    bot.inputs = { moveX: 0, moveY: 0, angle: 0, dash: false, gather: false, throwStart: false, throwRelease: false };
    return;
  }

  let target: ServerPlayerData | null = null;
  let best = Infinity;
  for (const p of match.players.values()) {
    if (p.team === bot.team || p.isFrozen) continue;
    const d = dist(p, bot);
    if (d < best) {
      best = d;
      target = p;
    }
  }

  if (!target) {
    bot.inputs = { moveX: 0, moveY: 0, angle: 0, dash: false, gather: false, throwStart: false, throwRelease: false };
    return;
  }

  const dx = target.x - bot.x;
  const dy = target.y - bot.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;

  if (!bot.hasBall) {
    bot.inputs = { moveX: nx, moveY: ny, angle: Math.atan2(ny, nx), dash: false, gather: true, throwStart: false, throwRelease: false };
    return;
  }

  const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.2;
  if (d <= 550) {
    bot.inputs = { moveX: 0, moveY: 0, angle, dash: false, gather: false, throwStart: bot.chargeLevel === 0, throwRelease: false };
    // OG parity: the throwStart flag alone never starts a charge — kick it
    // off here, or bots hold the ball forever and never throw.
    if (bot.chargeLevel === 0) bot.chargeLevel = 1;
  } else {
    bot.inputs = { moveX: nx, moveY: ny, angle, dash: Math.random() < 0.005, gather: false, throwStart: false, throwRelease: false };
    bot.chargeLevel = 0;
  }
}

/* ------------------------------------------------------------------ */
// Match Logic
/* ------------------------------------------------------------------ */

function updatePlayer(p: ServerPlayerData, match: MatchState) {
  if (p.isFrozen) return;

  if (p.dashCooldownTimer > 0) p.dashCooldownTimer--;

  if (p.inputs.dash && p.dashCooldownTimer === 0 && (p.inputs.moveX !== 0 || p.inputs.moveY !== 0)) {
    p.dashTimer = GAME_CONFIG.dashDuration;
    p.dashCooldownTimer = GAME_CONFIG.dashCooldown;
    const angle = Math.atan2(p.inputs.moveY, p.inputs.moveX);
    p.vx = Math.cos(angle) * GAME_CONFIG.dashSpeed;
    p.vy = Math.sin(angle) * GAME_CONFIG.dashSpeed;
  }

  if (p.dashTimer > 0) {
    p.dashTimer--;
  } else {
    let accel = GAME_CONFIG.acceleration;
    if (p.inputs.gather && !p.hasBall) {
      accel *= 0.5;
      p.vx *= 0.8;
      p.vy *= 0.8;
      p.gatherProgress++;
      if (p.gatherProgress >= GAME_CONFIG.gatherTime) {
        p.hasBall = true;
        p.gatherProgress = 0;
      }
    } else {
      p.gatherProgress = 0;
    }

    p.vx += p.inputs.moveX * accel;
    p.vy += p.inputs.moveY * accel;
    p.vx *= GAME_CONFIG.friction;
    p.vy *= GAME_CONFIG.friction;

    const speed = Math.hypot(p.vx, p.vy);
    if (speed > GAME_CONFIG.maxSpeed) {
      p.vx = (p.vx / speed) * GAME_CONFIG.maxSpeed;
      p.vy = (p.vy / speed) * GAME_CONFIG.maxSpeed;
    }
  }

  p.x += p.vx;
  p.y += p.vy;

  p.x = clamp(p.x, 0, GAME_CONFIG.worldWidth);
  p.y = clamp(p.y, 0, GAME_CONFIG.worldHeight);

  // Obstacle collision
  for (const obs of match.obstacles) {
    const ddx = p.x - obs.x;
    const ddy = p.y - obs.y;
    const ddist = Math.hypot(ddx, ddy);
    const minDist = p.radius + obs.radius;
    if (ddist < minDist) {
      const angle = Math.atan2(ddy, ddx);
      const push = minDist - ddist;
      p.x += Math.cos(angle) * push;
      p.y += Math.sin(angle) * push;
      p.vx *= 0.8;
      p.vy *= 0.8;
    }
  }
}

function tickMatch(match: MatchState, io: SocketIOServer) {
  if (match.status !== "active") return;

  const now = Date.now();

  // Check match timer
  if (now >= match.endTime!) {
    finishMatch(match, io, "time");
    return;
  }

  // Auto-thaw
  for (const p of match.players.values()) {
    if (p.isFrozen && p.frozenAt && now - p.frozenAt >= GAME_CONFIG.autoThawTime) {
      p.isFrozen = false;
      p.frozenAt = null;
    }
  }

  // Bot AI + throw releases
  for (const p of match.players.values()) {
    if (!p.isBot) continue;
    computeBotInput(p, match);
    if (p.hasBall && !p.isFrozen && p.chargeLevel >= 25) {
      const speed = GAME_CONFIG.ballSpeed + p.chargeLevel / 5;
      const sb: ServerSnowballData = {
        id: `sb-${match.id}-${++match.lastSnowballId}`,
        x: p.x,
        y: p.y,
        z: 14,
        vz: 2,
        vx: Math.cos(p.inputs.angle) * speed,
        vy: Math.sin(p.inputs.angle) * speed,
        radius: 6 + p.chargeLevel / 20,
        ownerId: p.id,
        team: p.team,
        active: true,
      };
      match.snowballs.push(sb);
      p.hasBall = false;
      p.chargeLevel = 0;
    }
  }

  // Charge + update players
  for (const p of match.players.values()) {
    if (p.chargeLevel > 0 && p.chargeLevel < GAME_CONFIG.chargeMax) p.chargeLevel++;
    updatePlayer(p, match);
    match.spatialGrid.update(p);
  }

  // Update snowballs + collisions
  const activeSnowballs: ServerSnowballData[] = [];
  for (const ball of match.snowballs) {
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.z += ball.vz;
    ball.vz -= 0.15;

    if (ball.z < 0) {
      ball.active = false;
      continue;
    }
    if (
      ball.x < 0 ||
      ball.x > GAME_CONFIG.worldWidth ||
      ball.y < 0 ||
      ball.y > GAME_CONFIG.worldHeight
    ) {
      ball.active = false;
      continue;
    }

    // Player collisions via spatial grid
    const nearby = match.spatialGrid.queryNearby(ball.x, ball.y, 40);
    let hit = false;
    for (const entity of nearby) {
      const p = match.players.get(entity.id);
      if (!p || p.id === ball.ownerId || p.team === ball.team || p.isFrozen) continue;
      if (dist(ball, p) < p.radius + ball.radius) {
        ball.active = false;
        p.isFrozen = true;
        p.frozenAt = now;
        p.deaths++;
        const owner = match.players.get(ball.ownerId);
        if (owner) owner.kills++;
        hit = true;
        io.to(match.id).emit("hit", { x: p.x, y: p.y, id: p.id });
        break;
      }
    }

    if (!hit) {
      // Obstacle collisions
      for (const obs of match.obstacles) {
        if (dist(ball, obs) < obs.radius + ball.radius) {
          ball.active = false;
          break;
        }
      }
    }

    if (ball.active) activeSnowballs.push(ball);
  }
  match.snowballs = activeSnowballs;

  // Check win condition (all enemies frozen) — only once both teams
  // actually have players. An empty team is not "eliminated": without
  // this guard, a lone player would instantly "win" the moment an
  // immediately-starting room ticks, which is what unfreezing rooms
  // would otherwise cause.
  const blueTotal = Array.from(match.players.values()).filter((p) => p.team === "blue").length;
  const redTotal = Array.from(match.players.values()).filter((p) => p.team === "red").length;
  if (blueTotal > 0 && redTotal > 0) {
    const blueAlive = Array.from(match.players.values()).filter((p) => p.team === "blue" && !p.isFrozen).length;
    const redAlive = Array.from(match.players.values()).filter((p) => p.team === "red" && !p.isFrozen).length;

    if (blueAlive === 0 && redAlive === 0) {
      finishMatch(match, io, "draw");
    } else if (blueAlive === 0) {
      finishMatch(match, io, "red");
    } else if (redAlive === 0) {
      finishMatch(match, io, "blue");
    }
  }

  // Broadcast state (stripped)
  const playersObj: Record<string, any> = {};
  for (const [id, p] of match.players) {
    playersObj[id] = {
      id: p.id,
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      team: p.team,
      isFrozen: p.isFrozen,
      hasBall: p.hasBall,
      chargeLevel: p.chargeLevel,
      gatherProgress: p.gatherProgress,
      skinColor: p.skinColor,
      hatType: p.hatType,
      isBot: p.isBot,
      kills: p.kills,
      deaths: p.deaths,
    };
  }

  io.to(match.id).volatile.emit("state", {
    players: playersObj,
    snowballs: match.snowballs.map((b) => ({
      id: b.id,
      x: b.x,
      y: b.y,
      z: b.z,
      radius: b.radius,
      team: b.team,
    })),
    timeRemaining: Math.max(0, Math.ceil((match.endTime! - now) / 1000)),
  });
}

function finishMatch(
  match: MatchState,
  io: SocketIOServer,
  reason: "blue" | "red" | "draw" | "time"
) {
  if (match.status === "finished") return;
  match.status = "finished";

  let winner: "blue" | "red" | "draw";
  if (reason === "draw") {
    winner = "draw";
  } else if (reason === "time") {
    const blueAlive = Array.from(match.players.values()).filter((p) => p.team === "blue" && !p.isFrozen).length;
    const redAlive = Array.from(match.players.values()).filter((p) => p.team === "red" && !p.isFrozen).length;
    if (blueAlive > redAlive) winner = "blue";
    else if (redAlive > blueAlive) winner = "red";
    else winner = "draw";
  } else {
    winner = reason;
  }
  match.winner = winner;

  const matchDuration = Math.floor((Date.now() - match.startTime) / 1000);

  io.to(match.id).emit("matchEnd", {
    winner,
    duration: matchDuration,
    players: Array.from(match.players.values()).map((p) => ({
      id: p.id,
      team: p.team,
      kills: p.kills,
      deaths: p.deaths,
      isBot: p.isBot,
    })),
  });

  // Clean up after 10s
  setTimeout(() => {
    matches.delete(match.id);
  }, 10000);
}

/* ------------------------------------------------------------------ */
// Match Manager
/* ------------------------------------------------------------------ */

const matches = new Map<string, MatchState>();
let matchCounter = 0;
let botCounter = 0;
const partyCodes = new Map<string, string>(); // code -> matchId

function createMatch(
  mode: "single" | "multi",
  blueCap: number,
  redCap: number,
  partyCode: string | null = null
): MatchState {
  const id = `match-${Date.now().toString(36)}-${++matchCounter}`;
  const match: MatchState = {
    id,
    mode,
    blueCap,
    redCap,
    players: new Map(),
    snowballs: [],
    obstacles: makeObstacles(),
    // Timer starts on activation, not creation — otherwise a room that
    // waits to fill would end the instant it starts.
    startTime: 0,
    endTime: null,
    winner: null,
    status: "waiting",
    partyCode,
    spatialGrid: new SpatialGrid(GAME_CONFIG.cellSize),
    lastSnowballId: 0,
  };
  matches.set(id, match);
  if (partyCode) partyCodes.set(partyCode, id);
  return match;
}

function activateMatch(match: MatchState) {
  if (match.status === "finished") return;
  match.status = "active";
  match.startTime = Date.now();
  match.endTime = Date.now() + GAME_CONFIG.matchDuration * 1000;
}

function findMultiMatch(blueCap: number, redCap: number): MatchState | null {
  for (const match of matches.values()) {
    if (match.mode !== "multi" || match.status !== "active") continue;
    if (match.partyCode) continue; // party rooms are invite-only, not open matchmaking
    if (match.blueCap !== blueCap || match.redCap !== redCap) continue;
    const blues = Array.from(match.players.values()).filter((p) => p.team === "blue").length;
    const reds = Array.from(match.players.values()).filter((p) => p.team === "red").length;
    if (blues < blueCap || reds < redCap) return match;
  }
  return null;
}

function countTeam(match: MatchState, team: "blue" | "red") {
  return Array.from(match.players.values()).filter((p) => p.team === team).length;
}

function hasHumans(match: MatchState) {
  return Array.from(match.players.values()).some((p) => !p.isBot);
}

function addBot(match: MatchState, team: "blue" | "red") {
  const id = `bot-${match.id}-${++botCounter}`;
  const bot = createPlayer(id, team, true);
  match.players.set(id, bot);
  match.spatialGrid.insert(bot);
  return bot;
}

function leaveMatch(socketId: string, _io: SocketIOServer) {
  for (const match of matches.values()) {
    if (!match.players.has(socketId)) continue;
    match.players.delete(socketId);
    if (!hasHumans(match)) {
      matches.delete(match.id);
      if (match.partyCode) partyCodes.delete(match.partyCode);
    }
    break;
  }
}

/* ------------------------------------------------------------------ */
// Socket.IO Setup
/* ------------------------------------------------------------------ */

export function createGameServer(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    pingInterval: 2000,
    pingTimeout: 5000,
  });

  io.on("connection", (socket) => {
    // Throw rate limit (gather gating already limits throws to ~1.3/s,
    // so this is only an anti-spam backstop)
    const lastThrowTime = { time: 0 };

    socket.on("join", (data: { mode?: string; blue?: number; red?: number; partyCode?: string }) => {
      const mode = data?.mode;
      const blue = Number(data?.blue);
      const red = Number(data?.red);
      const code = data?.partyCode?.toUpperCase()?.trim();

      if ((mode !== "single" && mode !== "multi") || !sizeAllowed(mode, blue, red)) {
        socket.emit("joinError", { message: "Invalid mode or match size." });
        return;
      }

      leaveMatch(socket.id, io);

      let match: MatchState;

      if (code && partyCodes.has(code)) {
        // Join by party code
        const existing = matches.get(partyCodes.get(code)!);
        if (!existing || existing.status === "finished") {
          socket.emit("joinError", { message: "Party code expired." });
          return;
        }
        match = existing;
        if (match.status !== "active") activateMatch(match);
        const blues = countTeam(match, "blue");
        const reds = countTeam(match, "red");
        let team: "blue" | "red";
        if (blues <= reds && blues < match.blueCap) team = "blue";
        else if (reds < match.redCap) team = "red";
        else {
          socket.emit("joinError", { message: "Party is full." });
          return;
        }
        match.players.set(socket.id, createPlayer(socket.id, team, false));
        match.spatialGrid.insert(match.players.get(socket.id)!);
      } else if (mode === "single") {
        match = createMatch("single", blue, red);
        match.players.set(socket.id, createPlayer(socket.id, "blue", false));
        match.spatialGrid.insert(match.players.get(socket.id)!);
        for (let i = 0; i < blue - 1; i++) addBot(match, "blue");
        for (let i = 0; i < red; i++) addBot(match, "red");
        activateMatch(match);
      } else {
        const foundMatch = findMultiMatch(blue, red);
        match = foundMatch ?? createMatch("multi", blue, red);
        const blues = countTeam(match, "blue");
        const reds = countTeam(match, "red");
        let team: "blue" | "red";
        if (blues <= reds && blues < match.blueCap) team = "blue";
        else if (reds < match.redCap) team = "red";
        else {
          match = createMatch("multi", blue, red);
          team = "blue";
        }
        match.players.set(socket.id, createPlayer(socket.id, team, false));
        match.spatialGrid.insert(match.players.get(socket.id)!);

        // Rooms start immediately on first join (OG behavior) — no waiting
        // for a full room, and the timer starts now, not at creation.
        if (match.status !== "active") activateMatch(match);
      }

      socket.join(match.id);
      const p = match.players.get(socket.id)!;
      socket.emit("init", {
        id: socket.id,
        width: GAME_CONFIG.worldWidth,
        height: GAME_CONFIG.worldHeight,
        obstacles: match.obstacles,
        team: p.team,
        match: { mode: match.mode, blueCap: match.blueCap, redCap: match.redCap },
        timeRemaining: match.status === "active" ? Math.max(0, Math.ceil((match.endTime! - Date.now()) / 1000)) : null,
      });
    });

    socket.on("createParty", (data: { blue?: number; red?: number }) => {
      const blue = Number(data?.blue) || 5;
      const red = Number(data?.red) || 5;
      if (!sizeAllowed("multi", blue, red)) {
        socket.emit("joinError", { message: "Invalid match size for party." });
        return;
      }
      leaveMatch(socket.id, io);
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const match = createMatch("multi", blue, red, code);
      match.players.set(socket.id, createPlayer(socket.id, "blue", false));
      match.spatialGrid.insert(match.players.get(socket.id)!);
      activateMatch(match);
      socket.join(match.id);
      socket.emit("partyCreated", { code, matchId: match.id });
      socket.emit("init", {
        id: socket.id,
        width: GAME_CONFIG.worldWidth,
        height: GAME_CONFIG.worldHeight,
        obstacles: match.obstacles,
        team: "blue",
        match: { mode: "multi", blueCap: match.blueCap, redCap: match.redCap },
        timeRemaining: match.status === "active" ? Math.max(0, Math.ceil((match.endTime! - Date.now()) / 1000)) : null,
      });
    });

    socket.on("input", (data: Partial<PlayerInputs>) => {
      const now = Date.now();
      // No input throttle: the client emits every frame and momentary
      // actions (throw/dash) live for exactly one frame, so throttling
      // here silently drops most quick taps. OG processes every input.

      const inputs = normalizeInputs(data);

      for (const match of matches.values()) {
        const p = match.players.get(socket.id);
        if (!p) continue;

        p.inputs.moveX = inputs.moveX;
        p.inputs.moveY = inputs.moveY;
        p.inputs.dash = inputs.dash;
        p.inputs.gather = inputs.gather;
        p.inputs.angle = inputs.angle;

        if (inputs.throwStart && p.hasBall && !p.isFrozen) {
          p.chargeLevel = 1;
        }

        if (inputs.throwRelease && p.hasBall && !p.isFrozen) {
          // Rate limit throws (max 3/sec)
          if (now - lastThrowTime.time < 333) continue;
          lastThrowTime.time = now;

          const speed = GAME_CONFIG.ballSpeed + p.chargeLevel / 5;
          const sb: ServerSnowballData = {
            id: `sb-${match.id}-${++match.lastSnowballId}`,
            x: p.x,
            y: p.y,
            z: 14,
            vz: 2,
            vx: Math.cos(inputs.angle) * speed,
            vy: Math.sin(inputs.angle) * speed,
            radius: 6 + p.chargeLevel / 20,
            ownerId: p.id,
            team: p.team,
            active: true,
          };
          match.snowballs.push(sb);
          p.hasBall = false;
          p.chargeLevel = 0;
          io.to(match.id).emit("effect", { type: "throw", x: p.x, y: p.y });
        }
        break;
      }
    });

    socket.on("disconnect", () => {
      leaveMatch(socket.id, io);
    });
  });

  // Game loop at 20Hz
  setInterval(() => {
    for (const match of matches.values()) {
      tickMatch(match, io);
    }
  }, 1000 / GAME_CONFIG.tickRate);

  return io;
}

export { matches };
