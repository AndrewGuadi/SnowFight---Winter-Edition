import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";

/* ------------------------------------------------------------------ */
// Types
/* ------------------------------------------------------------------ */
interface ServerPlayer {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: "blue" | "red";
  isFrozen: boolean;
  hasBall: boolean;
  chargeLevel: number;
  gatherProgress: number;
  skinColor: string;
  hatType: number;
  isBot: boolean;
  kills: number;
  deaths: number;
}

interface ServerSnowball {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  team: "blue" | "red";
}

interface MatchEndData {
  winner: "blue" | "red" | "draw";
  duration: number;
  players: Array<{
    id: string;
    team: string;
    kills: number;
    deaths: number;
    isBot: boolean;
  }>;
}

/* ------------------------------------------------------------------ */
// Audio Engine
/* ------------------------------------------------------------------ */
class AudioEngine {
  ctx: AudioContext | null = null;
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  playTone(freq: number, type: OscillatorType, duration: number, vol: number, slideTo?: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
  playNoise(duration: number, vol: number) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    noise.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }
  sfx = {
    throw: () => {
      this.playNoise(0.1, 0.2);
      this.playTone(400, "triangle", 0.1, 0.2, 100);
    },
    hit: () => {
      this.playNoise(0.2, 0.5);
      this.playTone(100, "square", 0.1, 0.4, 50);
    },
    dash: () => {
      this.playNoise(0.3, 0.2);
      this.playTone(300, "sine", 0.3, 0.3, 800);
    },
    collect: () => this.playTone(600, "sine", 0.1, 0.1, 800),
    ui: () => this.playTone(1200, "sine", 0.05, 0.1),
  };
}

/* ------------------------------------------------------------------ */
// Object Pooling
/* ------------------------------------------------------------------ */
class Particle {
  x = 0;
  y = 0;
  color = "";
  vx = 0;
  vy = 0;
  life = 0;
  active = false;
  reset(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.life = 1.0;
    this.active = true;
  }
  update() {
    if (!this.active) return;
    this.x += this.vx;
    this.y += this.vy;
    this.life -= 0.05;
    if (this.life <= 0) this.active = false;
  }
  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    if (!this.active) return;
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x - cx, this.y - cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class PopupText {
  x = 0;
  y = 0;
  text = "";
  color = "";
  life = 0;
  active = false;
  reset(x: number, y: number, text: string, color: string) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 60;
    this.active = true;
  }
  update() {
    if (!this.active) return;
    this.y -= 1;
    this.life--;
    if (this.life <= 0) this.active = false;
  }
  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    if (!this.active) return;
    ctx.globalAlpha = Math.min(1, this.life / 20);
    ctx.fillStyle = this.color;
    ctx.font = "bold 16px Arial";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 2;
    ctx.fillText(this.text, this.x - cx, this.y - cy);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ */
// Main Component
/* ------------------------------------------------------------------ */
export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [inGame, setInGame] = useState(false);
  const [matchEnd, setMatchEnd] = useState<MatchEndData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [scores, setScores] = useState({ blue: 0, red: 0 });
  const [matchBadge, setMatchBadge] = useState("");
  const [menuError, setMenuError] = useState("");
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [size, setSize] = useState<[number, number]>([1, 1]);
  const [partyCode, setPartyCode] = useState("");
  const [showPartyInput, setShowPartyInput] = useState(false);
  const [createdPartyCode, setCreatedPartyCode] = useState("");

