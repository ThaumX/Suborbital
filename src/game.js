const STORAGE_KEY = "suborbital-total-saved";
const MAX_FRAME_TIME = 0.06;
const TARGET_FRAME_RATE = 60;
const GAMEPLAY_SPEED = 0.25;
const MIN_ORBIT_DECAY = 0.0009;
const ORBIT_DECAY_SCALE = 0.0014;
const ORBIT_DECAY_ROUND_SCALE_FACTOR = 6;
const BASE_ORBIT_SPEED_FACTOR = 2600;
const CENTRAL_GRAVITY_STRENGTH = 7000;
const ORB_FORCE_SCALE = 0.36;
const ORB_APPROACH_FORCE_SCALE = 0.98;
const ORB_DEPART_FORCE_SCALE = 0.8;
const ORB_FIELD_VISUAL_FORCE_THRESHOLD = 1.3;
const ORB_LIFETIME_SECONDS = 2;
const ORB_FADE_START_SECONDS = 1.5;
const ORB_MIN_STRENGTH_SCALE = 0.24;
const ORB_MIN_VISUAL_ALPHA = 0.26;
const ORB_WEAKEN_FLASH_SPEED = 0.028;
const ORB_WEAKEN_FLASH_INTENSITY = 0.34;
const ORB_BOUNDARY_PULSE_SCALE = 0.09;
const ORB_MAX_EFFECT_FORCE_THRESHOLD = 0.06;
const MAX_ACTIVE_ORBS = 3;
const SHAPE_SPIN_SCALE = 0.55;
const MIN_ORB_GRAVITY_DISTANCE_SQ = 460;
const SUN_PULSE_SPEED = 0.0024;
const SUN_PULSE_AMPLITUDE = 0.045;
const SHAPE_OFFSCREEN_ESCAPE_SECONDS = 2;
const SHAPE_SPAWN_RADIUS_MIN = 380;
const SHAPE_SPAWN_RADIUS_MAX = 650;
const GAME_WORLD_WIDTH = 1800;
const GAME_WORLD_HEIGHT = 1260;

const ORB_TYPES = [
  {
    id: "pulse",
    name: "Pulse Orb",
    description: "Balanced attractor that gently guides shapes into stable arcs.",
    unlockAt: 0,
    colorA: 0x3cf6ff,
    colorB: 0x9a8dff,
    size: 74,
    gravity: 22000,
    polarity: 1,
    swirl: 0,
    innerSides: 6,
    outerSides: 3,
  },
  {
    id: "nova",
    name: "Nova Orb",
    description: "Reversal field that pushes shapes away from itself.",
    unlockAt: 50,
    colorA: 0xff66f0,
    colorB: 0xffdd66,
    size: 98,
    gravity: 32000,
    forceScale: 0.28,
    lifespanSeconds: 1,
    polarity: -1,
    swirl: 0,
    innerSides: 5,
    outerSides: 8,
  },
  {
    id: "vortex",
    name: "Vortex Orb",
    description: "Twisting pull that bends paths with extra swirl.",
    unlockAt: 100,
    colorA: 0x5ffff5,
    colorB: 0x66a0ff,
    size: 84,
    gravity: 18500,
    polarity: 1,
    swirl: 12000,
    innerSides: 4,
    outerSides: 7,
  },
  {
    id: "surge",
    name: "Surge Orb",
    description: "Boost field that accelerates shapes without changing heading.",
    unlockAt: 150,
    colorA: 0x72f7ff,
    colorB: 0x9fffd0,
    size: 90,
    gravity: 28000,
    forceScale: 0.5,
    polarity: 1,
    swirl: 0,
    forceMode: "velocity-boost",
    innerSides: 10,
    outerSides: 5,
  },
  {
    id: "twist",
    name: "Twist Orb",
    description: "Strongly redirects travel toward nearest radial in-or-out heading.",
    unlockAt: 220,
    colorA: 0xffb86a,
    colorB: 0xff6f8f,
    size: 92,
    gravity: 9000,
    forceScale: 0.22,
    polarity: 1,
    swirl: 0,
    forceMode: "radial-align",
    alignStrength: 0.92,
    innerSides: 7,
    outerSides: 11,
  },
];

