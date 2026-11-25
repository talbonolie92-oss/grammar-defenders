const LANES = 5;
const TILE_W = 108;
const TILE_H = 88;
const GRID_X = 72;
const GRID_Y = 86;
const GRID_W = TILE_W * 7;
const GRID_H = TILE_H * LANES;
import { QUESTIONS } from "../data/questions.js";

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
      this.questionActive = false;
      this.gameOver = false;
      this.spawnClock = 0;
      this.questionClock = 0;
      this.soundOn = false;
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
        sprout: { name: "Grammar Sprout", cost: 50, damage: 1, cooldown: 1.15, range: 490, color: 0xffe58c, projectileSpeed: 330, radius: 7, symbol: "✦", body: 0x8de1a4, role: "Balanced" },
        archer: { name: "Rune Archer", cost: 65, damage: 1, cooldown: 0.62, range: 560, color: 0xffd27a, projectileSpeed: 470, radius: 5, symbol: "➶", body: 0xe8b96f, role: "Rapid fire" },
        mage: { name: "Frost Mage", cost: 80, damage: 2, cooldown: 1.8, range: 440, color: 0x9deaff, projectileSpeed: 270, radius: 9, symbol: "✧", body: 0xb9a8f5, role: "Frost slow" }
      };
    }

    create() {
      this.drawWorld();
      this.createHud();
      this.input.on("pointerdown", pointer => this.handleBoardTap(pointer));
      this.time.addEvent({ delay: 1000, loop: true, callback: () => this.regenerateEnergy() });
      this.spawnTimer = this.time.addEvent({ delay: 3200, loop: true, callback: () => this.spawnEnemy() });
      this.time.addEvent({ delay: 17000, loop: true, callback: () => this.showQuestion() });
      this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickBattleClock() });
      this.events.on("shutdown", () => this.clearTimers());
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
        if (this.soundOn) this.playSound("deploy");
      });
    }

    handleBoardTap(pointer) {
      if (this.gameOver || pointer.x < GRID_X || pointer.x >= GRID_X + GRID_W || pointer.y < GRID_Y || pointer.y >= GRID_Y + GRID_H) return;
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
      const shadow = this.add.ellipse(0, 25, 58, 14, 0x10251d, .34);
      const aura = this.add.circle(0, 0, 29, stats.body, .13).setStrokeStyle(2, stats.color, .5);
      const body = this.add.circle(0, 0, unitType === "mage" ? 22 : 21, stats.body).setStrokeStyle(3, unitType === "archer" ? 0x8a5d28 : 0x2b7957);
      const feet = this.add.ellipse(0, 15, 25, 10, 0x25443b, .5);
      const eyeL = this.add.circle(-7, -3, 2.5, 0x20343b);
      const eyeR = this.add.circle(7, -3, 2.5, 0x20343b);
      const smile = this.add.arc(0, 3, 7, 15, 165, false, 0x28463c, 0).setStrokeStyle(1.5, 0x28463c);
      const ornament = unitType === "sprout"
        ? [this.add.ellipse(-13, -21, 17, 28, 0x4baf77).setRotation(-.65), this.add.ellipse(13, -21, 17, 28, 0x5fc98a).setRotation(.65)]
        : unitType === "archer"
          ? [this.add.arc(0, -8, 24, 205, 335, false, 0x855a2d).setStrokeStyle(4, 0x855a2d), this.add.line(0, -28, 0, -2, 0, 19, 0xffe3a1).setLineWidth(2)]
          : [this.add.circle(0, -24, 9, 0x83eaff).setStrokeStyle(2, 0xf2ffff), this.add.triangle(0, -34, -7, 8, 7, 8, 0, 0xd7f6ff)];
      const emblem = this.add.text(0, 1, unitType === "sprout" ? "✦" : unitType === "archer" ? "➶" : "✧", {
        fontFamily: "Arial", fontSize: "17px", color: "#fff8d7", fontStyle: "bold"
      }).setOrigin(.5);
      group.add([shadow, aura, feet, ...ornament, body, eyeL, eyeR, smile, emblem]);
      this.tweens.add({ targets: group, scale: { from: .25, to: 1 }, duration: 300, ease: "Back.Out" });
      this.tweens.add({ targets: aura, alpha: .04, scale: 1.12, duration: 1450, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: group, y: y - 3, duration: 1250 + col * 30, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      this.defenders.push({ lane, col, x, y, group, cooldown: Phaser.Math.FloatBetween(0, .35), unitType, stats });
      this.message.textContent = stats.name + " deployed!";
      this.playSound("deploy");
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

    spawnEnemy() {
      if (this.gameOver || !this.waveActive || this.enemiesSpawnedThisWave >= this.enemiesPerWave) return;
      if (this.enemies.length >= 14) return;

      const lane = Phaser.Math.Between(0, LANES - 1);
      const x = GRID_X + GRID_W + 25;
      const y = GRID_Y + lane * TILE_H + TILE_H / 2;
      const type = (this.wave - 1) % 3;
      const enemyType = ["Grunt", "Runner", "Brute"][type];
      const palette = [
        { body: 0xc87973, dark: 0x783f50, light: 0xf1b09a, eye: 0xffe5cb },
        { body: 0x8c82c7, dark: 0x4e477f, light: 0xc5baff, eye: 0xf5eaff },
        { body: 0xc69b5b, dark: 0x75502f, light: 0xf0cf8c, eye: 0xfff0c5 }
      ][type];
      const isBoss = this.enemiesSpawnedThisWave === this.enemiesPerWave - 1 && this.wave % 5 === 0;
      const radius = isBoss ? 31 : [23, 19, 27][type];
      const group = this.add.container(x, y);
      const shadow = this.add.ellipse(0, 25, isBoss ? 78 : radius * 2.3, 13, 0x10251d, .38);
      const aura = this.add.circle(0, 0, isBoss ? 42 : radius + 5, isBoss ? 0xe15a91 : palette.light, isBoss ? .13 : .07);
      const body = this.add.circle(0, 0, radius, isBoss ? 0x9f4264 : palette.body)
        .setStrokeStyle(isBoss ? 4 : 3, isBoss ? 0xf0a0c3 : palette.dark);
      const belly = this.add.ellipse(-2, 10, radius * 1.25, radius * .72, palette.dark, .34);
      const eyeY = -4;
      const eyes = this.add.text(0, eyeY, isBoss ? "◆" : type === 0 ? "••" : type === 1 ? "»" : "▰", {
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
      if (isBoss) {
        // Boss: crown, horns, glowing rune and a permanent aura.
        details.push(this.add.triangle(0, -radius - 13, -19, 17, 19, 17, 0, 0xf0d58b).setStrokeStyle(2, 0x75445f));
        details.push(this.add.triangle(-radius + 2, -radius * .55, -4, 13, 11, 7, 0, 0xead9ad));
        details.push(this.add.triangle(radius - 2, -radius * .55, -11, 7, 4, 13, 0, 0xead9ad));
        details.push(this.add.circle(0, -2, 7, 0xffc4e2).setStrokeStyle(2, 0xffffff));
      }
      group.add([shadow, aura, feet[0], feet[1], belly, body, ...details, eyes]);

      const baseHp = (this.wave > 2 ? 3 + Math.floor((this.wave - 1) / 3) : 2);
      const hp = (baseHp + [0, -1, 2][type]) * (isBoss ? 5 : 1);
      const barWidth = isBoss ? 70 : 46;
      const bar = this.add.graphics();
      bar.fillStyle(0x342d39); bar.fillRoundedRect(-barWidth / 2, isBoss ? -57 : -39, barWidth, 7, 3);
      bar.fillStyle(0x83e39a); bar.fillRoundedRect(-barWidth / 2 + 1, isBoss ? -56 : -38, barWidth - 2, 5, 2);
      group.add(bar);

      const speedFactor = [1, 1.65, 0.68][type];
      const enemy = {
        lane, x, y, baseY: y, group, hp, maxHp: hp,
        speed: isBoss ? 10 + this.wave * 0.6 : (17 + this.wave * 1.2) * speedFactor,
        bar, isBoss, enemyType, phase: 1, body, aura,
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
      if (this.gameOver) return;
      this.energy = Math.min(150, this.energy + 8);
      this.updateHud();
    }

    update(time, delta) {
      if (this.gameOver) return;
      const dt = Math.min(delta / 1000, 0.05);
      this.defenders.forEach(d => {
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
              p.target.slowUntil = this.time.now + 2600;
              this.message.textContent = "Frost magic slows an enemy!";
            }
          }
        } else {
          p.x += dx / dist * p.projectileSpeed * dt; p.y += dy / dist * p.projectileSpeed * dt;
        }
      });
      this.enemies.slice().forEach(e => {
        const slowed = e.slowUntil && this.time.now < e.slowUntil;
        e.x -= e.speed * (slowed ? 0.48 : 1) * dt;
        e.group.x = e.x;
        e.group.y = e.baseY + Math.sin(this.time.now * 0.003 + e.bobOffset) * (e.isBoss ? 2.2 : 1.5);
        if (e.x < 65) this.damageBase(e);
      });
      this.projectiles = this.projectiles.filter(p => p.active);
      this.checkWaveProgress();
    }

    fireProjectile(defender, target) {
      const stats = defender.stats;
      const p = this.add.container(defender.x + 18, defender.y - 5);
      const glow = this.add.circle(0, 0, stats.radius * 2.2, stats.color, .22);
      const core = this.add.circle(0, 0, stats.radius, stats.color).setStrokeStyle(2, 0xfff8d8);
      p.add([glow, core]);
      p.target = target;
      p.damage = stats.damage;
      p.projectileSpeed = stats.projectileSpeed;
      p.unitType = defender.unitType;
      this.projectiles.push(p);
      this.playSound("shot");
      this.tweens.add({ targets: defender.group, scaleY: .92, yoyo: true, duration: 100 });
    }

    damageEnemy(enemy, amount) {
      if (!enemy.group.active) return;
      const appliedDamage = enemy.enemyType === "Brute" && !enemy.isBoss ? Math.max(0.75, amount * 0.75) : amount;
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

    showQuestion() {
      if (this.gameOver || this.questionActive) return;
      this.questionActive = true;
      const item = QUESTIONS[this.questionIndex % QUESTIONS.length];
      this.questionIndex++;
      document.getElementById("question-text").textContent = item.topic + " · " + item.q;
      const options = document.getElementById("answer-options");
      options.innerHTML = "";
      item.a.forEach((answer, index) => {
        const button = document.createElement("button");
        button.className = "answer-button";
        button.textContent = answer;
        button.addEventListener("click", () => {
          if (!this.questionActive) return;
          this.questionActive = false;
          [...options.children].forEach(b => b.disabled = true);
          if (index === item.correct) {
            this.message.textContent = item.effect + " Grammar power activated!";
            this.playSound("correct");
            this.applyGrammarPower(item.effect);
            button.style.borderColor = "#76e0b2";
          } else {
            this.message.textContent = "Not quite! Your defenders keep fighting.";
            button.style.borderColor = "#e58b8b";
          }
          this.time.delayedCall(2400, () => {
            document.getElementById("question-text").textContent = "A challenge will appear during battle.";
            options.innerHTML = '<span class="waiting-label">Stay alert, Defender!</span>';
          });
        });
        options.appendChild(button);
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
        const seconds = this.endlessMode ? this.remainingSeconds : this.elapsedSeconds;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        this.timerText.textContent = String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
      }
    }

    tickBattleClock() {
      if (this.gameOver) return;
      if (this.endlessMode) {
        this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
        if (this.remainingSeconds === 0) {
          this.endGame(true, "TIME LIMIT REACHED!");
          return;
        }
      } else {
        this.elapsedSeconds++;
      }
      this.updateHud();
    }

    endGame(won, customTitle = "") {
      this.gameOver = true;
      if (this.spawnTimer) this.spawnTimer.paused = true;
      this.add.rectangle(480, 315, 960, 540, 0x081323, .76);
      this.add.text(480, 260, customTitle || (won ? "THE KEEP IS SAFE!" : "THE KEEP HAS FALLEN"), { fontFamily: "Nunito", fontSize: "34px", color: "#fff1c5", fontStyle: "900" }).setOrigin(.5);
      this.add.text(480, 315, "Press Restart to defend the frontier again.", { fontFamily: "Nunito", fontSize: "18px", color: "#ffffff" }).setOrigin(.5);
      this.message.textContent = won ? "Victory!" : "Defeat!";
      this.playSound(won ? "victory" : "defeat");
    }

    clearTimers() { this.time.removeAllEvents(); }
  };
}