  const audioRef = useRef(new AudioEngine());
  const stateRef = useRef({
    id: "",
    worldWidth: 3000,
    worldHeight: 2000,
    camera: { x: 0, y: 0 },
    players: new Map<string, ServerPlayer>(),
    obstacles: [] as Array<{ x: number; y: number; radius: number; type: string }>,
    snowballs: [] as ServerSnowball[],
    particles: Array.from({ length: 200 }, () => new Particle()),
    popups: Array.from({ length: 50 }, () => new PopupText()),
    footprints: [] as Array<{ x: number; y: number; life: number; angle: number }>,
    inputs: {
      moveX: 0,
      moveY: 0,
      angle: 0,
      dash: false,
      gather: false,
      throwStart: false,
      throwRelease: false,
    },
    viewIndex: 0,
    screenShake: 0,
    lastStateTime: 0,
    serverStates: [] as Array<{
      time: number;
      players: Record<string, ServerPlayer>;
      snowballs: ServerSnowball[];
    }>,
  });

  const VIEWS = [
    { name: "Close", zoom: 1 },
    { name: "Wide", zoom: 0.7 },
    { name: "Far", zoom: 0.5 },
  ];

  /* ---------------------------------------------------------------- */
  // Socket setup
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const socket = io(SERVER_URL || window.location.origin);
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("init", (data: any) => {
      const s = stateRef.current;
      s.id = data.id;
      s.worldWidth = data.width;
      s.worldHeight = data.height;
      s.obstacles = data.obstacles;
      s.players.clear();
      s.snowballs = [];
      s.serverStates = [];
      setInGame(true);
      setMatchEnd(null);
      setTimeRemaining(data.timeRemaining);
      setMatchBadge(`${data.match.mode === "single" ? "Single" : "Multi"} • ${data.match.blueCap}v${data.match.redCap}`);
      audioRef.current.init();
      audioRef.current.sfx.ui();
    });

    socket.on("joinError", (data: any) => {
      setMenuError(data.message || "Could not join match.");
    });

    socket.on("state", (data: any) => {
      const s = stateRef.current;
      s.lastStateTime = Date.now();

      s.serverStates.push({
        time: Date.now(),
        players: data.players,
        snowballs: data.snowballs,
      });
      if (s.serverStates.length > 3) s.serverStates.shift();

      s.snowballs = data.snowballs;

      const players = Object.values(data.players) as ServerPlayer[];
      const blueAlive = players.filter((p) => p.team === "blue" && !p.isFrozen).length;
      const redAlive = players.filter((p) => p.team === "red" && !p.isFrozen).length;
      setScores({ blue: blueAlive, red: redAlive });

      if (data.timeRemaining !== undefined) {
        setTimeRemaining(data.timeRemaining);
      }
    });

    socket.on("hit", (data: any) => {
      createParticles(data.x, data.y, "#FFF", 15);
      audioRef.current.sfx.hit();
      if (data.id === stateRef.current.id) {
        stateRef.current.screenShake = 10;
        addPopup(data.x, data.y, "FROZEN!", "#00FFFF");
      } else {
        addPopup(data.x, data.y, "HIT!", "#FFFF00");
      }
    });

    socket.on("effect", (data: any) => {
      const s = stateRef.current;
      const camDist = Math.hypot(s.camera.x - data.x, s.camera.y - data.y);
      if (data.type === "dash") {
        createParticles(data.x, data.y, "#FFF", 5);
        if (camDist < 800) audioRef.current.sfx.dash();
      } else if (data.type === "reload") {
        addPopup(data.x, data.y - 20, "RELOAD", "#FFF");
        if (data.id === s.id) audioRef.current.sfx.collect();
      } else if (data.type === "throw") {
        if (camDist < 800) audioRef.current.sfx.throw();
      }
    });

    socket.on("matchEnd", (data: MatchEndData) => {
      setMatchEnd(data);
      setInGame(false);
    });

    socket.on("partyCreated", (data: { code: string }) => {
      setCreatedPartyCode(data.code);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  function createParticles(x: number, y: number, color: string, count: number) {
    const s = stateRef.current;
    let added = 0;
    for (const p of s.particles) {
      if (!p.active && added < count) {
        p.reset(x, y, color);
        added++;
      }
    }
  }

  function addPopup(x: number, y: number, text: string, color: string) {
    const s = stateRef.current;
    for (const p of s.popups) {
      if (!p.active) {
        p.reset(x, y, text, color);
        return;
      }
    }
  }

  /* ---------------------------------------------------------------- */
  // Game Loop
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false })!;