const SHAPE_STYLES = [
  { sides: 3, color: 0x4de5ff },
  { sides: 4, color: 0x7fffae },
  { sides: 5, color: 0xff79d8 },
  { sides: 6, color: 0xffb36b },
  { sides: 0, color: 0xd6a8ff },
];

const getStoredTotalSaved = () => {
  const raw = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) || "0", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
};

const saveTotalSaved = (value) => {
  window.localStorage.setItem(STORAGE_KEY, String(Math.max(0, Math.floor(value))));
};

const getUnlockedOrbs = (totalSaved) => ORB_TYPES.filter((orb) => totalSaved >= orb.unlockAt);

const resolveSelectedOrbId = (selectedOrbId, totalSaved) => {
  const unlocked = getUnlockedOrbs(totalSaved);
  if (unlocked.some((orb) => orb.id === selectedOrbId)) {
    return selectedOrbId;
  }
  return unlocked[0]?.id || ORB_TYPES[0].id;
};

const getOrbFieldRadius = (orb) => {
  const perOrbForceScale = orb.forceScale ?? 1;
  const effectiveGravity = orb.gravity * ORB_FORCE_SCALE * perOrbForceScale * ORB_APPROACH_FORCE_SCALE;
  const radiusFromForce = Math.sqrt(effectiveGravity / ORB_FIELD_VISUAL_FORCE_THRESHOLD);
  return Math.max(orb.size * 0.7, radiusFromForce);
};

const getOrbMaxEffectRadius = (orb) => {
  const perOrbForceScale = orb.forceScale ?? 1;
  const effectiveGravity = orb.gravity * ORB_FORCE_SCALE * perOrbForceScale * ORB_APPROACH_FORCE_SCALE;
  return Math.sqrt(effectiveGravity / ORB_MAX_EFFECT_FORCE_THRESHOLD);
};

const makePolyPoints = (sides, radius) => {
  const points = [];
  for (let i = 0; i < sides; i += 1) {
    const t = (Math.PI * 2 * i) / sides - Math.PI / 2;
    points.push(new Phaser.Math.Vector2(Math.cos(t) * radius, Math.sin(t) * radius));
  }
  return points;
};

const drawWireShape = (graphics, sides, radius, color, alpha = 1) => {
  graphics.clear();
  graphics.lineStyle(2, color, alpha);
  if (sides <= 2) {
    graphics.strokeCircle(0, 0, radius);
    return;
  }
  graphics.strokePoints(makePolyPoints(sides, radius), true, true);
};

const drawDottedCircle = (graphics, radius, color, alpha = 0.35, dotCount = 52, fillRatio = 0.55) => {
  graphics.clear();
  graphics.lineStyle(1.5, color, alpha);

  const step = (Math.PI * 2) / dotCount;
  for (let i = 0; i < dotCount; i += 1) {
    const start = i * step;
    const end = start + step * fillRatio;
    graphics.beginPath();
    graphics.moveTo(Math.cos(start) * radius, Math.sin(start) * radius);
    graphics.lineTo(Math.cos(end) * radius, Math.sin(end) * radius);
    graphics.strokePath();
  }
};

class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create() {
    const { width, height } = this.scale;
    const totalSaved = getStoredTotalSaved();
    const selectedOrb = resolveSelectedOrbId(this.registry.get("selectedOrb") || ORB_TYPES[0].id, totalSaved);
    this.registry.set("selectedOrb", selectedOrb);

