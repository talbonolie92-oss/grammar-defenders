const LANES = 5;
const TILE_W = 108;
const TILE_H = 88;
const GRID_X = 72;
const GRID_Y = 86;
const GRID_W = TILE_W * 7;
const GRID_H = TILE_H * LANES;
import { QUESTIONS, BOSS_QUESTIONS } from "../data/questions.js";

export function createGameScene() {
  return class BattleScene extends Phaser.Scene {
    constructor() {
      super("BattleScene");
      this.energy = 100;
      this.baseHealth = 100;
      this.wave = 1;
      this.defenders = [];
      this.enemies = [];
      this.projectiles = [];
      this.selectedTile = null;
      this.questionIndex = 0;
      this.bossQuestionIndex = 0;
      this.questionActive = false;
      this.gameOver = false;
      this.spawnClock = 0;
      this.questionClock = 0;
      this.soundOn = false;
      this.battleStarted = false;
      this.questionIntervalSeconds = 45;
      this.difficulty = "normal";
      this.musicNodes = [];
      this.musicGain = null;
      this.musicChordIndex = 0;
      this.enemiesSpawnedThisWave = 0;
      this.enemiesPerWave = 8;
      this.waveActive = true;
      this.waveTransitioning = false;
      this.maxWaves = 10;
      const params = new URLSearchParams(window.location.search);
      const suppliedConfig = window.GRAMMAR_DEFENDERS_CONFIG || {};
      this.battleMode = suppliedConfig.mode || params.get("mode") || "fixed";
      this.endlessMode = this.battleMode === "endless";
      const requestedMinutes = Number(suppliedConfig.timeLimitMinutes || params.get("minutes") || 10);
      this.timeLimitMinutes = Phaser.Math.Clamp(Number.isFinite(requestedMinutes) ? requestedMinutes : 10, 1, 180);
      this.remainingSeconds = this.timeLimitMinutes * 60;
      this.elapsedSeconds = 0;
      this.kills = 0;
      this.selectedUnit = "sprout";
      this.unitCards = [...document.querySelectorAll("[data-unit]")];
      this.unitStats = {
        sprout: { name: "Grammar Sprout", cost: 25, damage: 1, cooldown: 1.2, range: 460, color: 0xffe58c, projectileSpeed: 330, radius: 7, symbol: "✦", body: 0x8de1a4, role: "Balanced" },
        archer: { name: "Rune Archer", cost: 50, damage: 1, cooldown: 0.62, range: 560, color: 0xffd27a, projectileSpeed: 470, radius: 5, symbol: "➶", body: 0xe8b96f, role: "Rapid fire" },
        guardian: { name: "Aegis Guardian", cost: 75, damage: 0, cooldown: 0, range: 0, color: 0x9fc8f4, projectileSpeed: 0, radius: 0, symbol: "⬟", body: 0x8da8c5, role: "Lane blocker", health: 38 },
        mage: { name: "Frost Mage", cost: 90, damage: 2, cooldown: 1.8, range: 440, color: 0x9deaff, projectileSpeed: 270, radius: 9, symbol: "❄", body: 0xb9a8f5, role: "Frost slow" },
        ember: { name: "Ember Mage", cost: 110, damage: 3, cooldown: 2.2, range: 430, color: 0xff925d, projectileSpeed: 250, radius: 12, symbol: "♨", body: 0xe67a4e, role: "Splash damage" },
        volt: { name: "Volt Beast", cost: 130, damage: 2, cooldown: 1.55, range: 510, color: 0xf2ed8b, projectileSpeed: 390, radius: 10, symbol: "ϟ", body: 0x77bad7, role: "Chain shock" },
        thorn: { name: "Thorn Dragon", cost: 150, damage: 4, cooldown: 2.3, range: 520, color: 0x9ce28c, projectileSpeed: 300, radius: 12, symbol: "♜", body: 0x56885d, role: "Heavy damage" },
        knight: { name: "Iron Knight", cost: 175, damage: 0, cooldown: 0, range: 0, color: 0xcbdcf0, projectileSpeed: 0, radius: 0, symbol: "⚔", body: 0x718aa8, role: "Heavy blocker", health: 70 },
        phoenix: { name: "Solar Phoenix", cost: 200, damage: 5, cooldown: 2.8, range: 540, color: 0xffc16d, projectileSpeed: 320, radius: 14, symbol: "♨", body: 0xe58b55, role: "Lane burst" },
        titan: { name: "Ancient Titan", cost: 250, damage: 0, cooldown: 0, range: 0, color: 0xd8c1ff, projectileSpeed: 0, radius: 0, symbol: "✹", body: 0x9a83c7, role: "Ultimate fortress", health: 130 }
      };
    }

    create() {
      this.drawWorld();
      this.createHud();
      this.input.on("pointerdown", pointer => this.handleBoardTap(pointer));
      this.events.on("shutdown", () => this.clearTimers());
      this.updateHud();
    }

    startBattle(config = {}) {
      if (this.battleStarted) return;
      this.battleMode = config.mode === "fixed" ? "fixed" : "endless";
      this.endlessMode = this.battleMode === "endless";
      this.timeLimitMinutes = Phaser.Math.Clamp(Number(config.timeLimitMinutes) || 10, 1, 180);
      this.remainingSeconds = this.timeLimitMinutes * 60;
      this.elapsedSeconds = 0;
      this.questionIntervalSeconds = Phaser.Math.Clamp(Number(config.questionIntervalSeconds) || 45, 15, 180);
      this.difficulty = ["easy", "normal", "hard"].includes(config.difficulty) ? config.difficulty : "normal";
      this.battleStarted = true;
      if (this.modeText) this.modeText.textContent = this.endlessMode ? "ENDLESS SURVIVAL" : "FIXED WAVES";
      this.message.textContent = this.endlessMode ? "Endless Survival begins! Defend the keep!" : "Fixed Waves begins! Clear every wave!";
      this.time.addEvent({ delay: 1000, loop: true, callback: () => this.regenerateEnergy() });
      this.spawnTimer = this.time.addEvent({ delay: 3200, loop: true, callback: () => this.spawnEnemy() });
      this.questionTimer = this.time.addEvent({ delay: this.questionIntervalSeconds * 1000, loop: true, callback: () => this.showQuestion(false) });
      this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickBattleClock() });
      this.updateHud();
    }

    drawWorld() {
      const g = this.add.graphics();
      // Distant twilight sky and layered mountain silhouettes.
      g.fillGradientStyle(0x142b43, 0x1d4050, 0x426b58, 0x315b4d, 1);
      g.fillRect(0, 0, 960, 540);
      g.fillStyle(0x9ac9a0, 0.12);
      g.fillCircle(770, 48, 58);
      g.fillStyle(0xd9efbb, 0.13);
      g.fillCircle(770, 48, 39);
      g.fillStyle(0x183c43, 0.48);
      g.fillTriangle(0, 150, 180, 42, 365, 150);
      g.fillTriangle(260, 150, 500, 30, 740, 150);
      g.fillTriangle(620, 150, 825, 55, 1020, 150);
      // Forest silhouettes behind the lanes.
      for (let i = 0; i < 20; i++) {
        const x = (i * 53) % 950;
        const y = 62 + (i % 3) * 19;
        g.fillStyle(i % 2 ? 0x173b3e : 0x204b45, 0.55);
        g.fillTriangle(x, y + 48, x + 17, y, x + 34, y + 48);
        g.fillRect(x + 13, y + 37, 8, 24);
      }
      // Stone-and-moss lane foundations.
      for (let lane = 0; lane < LANES; lane++) {
        const y = GRID_Y + lane * TILE_H;
        g.fillStyle(0x102b2c, 0.42);
        g.fillRoundedRect(GRID_X - 5, y + 4, GRID_W + 10, TILE_H, 9);
        g.fillStyle(lane % 2 ? 0x376b55 : 0x477b5d, 0.98);
        g.fillRoundedRect(GRID_X, y, GRID_W, TILE_H - 3, 8);
        g.lineStyle(2, 0xb4d89a, 0.22);
        g.strokeRoundedRect(GRID_X, y, GRID_W, TILE_H - 3, 8);
        g.fillStyle(0x1c4c43, 0.2);
        g.fillRect(GRID_X + 2, y + TILE_H - 13, GRID_W - 4, 9);
        for (let col = 0; col < 7; col++) {
          const x = GRID_X + col * TILE_W;
          g.lineStyle(1, 0xe1efbd, 0.18);
          g.strokeRoundedRect(x + 2, y + 2, TILE_W - 4, TILE_H - 7, 5);
          if ((lane + col) % 3 === 0) {
            g.fillStyle(0xc6e69a, 0.25);
            g.fillCircle(x + 21, y + 22, 2.5);
            g.fillCircle(x + 83, y + 61, 2);
            g.fillStyle(0x244d3e, 0.25);
            g.fillEllipse(x + 54, y + 70, 26, 5);
          }
          // Tiny rune stones give each tile a readable fantasy identity.
          if ((lane * 7 + col) % 5 === 0) {
            g.lineStyle(1, 0xe7d59a, 0.26);
            g.strokeCircle(x + 91, y + 17, 5);
            g.lineBetween(x + 91, y + 12, x + 91, y + 22);
          }
        }
      }
      // Keep: layered walls, roof, banner and glowing crystal.
      g.fillStyle(0x0c292b, 0.55); g.fillRoundedRect(13, GRID_Y + 61, 51, 365, 13);
      g.fillStyle(0x6fae87); g.fillRoundedRect(18, GRID_Y + 69, 42, 348, 10);
      g.fillStyle(0xb8e5a6); g.fillRoundedRect(23, GRID_Y + 78, 32, 330, 7);
      g.fillStyle(0x315d55); g.fillTriangle(12, GRID_Y + 77, 39, GRID_Y + 39, 66, GRID_Y + 77);
      g.fillStyle(0xf4dc8d); g.fillCircle(39, GRID_Y + 56, 8);
      // Dark gate: stone pillars and a glowing portal.
      g.fillStyle(0x182638); g.fillRoundedRect(850, GRID_Y + 60, 91, 365, 13);
      g.fillStyle(0x624d60); g.fillRoundedRect(858, GRID_Y + 72, 75, 340, 9);
      g.fillStyle(0x2b314b); g.fillRoundedRect(868, GRID_Y + 100, 55, 284, 24);
      g.fillStyle(0x9c5b87, 0.25); g.fillEllipse(895, GRID_Y + 242, 44, 260);
      g.lineStyle(3, 0xe08eb5, 0.75); g.strokeEllipse(895, GRID_Y + 242, 44, 260);
      for (let i = 0; i < LANES; i++) {
        this.add.text(39, GRID_Y + i * TILE_H + TILE_H / 2, String(i + 1), {
          fontFamily: "Nunito", fontSize: "15px", color: "#173f38", fontStyle: "900"
        }).setOrigin(.5);
      }
      this.add.text(39, 55, "KEEP", { fontFamily: "Nunito", fontSize: "12px", color: "#e0ffe4", fontStyle: "900" }).setOrigin(.5);
      this.add.text(895, 55, "DARK GATE", { fontFamily: "Nunito", fontSize: "12px", color: "#ffe0ee", fontStyle: "900" }).setOrigin(.5);
      this.add.text(480, 27, "THE EMERALD FRONTIER", {
        fontFamily: "Nunito", fontSize: "16px", color: "#efffce", fontStyle: "900",
        stroke: "#173a3a", strokeThickness: 4
      }).setOrigin(.5);
      // Ambient drifting motes, deliberately few and lightweight.
      for (let i = 0; i < 12; i++) {
        const mote = this.add.circle(95 + i * 67, 58 + (i % 4) * 11, 1.8, 0xd9efaa, 0.5);
        this.tweens.add({ targets: mote, y: mote.y - 12, alpha: 0.12, duration: 2400 + i * 90, yoyo: true, repeat: -1, delay: i * 110 });
      }
    }

    createHud() {
      this.energyText = document.getElementById("energy-value");
      this.energyFill = document.getElementById("energy-fill");
      this.waveText = document.getElementById("wave-value");
      this.baseText = document.getElementById("base-value");
      this.timerText = document.getElementById("battle-time");
      this.modeText = document.getElementById("battle-mode");
      this.message = document.getElementById("battle-message");
      if (this.modeText) this.modeText.textContent = this.endlessMode ? "ENDLESS SURVIVAL" : "FIXED WAVES";
      this.unitCards.forEach(card => {
        card.addEventListener("click", () => {
          if (card.disabled) return;
          this.selectedUnit = card.dataset.unit;
          this.unitCards.forEach(c => c.classList.toggle("selected", c === card));
          this.message.textContent = this.unitStats[this.selectedUnit].name + " selected. Choose a tile.";
        });
      });
      document.getElementById("restart-button").addEventListener("click", () => window.location.reload());
      document.getElementById("sound-toggle").addEventListener("click", e => {
        this.soundOn = !this.soundOn;
        if (this.soundOn && !this.audioContext) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) this.audioContext = new AudioContextClass();
        }
        if (this.audioContext && this.audioContext.state === "suspended") this.audioContext.resume().catch(() => {});
        e.currentTarget.textContent = this.soundOn ? "♫ Sound: On" : "♫ Sound: Off";
        this.message.textContent = this.soundOn ? "Battle sounds enabled." : "Battle sounds muted.";
        if (this.soundOn) { this.startMusic(); this.playSound("deploy"); }
        else this.stopMusic();
      });
    }

    handleBoardTap(pointer) {
      if (!this.battleStarted || this.gameOver || this.questionActive || pointer.x < GRID_X || pointer.x >= GRID_X + GRID_W || pointer.y < GRID_Y || pointer.y >= GRID_Y + GRID_H) return;
      const col = Math.floor((pointer.x - GRID_X) / TILE_W);
      const lane = Math.floor((pointer.y - GRID_Y) / TILE_H);
      if (this.defenders.some(d => d.lane === lane && d.col === col)) return;
      const stats = this.unitStats[this.selectedUnit];
      if (this.energy < stats.cost) { this.message.textContent = "Not enough energy for " + stats.name + "."; return; }
      this.energy -= stats.cost;
      this.deployDefender(lane, col, this.selectedUnit);
      this.updateHud();
    }

    deployDefender(lane, col, unitType = "sprout") {
      const stats = this.unitStats[unitType] || this.unitStats.sprout;
      const x = GRID_X + col * TILE_W + TILE_W / 2;
      const y = GRID_Y + lane * TILE_H + TILE_H / 2;
      const group = this.add.container(x, y);
      const shadow = this.add.ellipse(0, 27, 60, 14, 0x10251d, .38);
      const aura = this.add.circle(0, 0, 31, stats.body, .12).setStrokeStyle(2, stats.color, .45);
      const parts = [shadow, aura];
      let legs = [];

      if (unitType === "archer") {
        // Hooded woodland ranger with a visible bow, quiver and leather armor.
        legs = [this.add.rectangle(-8, 14, 8, 15, 0x493d35), this.add.rectangle(8, 14, 8, 15, 0x493d35)];
        const torso = this.add.triangle(0, 2, -17, -17, 17, -17, 0, 23, 0x547d54).setStrokeStyle(2, 0x304c3b);
        const head = this.add.circle(0, -21, 11, 0xe8b58d).setStrokeStyle(2, 0x76513e);
        const hood = this.add.triangle(0, -29, -14, 16, 14, 16, 0, 0x6c5038).setStrokeStyle(2, 0x3d342b);
        const hair = this.add.ellipse(-2, -26, 22, 9, 0x513b2c);
        const face = this.add.rectangle(4, -20, 2, 3, 0x24303b);
        const bow = this.add.arc(18, -5, 25, 250, 110, false, 0xe5bd75).setStrokeStyle(4, 0x704b2d);
        const string = this.add.line(18, -29, 0, 0, 0, 0, 0xffedc3).setLineWidth(1.5);
        const quiver = this.add.rectangle(-15, -7, 8, 25, 0x704b35).setRotation(-.35);
        const arrow = this.add.line(-15, -24, 0, 0, 0, 13, 0xffe4a5).setLineWidth(2);
        parts.push(...legs, torso, head, hood, hair, face, quiver, arrow, bow, string);
      } else if (unitType === "mage") {
        // Robed ice mage with a tall hood and a crystal-tipped staff.
        legs = [this.add.ellipse(-8, 17, 12, 7, 0x313b63), this.add.ellipse(8, 17, 12, 7, 0x313b63)];
        const torso = this.add.triangle(0, 2, -17, -15, 17, -15, 0, 24, 0x6d6eae).setStrokeStyle(2, 0x3e477c);
        const head = this.add.circle(0, -20, 10, 0xe9c4ae).setStrokeStyle(2, 0x66557e);
        const hood = this.add.triangle(0, -30, -15, 19, 15, 19, 0, 0x4e568d).setStrokeStyle(2, 0xc7c9ff);
        const face = this.add.rectangle(4, -20, 2, 3, 0x25324b);
        const staff = this.add.rectangle(20, -2, 4, 52, 0x765b48).setRotation(-.12);
        const crystal = this.add.triangle(20, -31, -8, 9, 8, 9, 0, 0x9df5ff).setStrokeStyle(2, 0xf2ffff);
        const cape = this.add.triangle(-2, 8, -13, -12, 14, -12, 0, 27, 0x444d8e);
        parts.push(...legs, cape, torso, head, hood, face, staff, crystal);
      } else if (stats.health) {
        // Armored lane guardian with a broad shield held forward.
        legs = [this.add.rectangle(-8, 16, 10, 14, 0x46556b), this.add.rectangle(8, 16, 10, 14, 0x46556b)];
        const torso = this.add.rectangle(0, 1, 31, 29, 0x718ba8).setStrokeStyle(3, 0x354d6b);
        const head = this.add.circle(0, -20, 11, 0xd9b49a).setStrokeStyle(2, 0x586c84);
        const helmet = this.add.rectangle(0, -25, 24, 10, 0xb8c9dc).setStrokeStyle(2, 0x526b87);
        const crest = this.add.triangle(0, -35, -5, 10, 5, 10, 0, 0xd7e9fa);
        const visor = this.add.rectangle(0, -19, 16, 4, 0x344960);
        const shield = this.add.polygon(-21, 1, [-13,-22, 13,-22, 18,-4, 0,24, -18,-4], 0x527ba8).setStrokeStyle(3, 0xd5e8ff);
        const shieldMark = this.add.text(-21, 0, "✦", { fontSize: "17px", color: "#fff0bf", fontStyle: "bold" }).setOrigin(.5);
        const sword = this.add.rectangle(20, -8, 4, 29, 0xdce9f5).setRotation(.25);
        parts.push(...legs, torso, head, helmet, crest, visor, shield, shieldMark, sword);
      } else {
        if (unitType === "sprout") {
          legs = [this.add.ellipse(-8, 16, 12, 7, 0x315d45), this.add.ellipse(8, 16, 12, 7, 0x315d45)];
          const body = this.add.circle(0, 0, 21, stats.body).setStrokeStyle(3, 0x2b7957);
          const leafL = this.add.ellipse(-14, -22, 17, 28, 0x4baf77).setRotation(-.65);
          const leafR = this.add.ellipse(14, -22, 17, 28, 0x5fc98a).setRotation(.65);
          const eyes = [this.add.circle(-7, -3, 2.5, 0x20343b), this.add.circle(7, -3, 2.5, 0x20343b)];
          const smile = this.add.arc(0, 4, 7, 15, 165, false, 0x28463c, 0).setStrokeStyle(1.5, 0x28463c);
          parts.push(...legs, leafL, leafR, body, ...eyes, smile);
        } else {
          // Elite heroes use distinct silhouettes, armor, horns, and magical crests.
          legs = [this.add.rectangle(-9, 16, 9, 14, 0x263748), this.add.rectangle(9, 16, 9, 14, 0x263748)];
          const torso = this.add.triangle(0, 2, -18, -15, 18, -15, 0, 24, stats.body).setStrokeStyle(3, 0x28354a);
          const head = this.add.circle(0, -20, 11, 0xe6b997).setStrokeStyle(2, 0x493c3b);
          const brow = this.add.rectangle(0, -23, 20, 4, 0x352b37);
          const eyes = [this.add.circle(-5, -19, 2.5, 0xfff3d2), this.add.circle(5, -19, 2.5, 0xfff3d2)];
          const crest = this.add.star(0, -38, unitType === "titan" ? 8 : 5, 7, unitType === "titan" ? 23 : 15, stats.color).setStrokeStyle(2, 0xfff4d4);
          const leftHorn = this.add.triangle(-14, -28, -7, 15, 7, 15, 0, stats.color);
          const rightHorn = this.add.triangle(14, -28, -7, 15, 7, 15, 0, stats.color);
          const weapon = this.add.rectangle(23, 0, unitType === "thorn" ? 9 : 5, 44, stats.color).setRotation(-.2);
          const glow = this.add.circle(0, 0, unitType === "phoenix" || unitType === "titan" ? 32 : 25, stats.color, .18).setStrokeStyle(2, stats.color, .5);
          parts.push(...legs, glow, torso, head, brow, ...eyes, crest, leftHorn, rightHorn, weapon);
        }
      }

      group.add(parts);
      this.tweens.add({ targets: group, scale: { from: .25, to: 1 }, duration: 320, ease: "Back.Out" });
      this.tweens.add({ targets: aura, alpha: .035, scale: 1.12, duration: 1450, yoyo: true, repeat: -1 });
      if (!stats.health) this.tweens.add({ targets: group, y: y - 3, duration: 1250 + col * 30, yoyo: true, repeat: -1, ease: "Sine.InOut" });

      let healthBar = null;
      if (stats.health) {
        healthBar = this.add.graphics();
        group.add(healthBar);
        this.drawGuardianHealth(healthBar, stats.health, stats.health);
      }
      this.defenders.push({
        lane, col, x, y, group, cooldown: Phaser.Math.FloatBetween(0, .35),
        unitType, stats, hp: stats.health || 0, maxHp: stats.health || 0,
        healthBar, attackCooldown: 0, legs
      });
      this.message.textContent = stats.name + " deployed!";
      this.playSound("deploy");
    }

    drawGuardianHealth(graphics, hp, maxHp) {
      graphics.clear();
      const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
      graphics.fillStyle(0x26344a, .95);
      graphics.fillRoundedRect(-22, -39, 44, 6, 3);
      graphics.fillStyle(ratio > .4 ? 0x83e39a : 0xe58b8b, 1);
      graphics.fillRoundedRect(-21, -38, 42 * ratio, 4, 2);
    }

    playSound(kind) {
      if (!this.soundOn || !this.audioContext) return;
      const presets = {
        deploy: [420, 660, 0.09, "sine"],
        shot: [520, 380, 0.045, "triangle"],
        hit: [190, 115, 0.07, "square"],
        defeat: [260, 90, 0.16, "sawtooth"],
        correct: [520, 880, 0.2, "sine"],
        boss: [110, 65, 0.42, "sawtooth"],
        wave: [360, 560, 0.22, "triangle"],
        victory: [520, 1040, 0.5, "sine"]
      };
      if (kind === "shot") {
        const stamp = performance.now();
        if (stamp - (this.lastShotSoundAt || 0) < 110) return;
        this.lastShotSoundAt = stamp;
      }
      const [startHz, endHz, duration, type] = presets[kind] || presets.hit;
      const now = this.audioContext.currentTime;
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(startHz, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.075, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    }

    startMusic() {
      if (!this.audioContext || this.musicGain) return;
      const ctx = this.audioContext;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 1.2);
      master.connect(ctx.destination);
      this.musicGain = master;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1100;
      filter.connect(master);
      const notes = [110, 164.81, 220];
      this.musicNodes = notes.map((hz, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = index === 0 ? "sine" : "triangle";
        osc.frequency.value = hz;
        gain.gain.value = index === 0 ? 0.34 : 0.12;
        osc.connect(gain);
        gain.connect(filter);
        osc.start();
        return osc;
      });
      const chords = [
        [110, 164.81, 220], [98, 146.83, 196],
        [130.81, 196, 261.63], [87.31, 130.81, 174.61]
      ];
      this.musicEvent = this.time.addEvent({
        delay: 5200, loop: true, callback: () => {
          this.musicChordIndex = (this.musicChordIndex + 1) % chords.length;
          const chord = chords[this.musicChordIndex];
          this.musicNodes.forEach((osc, i) => osc.frequency.setTargetAtTime(chord[i], ctx.currentTime, 1.1));
        }
      });
    }

    stopMusic() {
      if (this.musicEvent) { this.musicEvent.remove(false); this.musicEvent = null; }
      if (this.musicGain && this.audioContext) {
        try {
          this.musicGain.gain.setTargetAtTime(0.0001, this.audioContext.currentTime, 0.18);
          this.musicNodes.forEach(osc => { try { osc.stop(this.audioContext.currentTime + 0.7); } catch (_) {} });
        } catch (_) {}
      }
      this.musicNodes = [];
      this.musicGain = null;
    }

    spawnEnemy() {
      if (this.gameOver || !this.waveActive || this.enemiesSpawnedThisWave >= this.enemiesPerWave) return;
      if (this.enemies.length >= 14) return;

      const lane = Phaser.Math.Between(0, LANES - 1);
      const x = GRID_X + GRID_W + 25;
      const y = GRID_Y + lane * TILE_H + TILE_H / 2;
      const enemyRoster = ["Grunt", "Runner", "Brute", "Shadow Stalker", "Bone Warrior", "Venom Beast", "Dark Caster", "War Crusher", "Dread Beast", "Dark Overlord"];
      const enemyIndex = Math.min(9, this.wave - 1);
      const type = enemyIndex % 3;
      const isBoss = this.enemiesSpawnedThisWave === this.enemiesPerWave - 1 && this.wave % 5 === 0;
      const enemyType = isBoss ? "Dark Overlord" : enemyRoster[enemyIndex];
      const palettes = [
        { body: 0xb94f54, dark: 0x542b3b, light: 0xf18a83, eye: 0xffd6bd },
        { body: 0x6555a8, dark: 0x302b62, light: 0xb9a8ff, eye: 0xf5eaff },
        { body: 0x9a673c, dark: 0x493024, light: 0xe9b66e, eye: 0xffe2a8 },
        { body: 0x4f657e, dark: 0x202d44, light: 0xa8c7e8, eye: 0xe8f6ff },
        { body: 0x9b9ca8, dark: 0x454958, light: 0xe0e2e9, eye: 0xffffff },
        { body: 0x4e916e, dark: 0x1d493c, light: 0xa5e17d, eye: 0xf4ffbd },
        { body: 0x66508f, dark: 0x302449, light: 0xc3a3f4, eye: 0xf7e3ff },
        { body: 0x786c62, dark: 0x39312e, light: 0xd5c0a7, eye: 0xffe8cf },
        { body: 0x8d3f57, dark: 0x421c3b, light: 0xf08ba7, eye: 0xffd8e4 },
        { body: 0x7e294e, dark: 0x29172f, light: 0xf1a0c4, eye: 0xffffff }
      ];
      const palette = palettes[isBoss ? 9 : enemyIndex];
      const radius = isBoss ? 31 : [23, 19, 27][type];
      const group = this.add.container(x, y);
      const shadow = this.add.ellipse(0, 25, isBoss ? 78 : radius * 2.3, 13, 0x10251d, .38);
      const aura = this.add.circle(0, 0, isBoss ? 42 : radius + 5, isBoss ? 0xe15a91 : palette.light, isBoss ? .13 : .07);
      const frostRing = this.add.circle(0, 0, radius + 9, 0x9deaff, 0).setStrokeStyle(2, 0xc7f6ff, .9).setVisible(false);
      const body = this.add.circle(0, 0, radius, isBoss ? 0x9f4264 : palette.body)
        .setStrokeStyle(isBoss ? 4 : 3, isBoss ? 0xf0a0c3 : palette.dark);
      const belly = this.add.ellipse(-2, 10, radius * 1.25, radius * .72, palette.dark, .34);
      const eyeY = -4;
      const eyes = this.add.text(0, eyeY, isBoss ? "◆◆" : type === 0 ? "××" : type === 1 ? "◥◤" : "▰", {
        fontFamily: "Arial", fontSize: isBoss ? "21px" : "17px", color: "#fff"
      }).setOrigin(.5);
      const feet = [
        this.add.ellipse(-radius * .48, radius * .83, 14, 9, palette.dark),
        this.add.ellipse(radius * .48, radius * .83, 14, 9, palette.dark)
      ];
      const details = [];
      if (type === 0) {
        // Grunt: battered helmet and small shoulder plates.
        details.push(this.add.arc(0, -10, radius * .8, 205, 335, false, palette.light, 0).setStrokeStyle(4, palette.dark));
        details.push(this.add.circle(-radius * .82, 5, 7, palette.light).setStrokeStyle(2, palette.dark));
        details.push(this.add.circle(radius * .82, 5, 7, palette.light).setStrokeStyle(2, palette.dark));
      } else if (type === 1) {
        // Runner: swept-back horns and a light, aerodynamic silhouette.
        details.push(this.add.triangle(-10, -radius + 2, -7, 12, 8, 7, -2, palette.light));
        details.push(this.add.triangle(9, -radius + 2, -8, 7, 8, 12, 2, palette.light));
        details.push(this.add.line(-radius + 2, 8, -7, 0, 0, palette.light).setLineWidth(3, 0.8));
      } else {
        // Brute: oversized shoulder armor and a heavy brow.
        details.push(this.add.ellipse(-radius * .83, -2, 19, 25, palette.dark).setStrokeStyle(2, palette.light));
        details.push(this.add.ellipse(radius * .83, -2, 19, 25, palette.dark).setStrokeStyle(2, palette.light));
        details.push(this.add.rectangle(0, -radius * .62, radius * 1.3, 7, palette.light, .9));
      }
      if (enemyType === "Shadow Stalker" || enemyType === "Dread Beast" || isBoss) {
        details.push(this.add.triangle(-radius * .62, -radius * .78, -5, 16, 8, 7, 0, palette.light).setStrokeStyle(2, palette.dark));
        details.push(this.add.triangle(radius * .62, -radius * .78, -8, 7, 5, 16, 0, palette.light).setStrokeStyle(2, palette.dark));
      }
      if (enemyType === "Bone Warrior" || enemyType === "War Crusher") {
        details.push(this.add.rectangle(0, 4, radius * 1.45, 12, palette.light).setStrokeStyle(2, palette.dark));
        details.push(this.add.circle(-radius * .8, 1, 8, palette.dark).setStrokeStyle(2, palette.light));
        details.push(this.add.circle(radius * .8, 1, 8, palette.dark).setStrokeStyle(2, palette.light));
      }
      if (enemyType === "Venom Beast") {
        details.push(this.add.circle(0, -radius * .78, 8, 0xb5f16c).setStrokeStyle(2, 0x315b3d));
        details.push(this.add.triangle(-radius * .7, -radius * .65, -7, 10, 7, 10, 0, 0xb5f16c));
        details.push(this.add.triangle(radius * .7, -radius * .65, -7, 10, 7, 10, 0, 0xb5f16c));
      }
      if (enemyType === "Dark Caster") {
        details.push(this.add.rectangle(radius * .8, -3, 5, radius * 2.1, 0x3c244f).setRotation(-.18));
        details.push(this.add.star(radius * .8, -radius * 1.25, 5, 4, 10, 0xc7a0ff).setStrokeStyle(2, 0xffffff));
      }
      if (enemyType === "War Crusher" || enemyType === "Dread Beast" || isBoss) {
        details.push(this.add.triangle(-radius * .9, 4, -7, 14, 7, 14, 0, 0xe7c4a3));
        details.push(this.add.triangle(radius * .9, 4, -7, 14, 7, 14, 0, 0xe7c4a3));
      }
      if (isBoss) {
        // Boss: crown, horns, glowing rune and a permanent aura.
        details.push(this.add.triangle(0, -radius - 13, -19, 17, 19, 17, 0, 0xf0d58b).setStrokeStyle(2, 0x75445f));
        details.push(this.add.triangle(-radius + 2, -radius * .55, -4, 13, 11, 7, 0, 0xead9ad));
        details.push(this.add.triangle(radius - 2, -radius * .55, -11, 7, 4, 13, 0, 0xead9ad));
        details.push(this.add.circle(0, -2, 7, 0xffc4e2).setStrokeStyle(2, 0xffffff));
      }
      group.add([shadow, aura, frostRing, feet[0], feet[1], belly, body, ...details, eyes]);

      const baseHp = (this.wave > 2 ? 3 + Math.floor((this.wave - 1) / 3) : 2);
      const enemyLevel = enemyRoster.indexOf(enemyType);
      const hpScale = [1, .8, 1.5, 1.2, 1.35, 1.25, 1.15, 1.8, 2.1, 3.2][Math.max(0, enemyLevel)];
      const hp = Math.max(1, Math.round((baseHp + [0, -1, 2][type]) * hpScale * (isBoss ? 5 : 1)));
      const barWidth = isBoss ? 70 : 46;
      const bar = this.add.graphics();
      bar.fillStyle(0x342d39); bar.fillRoundedRect(-barWidth / 2, isBoss ? -57 : -39, barWidth, 7, 3);
      bar.fillStyle(0x83e39a); bar.fillRoundedRect(-barWidth / 2 + 1, isBoss ? -56 : -38, barWidth - 2, 5, 2);
      group.add(bar);

      const speedFactor = [1, 1.65, 0.68, 1.35, .82, 1.05, .9, .62, .78, .55][Math.max(0, enemyLevel)];
      const enemy = {
        lane, x, y, baseY: y, group, hp, maxHp: hp,
        speed: isBoss ? 10 + this.wave * 0.6 : (17 + this.wave * 1.2) * speedFactor,
        bar, isBoss, enemyType, enemyLevel, phase: 1, body, aura, frostRing, feet,
        bobOffset: Phaser.Math.FloatBetween(0, Math.PI * 2)
      };
      this.enemies.push(enemy);
      this.enemiesSpawnedThisWave++;

      this.tweens.add({ targets: group, scale: { from: .72, to: 1 }, duration: isBoss ? 420 : 240, ease: "Back.Out" });
      this.tweens.add({ targets: aura, alpha: isBoss ? .05 : .02, scale: isBoss ? 1.15 : 1.08, duration: isBoss ? 650 : 1100, yoyo: true, repeat: -1 });
      if (isBoss) {
        this.message.textContent = "BOSS APPROACHING!";
        this.cameras.main.flash(180, 110, 35, 70, false);
        this.playSound("boss");
        this.time.delayedCall(900, () => this.showQuestion(true));
      } else {
        const portal = this.add.circle(x, y, 8, palette.light, .55);
        this.tweens.add({ targets: portal, scale: 2.7, alpha: 0, duration: 260, onComplete: () => portal.destroy() });
      }
    }

    checkWaveProgress() {
      if (this.gameOver || !this.waveActive || this.waveTransitioning) return;
      if (this.enemiesSpawnedThisWave < this.enemiesPerWave || this.enemies.length > 0) return;

      this.waveActive = false;
      this.waveTransitioning = true;
      this.spawnTimer.paused = true;
      if (!this.endlessMode && this.wave >= this.maxWaves) {
        this.endGame(true);
        return;
      }

      this.message.textContent = "Wave cleared! The next wave approaches...";
      this.playSound("wave");
      this.time.delayedCall(5000, () => {
        if (this.gameOver) return;
        this.wave++;
        this.enemiesSpawnedThisWave = 0;
        this.enemiesPerWave = Math.min(14, 8 + Math.floor((this.wave - 1) / 2));
        this.waveActive = true;
        this.waveTransitioning = false;
        this.spawnTimer.delay = Math.max(1100, 3200 - (this.wave - 1) * 120);
        this.spawnTimer.paused = false;
        this.message.textContent = "Wave " + this.wave + " — defend the keep!";
        this.playSound(this.wave % 5 === 0 ? "boss" : "wave");
        this.updateHud();
      });
    }

    regenerateEnergy() {
      if (this.gameOver || this.questionActive) return;
      this.energy = Math.min(150, this.energy + 8);
      this.updateHud();
    }

    update(time, delta) {
      if (!this.battleStarted || this.gameOver || this.questionActive) return;
      const dt = Math.min(delta / 1000, 0.05);
      this.defenders.forEach(d => {
        if (d.stats.health) return;
        d.cooldown -= dt;
        if (d.cooldown <= 0) {
          const target = this.enemies
            .filter(e => e.lane === d.lane && e.x > d.x && e.x - d.x < d.stats.range)
            .sort((a, b) => a.x - b.x)[0];
          if (target) { this.fireProjectile(d, target); d.cooldown = d.stats.cooldown; }
        }
      });
      this.projectiles.forEach(p => {
        if (!p.active) return;
        const dx = p.target.x - p.x, dy = p.target.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 13 || !p.target.group.active) {
          p.destroy(); p.active = false;
          if (p.target.group.active) {
            this.damageEnemy(p.target, p.damage);
            if (p.unitType === "mage" && p.target.group.active) {
              p.target.slowUntil = this.time.now + 3000;
              this.message.textContent = "Frost magic slows an enemy!";
            }
            if (p.unitType === "ember" || p.unitType === "phoenix") {
              const splashDamage = p.unitType === "phoenix" ? 3 : 1;
              this.enemies.slice().filter(e => e !== p.target && e.lane === p.target.lane && Math.abs(e.x - p.target.x) < 92)
                .forEach(e => this.damageEnemy(e, splashDamage));
            }
            if (p.unitType === "volt") {
              const chainTarget = this.enemies.filter(e => e !== p.target && e.lane === p.target.lane && Math.abs(e.x - p.target.x) < 145)
                .sort((a, b) => Math.abs(a.x - p.target.x) - Math.abs(b.x - p.target.x))[0];
              if (chainTarget) this.damageEnemy(chainTarget, 2);
            }
          }
        } else {
          p.x += dx / dist * p.projectileSpeed * dt; p.y += dy / dist * p.projectileSpeed * dt;
        }
      });
      this.enemies.slice().forEach(e => {
        const blocker = this.defenders.find(d => d.stats.health && d.lane === e.lane && d.hp > 0 && d.x < e.x && e.x - d.x < 42);
        if (blocker) {
          e.x = Math.max(e.x, blocker.x + 34);
          e.attackCooldown = (e.attackCooldown || 0) - dt;
          if (e.attackCooldown <= 0) {
            const hit = ["Brute", "War Crusher", "Dread Beast", "Dark Overlord"].includes(e.enemyType) ? 6 : e.enemyType === "Runner" || e.enemyType === "Shadow Stalker" ? 2 : e.enemyType === "Venom Beast" ? 4 : 3;
            blocker.hp -= hit;
            blocker.healthBar && this.drawGuardianHealth(blocker.healthBar, blocker.hp, blocker.maxHp);
            this.tweens.add({ targets: blocker.group, x: blocker.x - 3, yoyo: true, duration: 70 });
            e.attackCooldown = 0.85;
            if (blocker.hp <= 0) {
              this.tweens.add({ targets: blocker.group, alpha: 0, scale: .65, duration: 260, onComplete: () => blocker.group.destroy() });
              this.defenders = this.defenders.filter(d => d !== blocker);
              this.message.textContent = "Aegis Guardian has fallen! The lane is open.";
            }
          }
        } else {
          const slowed = e.slowUntil && this.time.now < e.slowUntil;
          e.x -= e.speed * (slowed ? 0.48 : 1) * dt;
        }
        e.group.x = e.x;
        e.group.y = e.baseY + Math.sin(this.time.now * 0.003 + e.bobOffset) * (e.isBoss ? 2.2 : 1.5);
        const frostActive = Boolean(e.slowUntil && this.time.now < e.slowUntil);
        if (e.frostRing) {
          e.frostRing.setVisible(frostActive);
          e.frostRing.setAlpha(frostActive ? .62 + Math.sin(this.time.now * .012) * .18 : 0);
          e.frostRing.rotation += dt * 0.7;
        }
        if (e.feet) {
          e.feet[0].rotation = Math.sin(this.time.now * 0.012 + e.bobOffset) * .22;
          e.feet[1].rotation = -Math.sin(this.time.now * 0.012 + e.bobOffset) * .22;
        }
        if (e.x < 65) this.damageBase(e);
      });
      this.projectiles = this.projectiles.filter(p => p.active);
      this.checkWaveProgress();
    }

    fireProjectile(defender, target) {
      const stats = defender.stats;
      const p = this.add.container(defender.x + 18, defender.y - 5);
      if (defender.unitType === "ember" || defender.unitType === "phoenix") {
        const glow = this.add.circle(0, 0, defender.unitType === "phoenix" ? 22 : 16, stats.color, .3);
        const core = this.add.star(0, 0, 6, 6, 13, stats.color).setStrokeStyle(2, 0xffefc4);
        p.add([glow, core]);
      } else if (defender.unitType === "volt") {
        const glow = this.add.circle(0, 0, 18, 0xf4ed8b, .25);
        const bolt = this.add.star(0, 0, 4, 4, 14, 0xf9f6bd).setStrokeStyle(2, 0xffffff);
        p.add([glow, bolt]);
      } else if (defender.unitType === "thorn") {
        const spike = this.add.triangle(0, 0, -12, 8, 12, 8, 0, -12, 0x9ce28c).setStrokeStyle(2, 0xe6ffd9);
        p.add([spike]);
      } else if (defender.unitType === "archer") {
        const shaft = this.add.rectangle(0, 0, 23, 3, 0xffe4a5);
        const tip = this.add.triangle(13, 0, -5, -5, -5, 5, 5, 0xfff4d0);
        const tail = this.add.triangle(-11, 0, 4, -5, 4, 5, -4, 0xd9e7f5);
        p.add([shaft, tip, tail]);
      } else if (defender.unitType === "mage") {
        const glow = this.add.circle(0, 0, 18, 0x9deaff, .2);
        const core = this.add.star(0, 0, 6, 5, 10, 0xb9f4ff).setStrokeStyle(2, 0xffffff);
        p.add([glow, core]);
      } else {
        const glow = this.add.circle(0, 0, 14, stats.color, .22);
        const core = this.add.circle(0, 0, 7, stats.color).setStrokeStyle(2, 0xfff8d8);
        p.add([glow, core]);
      }
      p.target = target;
      p.damage = stats.damage;
      p.projectileSpeed = stats.projectileSpeed;
      p.unitType = defender.unitType;
      this.projectiles.push(p);
      this.playSound("shot");
      this.tweens.add({
        targets: defender.group,
        scaleY: .94,
        angle: defender.unitType === "archer" ? 4 : -3,
        yoyo: true,
        duration: defender.unitType === "mage" ? 180 : 95
      });
      if (defender.legs && defender.legs.length) {
        this.tweens.add({ targets: defender.legs, y: "+=3", yoyo: true, duration: 90 });
      }
    }

    damageEnemy(enemy, amount) {
      if (!enemy.group.active) return;
      const appliedDamage = ["Brute", "Bone Warrior", "War Crusher"].includes(enemy.enemyType) && !enemy.isBoss ? Math.max(0.75, amount * (enemy.enemyType === "Bone Warrior" ? 0.65 : 0.75)) : amount;
      enemy.hp -= appliedDamage;
      if (enemy.isBoss) {
        const healthRatio = enemy.hp / enemy.maxHp;
        const nextPhase = healthRatio <= 0.25 ? 3 : healthRatio <= 0.6 ? 2 : 1;
        if (nextPhase > enemy.phase) {
          enemy.phase = nextPhase;
          enemy.speed = Math.min(enemy.speed * (nextPhase === 2 ? 1.2 : 1.3), 42);
          this.message.textContent = "BOSS PHASE " + nextPhase + "! The gatekeeper grows stronger!";
          this.playSound("boss");
          this.tweens.add({ targets: enemy.body, alpha: 0.45, yoyo: true, duration: 150, repeat: 2 });
        }
      }
      enemy.bar.clear();
      const barWidth = enemy.isBoss ? 64 : 46;
      const barY = enemy.isBoss ? -48 : -37;
      const ratio = Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
      enemy.bar.fillStyle(0x342d39);
      enemy.bar.fillRoundedRect(-barWidth / 2, barY, barWidth, 6, 3);
      enemy.bar.fillStyle(ratio > 0.45 ? 0x83e39a : 0xe58b8b);
      enemy.bar.fillRoundedRect(-barWidth / 2 + 1, barY + 1, Math.max(0, (barWidth - 2) * ratio), 4, 2);
      this.playSound("hit");
      enemy.group.setScale(1.12);
      this.tweens.add({ targets: enemy.group, scale: 1, duration: 120 });
      if (enemy.hp <= 0) {
        const burst = this.add.circle(enemy.x, enemy.y, 12, 0xffd58c, .8);
        this.tweens.add({ targets: burst, scale: 2.8, alpha: 0, duration: 260, onComplete: () => burst.destroy() });
        enemy.group.destroy();
        this.enemies = this.enemies.filter(e => e !== enemy);
        this.kills++;
        this.playSound("defeat");
        this.energy = Math.min(150, this.energy + (enemy.isBoss ? 25 : 8));
        this.updateHud();
      }
    }

    damageBase(enemy) {
      enemy.group.destroy();
      this.enemies = this.enemies.filter(e => e !== enemy);
      this.baseHealth = Math.max(0, this.baseHealth - 10);
      this.cameras.main.shake(130, 0.004);
      this.updateHud();
      if (this.baseHealth <= 0) this.endGame(false);
    }

    showQuestion(isBoss = false) {
      if (!this.battleStarted || this.gameOver || this.questionActive) return;
      this.questionActive = true;
      if (this.spawnTimer) this.spawnTimer.paused = true;
      if (this.questionTimer && isBoss) this.questionTimer.paused = true;
      let pool = isBoss ? BOSS_QUESTIONS : QUESTIONS;
      if (!isBoss && this.difficulty === "easy") pool = QUESTIONS.filter(q => q.grade === "7–9");
      if (!isBoss && this.difficulty === "hard") pool = QUESTIONS.filter(q => q.grade === "10–12");
      const item = pool[(isBoss ? this.bossQuestionIndex++ : this.questionIndex++) % pool.length];
      this.isBossQuestion = isBoss;
      const overlay = this.add.container(0, 0).setDepth(1000);
      this.questionOverlay = overlay;
      const shade = this.add.rectangle(480, 270, 960, 540, 0x071321, .82).setInteractive();
      const panel = this.add.rectangle(480, 270, 770, 410, isBoss ? 0x321d35 : 0x172d49, .99).setStrokeStyle(3, isBoss ? 0xf0a0c3 : 0x91d8c2);
      const topGlow = this.add.rectangle(480, 82, 760, 5, 0x91e5c2, .9);
      const eyebrow = this.add.text(480, 111, isBoss ? "☠  BOSS GRAMMAR TRIAL  ☠" : "✦  GRAMMAR CHALLENGE  ✦", {
        fontFamily: "Nunito", fontSize: "15px", color: "#a9f0cf", fontStyle: "900", letterSpacing: 2
      }).setOrigin(.5);
      const topic = this.add.text(480, 145, item.topic.toUpperCase(), {
        fontFamily: "Nunito", fontSize: "12px", color: "#ffd779", fontStyle: "900", letterSpacing: 1.4
      }).setOrigin(.5);
      const question = this.add.text(480, 198, item.q, {
        fontFamily: "Nunito", fontSize: "22px", color: "#ffffff", fontStyle: "900",
        align: "center", wordWrap: { width: 680 }, lineSpacing: 7
      }).setOrigin(.5);
      const instruction = this.add.text(480, 256, "Choose the correct answer to unleash a battle power", {
        fontFamily: "Nunito", fontSize: "12px", color: "#b6c8dc", fontStyle: "700"
      }).setOrigin(.5);
      overlay.add([shade, panel, topGlow, eyebrow, topic, question, instruction]);
      item.a.forEach((answer, index) => {
        const y = 312 + index * 58;
        const button = this.add.rectangle(480, y, 660, 48, 0x294969, 1).setStrokeStyle(2, 0x587d9b).setInteractive({ useHandCursor: true });
        const label = this.add.text(480, y, (index + 1) + ".  " + answer, {
          fontFamily: "Nunito", fontSize: "16px", color: "#ffffff", fontStyle: "900",
          align: "center", wordWrap: { width: 620 }
        }).setOrigin(.5);
        button.on("pointerover", () => button.setFillStyle(0x376477));
        button.on("pointerout", () => button.setFillStyle(0x294969));
        button.on("pointerdown", () => this.answerQuestion(index, item, button, label));
        overlay.add([button, label]);
      });
      this.tweens.add({ targets: overlay, alpha: { from: 0, to: 1 }, duration: 180, ease: "Quad.Out" });
      this.cameras.main.shake(100, .0015);
    }

    answerQuestion(index, item, button, label) {
      if (!this.questionActive) return;
      const correct = index === item.correct;
      if (correct) {
        button.setFillStyle(0x286c58);
        button.setStrokeStyle(2, 0x8ff0bd);
        label.setColor("#d8ffe9");
        this.message.textContent = item.effect + " Grammar power activated!";
        this.playSound("correct");
        this.applyGrammarPower(item.effect);
      } else {
        button.setFillStyle(0x713f50);
        button.setStrokeStyle(2, 0xf0a2a2);
        label.setColor("#ffe1e1");
        this.message.textContent = "Not quite! Your defenders keep fighting.";
      }
      const feedback = this.add.text(480, 492, correct ? "CORRECT! BATTLE POWER ACTIVATED" : "NOT QUITE — THE BATTLE CONTINUES", {
        fontFamily: "Nunito", fontSize: "13px", color: correct ? "#9cf0bf" : "#ffb4b4", fontStyle: "900", letterSpacing: 1
      }).setOrigin(.5);
      this.questionOverlay.add(feedback);
      this.time.delayedCall(1150, () => {
        if (this.questionOverlay) this.questionOverlay.destroy(true);
        this.questionOverlay = null;
        this.questionActive = false;
        this.isBossQuestion = false;
        if (!this.gameOver && this.spawnTimer) this.spawnTimer.paused = false;
        if (!this.gameOver && this.questionTimer) this.questionTimer.paused = false;
      });
    }

    applyGrammarPower(effect = "POWER SURGE!") {
      const label = String(effect).toUpperCase();
      let feedback = effect;
      let color = "#ffe58c";

      if (label.includes("FREEZE")) {
        this.enemies.forEach(enemy => {
          enemy.slowUntil = this.time.now + 3800;
          this.tweens.add({ targets: enemy.body, tint: 0x8feaff, duration: 180, yoyo: true, repeat: 2 });
        });
        feedback = "FREEZE BLAST! All enemies slowed.";
        color = "#9deaff";
      } else if (label.includes("REGENERATION") || label.includes("DEFENSE UP")) {
        const restored = Math.min(20, 100 - this.baseHealth);
        this.baseHealth += restored;
        this.energy = Math.min(150, this.energy + 12);
        feedback = restored > 0 ? "KEEP RESTORED +" + restored + "%!" : "DEFENSE SURGE! +12 ENERGY";
        color = "#8de1a4";
      } else if (label.includes("ARMOR BREAK") || label.includes("SHIELD PIERCE") || label.includes("WEAKNESS")) {
        const targets = this.enemies.slice().sort((a, b) => a.x - b.x).slice(0, 3);
        targets.forEach(enemy => this.damageEnemy(enemy, 3));
        feedback = "ARMOR SHATTER! Heavy damage to up to 3 enemies.";
        color = "#ffd27a";
      } else if (label.includes("CRITICAL") || label.includes("PRECISION") || label.includes("RAPID STRIKE") || label.includes("ECHO STRIKE")) {
        const target = this.enemies.slice().sort((a, b) => a.x - b.x)[0];
        if (target) this.damageEnemy(target, 5);
        this.energy = Math.min(150, this.energy + 8);
        feedback = target ? "CRITICAL STRIKE! 5 damage." : "CRITICAL STRIKE! +8 ENERGY";
        color = "#ffb3a8";
      } else if (label.includes("GUARDIAN SHIELD")) {
        const restored = Math.min(35, 100 - this.baseHealth);
        this.baseHealth += restored;
        this.energy = Math.min(150, this.energy + 20);
        feedback = "GUARDIAN SHIELD! Keep restored and +20 energy.";
        color = "#b9d8ff";
      } else if (label.includes("DRAGON FURY")) {
        this.enemies.slice().forEach(enemy => this.damageEnemy(enemy, 6));
        this.energy = Math.min(150, this.energy + 15);
        feedback = "DRAGON FURY! Heavy damage across the battlefield.";
        color = "#ffb27c";
      } else if (label.includes("SUPPLY") || label.includes("POWER SURGE") || label.includes("TEAM SURGE") || label.includes("TIME SURGE") || label.includes("FOCUS BONUS") || label.includes("DEADLINE DASH")) {
        this.energy = Math.min(150, this.energy + 30);
        feedback = "ENERGY SURGE! +30 ENERGY";
        color = "#ffe58c";
      } else {
        const targets = this.enemies.slice().sort((a, b) => a.x - b.x).slice(0, 3);
        targets.forEach(enemy => this.damageEnemy(enemy, 1));
        this.energy = Math.min(150, this.energy + 12);
        feedback = "GRAMMAR POWER! Damage dealt and +12 energy.";
      }

      this.updateHud();
      const flash = this.add.rectangle(480, 315, 720, 440, 0xffe58c, .12);
      this.tweens.add({ targets: flash, alpha: 0, duration: 420, onComplete: () => flash.destroy() });
      const toast = this.add.text(480, 66, feedback, {
        fontFamily: "Nunito", fontSize: "17px", color, fontStyle: "900",
        stroke: "#17233a", strokeThickness: 4, align: "center",
        wordWrap: { width: 680 }
      }).setOrigin(.5);
      this.tweens.add({
        targets: toast, y: 48, alpha: 0, duration: 1800, delay: 350,
        onComplete: () => toast.destroy()
      });
    }

    updateHud() {
      this.energyText.textContent = this.energy;
      this.energyFill.style.width = (this.energy / 150 * 100) + "%";
      this.unitCards.forEach(card => {
        const stats = this.unitStats[card.dataset.unit];
        if (stats) card.classList.toggle("unaffordable", this.energy < stats.cost);
      });
      this.waveText.textContent = this.wave;
      this.baseText.textContent = this.baseHealth + "%";
      if (this.timerText) {
        const seconds = this.remainingSeconds;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        this.timerText.textContent = String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
      }
    }

    tickBattleClock() {
      if (!this.battleStarted || this.gameOver || this.questionActive) return;
      {
        this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
        if (this.remainingSeconds === 0) {
          this.endGame(true, "TIME LIMIT REACHED!");
          return;
        }
      }
      this.updateHud();
    }

    endGame(won, customTitle = "") {
      this.gameOver = true;
      if (this.spawnTimer) this.spawnTimer.paused = true;
      if (this.questionTimer) this.questionTimer.paused = true;
      this.stopMusic();
      this.add.rectangle(480, 315, 960, 540, 0x081323, .76);
      this.add.text(480, 260, customTitle || (won ? "THE KEEP IS SAFE!" : "THE KEEP HAS FALLEN"), { fontFamily: "Nunito", fontSize: "34px", color: "#fff1c5", fontStyle: "900" }).setOrigin(.5);
      this.add.text(480, 315, "Press Restart to defend the frontier again.", { fontFamily: "Nunito", fontSize: "18px", color: "#ffffff" }).setOrigin(.5);
      this.message.textContent = won ? "Victory!" : "Defeat!";
      this.playSound(won ? "victory" : "defeat");
    }

    clearTimers() { this.time.removeAllEvents(); this.stopMusic(); }
  };
}