    let animId = 0;
    const s = stateRef.current;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    function render() {
      animId = requestAnimationFrame(render);
      if (!inGame) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, canvas!.width, canvas!.height);
        return;
      }

      const vw = canvas!.width;
      const vh = canvas!.height;

      const now = Date.now();
      const states = s.serverStates;
      if (states.length >= 2) {
        const prev = states[states.length - 2];
        const curr = states[states.length - 1];
        const dt = curr.time - prev.time;
        const t = dt > 0 ? Math.min(1, (now - curr.time) / dt) : 0;

        for (const [id, cp] of Object.entries(curr.players)) {
          const pp = prev.players[id];
          let targetX = cp.x;
          let targetY = cp.y;
          if (pp) {
            targetX = pp.x + (cp.x - pp.x) * t;
            targetY = pp.y + (cp.y - pp.y) * t;
          }
          const existing = s.players.get(id);
          if (existing) {
            existing.x += (targetX - existing.x) * 0.3;
            existing.y += (targetY - existing.y) * 0.3;
            existing.vx = cp.vx;
            existing.vy = cp.vy;
            existing.isFrozen = cp.isFrozen;
            existing.hasBall = cp.hasBall;
            existing.chargeLevel = cp.chargeLevel;
            existing.gatherProgress = cp.gatherProgress;
          } else {
            s.players.set(id, { ...cp, x: targetX, y: targetY });
          }
        }
        for (const id of s.players.keys()) {
          if (!curr.players[id]) s.players.delete(id);
        }
      }

      if (s.id && socketRef.current) {
        socketRef.current.emit("input", {
          moveX: s.inputs.moveX,
          moveY: s.inputs.moveY,
          dash: s.inputs.dash,
          gather: s.inputs.gather,
          throwStart: s.inputs.throwStart,
          throwRelease: s.inputs.throwRelease,
          angle: s.inputs.angle,
        });
        s.inputs.throwStart = false;
        s.inputs.throwRelease = false;
        s.inputs.dash = false;
      }

      let shakeX = 0, shakeY = 0;
      if (s.screenShake > 0) {
        shakeX = (Math.random() - 0.5) * s.screenShake;
        shakeY = (Math.random() - 0.5) * s.screenShake;
        s.screenShake *= 0.9;
      }

      const myPlayer = s.players.get(s.id);
      if (myPlayer) {
        const tx = myPlayer.x - vw / 2;
        const ty = myPlayer.y - vh / 2;
        const clampedX = Math.max(0, Math.min(tx, s.worldWidth - vw));
        const clampedY = Math.max(0, Math.min(ty, s.worldHeight - vh));
        s.camera.x += (clampedX - s.camera.x) * 0.1;
        s.camera.y += (clampedY - s.camera.y) * 0.1;
      }

      const cx = s.camera.x + shakeX;
      const cy = s.camera.y + shakeY;
      const zoom = VIEWS[s.viewIndex].zoom;
      const viewW = vw / zoom;
      const viewH = vh / zoom;
      const visX0 = cx + vw / 2 - viewW / 2;
      const visX1 = cx + vw / 2 + viewW / 2;
      const visY0 = cy + vh / 2 - viewH / 2;
      const visY1 = cy + vh / 2 + viewH / 2;

      ctx.clearRect(0, 0, vw, vh);
      ctx.fillStyle = "#e3f2fd";
      ctx.fillRect(0, 0, vw, vh);

      ctx.save();
      ctx.translate(vw / 2, vh / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-vw / 2, -vh / 2);

      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const gridSize = 100;
      for (let wx = Math.floor(visX0 / gridSize) * gridSize; wx <= visX1; wx += gridSize) {
        ctx.moveTo(wx - cx, visY0 - cy);
        ctx.lineTo(wx - cx, visY1 - cy);
      }
      for (let wy = Math.floor(visY0 / gridSize) * gridSize; wy <= visY1; wy += gridSize) {
        ctx.moveTo(visX0 - cx, wy - cy);
        ctx.lineTo(visX1 - cx, wy - cy);
      }
      ctx.stroke();

      ctx.strokeStyle = "#FF0000";
      ctx.lineWidth = 5;
      ctx.strokeRect(0 - cx, 0 - cy, s.worldWidth, s.worldHeight);

      for (let i = s.footprints.length - 1; i >= 0; i--) {
        const fp = s.footprints[i];
        fp.life--;
        if (fp.life <= 0) { s.footprints.splice(i, 1); continue; }
        if (fp.x < visX0 || fp.x > visX1 || fp.y < visY0 || fp.y > visY1) continue;
        ctx.save();
        ctx.translate(fp.x - cx, fp.y - cy);
        ctx.rotate(fp.angle);
        ctx.fillStyle = `rgba(255,255,255,${fp.life / 200})`;
        ctx.beginPath();
        ctx.ellipse(0, -3, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, 3, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const obs of s.obstacles) {
        if (obs.x + obs.radius < visX0 || obs.x - obs.radius > visX1 || obs.y + obs.radius < visY0 || obs.y - obs.radius > visY1) continue;
        const dx = obs.x - cx;
        const dy = obs.y - cy;
        ctx.fillStyle = "rgba(0,0,30,0.15)";
        ctx.beginPath();
        ctx.ellipse(dx, dy + obs.radius / 2, obs.radius, obs.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        if (obs.type === "tree") {
          ctx.fillStyle = "#1e4620";
          ctx.beginPath();
          ctx.moveTo(dx, dy - 55);
          ctx.lineTo(dx + 25, dy + 10);
          ctx.lineTo(dx - 25, dy + 10);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.moveTo(dx, dy - 55);
          ctx.lineTo(dx + 8, dy - 40);
          ctx.lineTo(dx - 8, dy - 40);
          ctx.fill();
        } else if (obs.type === "snowman") {
          ctx.fillStyle = "#f0f9ff";
          ctx.beginPath();
          ctx.arc(dx, dy, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(dx, dy - 20, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#e74c3c";
          ctx.beginPath();
          ctx.arc(dx, dy - 22, 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "#78909c";
          ctx.beginPath();
          ctx.arc(dx, dy, 20, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const renderList = Array.from(s.players.values()).sort((a, b) => a.y - b.y);
      for (const p of renderList) {
        drawPlayer(ctx, p, cx, cy, s.id);
      }

      for (const b of s.snowballs) {
        const dx = b.x - cx;
        const dy = b.y - cy - b.z;
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.arc(b.x - cx, b.y - cy, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFF";
        ctx.beginPath();
        ctx.arc(dx, dy, b.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of s.particles) { p.update(); p.draw(ctx, cx, cy); }
      for (const p of s.popups) { p.update(); p.draw(ctx, cx, cy); }

      ctx.restore();
    }

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [inGame]);

  function drawPlayer(
    ctx: CanvasRenderingContext2D,
    p: ServerPlayer,
    camX: number,
    camY: number,
    myId: string
  ) {
    const drawX = p.x - camX;
    const drawY = p.y - camY;
    const speed = Math.hypot(p.vx, p.vy);
    const walkCycle = speed > 0.5 ? Date.now() / 100 : 0;
    const bob = Math.sin(walkCycle * 2) * 2;
    const scale = p.gatherProgress > 0 ? 0.9 : 1;
    const teamColor = p.team === "blue" ? "#2196F3" : "#F44336";
    const teamColorDark = p.team === "blue" ? "#1976D2" : "#D32F2F";

    ctx.save();
    ctx.translate(drawX, drawY + bob);
    ctx.scale(scale, scale);

    if (p.isFrozen) {
      ctx.fillStyle = "rgba(179, 229, 252, 0.6)";
      ctx.fillRect(-16, -24, 32, 40);
      ctx.strokeStyle = "#FFF";
      ctx.strokeRect(-16, -24, 32, 40);
      ctx.fillStyle = teamColor;
      ctx.beginPath();
      ctx.arc(0, -10, 10, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const legOffset = Math.sin(walkCycle) * 6;
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.arc(-6, 8 + legOffset, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(6, 8 - legOffset, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = teamColor;
      ctx.beginPath();
      (ctx as any).roundRect(-12, -10, 24, 20, 8);
      ctx.fill();
      ctx.fillStyle = teamColorDark;
      ctx.fillRect(-2, -10, 4, 20);

      ctx.fillStyle = p.skinColor || "#ffdbac";
      ctx.beginPath();
      ctx.arc(0, -16, 9, 0, Math.PI * 2);
      ctx.fill();

      if (p.hatType === 1) {
        ctx.fillStyle = teamColorDark;
        ctx.beginPath();
        ctx.arc(0, -20, 9, Math.PI, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -24, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.hatType === 2) {
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -16, 9.5, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = "#FFF";
        ctx.beginPath();
        ctx.arc(-9, -16, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(9, -16, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.hatType === 3) {
        ctx.strokeStyle = teamColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -16, 10, 0, Math.PI * 2);
        ctx.stroke();
      }

      const facingAngle = Math.atan2(p.vy, p.vx);
      const eyeOffX = Math.cos(facingAngle) * 3;
      const eyeOffY = Math.sin(facingAngle) * 3;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(-2 + eyeOffX, -16 + eyeOffY, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(2 + eyeOffX, -16 + eyeOffY, 1.5, 0, Math.PI * 2);
      ctx.fill();

      const hx = Math.cos(facingAngle) * 10;
      const hy = Math.sin(facingAngle) * 10;

      if (p.hasBall) {
        ctx.fillStyle = "#FFF";
        ctx.beginPath();
        ctx.arc(hx, hy - 2, 5, 0, Math.PI * 2);
        ctx.fill();
        if (p.chargeLevel > 0) {
          ctx.strokeStyle = `rgba(255,255,255,${p.chargeLevel / 60})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(hx, hy - 2, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = teamColorDark;
        ctx.beginPath();
        ctx.arc(-10, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (p.id === myId) {
      ctx.fillStyle = "#FFD700";
      ctx.beginPath();
      ctx.moveTo(-5, -45);
      ctx.lineTo(5, -45);
      ctx.lineTo(0, -38);
      ctx.fill();
    }

    ctx.restore();
  }

  /* ---------------------------------------------------------------- */
  // Input Handling
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!inGame) return;
    const s = stateRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "w") s.inputs.moveY = -1;
      if (k === "s") s.inputs.moveY = 1;
      if (k === "a") s.inputs.moveX = -1;
      if (k === "d") s.inputs.moveX = 1;
      if (k === " ") s.inputs.dash = true;
      if (k === "f") s.inputs.throwStart = true;
      if (k === "g") s.inputs.gather = true;
      if (k === "1") setView(0);
      if (k === "2") setView(1);
      if (k === "3") setView(2);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "s") s.inputs.moveY = 0;
      if (k === "a" || k === "d") s.inputs.moveX = 0;
      if (k === " ") s.inputs.dash = false;
      if (k === "f") s.inputs.throwRelease = true;
      if (k === "g") s.inputs.gather = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      const p = s.players.get(s.id);
      if (!p) return;
      const zoom = VIEWS[s.viewIndex].zoom;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const px = vw / 2 + (p.x - s.camera.x - vw / 2) * zoom;
      const py = vh / 2 + (p.y - s.camera.y - vh / 2) * zoom;
      s.inputs.angle = Math.atan2(e.clientY - py, e.clientX - px);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) s.inputs.throwStart = true;
      if (e.button === 2) s.inputs.gather = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) s.inputs.throwRelease = true;
      if (e.button === 2) s.inputs.gather = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("contextmenu", (e) => e.preventDefault());

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [inGame]);

  /* ---------------------------------------------------------------- */
  // Touch / Joystick
  /* ---------------------------------------------------------------- */
  const joyOriginRef = useRef({ x: 0, y: 0 });
  const joyActiveRef = useRef(false);

  const handleJoyStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const zone = e.currentTarget as HTMLDivElement;
    const rect = zone.getBoundingClientRect();
    joyOriginRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    joyActiveRef.current = true;
    handleJoyMove(e);
  }, []);

  const handleJoyMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!joyActiveRef.current) return;
    e.preventDefault();
    const t = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    if (!t) return;
    const s = stateRef.current;
    let dx = (t as any).clientX - joyOriginRef.current.x;
    let dy = (t as any).clientY - joyOriginRef.current.y;
    const dist = Math.hypot(dx, dy);
    const max = 35;
    if (dist > max) { dx = (dx / dist) * max; dy = (dy / dist) * max; }
    s.inputs.moveX = dx / max;
    s.inputs.moveY = dy / max;
    if (dist > 5) s.inputs.angle = Math.atan2(s.inputs.moveY, s.inputs.moveX);
    const knob = document.getElementById("joystick-knob");
    if (knob) knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }, []);

  const handleJoyEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    joyActiveRef.current = false;
    const s = stateRef.current;
    s.inputs.moveX = 0;
    s.inputs.moveY = 0;
    const knob = document.getElementById("joystick-knob");
    if (knob) knob.style.transform = `translate(-50%, -50%)`;
  }, []);

  /* ---------------------------------------------------------------- */
  // UI Actions
  /* ---------------------------------------------------------------- */
  function joinGame() {
    audioRef.current.init();
    audioRef.current.sfx.ui();
    setMenuError("");
    if (showPartyInput && partyCode.trim()) {
      socketRef.current?.emit("join", {
        mode: "multi",
        blue: 5,
        red: 5,
        partyCode: partyCode.trim(),
      });
    } else {
      socketRef.current?.emit("join", { mode, blue: size[0], red: size[1] });
    }
  }

  function createParty() {
    audioRef.current.init();
    audioRef.current.sfx.ui();
    socketRef.current?.emit("createParty", { blue: size[0], red: size[1] });
  }

  function setView(i: number) {
    stateRef.current.viewIndex = Math.max(0, Math.min(i, VIEWS.length - 1));
  }

  function selectMode(m: "single" | "multi") {
    setMode(m);
    if (m === "multi" && size[0] === 30) setSize([1, 1]);
  }

  function selectSize(b: number, r: number) {
    setSize([b, r]);
  }

  function leaveGame() {
    socketRef.current?.disconnect();
    setInGame(false);
    setMatchEnd(null);
    window.location.reload();
  }

  /* ---------------------------------------------------------------- */
  // Render
  /* ---------------------------------------------------------------- */
  if (matchEnd) {
    const myStats = matchEnd.players.find((p) => p.id === stateRef.current.id);
    const isWin = matchEnd.winner === stateRef.current.players.get(stateRef.current.id)?.team;

    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
        <div className="bg-white/95 p-8 rounded-3xl shadow-2xl text-center max-w-md w-full mx-4">
          <h1 className={`text-4xl font-black mb-2 ${matchEnd.winner === "draw" ? "text-yellow-500" : isWin ? "text-green-500" : "text-red-500"}`}>
            {matchEnd.winner === "draw" ? "DRAW!" : isWin ? "VICTORY!" : "DEFEAT!"}
          </h1>
          <p className="text-slate-500 mb-4">
            Match duration: {Math.floor(matchEnd.duration / 60)}:{(matchEnd.duration % 60).toString().padStart(2, "0")}
          </p>
          {myStats && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-100 rounded-xl p-3">
                <div className="text-2xl font-black text-blue-600">{myStats.kills}</div>
                <div className="text-xs font-bold text-slate-500 uppercase">Kills</div>
              </div>
              <div className="bg-slate-100 rounded-xl p-3">
                <div className="text-2xl font-black text-red-600">{myStats.deaths}</div>
                <div className="text-xs font-bold text-slate-500 uppercase">Deaths</div>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setMatchEnd(null); setInGame(false); }} className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl hover:bg-blue-500">
              PLAY AGAIN
            </button>
            <button onClick={leaveGame} className="flex-1 bg-slate-200 text-slate-700 font-black py-3 rounded-xl hover:bg-slate-300">
              MENU
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!inGame) {
    return (
      <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center z-50">
        <div className="bg-white/95 p-8 rounded-3xl shadow-2xl text-center max-w-lg w-full mx-4 border border-white/50">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-400 mb-2">SNOWBRAWL</h1>
          <p className="text-slate-500 font-bold mb-6 tracking-widest text-xs uppercase">Multiplayer Edition</p>

          <div className="mb-6 flex flex-col items-center">
            {connected ? (
              <p className="text-green-500 font-bold">CONNECTED!</p>
            ) : (
              <>
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mb-2" />
                <p className="text-sm font-bold text-slate-400">CONNECTING TO SERVER...</p>
              </>
            )}
          </div>

          <div className="flex gap-2 mb-3">
            <button onClick={() => selectMode("single")} className={`flex-1 py-3 rounded-xl font-black transition-all ${mode === "single" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              Single Player
            </button>
            <button onClick={() => selectMode("multi")} className={`flex-1 py-3 rounded-xl font-black transition-all ${mode === "multi" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              Multiplayer
            </button>
          </div>

          <div className="flex gap-2 mb-3 flex-wrap">
            {[ [1,1], [1,5], [5,5], [10,10], [30,30] ].map(([b,r]) => (
              <button key={`${b}v${r}`} onClick={() => selectSize(b,r)} disabled={mode !== "single" && b === 30}
                className={`flex-1 min-w-[60px] py-2 rounded-xl font-black text-sm transition-all ${size[0]===b && size[1]===r ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"} ${mode !== "single" && b === 30 ? "opacity-35 cursor-not-allowed" : ""}`}>
                {b}v{r}
              </button>
            ))}
          </div>

          {mode === "multi" && (
            <div className="flex gap-2 mb-3">
              <button onClick={() => setShowPartyInput(!showPartyInput)} className="flex-1 py-2 rounded-xl font-black text-sm bg-purple-100 text-purple-700 hover:bg-purple-200">
                {showPartyInput ? "Hide Party Code" : "Join Party"}
              </button>
              <button onClick={createParty} className="flex-1 py-2 rounded-xl font-black text-sm bg-purple-600 text-white hover:bg-purple-500">
                Create Party
              </button>
            </div>
          )}

          {showPartyInput && (
            <input type="text" value={partyCode} onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
              placeholder="ENTER PARTY CODE" className="w-full mb-3 px-4 py-2 rounded-xl border-2 border-slate-200 font-black text-center uppercase" />
          )}

          {createdPartyCode && (
            <div className="mb-3 p-2 bg-green-100 rounded-xl">
              <p className="text-green-700 font-bold text-sm">Party Code: {createdPartyCode}</p>
            </div>
          )}

          {menuError && <p className="text-red-500 font-bold text-sm mb-3">{menuError}</p>}

          <button onClick={joinGame} disabled={!connected}
            className={`w-full font-black text-xl py-4 rounded-xl shadow-lg transition-all ${connected ? "bg-blue-600 text-white hover:bg-blue-500 hover:scale-105" : "bg-slate-300 text-white opacity-50 cursor-not-allowed"}`}>
            {connected ? "JOIN BATTLE" : "WAITING FOR SERVER..."}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#e3f2fd] touch-none select-none">
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* HUD */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-40">
        <div className="flex justify-between items-start w-full">
          <div className="bg-white/20 backdrop-blur-md border border-white/40 rounded-xl px-5 py-2 flex flex-col items-center min-w-[80px] transform -skew-x-[10deg]">
            <span className="text-[10px] uppercase font-black opacity-70 skew-x-[10deg] text-blue-600">Blue</span>
            <span className="text-3xl font-black skew-x-[10deg] text-blue-600">{scores.blue}</span>
          </div>

          <div className="bg-white/20 backdrop-blur-md border border-white/40 rounded-xl px-3 py-2 flex flex-col items-center gap-1">
            <span className="font-black text-xs text-slate-700">{matchBadge}</span>
            {timeRemaining !== null && (
              <span className={`font-black text-lg ${timeRemaining <= 30 ? "text-red-500" : "text-slate-800"}`}>
                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
              </span>
            )}
            <div className="flex gap-1">
              {VIEWS.map((v, i) => (
                <button key={v.name} onClick={() => setView(i)}
                  className={`pointer-events-auto text-[10px] font-black px-2 py-1 rounded-lg transition-all ${stateRef.current.viewIndex === i ? "bg-sky-500 text-white" : "bg-white/30 text-slate-700"}`}>
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/20 backdrop-blur-md border border-white/40 rounded-xl px-5 py-2 flex flex-col items-center min-w-[80px] transform -skew-x-[10deg]">
            <span className="text-[10px] uppercase font-black opacity-70 skew-x-[10deg] text-red-600">Red</span>
            <span className="text-3xl font-black skew-x-[10deg] text-red-600">{scores.red}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute inset-0 z-30 overflow-hidden pointer-events-none">
        <div className="absolute bottom-8 left-8 w-[140px] h-[140px] pointer-events-auto"
          onTouchStart={handleJoyStart} onTouchMove={handleJoyMove} onTouchEnd={handleJoyEnd}
          onMouseDown={handleJoyStart} onMouseMove={handleJoyMove} onMouseUp={handleJoyEnd} onMouseLeave={handleJoyEnd}>
          <div className="w-full h-full rounded-full border-2 border-white/30 bg-gradient-to-br from-white/10 to-transparent relative backdrop-blur-sm shadow-xl">
            <div id="joystick-knob" className="absolute w-12 h-12 bg-white rounded-full shadow-lg top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-slate-200 pointer-events-none" />
          </div>
        </div>

        <div className="absolute bottom-8 right-8 flex flex-col items-center gap-3 pointer-events-auto">
          <div className="flex gap-4 items-end">
            <button onTouchStart={(e) => { e.preventDefault(); stateRef.current.inputs.dash = true; }}
              onMouseDown={() => (stateRef.current.inputs.dash = true)}
              className="w-16 h-16 rounded-full bg-yellow-400/80 active:bg-yellow-500 shadow-lg flex items-center justify-center border-2 border-white/60 backdrop-blur-sm">
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>

            <button onTouchStart={(e) => { e.preventDefault(); stateRef.current.inputs.throwStart = true; }}
              onTouchEnd={(e) => { e.preventDefault(); stateRef.current.inputs.throwRelease = true; }}
              onMouseDown={() => (stateRef.current.inputs.throwStart = true)}
              onMouseUp={() => (stateRef.current.inputs.throwRelease = true)}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-600 active:from-red-600 shadow-xl flex items-center justify-center border-2 border-white/60 backdrop-blur-sm relative">
              <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth={2.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
            </button>
          </div>

          <button onTouchStart={(e) => { e.preventDefault(); stateRef.current.inputs.gather = true; }}
            onTouchEnd={(e) => { e.preventDefault(); stateRef.current.inputs.gather = false; }}
            onMouseDown={() => (stateRef.current.inputs.gather = true)}
            onMouseUp={() => (stateRef.current.inputs.gather = false)}
            className="w-16 h-16 rounded-full bg-blue-500/80 active:bg-blue-600 shadow-lg flex items-center justify-center border-2 border-white/60 backdrop-blur-sm">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeWidth={2.5} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