    this.add
      .text(width / 2, 120, "SUBORBITAL", {
        fontSize: "70px",
        color: "#63f8ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setAlpha(0.95);

    this.add
      .text(width / 2, 200, "Neon Gravity Rescue", {
        fontSize: "24px",
        color: "#d7f7ff",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 265, `Total Shapes Saved: ${totalSaved}`, {
        fontSize: "28px",
        color: "#adffea",
      })
      .setOrigin(0.5);

    const orbName = ORB_TYPES.find((orb) => orb.id === selectedOrb)?.name || ORB_TYPES[0].name;

    this.add
      .text(width / 2, 315, `Selected Orb: ${orbName}`, {
        fontSize: "22px",
        color: "#b3c3ff",
      })
      .setOrigin(0.5);

    const start = this.add
      .text(width / 2, height - 170, "START", {
        fontSize: "42px",
        color: "#ffffff",
        backgroundColor: "#102947",
        padding: { x: 22, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    start.on("pointerover", () => start.setTint(0x79ffea));
    start.on("pointerout", () => start.clearTint());
    start.on("pointerdown", () => {
      this.scene.start("GameScene", {
        selectedOrb,
      });
    });

    const select = this.add
      .text(width / 2, height - 95, "ORB SELECT", {
        fontSize: "34px",
        color: "#ffffff",
        backgroundColor: "#2c174a",
        padding: { x: 18, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    select.on("pointerover", () => select.setTint(0xff7cf5));
    select.on("pointerout", () => select.clearTint());
    select.on("pointerdown", () => this.scene.start("OrbSelectScene"));
  }
}

class OrbSelectScene extends Phaser.Scene {
  constructor() {
    super("OrbSelectScene");
  }

  create() {
    const { width, height } = this.scale;
    const totalSaved = getStoredTotalSaved();
    const selectedOrb = resolveSelectedOrbId(this.registry.get("selectedOrb") || ORB_TYPES[0].id, totalSaved);

    this.add
      .text(width / 2, 74, "SELECT ORB", {
        fontSize: "48px",
        color: "#89ffff",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 114, `Unlocks from saved shapes: ${totalSaved}`, {
        fontSize: "22px",
        color: "#b3d4ff",
      })
      .setOrigin(0.5);

    ORB_TYPES.forEach((orb, index) => {
      const unlocked = totalSaved >= orb.unlockAt;
      const y = 200 + index * 168;
      const panelLeft = -320;
      const panelTop = -64;
      const panelWidth = 640;
      const panelHeight = 128;

      const panel = this.add.graphics({ x: width / 2, y });
      panel.lineStyle(2, unlocked ? orb.colorA : 0x404c6a, 0.95);
      panel.strokeRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, 16);

      const label = `${orb.name}  ·  ${unlocked ? "UNLOCKED" : `LOCKED (${orb.unlockAt})`}`;
      const text = this.add
        .text(width / 2 - 236, y - 26, label, {
          fontSize: "26px",
          color: unlocked ? "#eeffff" : "#7f8ca7",
        })
        .setOrigin(0, 0.5);

      this.add
        .text(width / 2 - 236, y + 8, `Size ${orb.size} | Strength ${Math.floor(orb.gravity / 1000)}`, {
          fontSize: "16px",
          color: unlocked ? "#a3ddff" : "#51617e",
        })
        .setOrigin(0, 0.5);

      this.add
        .text(width / 2 - 236, y + 34, orb.description, {
          fontSize: "15px",
          color: unlocked ? "#91c9ff" : "#4a5d78",
        })
        .setOrigin(0, 0.5);

      const preview = this.add.container(width / 2 + 228, y + 2);
      const outer = this.add.graphics();
      const inner = this.add.graphics();
      drawWireShape(outer, orb.outerSides, 30, orb.colorA, unlocked ? 1 : 0.35);
      drawWireShape(inner, orb.innerSides, 20, orb.colorB, unlocked ? 1 : 0.35);
      preview.add([outer, inner]);
      this.tweens.add({ targets: outer, angle: 360, duration: 3800, repeat: -1 });
      this.tweens.add({ targets: inner, angle: -360, duration: 2600, repeat: -1 });

      if (unlocked) {
        panel.setInteractive(new Phaser.Geom.Rectangle(panelLeft, panelTop, panelWidth, panelHeight), Phaser.Geom.Rectangle.Contains);
        panel.on("pointerdown", () => {
          this.registry.set("selectedOrb", orb.id);
          this.scene.start("MenuScene");
        });
        panel.on("pointerover", () => {
          panel.clear();
          panel.lineStyle(2, orb.colorB, 1);
          panel.strokeRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, 16);
          text.setTint(0x66ffea);
        });
        panel.on("pointerout", () => {
          panel.clear();
          panel.lineStyle(2, orb.colorA, 0.95);
          panel.strokeRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, 16);
          text.clearTint();
        });
      }

      if (selectedOrb === orb.id) {
        this.add
          .text(width / 2 + 100, y - 38, "SELECTED", {
            fontSize: "14px",
            color: "#65ffc8",
          })
          .setOrigin(0.5);
      }
    });

    const back = this.add
      .text(width / 2, height - 52, "BACK", {
        fontSize: "28px",
        color: "#ffffff",
        backgroundColor: "#132947",
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    back.on("pointerdown", () => this.scene.start("MenuScene"));
    back.on("pointerover", () => back.setTint(0x8fffe2));
    back.on("pointerout", () => back.clearTint());
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.shapeId = 0;
    this.playerOrbs = [];
  }

  init(data) {
    const totalSaved = getStoredTotalSaved();
    this.selectedOrbId = resolveSelectedOrbId(
      data.selectedOrb || this.registry.get("selectedOrb") || ORB_TYPES[0].id,
      totalSaved,
    );
  }

  create() {
    const { width, height } = this.scale;
    this.center = new Phaser.Math.Vector2(width / 2, height / 2);
    this.sunRadius = 34;
    this.round = 1;
    this.roundScore = 0;
    this.totalSaved = getStoredTotalSaved();
    this.destroyedCount = 0;
    this.shapeId = 0;
    this.activeShapes = [];
    this.playerOrbs = [];
    this.gameEnded = false;

    this.sunCore = this.add.graphics({ x: this.center.x, y: this.center.y });
    this.renderSun();

    this.hud = {
      round: this.add.text(20, 16, "", { fontSize: "22px", color: "#88ffff" }),
      score: this.add.text(20, 42, "", { fontSize: "22px", color: "#95ffc9" }),
      lost: this.add.text(20, 68, "", { fontSize: "22px", color: "#ff92a4" }),
      total: this.add.text(20, 94, "", { fontSize: "22px", color: "#b6c7ff" }),
      orbs: this.add.text(width - 20, 16, "", { fontSize: "14px", color: "#95c6ff" }).setOrigin(1, 0),
      help: this.add
        .text(width / 2, height - 18, "Click or tap to place orb gravity well", {
          fontSize: "18px",
          color: "#c2d8ff",
        })
        .setOrigin(0.5, 1),
    };

    this.input.on("pointerdown", (pointer) => this.placeOrb(pointer.x, pointer.y));

    this.startRound();
    this.updateHud();
  }

  renderSun() {
    this.sunCore.clear();
    this.sunCore.lineStyle(3, 0xffe88a, 0.9);
    this.sunCore.strokeCircle(0, 0, this.sunRadius + 12);
    this.sunCore.lineStyle(2, 0xffaa66, 0.95);
    this.sunCore.strokeCircle(0, 0, this.sunRadius + 5);
    this.sunCore.lineStyle(2, 0xff7e55, 1);
    this.sunCore.strokeCircle(0, 0, this.sunRadius - 2);
    this.sunCore.lineStyle(1, 0xfff3c7, 1);
    this.sunCore.strokeCircle(0, 0, this.sunRadius * 0.42);
  }

  placeOrb(x, y) {
    if (this.gameEnded) {
      return;
    }

    const safeMargin = this.sunRadius + 20;
    if (Phaser.Math.Distance.Between(x, y, this.center.x, this.center.y) < safeMargin) {
      return;
    }

    const orbType = ORB_TYPES.find((orb) => orb.id === this.selectedOrbId) || ORB_TYPES[0];
    const fieldRadius = getOrbFieldRadius(orbType);
    const maxEffectRadius = getOrbMaxEffectRadius(orbType);
    const container = this.add.container(x, y);
    const outer = this.add.graphics();
    const inner = this.add.graphics();
    const field = this.add.graphics();
    const maxEffectBoundary = this.add.graphics();

    drawWireShape(outer, orbType.outerSides, orbType.size * 0.26, orbType.colorA, 1);
    drawWireShape(inner, orbType.innerSides, orbType.size * 0.16, orbType.colorB, 1);

    field.lineStyle(1, orbType.colorA, 0.35);
    field.strokeCircle(0, 0, fieldRadius);
    drawDottedCircle(maxEffectBoundary, maxEffectRadius, orbType.colorB, 0.3);

    container.add([maxEffectBoundary, field, outer, inner]);

    const orb = {
      ...orbType,
      x,
      y,
      fieldRadius,
      maxEffectRadius,
      field,
      maxEffectBoundary,
      container,
      outer,
      inner,
      spawnedAtMs: this.time.now,
      strengthScale: 1,
    };

    this.playerOrbs.push(orb);
    while (this.playerOrbs.length > MAX_ACTIVE_ORBS) {
      const oldestOrb = this.playerOrbs.shift();
      oldestOrb?.container.destroy();
    }

    this.updateHud();
  }

  updatePlayerOrbsState() {
    if (!this.playerOrbs.length) {
      return;
    }

    let removedCount = 0;
    for (let i = this.playerOrbs.length - 1; i >= 0; i -= 1) {
      const orb = this.playerOrbs[i];
      const orbLifespanSeconds = orb.lifespanSeconds ?? ORB_LIFETIME_SECONDS;
      const fadeStartSeconds = Math.min(ORB_FADE_START_SECONDS, orbLifespanSeconds * 0.75);
      const ageSeconds = (this.time.now - orb.spawnedAtMs) / 1000;
      if (ageSeconds >= orbLifespanSeconds) {
        orb.container.destroy();
        this.playerOrbs.splice(i, 1);
        removedCount += 1;
        continue;
      }

      const fadeWindow = Math.max(0.0001, orbLifespanSeconds - fadeStartSeconds);
      const fadeProgress =
        ageSeconds <= fadeStartSeconds
          ? 0
          : Phaser.Math.Clamp((ageSeconds - fadeStartSeconds) / fadeWindow, 0, 1);

      orb.strengthScale = Phaser.Math.Linear(1, ORB_MIN_STRENGTH_SCALE, fadeProgress);

      const baseAlpha = Phaser.Math.Linear(1, ORB_MIN_VISUAL_ALPHA, fadeProgress);
      const flashWave = (Math.sin((this.time.now + i * 180) * ORB_WEAKEN_FLASH_SPEED) + 1) * 0.5;
      const flashAlpha = flashWave * ORB_WEAKEN_FLASH_INTENSITY * fadeProgress;
      orb.container.setAlpha(Math.min(1, baseAlpha + flashAlpha));

      const boundaryPulse =
        1 + Math.sin((this.time.now + i * 180) * ORB_WEAKEN_FLASH_SPEED * 0.75) * ORB_BOUNDARY_PULSE_SCALE * fadeProgress;
      orb.field.setScale(boundaryPulse);
    }

    if (removedCount > 0) {
      this.updateHud();
    }
  }

  startRound() {
    if (this.playerOrbs.length) {
      this.playerOrbs.forEach((orb) => orb.container.destroy());
      this.playerOrbs = [];
    }

    const count = this.round + 2;
    for (let i = 0; i < count; i += 1) {
      this.spawnShape();
    }
    this.updateHud();
  }

  spawnShape() {
    const style = Phaser.Utils.Array.GetRandom(SHAPE_STYLES);
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const spawnRadius = Phaser.Math.Between(SHAPE_SPAWN_RADIUS_MIN, SHAPE_SPAWN_RADIUS_MAX);
    const x = this.center.x + Math.cos(angle) * spawnRadius;
    const y = this.center.y + Math.sin(angle) * spawnRadius;
    const radialX = Math.cos(angle);
    const radialY = Math.sin(angle);
    const orbitDirection = Phaser.Math.RND.sign();
    const tangentX = -radialY * orbitDirection;
    const tangentY = radialX * orbitDirection;

    // Simplified circular orbit seed speed: v ≈ sqrt(GM / r).
    const baseSpeed = Math.sqrt(BASE_ORBIT_SPEED_FACTOR / spawnRadius);
    const tangentialSpeed = baseSpeed * Phaser.Math.FloatBetween(0.92, 1.06);
    const outwardDrift = baseSpeed * Phaser.Math.FloatBetween(0.14, 0.26);

    const shape = {
      id: this.shapeId++,
      x,
      y,
      vx: tangentX * tangentialSpeed + radialX * outwardDrift,
      vy: tangentY * tangentialSpeed + radialY * outwardDrift,
      size: Phaser.Math.Between(9, 16),
      style,
      spin: Phaser.Math.FloatBetween(-2.2, 2.2) * SHAPE_SPIN_SCALE,
      rotation: Phaser.Math.FloatBetween(0, Math.PI * 2),
      offScreenDuration: 0,
      gfx: this.add.graphics(),
    };

    this.activeShapes.push(shape);
    this.renderShape(shape);
  }

  renderShape(shape) {
    shape.gfx.clear();
    shape.gfx.lineStyle(2, shape.style.color, 0.95);
    if (shape.style.sides <= 2) {
      shape.gfx.strokeCircle(shape.x, shape.y, shape.size);
      return;
    }

    const points = makePolyPoints(shape.style.sides, shape.size).map((point) =>
      point.clone().rotate(shape.rotation).add(new Phaser.Math.Vector2(shape.x, shape.y)),
    );
    shape.gfx.strokePoints(points, true, true);
  }

  removeShape(shape) {
    shape.gfx.destroy();
    this.activeShapes = this.activeShapes.filter((item) => item.id !== shape.id);

    if (!this.activeShapes.length && !this.gameEnded) {
      this.time.delayedCall(650, () => {
        if (this.gameEnded) {
          return;
        }
        this.round += 1;
        this.startRound();
      });
    }
  }

  updateHud() {
    this.hud.round.setText(`Round: ${this.round}`);
    this.hud.score.setText(`Escaped: ${this.roundScore}`);
    this.hud.lost.setText(`Lost: ${this.destroyedCount}/3`);
    this.hud.total.setText(`Total saved: ${this.totalSaved}`);
    this.hud.orbs.setText(`Orbs: ${this.playerOrbs.length}/${MAX_ACTIVE_ORBS}`);
  }

  endGame() {
    this.gameEnded = true;
    if (this.playerOrbs.length) {
      this.playerOrbs.forEach((orb) => orb.container.destroy());
      this.playerOrbs = [];
      this.updateHud();
    }

    this.time.delayedCall(700, () => {
      this.scene.start("GameOverScene", {
        roundScore: this.roundScore,
        totalSaved: this.totalSaved,
        selectedOrb: this.selectedOrbId,
      });
    });
  }

  applyCentralGravity(shape, delta) {
    const dx = this.center.x - shape.x;
    const dy = this.center.y - shape.y;
    const r2 = Math.max(dx * dx + dy * dy, 280);
    const r = Math.sqrt(r2);
    const gravity = CENTRAL_GRAVITY_STRENGTH / r2;
    shape.vx += (dx / r) * gravity * delta;
    shape.vy += (dy / r) * gravity * delta;

    const decay = Math.max(MIN_ORBIT_DECAY, (ORBIT_DECAY_SCALE * this.round) / ORBIT_DECAY_ROUND_SCALE_FACTOR);
    shape.vx *= 1 - decay * delta;
    shape.vy *= 1 - decay * delta;
  }

  applyOrbGravity(shape, delta) {
    if (!this.playerOrbs.length) {
      return;
    }

    for (const orb of this.playerOrbs) {
      const dx = orb.x - shape.x;
      const dy = orb.y - shape.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > orb.maxEffectRadius) {
        continue;
      }

      const r2 = Math.max(dx * dx + dy * dy, MIN_ORB_GRAVITY_DISTANCE_SQ);
      const r = Math.sqrt(r2);
      const orbStrength = orb.strengthScale ?? 1;
      const perOrbForceScale = orb.forceScale ?? 1;

      if (orb.forceMode === "velocity-boost") {
        const speed = Math.sqrt(shape.vx * shape.vx + shape.vy * shape.vy);
        if (speed > 0.0001) {
          const boost = ((orb.gravity * ORB_FORCE_SCALE * perOrbForceScale * orbStrength) / r2) * delta;
          shape.vx += (shape.vx / speed) * boost;
          shape.vy += (shape.vy / speed) * boost;
        }
        continue;
      }

      if (orb.forceMode === "radial-align") {
        const towardX = dx / r;
        const towardY = dy / r;
        const speed = Math.sqrt(shape.vx * shape.vx + shape.vy * shape.vy);
        if (speed > 0.0001) {
          const headingX = shape.vx / speed;
          const headingY = shape.vy / speed;
          const headingDot = headingX * towardX + headingY * towardY;
          const targetSign = headingDot >= 0 ? 1 : -1;
          const targetX = towardX * targetSign;
          const targetY = towardY * targetSign;

          const weakPull = ((orb.gravity * ORB_FORCE_SCALE * perOrbForceScale * orbStrength) / r2) * delta;
          shape.vx += targetX * weakPull;
          shape.vy += targetY * weakPull;

          const adjustedSpeed = Math.sqrt(shape.vx * shape.vx + shape.vy * shape.vy);
          if (adjustedSpeed > 0.0001) {
            const adjustedDirX = shape.vx / adjustedSpeed;
            const adjustedDirY = shape.vy / adjustedSpeed;
            const alignStrength = Phaser.Math.Clamp((orb.alignStrength ?? 0.9) * delta, 0, 1);
            const blendedX = Phaser.Math.Linear(adjustedDirX, targetX, alignStrength);
            const blendedY = Phaser.Math.Linear(adjustedDirY, targetY, alignStrength);
            const blendLength = Math.sqrt(blendedX * blendedX + blendedY * blendedY);
            if (blendLength > 0.0001) {
              shape.vx = (blendedX / blendLength) * adjustedSpeed;
              shape.vy = (blendedY / blendLength) * adjustedSpeed;
            }
          }
        }
        continue;
      }

      const radialVelocity = (shape.vx * dx + shape.vy * dy) / r;
      const approachScale = radialVelocity >= 0 ? ORB_APPROACH_FORCE_SCALE : ORB_DEPART_FORCE_SCALE;
      const pull = ((orb.gravity * ORB_FORCE_SCALE * perOrbForceScale * approachScale * orbStrength) / r2) * orb.polarity;

      shape.vx += (dx / r) * pull * delta;
      shape.vy += (dy / r) * pull * delta;

      if (orb.swirl !== 0) {
        const swirl = ((orb.swirl * ORB_FORCE_SCALE * perOrbForceScale * orbStrength) / r2) * delta;
        shape.vx += (-dy / r) * swirl;
        shape.vy += (dx / r) * swirl;
      }
    }
  }

  update(_, deltaMs) {
    // Cap frame delta to avoid unstable jumps during lag spikes.
    const delta = Math.min(MAX_FRAME_TIME, deltaMs / 1000) * TARGET_FRAME_RATE;
    const visualDelta = delta / TARGET_FRAME_RATE;
    const physicsDelta = delta * GAMEPLAY_SPEED;

    this.sunCore.rotation += visualDelta * 0.35;
    const pulseWave = Math.sin(this.time.now * SUN_PULSE_SPEED);
    const pulseShape = Math.sign(pulseWave) * Math.pow(Math.abs(pulseWave), 1.9);
    const undertone = Math.sin(this.time.now * SUN_PULSE_SPEED * 0.5) * 0.22;
    const sunPulse = 1 + (pulseShape + undertone) * SUN_PULSE_AMPLITUDE;
    this.sunCore.setScale(sunPulse);

    this.updatePlayerOrbsState();

    for (const orb of this.playerOrbs) {
      orb.outer.rotation += visualDelta * 2.4;
      orb.inner.rotation -= visualDelta * 2.8;
    }

    for (const shape of [...this.activeShapes]) {
      this.applyCentralGravity(shape, physicsDelta);
      this.applyOrbGravity(shape, physicsDelta);

      shape.x += shape.vx * physicsDelta;
      shape.y += shape.vy * physicsDelta;
      shape.rotation += shape.spin * visualDelta;
      this.renderShape(shape);

      const fromCenter = Phaser.Math.Distance.Between(shape.x, shape.y, this.center.x, this.center.y);
      if (fromCenter <= this.sunRadius) {
        this.destroyedCount += 1;
        this.removeShape(shape);
        this.updateHud();
        if (this.destroyedCount >= 3 && !this.gameEnded) {
          this.endGame();
          return;
        }
        continue;
      }

      const isOffScreen =
        shape.x + shape.size < 0 ||
        shape.x - shape.size > this.scale.width ||
        shape.y + shape.size < 0 ||
        shape.y - shape.size > this.scale.height;

      if (isOffScreen) {
        shape.offScreenDuration += visualDelta;
      } else {
        shape.offScreenDuration = 0;
      }

      if (shape.offScreenDuration >= SHAPE_OFFSCREEN_ESCAPE_SECONDS) {
        this.roundScore += 1;
        this.totalSaved += 1;
        saveTotalSaved(this.totalSaved);
        this.removeShape(shape);
        this.updateHud();
      }
    }
  }
}

class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOverScene");
  }

  init(data) {
    this.roundScore = data.roundScore || 0;
    this.totalSaved = data.totalSaved || getStoredTotalSaved();
    this.selectedOrb = data.selectedOrb || ORB_TYPES[0].id;
  }

  create() {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, 170, "GAME OVER", {
        fontSize: "72px",
        color: "#ff8aa8",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 256, `Shapes escaped this run: ${this.roundScore}`, {
        fontSize: "30px",
        color: "#bcffe8",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 304, `Total saved: ${this.totalSaved}`, {
        fontSize: "30px",
        color: "#bcd2ff",
      })
      .setOrigin(0.5);

    const retry = this.add
      .text(width / 2, height - 145, "PLAY AGAIN", {
        fontSize: "38px",
        color: "#ffffff",
        backgroundColor: "#1a3555",
        padding: { x: 24, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    retry.on("pointerover", () => retry.setTint(0x81ffdf));
    retry.on("pointerout", () => retry.clearTint());
    retry.on("pointerdown", () =>
      this.scene.start("GameScene", {
        selectedOrb: this.selectedOrb,
      }),
    );

    const menu = this.add
      .text(width / 2, height - 76, "RETURN TO MENU", {
        fontSize: "30px",
        color: "#ffffff",
        backgroundColor: "#3a224f",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    menu.on("pointerover", () => menu.setTint(0xff9ff6));
    menu.on("pointerout", () => menu.clearTint());
    menu.on("pointerdown", () => this.scene.start("MenuScene"));
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  transparent: true,
  backgroundColor: 0x000000,
  width: GAME_WORLD_WIDTH,
  height: GAME_WORLD_HEIGHT,
  scene: [MenuScene, OrbSelectScene, GameScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

game.registry.set("selectedOrb", ORB_TYPES[0].id);
