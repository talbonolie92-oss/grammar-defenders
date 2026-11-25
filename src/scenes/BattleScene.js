const LANES = 5;
const TILE_W = 108;
const TILE_H = 54;
const GRID_X = 72;
const GRID_Y = 38;
const GRID_W = TILE_W * 7;
const GRID_H = TILE_H * LANES;
import { QUESTIONS, BOSS_QUESTIONS } from "../data/questions.js";

export function createGameScene() {
  return class BattleScene extends Phaser.Scene {
    constructor() {
      super("BattleScene");
      this.energy = 150;
      this.baseHealth = 100;
      this.baseShield = 0;
      this.laneLives = [3, 3, 3, 3, 3];
      this.laneLifeLabels = [];
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
      this.enemyPressureUntil = 0;
      this.passiveEnergyClock = 0;
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
      this.questionsAnswered = 0;
      this.correctAnswers = 0;
      this.incorrectAnswers = 0;
      this.selectedUnit = "sunwell";
      this.upgradeMode = false;
      this.upgradeChoiceActive = false;
      this.upgradeChoiceOverlay = null;
      this.advancedDeckUnlocked = false;
      this.unitCards = [...document.querySelectorAll("[data-unit]")];
      this.unitStats = {
        archer: { name: "Rune Archer", cost: 50, damage: 1, cooldown: 0.62, range: 560, color: 0xffd27a, projectileSpeed: 470, radius: 5, symbol: "➶", body: 0xe8b96f, role: "Rapid fire" },
        guardian: { name: "Aegis Guardian", cost: 75, damage: 0, cooldown: 0, range: 0, color: 0x9fc8f4, projectileSpeed: 0, radius: 0, symbol: "⬟", body: 0x8da8c5, role: "Lane blocker", health: 38 },
        mage: { name: "Frost Mage", cost: 90, damage: 2, cooldown: 1.8, range: 440, color: 0x9deaff, projectileSpeed: 270, radius: 9, symbol: "❄", body: 0xb9a8f5, role: "Frost slow" },
        ember: { name: "Ember Mage", cost: 110, damage: 3, cooldown: 2.2, range: 430, color: 0xff925d, projectileSpeed: 250, radius: 12, symbol: "♨", body: 0xe67a4e, role: "Splash damage" },
        volt: { name: "Volt Beast", cost: 130, damage: 2, cooldown: 1.55, range: 510, color: 0xf2ed8b, projectileSpeed: 390, radius: 10, symbol: "ϟ", body: 0x77bad7, role: "Chain shock" },
        thorn: { name: "Thorn Dragon", cost: 150, damage: 4, cooldown: 2.3, range: 520, color: 0x9ce28c, projectileSpeed: 300, radius: 12, symbol: "♜", body: 0x56885d, role: "Heavy damage" },
        knight: { name: "Iron Knight", cost: 175, damage: 0, cooldown: 0, range: 0, color: 0xcbdcf0, projectileSpeed: 0, radius: 0, symbol: "⚔", body: 0x718aa8, role: "Heavy blocker", health: 70 },
        phoenix: { name: "Solar Phoenix", cost: 200, damage: 5, cooldown: 2.8, range: 540, color: 0xffc16d, projectileSpeed: 320, radius: 14, symbol: "♨", body: 0xe58b55, role: "Lane burst" },
        sunwell: { name: "Sunwell Keeper", cost: 65, damage: 0, cooldown: 0, range: 0, color: 0xffe58c, projectileSpeed: 0, radius: 0, symbol: "☼", body: 0xe6c96f, role: "Energy producer", energyRate: 7, energyInterval: 3.5 },
        titan: { name: "Ancient Titan", cost: 250, damage: 18, cooldown: 2.0, range: 1000, color: 0xd8c1ff, projectileSpeed: 520, radius: 15, symbol: "✹", body: 0x9a83c7, role: "Global boss breaker", health: 360 },
        stormcaller: { name: "Stormcaller", cost: 220, damage: 7, cooldown: 1.9, range: 620, color: 0x8fe7f2, projectileSpeed: 440, radius: 13, symbol: "ϟ", body: 0x4b91b4, role: "Elite chain striker" },
        runeblade: { name: "Runeblade", cost: 230, damage: 0, cooldown: 0, range: 0, color: 0xf0c68a, projectileSpeed: 0, radius: 0, symbol: "⚔", body: 0xb17b55, role: "Elite fortress", health: 115 }
      };
    }

    create() {
      this.drawWorld();
      this.createHud();
      // Use Phaser's camera-transformed pointer coordinates for the whole
      // board. This avoids per-object hit-test gaps on scaled mobile canvases.
      this.input.on("pointerdown", pointer => this.handleBoardPointer(pointer));
      this.events.on("shutdown", () => this.clearTimers());
      this.updateHud();
      const launchConfig = window.GRAMMAR_DEFENDERS_CONFIG;
      if (launchConfig && launchConfig.studentLaunch) this.startBattle(launchConfig);
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
      this.customQuestions = Array.isArray(config.questions) ? config.questions
        .filter(q => {
          if (!q || typeof q.q !== "string" || !q.q.trim() || !Array.isArray(q.a) || q.a.length < 2 || q.a.length > 4) return false;
          if (q.a.some(answer => typeof answer !== "string" || !answer.trim())) return false;
          return (typeof q.correct === "number" || (typeof q.correct === "string" && q.correct.trim() !== ""))
            && Number.isInteger(Number(q.correct)) && Number(q.correct) >= 0 && Number(q.correct) < q.a.length;
        })
        .map(q => ({ ...q, topic: String(q.topic || "General"), effect: String(q.effect || "GRAMMAR POWER!"), correct: Number(q.correct) })) : [];
      this.battleStarted = true;
      if (this.modeText) this.modeText.textContent = this.endlessMode ? "ENDLESS SURVIVAL" : "FIXED WAVES";
      this.message.textContent = this.endlessMode ? "Endless Survival begins! Defend the keep!" : "Fixed Waves begins! Clear every wave!";
      // Spawn the first attacker immediately so the battlefield never starts empty.
      this.spawnEnemySafely();
      this.spawnTimer = this.time.addEvent({
        delay: 2600,
        loop: true,
        callback: () => this.spawnEnemySafely()
      });
      this.questionTimer = this.time.addEvent({ delay: this.questionIntervalSeconds * 1000, loop: true, callback: () => this.showQuestion(false) });
      this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickBattleClock() });
      this.updateHud();
    }

    drawWorld() {
      const g = this.add.graphics();
      // Distant twilight sky and layered mountain silhouettes.
      g.fillGradientStyle(0x142b43, 0x1d4050, 0x426b58, 0x315b4d, 1);
      g.fillRect(0, 0, 960, 340);
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
      g.fillStyle(0x0c292b, 0.55); g.fillRoundedRect(13, GRID_Y + 35, 51, GRID_H - 20, 13);
      g.fillStyle(0x6fae87); g.fillRoundedRect(18, GRID_Y + 42, 42, GRID_H - 34, 10);
      g.fillStyle(0xb8e5a6); g.fillRoundedRect(23, GRID_Y + 49, 32, GRID_H - 48, 7);
      g.fillStyle(0x315d55); g.fillTriangle(12, GRID_Y + 77, 39, GRID_Y + 39, 66, GRID_Y + 77);
      g.fillStyle(0xf4dc8d); g.fillCircle(39, GRID_Y + 56, 8);
      // Dark gate: stone pillars and a glowing portal.
      g.fillStyle(0x182638); g.fillRoundedRect(850, GRID_Y + 35, 91, GRID_H - 20, 13);
      g.fillStyle(0x624d60); g.fillRoundedRect(858, GRID_Y + 43, 75, GRID_H - 36, 9);
      g.fillStyle(0x2b314b); g.fillRoundedRect(868, GRID_Y + 66, 55, GRID_H - 82, 24);
      g.fillStyle(0x9c5b87, 0.25); g.fillEllipse(895, GRID_Y + GRID_H / 2, 44, GRID_H - 60);
      g.lineStyle(3, 0xe08eb5, 0.75); g.strokeEllipse(895, GRID_Y + GRID_H / 2, 44, GRID_H - 60);
      this.laneLifeLabels = [];
      for (let i = 0; i < LANES; i++) {
        this.add.text(39, GRID_Y + i * TILE_H + 13, String(i + 1), {
          fontFamily: "Nunito", fontSize: "11px", color: "#173f38", fontStyle: "900"
        }).setOrigin(.5);
        const laneLife = this.add.text(39, GRID_Y + i * TILE_H + 40, "♥♥♥", {
          fontFamily: "Arial", fontSize: "8px", color: "#ffb5c8", fontStyle: "bold"
        }).setOrigin(.5);
        this.laneLifeLabels.push(laneLife);
      }
      this.add.text(39, 24, "KEEP", { fontFamily: "Nunito", fontSize: "12px", color: "#e0ffe4", fontStyle: "900" }).setOrigin(.5);
      this.add.text(895, 24, "DARK GATE", { fontFamily: "Nunito", fontSize: "12px", color: "#ffe0ee", fontStyle: "900" }).setOrigin(.5);
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
      this.laneLivesText = document.getElementById("lane-value");
      this.timerText = document.getElementById("battle-time");
      this.modeText = document.getElementById("battle-mode");
      this.message = document.getElementById("battle-message");
      if (this.modeText) this.modeText.textContent = this.endlessMode ? "ENDLESS SURVIVAL" : "FIXED WAVES";
      this.removeModeButton = document.getElementById("remove-mode-button");
      this.removeMode = false;
      this.upgradeModeButton = document.getElementById("upgrade-mode-button");
      this.upgradeModeButton?.addEventListener("click", () => {
        if (!this.battleStarted || this.gameOver) {
          this.message.textContent = "Start a battle before upgrading defenders.";
          return;
        }
        this.upgradeMode = !this.upgradeMode;
        this.removeMode = false;
        this.removeModeButton?.classList.remove("active");
        this.removeModeButton?.setAttribute("aria-pressed", "false");
        this.upgradeModeButton.classList.toggle("active", this.upgradeMode);
        this.upgradeModeButton.setAttribute("aria-pressed", String(this.upgradeMode));
        this.message.textContent = this.upgradeMode
          ? "Upgrade mode: tap a deployed defender to evolve it."
          : "Upgrade mode cancelled.";
      });
      this.removeModeButton?.addEventListener("click", () => {
        if (!this.battleStarted || this.gameOver) {
          this.message.textContent = "Start a battle before removing defenders.";
          return;
        }
        this.removeMode = !this.removeMode;
        this.upgradeMode = false;
        this.upgradeModeButton?.classList.remove("active");
        this.upgradeModeButton?.setAttribute("aria-pressed", "false");
        this.removeModeButton.classList.toggle("active", this.removeMode);
        this.removeModeButton.setAttribute("aria-pressed", String(this.removeMode));
        this.message.textContent = this.removeMode
          ? "Remove mode: tap a deployed defender to remove it. No energy refund."
          : "Remove mode cancelled. Select a defender to deploy.";
      });
      this.unitCards.forEach(card => {
        card.addEventListener("click", () => {
          if (card.disabled) return;
          this.upgradeMode = false;
          this.removeMode = false;
          this.upgradeModeButton?.classList.remove("active");
          this.upgradeModeButton?.setAttribute("aria-pressed", "false");
          this.removeModeButton?.classList.remove("active");
          this.removeModeButton?.setAttribute("aria-pressed", "false");
          this.removeMode = false;
          this.upgradeMode = false;
          this.upgradeModeButton?.classList.remove("active");
          this.upgradeModeButton?.setAttribute("aria-pressed", "false");
          this.removeModeButton?.classList.remove("active");
          this.removeModeButton?.setAttribute("aria-pressed", "false");
          this.selectedUnit = card.dataset.unit;
          this.unitCards.forEach(c => {
            const selected = c === card;
            c.classList.toggle("selected", selected);
            c.setAttribute("aria-pressed", String(selected));
          });
          this.message.textContent = this.unitStats[this.selectedUnit].name + " selected. Choose a tile.";
        });
      });
      document.getElementById("restart-button").addEventListener("click", () => window.location.reload());
      const prepareAudio = () => {
        if (!this.audioContext) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) this.audioContext = new AudioContextClass();
        }
        if (this.audioContext && this.audioContext.state === "suspended") this.audioContext.resume().catch(() => {});
      };
      document.getElementById("music-toggle").addEventListener("click", e => {
        this.musicOn = !this.musicOn;
        prepareAudio();
        e.currentTarget.textContent = this.musicOn ? "♫ Music: On" : "♫ Music: Off";
        if (this.musicOn) this.startMusic();
        else this.stopMusic();
      });
      document.getElementById("sound-toggle").addEventListener("click", e => {
        this.soundOn = !this.soundOn;
        prepareAudio();
        e.currentTarget.textContent = this.soundOn ? "SFX: On" : "SFX: Off";
        this.message.textContent = this.soundOn ? "Sound effects enabled." : "Sound effects muted.";
        if (this.soundOn) this.playSound("deploy");
      });
    }

    handleBoardPointer(pointer) {
      if (!pointer || !this.battleStarted || this.gameOver || this.questionActive || this.upgradeChoiceActive) return;
      // pointer.x/y are already converted by Phaser's Scale Manager. Transform
      // through the active camera, then map the point to one of the 35 tiles.
      const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const localX = point.x - GRID_X;
      const localY = point.y - GRID_Y;
      if (localX < 0 || localY < 0 || localX >= GRID_W || localY >= GRID_H) return;
      const col = Math.floor(localX / TILE_W);
      const lane = Math.floor(localY / TILE_H);
      if (lane >= 0 && lane < LANES && col >= 0 && col < 7) {
        this.handleTileTap(lane, col);
      }
    }

    handleTileTap(lane, col) {
      if (!this.battleStarted || this.gameOver || this.questionActive || this.upgradeChoiceActive) return;
      if (!Number.isInteger(lane) || !Number.isInteger(col) ||
          lane < 0 || lane >= LANES || col < 0 || col >= 7) return;
      const existing = this.defenders.find(d => d.lane === lane && d.col === col);
      if (this.upgradeMode) {
        if (existing) this.upgradeDefender(existing);
        else this.message.textContent = "Choose a tile with a defender to upgrade.";
        return;
      }
      if (this.removeMode) {
        if (existing) this.removeDefender(existing);
        else this.message.textContent = "No defender on that tile. Tap a deployed defender to remove it.";
        return;
      }
      if (existing) {
        this.message.textContent = "That tile is occupied. Select Remove to reposition the defender.";
        return;
      }
      const stats = this.unitStats[this.selectedUnit];
      if (this.energy < stats.cost) {
        this.message.textContent = "Not enough energy for " + stats.name + ".";
        return;
      }
      try {
        this.deployDefender(lane, col, this.selectedUnit);
        this.energy -= stats.cost;
        this.updateHud();
      } catch (error) {
        console.error("Defender deployment failed:", error);
        this.message.textContent = "Deployment failed. Energy was not spent. Please reload and try again.";
      }
    }

    removeDefender(defender) {
      if (!defender || !this.defenders.includes(defender)) return;
      this.defenders = this.defenders.filter(item => item !== defender);
      if (defender.healthBar?.active) defender.healthBar.destroy();
      if (defender.group?.active) {
        this.tweens.add({
          targets: defender.group, alpha: 0, scale: 0.55, duration: 180,
          ease: "Cubic.In",
          onComplete: () => defender.group?.destroy()
        });
      }
      this.message.textContent = defender.stats.name + " removed. Energy is not refunded.";
      this.playSound("remove");
      this.updateHud();
    }

    deployDefender(lane, col, unitType = "archer") {
      const stats = { ...(this.unitStats[unitType] || this.unitStats.archer) };
      const x = GRID_X + col * TILE_W + TILE_W / 2;
      const y = GRID_Y + lane * TILE_H + TILE_H / 2;
      const group = this.add.container(x, y).setDepth(20).setVisible(true).setAlpha(1);
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
        const bow = this.add.ellipse(18, -5, 8, 46, 0x704b2d);
        const bowString = this.add.rectangle(18, -5, 1.5, 48, 0xffedc3);
        const quiverTie = this.add.rectangle(-15, -17, 2, 13, 0xffe4a5);
        const quiver = this.add.rectangle(-15, -7, 8, 25, 0x704b35).setRotation(-.35);
        parts.push(...legs, torso, head, hood, hair, face, quiver, bow, bowString, quiverTie);
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
      } else if (unitType === "guardian") {
        // Aegis Guardian: broad shield-bearing defender, built for lane blocking.
        legs = [this.add.rectangle(-9, 17, 12, 15, 0x46556b), this.add.rectangle(9, 17, 12, 15, 0x46556b)];
        const torso = this.add.rectangle(0, 1, 34, 31, 0x718ba8).setStrokeStyle(3, 0x354d6b);
        const head = this.add.circle(0, -20, 11, 0xd9b49a).setStrokeStyle(2, 0x586c84);
        const helmet = this.add.rectangle(0, -25, 26, 11, 0xb8c9dc).setStrokeStyle(2, 0x526b87);
        const crest = this.add.triangle(0, -37, -7, 12, 7, 12, 0, 0xd7e9fa);
        const visor = this.add.rectangle(0, -19, 17, 4, 0x344960);
        const shield = this.add.polygon(-23, 2, [-14,-23, 14,-23, 19,-4, 0,25, -19,-4], 0x527ba8).setStrokeStyle(3, 0xd5e8ff);
        const shieldMark = this.add.text(-23, 1, "✦", { fontSize: "18px", color: "#fff0bf", fontStyle: "bold" }).setOrigin(.5);
        parts.push(...legs, torso, head, helmet, crest, visor, shield, shieldMark);
      } else if (unitType === "knight") {
        // Iron Knight: tall plate-armored champion with a greatsword, not another shield tank.
        legs = [this.add.rectangle(-10, 18, 12, 17, 0x39485c), this.add.rectangle(10, 18, 12, 17, 0x39485c)];
        const cape = this.add.triangle(-3, 7, -19, -17, 18, -17, -8, 36, 0x7e3949).setStrokeStyle(2, 0x4c2938);
        const torso = this.add.rectangle(0, 0, 35, 35, 0x9aaec5).setStrokeStyle(3, 0x40536c);
        const chest = this.add.polygon(0, 1, [-12,-12, 12,-12, 10,12, 0,17, -10,12], 0xd9e6f3).setStrokeStyle(2, 0x667f9c);
        const head = this.add.circle(0, -23, 12, 0x71859d).setStrokeStyle(3, 0xd7e4f1);
        const visor = this.add.rectangle(0, -22, 17, 5, 0x17283d);
        const plume = this.add.triangle(0, -39, -7, 13, 7, 13, 0, 0xe6a3a8);
        const sword = this.add.rectangle(24, -8, 7, 47, 0xdce9f5).setStrokeStyle(2, 0x657e99).setRotation(-.18);
        const guard = this.add.rectangle(24, 7, 20, 5, 0xc89b59).setRotation(-.18);
        parts.push(...legs, cape, torso, chest, head, visor, plume, sword, guard);
      } else if (unitType === "ember") {
        // Ember Mage: flame-crowned caster with a burning staff and ember robe.
        legs = [this.add.ellipse(-8, 17, 12, 7, 0x773b31), this.add.ellipse(8, 17, 12, 7, 0x773b31)];
        const robe = this.add.triangle(0, 5, -20, -17, 20, -17, 0, 27, 0xb84e36).setStrokeStyle(3, 0x6e302d);
        const face = this.add.circle(0, -20, 10, 0xf0c19a).setStrokeStyle(2, 0x7e493b);
        const hood = this.add.ellipse(0, -25, 30, 12, 0xf06b3c).setStrokeStyle(2, 0xffb05b);
        const flame1 = this.add.triangle(-9, -39, -7, 18, 7, 18, 0, 0xffdf77);
        const flame2 = this.add.triangle(7, -43, -6, 17, 6, 17, 0, 0xff8c3e);
        const staff = this.add.rectangle(22, -2, 4, 54, 0x71472f).setRotation(-.12);
        const orb = this.add.star(22, -32, 6, 4, 11, 0xffb84d).setStrokeStyle(2, 0xffefb1);
        parts.push(...legs, robe, face, hood, flame1, flame2, staff, orb);
      } else if (unitType === "volt") {
        // Volt Beast: compact electric creature with lightning antlers and a charged core.
        legs = [this.add.ellipse(-12, 15, 15, 9, 0x28506b), this.add.ellipse(12, 15, 15, 9, 0x28506b)];
        const body = this.add.ellipse(0, 0, 43, 39, 0x4d9ab6).setStrokeStyle(3, 0x244e76);
        const belly = this.add.ellipse(0, 8, 24, 18, 0xc7e8d7);
        const head = this.add.circle(0, -17, 13, 0x75c6d3).setStrokeStyle(2, 0x285d79);
        const leftBolt = this.add.star(-15, -34, 4, 3, 13, 0xf8f28d).setRotation(-.3);
        const rightBolt = this.add.star(15, -34, 4, 3, 13, 0xf8f28d).setRotation(.3);
        const eyes = [this.add.circle(-5, -18, 3, 0x17334c), this.add.circle(5, -18, 3, 0x17334c)];
        const core = this.add.star(0, 3, 6, 5, 11, 0xf8f28d).setStrokeStyle(2, 0xffffff);
        parts.push(...legs, body, belly, head, leftBolt, rightBolt, ...eyes, core);
      } else if (unitType === "thorn") {
        // Thorn Dragon: four-legged drake with scales, horns and a long spiked tail.
        legs = [this.add.rectangle(-13, 14, 9, 18, 0x315b3d), this.add.rectangle(12, 14, 9, 18, 0x315b3d)];
        const body = this.add.ellipse(0, 2, 47, 32, 0x56885d).setStrokeStyle(3, 0x294d38);
        const belly = this.add.ellipse(2, 9, 25, 15, 0xb7d28a);
        const head = this.add.triangle(17, -14, -13, 13, 13, 10, 6, 0x6da86c).setStrokeStyle(2, 0x294d38);
        const jaw = this.add.triangle(21, -5, -7, 6, 9, 4, 1, 0xc4d99a);
        const hornA = this.add.triangle(5, -28, -7, 12, 7, 12, 0, 0xd4e9a1);
        const hornB = this.add.triangle(20, -27, -7, 12, 7, 12, 0, 0xd4e9a1);
        const eye = this.add.circle(22, -15, 3, 0xffe58c);
        const tail = this.add.triangle(-27, 0, -4, 10, 4, -10, -18, 0x315d42);
        const spikes = [-8, 3, 14].map((x, i) => this.add.triangle(x, -17 - (i%2)*3, -6, 12, 6, 12, 0, 0x9ce28c));
        parts.push(...legs, tail, body, belly, head, jaw, hornA, hornB, eye, ...spikes);
      } else if (unitType === "phoenix") {
        // Solar Phoenix: winged firebird with layered feathers and a bright crest.
        const leftWing = this.add.triangle(-20, -3, -5, -22, 7, 18, -32, 0xffa34e).setStrokeStyle(2, 0x9d4c32);
        const rightWing = this.add.triangle(20, -3, -7, -22, 5, 18, 32, 0xffc46a).setStrokeStyle(2, 0x9d4c32);
        const body = this.add.ellipse(0, 2, 29, 39, 0xe77b43).setStrokeStyle(3, 0x8d3d31);
        const belly = this.add.ellipse(0, 8, 17, 22, 0xffd68a);
        const head = this.add.circle(0, -23, 10, 0xffc36b).setStrokeStyle(2, 0x8d3d31);
        const beak = this.add.triangle(0, -17, -5, 8, 5, 8, 0, 0xffefad);
        const crest = this.add.triangle(-3, -42, -8, 15, 8, 15, 0, 0xffe28a);
        const tail = this.add.triangle(0, 25, -15, -4, 15, -4, 0, 0xe9573d);
        const eye = this.add.circle(4, -24, 2.5, 0x382a34);
        parts.push(leftWing, rightWing, body, belly, head, beak, crest, tail, eye);
      } else if (unitType === "titan") {
        // Ancient Titan: towering stone golem with huge shoulders, rune core and fists.
        legs = [this.add.rectangle(-12, 20, 17, 21, 0x655b82), this.add.rectangle(12, 20, 17, 21, 0x655b82)];
        const cape = this.add.triangle(0, 8, -24, -20, 24, -20, 0, 40, 0x4c3f70);
        const torso = this.add.rectangle(0, 0, 43, 43, 0x8978b3).setStrokeStyle(4, 0x40345f);
        const shoulderL = this.add.rectangle(-25, -9, 20, 27, 0x9e8bc8).setStrokeStyle(3, 0x51416e).setRotation(-.18);
        const shoulderR = this.add.rectangle(25, -9, 20, 27, 0x9e8bc8).setStrokeStyle(3, 0x51416e).setRotation(.18);
        const head = this.add.rectangle(0, -28, 27, 23, 0x76669e).setStrokeStyle(3, 0x40345f);
        const eyes = [this.add.circle(-6, -29, 3, 0xf7e7ff), this.add.circle(6, -29, 3, 0xf7e7ff)];
        const rune = this.add.star(0, 0, 6, 6, 13, 0xe2c7ff).setStrokeStyle(2, 0xffffff);
        const fistL = this.add.circle(-29, 11, 11, 0x78689f).setStrokeStyle(2, 0x40345f);
        const fistR = this.add.circle(29, 11, 11, 0x78689f).setStrokeStyle(2, 0x40345f);
        parts.push(...legs, cape, torso, shoulderL, shoulderR, head, ...eyes, rune, fistL, fistR);
      } else if (unitType === "sunwell") {
        const base = this.add.ellipse(0, 13, 35, 15, 0x7b6537).setStrokeStyle(2, 0xffe58c);
        const stem = this.add.rectangle(0, -1, 8, 30, 0x8cbd72).setStrokeStyle(2, 0x416b4a);
        const crystal = this.add.star(0, -24, 8, 12, 23, 0xffe58c).setStrokeStyle(3, 0xfff5c2);
        const orb = this.add.circle(0, -24, 8, 0xffffff, .9);
        const rays = Array.from({ length: 8 }, (_, i) =>
          this.add.rectangle(Math.cos(i * Math.PI / 4) * 32, -24 + Math.sin(i * Math.PI / 4) * 32, 8, 2, 0xffe58c)
            .setRotation(i * Math.PI / 4)
        );
        parts.push(base, stem, crystal, orb, ...rays);
      } else if (unitType === "runeblade") {
        legs = [this.add.rectangle(-11, 18, 13, 17, 0x513e35), this.add.rectangle(11, 18, 13, 17, 0x513e35)];
        const cape = this.add.triangle(-4, 8, -21, -18, 20, -18, -10, 39, 0x6b3448).setStrokeStyle(2, 0x3a253b);
        const armor = this.add.rectangle(0, -1, 38, 38, 0xb17b55).setStrokeStyle(3, 0x4b382d);
        const helmet = this.add.triangle(0, -27, -15, 18, 15, 18, 0, 0xe9c68b).setStrokeStyle(3, 0x6e4a34);
        const visor = this.add.rectangle(0, -23, 17, 5, 0x1b293b);
        const sword = this.add.rectangle(25, -5, 7, 54, 0xf6e2b4).setStrokeStyle(2, 0x8b6448).setRotation(-.2);
        const guard = this.add.rectangle(25, 8, 21, 5, 0xc18c56);
        parts.push(...legs, cape, armor, helmet, visor, sword, guard);
      } else if (unitType === "stormcaller") {
        const body = this.add.ellipse(0, 2, 43, 37, 0x4b91b4).setStrokeStyle(3, 0x214e70);
        const head = this.add.circle(0, -19, 13, 0x8fe7f2).setStrokeStyle(2, 0x326c89);
        const eyes = [this.add.circle(-5, -20, 3, 0x19394d), this.add.circle(5, -20, 3, 0x19394d)];
        const horns = [this.add.star(-17, -34, 4, 3, 12, 0xe3ffff), this.add.star(17, -34, 4, 3, 12, 0xe3ffff)];
        const core = this.add.star(0, 2, 6, 5, 12, 0xe3ffff);
        parts.push(body, head, ...eyes, ...horns, core);
      } else {
        {
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

      // Reparent every visual into one actor container, then normalize child state.
      group.add(parts);
      group.iterate(child => {
        child.setActive(true);
        child.setVisible(true);
        child.setAlpha(1);
        child.setDepth(0);
      });
      group.setActive(true).setVisible(true).setAlpha(1).setDepth(20);
      this.children.bringToTop(group);
      this.tweens.add({ targets: group, scale: { from: .25, to: 1 }, duration: 320, ease: "Back.Out" });
      this.tweens.add({ targets: aura, alpha: .035, scale: 1.12, duration: 1450, yoyo: true, repeat: -1 });
      if (!stats.health) this.tweens.add({ targets: group, y: y - 3, duration: 1250 + col * 30, yoyo: true, repeat: -1, ease: "Sine.InOut" });

      // Every deployed unit is a physical target: attackers can be damaged and destroyed too.
      const unitHealth = {
        archer: 20, guardian: 38, mage: 22, ember: 26,
        volt: 28, thorn: 36, knight: 70, phoenix: 44, sunwell: 18,
        titan: 360, stormcaller: 32, runeblade: 115
      };
      const maxHp = unitHealth[unitType] || 24;
      const levelBadge = this.add.text(0, -52, "I", {
        fontFamily: "Nunito", fontSize: "12px", fontStyle: "1000",
        color: "#fff4bd", stroke: "#18283a", strokeThickness: 3
      }).setOrigin(.5);
      group.add(levelBadge);
      let evolutionMark = null;
      const healthBar = this.add.graphics();
      group.add(healthBar);
      healthBar.setVisible(true).setAlpha(1).setDepth(0);
      this.drawGuardianHealth(healthBar, maxHp, maxHp);
      this.defenders.push({
        lane, col, x, y, group, cooldown: Phaser.Math.FloatBetween(0, .35),
        unitType, stats, hp: maxHp, maxHp, level: 1, levelBadge, evolutionMark,
        healthBar, attackCooldown: 0, legs, upgradePaths: [], damageReduction: 0,
        counterDamageMultiplier: 1
      });
      this.message.textContent = stats.name + " deployed! Upgrade it later to unlock stronger abilities.";
      this.playSound("deploy");
    }


    upgradeDefender(defender) {
      if (!defender || !this.defenders.includes(defender)) return;
      if (defender.level >= 3) {
        this.message.textContent = defender.stats.name + " has reached MAX evolution.";
        return;
      }
      const nextLevel = defender.level + 1;
      const cost = Math.round(defender.stats.cost * (nextLevel === 2 ? 0.65 : 0.9));
      if (this.energy < cost) {
        this.message.textContent = "Need " + cost + " energy to evolve " + defender.stats.name + ".";
        return;
      }
      this.energy -= cost;
      defender.level = nextLevel;
      const multiplier = nextLevel === 2 ? 1.5 : 2;
      const base = this.unitStats[defender.unitType];
      const vanguardChoices = (defender.upgradePaths || []).filter(path => path === "vanguard").length;
      const mysticChoices = (defender.upgradePaths || []).filter(path => path === "mystic").length;
      if (base.damage > 0) {
        defender.stats.damage = Math.max(1, Math.round(base.damage * multiplier * Math.pow(1.25, vanguardChoices)));
      }
      if (base.cooldown > 0) {
        defender.stats.cooldown = Math.max(.38, base.cooldown * (nextLevel === 2 ? .88 : .76) * Math.pow(.9, vanguardChoices));
      }
      if (base.range > 0) {
        defender.stats.range = Math.round(base.range * Math.pow(1.2, mysticChoices));
        defender.stats.projectileSpeed = Math.round(base.projectileSpeed * Math.pow(1.2, mysticChoices));
      }
      defender.maxHp = Math.round(defender.maxHp * 1.35);
      defender.hp = Math.min(defender.maxHp, Math.round(defender.hp + defender.maxHp * .25));
      if (defender.unitType === "sunwell") {
        defender.stats.energyRate = Math.round(base.energyRate * nextLevel * Math.pow(1.35, mysticChoices));
      }
      defender.levelBadge?.setText(nextLevel === 2 ? "II" : "III");
      defender.levelBadge?.setColor(nextLevel === 3 ? "#ffe18b" : "#d9f4ff");
      if (defender.evolutionMark?.active) defender.evolutionMark.destroy();
      const burst = this.add.circle(defender.x, defender.y, 18, nextLevel === 3 ? 0xffdf78 : 0x9ce8ff, .28).setDepth(48);
      const ring = this.add.circle(defender.x, defender.y, 25, 0xffffff, 0).setStrokeStyle(3, nextLevel === 3 ? 0xffdf78 : 0x9ce8ff, .9).setDepth(49);
      this.tweens.add({ targets: [burst, ring], scale: 2.8, alpha: 0, duration: 420, ease: "Cubic.Out", onComplete: () => { burst.destroy(); ring.destroy(); } });
      const mark = this.add.star(0, -57, nextLevel + 3, 5, 10 + nextLevel * 2, nextLevel === 3 ? 0xffdf78 : 0x9ce8ff)
        .setStrokeStyle(2, 0xffffff);
      defender.group.add(mark);
      defender.evolutionMark = mark;
      defender.group.setScale(1 + (nextLevel - 1) * .06);
      if (defender.evolutionAura?.active) defender.evolutionAura.destroy();
      defender.evolutionAura = null;
      if (defender.unitType === "sunwell") {
        // Rebuild, rather than stack, crystals so the visible count matches its tier.
        defender.energyCrystals?.forEach(crystal => crystal.destroy());
        defender.energyCrystals = [];
        for (let i = 0; i < nextLevel; i++) {
          const crystal = this.add.star((i - (nextLevel - 1) / 2) * 13, -42 - (i % 2) * 5, 5, 4, 8, 0xffe58c)
            .setStrokeStyle(1.5, 0xffffff);
          defender.group.add(crystal);
          defender.energyCrystals.push(crystal);
        }
      } else {
        const ring = this.add.circle(0, 0, 39 + nextLevel * 3, 0xffffff, .035)
          .setStrokeStyle(2, nextLevel === 3 ? 0xffdf78 : defender.stats.color, .8);
        defender.group.add(ring);
        defender.group.sendToBack(ring);
        defender.evolutionAura = ring;
      }
      this.drawGuardianHealth(defender.healthBar, defender.hp, defender.maxHp);
      this.updateHud();
      this.message.textContent = defender.stats.name + " reached Tier " + nextLevel + "! Choose a specialization.";
      this.playSound("deploy");
      this.showUpgradeChoices(defender, nextLevel);
    }

    showUpgradeChoices(defender, tier) {
      if (!defender || !this.defenders.includes(defender)) return;
      this.upgradeChoiceActive = true;
      if (this.spawnTimer) this.spawnTimer.paused = true;
      if (this.questionTimer) this.questionTimer.paused = true;
      const overlay = this.add.container(0, 0).setDepth(950);
      this.upgradeChoiceOverlay = overlay;
      const shade = this.add.rectangle(480, 170, 960, 340, 0x071321, .88).setInteractive();
      const panel = this.add.rectangle(480, 170, 820, 292, 0x142b43, .99).setStrokeStyle(3, 0xffdf78);
      const heading = this.add.text(480, 43, "CHOOSE A TIER " + (tier === 2 ? "II" : "III") + " SPECIALIZATION", {
        fontFamily: "Nunito", fontSize: "20px", color: "#ffe7a1", fontStyle: "1000", letterSpacing: 1
      }).setOrigin(.5);
      const sub = this.add.text(480, 70, defender.stats.name + " — select one permanent upgrade path", {
        fontFamily: "Nunito", fontSize: "12px", color: "#d2e4f0", fontStyle: "800"
      }).setOrigin(.5);
      overlay.add([shade, panel, heading, sub]);
      const choices = [
        { id: "vanguard", title: "⚔ VANGUARD", desc: "More attack or counter damage\nand faster strikes", color: 0x70453e },
        { id: "fortress", title: "🛡 FORTRESS", desc: "Much tougher defender\nand reduced incoming damage", color: 0x365a70 },
        { id: "mystic", title: "✦ MYSTIC", desc: "Greater range / projectile speed\nor stronger energy production", color: 0x514477 }
      ];
      choices.forEach((choice, index) => {
        const x = 205 + index * 275;
        const card = this.add.rectangle(x, 190, 245, 165, choice.color, 1)
          .setStrokeStyle(2, 0xc8e7d8).setInteractive({ useHandCursor: true });
        const title = this.add.text(x, 143, choice.title, {
          fontFamily: "Nunito", fontSize: "16px", color: "#fff1c5", fontStyle: "1000"
        }).setOrigin(.5);
        const desc = this.add.text(x, 202, choice.desc, {
          fontFamily: "Nunito", fontSize: "13px", color: "#f0f5f8", fontStyle: "800",
          align: "center", lineSpacing: 7
        }).setOrigin(.5);
        const pick = this.add.text(x, 251, "SELECT", {
          fontFamily: "Nunito", fontSize: "12px", color: "#a9f0cf", fontStyle: "1000", letterSpacing: 1
        }).setOrigin(.5);
        card.on("pointerover", () => card.setStrokeStyle(4, 0xffdf78));
        card.on("pointerout", () => card.setStrokeStyle(2, 0xc8e7d8));
        card.on("pointerdown", () => this.applyDefenderUpgradeChoice(defender, choice.id));
        overlay.add([card, title, desc, pick]);
      });
      overlay.add(this.add.text(480, 300, "Battle pauses while you choose. Each tier grants one specialization.", {
        fontFamily: "Nunito", fontSize: "11px", color: "#b8ccdc", fontStyle: "700"
      }).setOrigin(.5));
    }

    applyDefenderUpgradeChoice(defender, choice) {
      if (!this.upgradeChoiceActive || !defender || !this.defenders.includes(defender)) return;
      defender.upgradePaths = defender.upgradePaths || [];
      defender.upgradePaths.push(choice);
      if (choice === "vanguard") {
        if (defender.stats.damage > 0) {
          defender.stats.damage = Math.max(1, Math.round(defender.stats.damage * 1.25));
          defender.stats.cooldown = Math.max(.38, defender.stats.cooldown * .9);
        } else {
          defender.counterDamageMultiplier = (defender.counterDamageMultiplier || 1) * 1.3;
        }
      } else if (choice === "fortress") {
        const oldMax = defender.maxHp;
        defender.maxHp = Math.round(defender.maxHp * 1.45);
        defender.hp = Math.min(defender.maxHp, defender.hp + Math.round(oldMax * .45));
        defender.damageReduction = Math.min(.35, (defender.damageReduction || 0) + .15);
      } else if (choice === "mystic") {
        if (defender.stats.energyRate) {
          defender.stats.energyRate = Math.round(defender.stats.energyRate * 1.35);
        } else if (defender.stats.damage > 0) {
          defender.stats.range = Math.round(defender.stats.range * 1.2);
          defender.stats.projectileSpeed = Math.round(defender.stats.projectileSpeed * 1.2);
        } else {
          defender.maxHp = Math.round(defender.maxHp * 1.2);
          defender.hp = Math.min(defender.maxHp, defender.hp + Math.round(defender.maxHp * .2));
          defender.counterDamageMultiplier = (defender.counterDamageMultiplier || 1) * 1.15;
        }
      }
      if (defender.healthBar?.active) this.drawGuardianHealth(defender.healthBar, defender.hp, defender.maxHp);
      if (defender.group?.active) {
        const color = choice === "vanguard" ? 0xffa27d : choice === "fortress" ? 0x9bc9ff : 0xc5a7ff;
        const glow = this.add.circle(defender.x, defender.y, 34, color, .22).setDepth(47);
        this.tweens.add({ targets: glow, scale: 1.9, alpha: 0, duration: 420, onComplete: () => glow.destroy() });
      }
      if (this.upgradeChoiceOverlay) this.upgradeChoiceOverlay.destroy(true);
      this.upgradeChoiceOverlay = null;
      this.upgradeChoiceActive = false;
      this.updateHud();
      if (this.pendingBossQuestion && !this.gameOver) {
        this.pendingBossQuestion = false;
        this.showQuestion(true);
      } else {
        if (!this.gameOver && this.spawnTimer) this.spawnTimer.paused = false;
        if (!this.gameOver && this.questionTimer) this.questionTimer.paused = false;
      }
      const label = choice === "vanguard" ? "Vanguard" : choice === "fortress" ? "Fortress" : "Mystic";
      this.message.textContent = defender.stats.name + " gained the " + label + " path!";
      this.playSound("wave");
    }

    unlockAdvancedDeck() {
      this.advancedDeckUnlocked = true;
      ["stormcaller", "runeblade"].forEach(id => {
        const card = document.querySelector('[data-unit="' + id + '"]');
        if (card) {
          card.disabled = false;
          card.classList.remove("deck-locked");
          card.title = "Unlocked after the first boss.";
        }
      });
      this.message.textContent = "FIRST BOSS DEFEATED — ELITE DEFENDERS UNLOCKED!";
      this.playSound("wave");
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
        remove: [420, 210, 0.11, "triangle"],
        energy: [720, 1120, 0.16, "sine"],
        shot: [520, 380, 0.045, "triangle"],
        hit: [190, 115, 0.07, "square"],
        defeat: [260, 90, 0.16, "sawtooth"],
        correct: [520, 880, 0.2, "sine"],
        boss: [110, 65, 0.42, "sawtooth"],
        wave: [360, 560, 0.22, "triangle"],
        victory: [520, 1040, 0.5, "sine"],
        lane: [150, 65, 0.22, "sawtooth"]
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
      gain.gain.exponentialRampToValueAtTime(kind === "shot" ? 0.12 : 0.14, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    }

    prepareAudio() {
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) this.audioContext = new AudioContextClass();
      }
      if (this.audioContext && this.audioContext.state === "suspended") this.audioContext.resume().catch(() => {});
    }

    enableMusic() {
      this.prepareAudio();
      if (!this.audioContext) return;
      if (this.audioContext.state === "suspended") this.audioContext.resume().catch(() => {});
      this.musicOn = true;
      const toggle = document.getElementById("music-toggle");
      if (toggle) toggle.textContent = "♫ Music: On";
      this.startMusic();
    }

    startMusic() {
      if (!this.audioContext || this.musicGain) return;
      const ctx = this.audioContext;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.19, ctx.currentTime + 0.8);
      master.connect(ctx.destination);
      this.musicGain = master;
      const melody = [523.25,659.25,783.99,659.25,587.33,698.46,880,698.46,523.25,659.25,783.99,1046.5,880,783.99,659.25,587.33];
      const bass = [130.81,146.83,164.81,110];
      let step = 0;
      const playTone = (frequency, duration, volume, type = "triangle") => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        osc.stop(ctx.currentTime + duration + 0.03);
        this.musicNodes.push(osc);
        osc.onended = () => { this.musicNodes = this.musicNodes.filter(node => node !== osc); };
      };
      this.musicEvent = this.time.addEvent({
        delay: 230, loop: true, callback: () => {
          if (!this.musicOn || !this.audioContext || this.audioContext.state !== "running") return;
          const index = step % melody.length;
          playTone(melody[index], 0.19, 0.12, "triangle");
          if (step % 4 === 0) playTone(bass[Math.floor(step / 4) % bass.length], 0.68, 0.10, "sine");
          if (step % 8 === 0) {
            const kick = ctx.createOscillator();
            const kickGain = ctx.createGain();
            kick.type = "sine";
            kick.frequency.setValueAtTime(115, ctx.currentTime);
            kick.frequency.exponentialRampToValueAtTime(48, ctx.currentTime + 0.14);
            kickGain.gain.setValueAtTime(0.12, ctx.currentTime);
            kickGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
            kick.connect(kickGain); kickGain.connect(master);
            kick.start(); kick.stop(ctx.currentTime + 0.18);
            this.musicNodes.push(kick);
            kick.onended = () => { this.musicNodes = this.musicNodes.filter(node => node !== kick); };
          }
          step++;
        }
      });
    }

    stopMusic() {
      if (this.musicEvent) { this.musicEvent.remove(false); this.musicEvent = null; }
      const master = this.musicGain;
      const ctx = this.audioContext;
      this.musicGain = null;
      this.musicOn = false;
      if (master && ctx) {
        try {
          const now = ctx.currentTime;
          master.gain.cancelScheduledValues(now);
          master.gain.setTargetAtTime(0.0001, now, 0.06);
          this.musicNodes.forEach(osc => { try { osc.stop(now + 0.25); } catch (_) {} });
          window.setTimeout(() => { try { master.disconnect(); } catch (_) {} }, 500);
        } catch (_) {
          try { master.disconnect(); } catch (_) {}
        }
      }
      this.musicNodes = [];
      const toggle = document.getElementById("music-toggle");
      if (toggle) toggle.textContent = "♫ Music: Off";
    }

    spawnEnemySafely() {
      if (!this.battleStarted || this.gameOver) return;
      try {
        this.spawnEnemy();
        if (this.enemies.length && this.message && this.message.textContent === "Prepare your defenses!") {
          this.message.textContent = "Attackers incoming! Defend the keep!";
        }
      } catch (error) {
        console.error("Enemy spawn failed:", error);
        if (this.message) this.message.textContent = "Enemy spawn error: " + (error?.message || "unknown error");
      }
    }

    spawnEnemy() {
      if (this.gameOver || !this.waveActive || this.enemiesSpawnedThisWave >= this.enemiesPerWave) return;
      const bossWave = this.wave % 5 === 0;
      if (this.enemies.length >= (bossWave ? 34 : (this.wave > 5 ? 30 : 20))) return;

      const lane = Phaser.Math.Between(0, LANES - 1);
      const x = GRID_X + GRID_W + 25;
      const y = GRID_Y + lane * TILE_H + TILE_H / 2;
      const enemyRoster = ["Grunt", "Runner", "Brute", "Shadow Stalker", "Bone Warrior", "Venom Beast", "Dark Caster", "War Crusher", "Dread Beast", "Dark Overlord"];
      // Dark Overlord is reserved for the scripted boss slot on boss waves.
      // Keeping normal spawns capped at level 8 prevents a second accidental
      // Overlord from appearing as an ordinary minion from wave 10 onward.
      const unlockedEnemyLevel = Math.min(8, Math.floor((this.wave - 1) * 1.15));
      const enemyIndex = Phaser.Math.Between(0, unlockedEnemyLevel);
      const type = enemyIndex % 3;
      const isBoss = this.enemiesSpawnedThisWave === this.enemiesPerWave - 1 && this.wave % 5 === 0;
      const enemyType = isBoss ? "Dark Overlord" : enemyRoster[enemyIndex];
      // Compute wave scaling before building armor visuals.
      const armorLevel = Math.min(5, Math.floor((this.wave - 1) / 2));
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
      const group = this.add.container(x, y).setDepth(20).setVisible(true).setAlpha(1);
      const shadow = this.add.ellipse(0, 25, isBoss ? 78 : radius * 2.3, 13, 0x10251d, .38);
      const aura = this.add.circle(0, 0, isBoss ? 42 : radius + 5, isBoss ? 0xe15a91 : palette.light, isBoss ? .13 : .07);
      const frostRing = this.add.circle(0, 0, radius + 9, 0x9deaff, 0).setStrokeStyle(2, 0xc7f6ff, .9).setVisible(false);
      const body = this.add.circle(0, 0, radius, isBoss ? 0x9f4264 : palette.body)
        .setStrokeStyle(isBoss ? 4 : 3, isBoss ? 0xf0a0c3 : palette.dark);
      const belly = this.add.ellipse(-2, 10, radius * 1.25, radius * .72, palette.dark, .34);
      const eyeY = -4;
      const eyeParts = [];
      for (const side of [-1, 1]) {
        const eyeX = side * radius * 0.34;
        eyeParts.push(this.add.ellipse(eyeX, eyeY, isBoss ? 11 : 9, isBoss ? 13 : 11, 0xfff5e8).setStrokeStyle(1.5, palette.dark));
        eyeParts.push(this.add.circle(eyeX + (isBoss ? 1 : 1.5), eyeY + 1, isBoss ? 4.2 : 3.4, isBoss ? 0xb51f53 : 0x263044));
        eyeParts.push(this.add.circle(eyeX + (isBoss ? 2 : 2.5), eyeY - 1, 1.4, 0xffffff));
      }
      eyeParts.push(this.add.rectangle(0, eyeY - 9, radius * 1.1, 3, palette.dark).setRotation(isBoss ? 0 : -.06));
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
        const speedTrail = this.add.rectangle(-radius - 4, 6, 10, 3, palette.light, .8).setRotation(-.2);
        details.push(speedTrail);
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
      if (armorLevel > 0) {
        const armorColor = armorLevel >= 3 ? 0xd8c8a8 : 0x9aaec5;
        details.push(this.add.rectangle(0, 5, radius * 1.45, Math.max(7, radius * .42), armorColor).setStrokeStyle(2, 0x34445b));
        details.push(this.add.circle(-radius * .72, -radius * .42, 5 + armorLevel, 0x6f829b).setStrokeStyle(1, 0xdce8f4));
        details.push(this.add.circle(radius * .72, -radius * .42, 5 + armorLevel, 0x6f829b).setStrokeStyle(1, 0xdce8f4));
      }
      // Keep enemy visuals in a single visible container above the battlefield.
      const enemyParts = [shadow, aura, frostRing, feet[0], feet[1], belly, body, ...details, ...eyeParts];
      group.add(enemyParts);
      group.iterate(child => {
        child.setActive(true);
        child.setVisible(true);
        child.setAlpha(1);
        child.setDepth(0);
      });
      group.setActive(true).setVisible(true).setAlpha(1).setDepth(20);
      this.children.bringToTop(group);

      // The opening Grunt now survives five basic Archer hits. Elite classes
      // receive a meaningful durability jump, then scale with later waves.
      const baseHp = 5 + Math.floor((this.wave - 1) / 3);
      const waveMultiplier = 1 + (this.wave - 1) * 0.18;
      const enemyLevel = enemyRoster.indexOf(enemyType);
      const hpScale = [1, 1.2, 2, 1.6, 1.8, 1.7, 1.9, 2.4, 2.8, 4.2][Math.max(0, enemyLevel)];
      const hp = Math.max(5, Math.round((baseHp + [0, 1, 2][type]) * hpScale * waveMultiplier * (isBoss ? 5 : 1)));
      const barWidth = isBoss ? 70 : 46;
      const bar = this.add.graphics();
      bar.fillStyle(0x342d39); bar.fillRoundedRect(-barWidth / 2, isBoss ? -57 : -39, barWidth, 7, 3);
      bar.fillStyle(0x83e39a); bar.fillRoundedRect(-barWidth / 2 + 1, isBoss ? -56 : -38, barWidth - 2, 5, 2);
      group.add(bar);

      const speedFactor = [1, 1.65, 0.68, 1.35, .82, 1.05, .9, .62, .78, .55][Math.max(0, enemyLevel)];
      const enemy = {
        lane, x, y, baseY: y, group, hp, maxHp: hp, armorLevel,
        speed: isBoss ? 10 + this.wave * 0.8 : Math.min(48, (17 + this.wave * 1.7) * speedFactor),
        bar, isBoss, enemyType, enemyLevel, phase: 1, body, aura, frostRing, feet,
        bobOffset: Phaser.Math.FloatBetween(0, Math.PI * 2),
        specialCooldown: isBoss && this.wave >= 10 ? Phaser.Math.FloatBetween(4.2, 5.2) : 0,
        specialWindup: 0,
        specialRing: null,
        laneAlert: null,
        // Dread Beasts periodically telegraph and perform a short lane charge.
        chargeCooldown: enemyType === "Dread Beast" && this.wave >= 8 ? Phaser.Math.FloatBetween(3.5, 5.5) : 0,
        chargeWindup: 0,
        chargeRemaining: 0,
        charging: false,
        chargeBodyColor: palette.body,
        chargeBodyStroke: palette.dark
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
        const bossWave = this.wave % 5 === 0;
        // Boss waves are full assaults: a larger minion wave followed by the boss.
        this.enemiesPerWave = bossWave
          ? Math.min(28, 16 + Math.floor(this.wave / 5) * 2 + (this.wave > 5 ? 3 : 0))
          : Math.min(28, 8 + Math.floor((this.wave - 1) * 1.2) + (this.wave > 5 ? 3 : 0));
        if (this.wave >= 6 && !this.advancedDeckUnlocked) this.unlockAdvancedDeck();
        this.waveActive = true;
        this.waveTransitioning = false;
        this.spawnTimer.delay = bossWave
          ? Math.max(850, 1350 - Math.floor(this.wave / 5) * 45)
          : Math.max(620, 3200 - (this.wave - 1) * 170 - (this.wave > 5 ? 250 : 0));
        this.spawnTimer.paused = false;
        this.message.textContent = "Wave " + this.wave + " — defend the keep!";
        this.playSound(this.wave % 5 === 0 ? "boss" : "wave");
        this.updateHud();
      });
    }

    showSunwellEnergy(defender, amount) {
      this.updateHud();
      const orb = this.add.circle(defender.x, defender.y - 34, 7, 0xffe58c, 1)
        .setStrokeStyle(2, 0xffffff, 0.95).setDepth(45);
      const glow = this.add.circle(defender.x, defender.y - 34, 13, 0xffe58c, 0.2).setDepth(44);
      const label = this.add.text(defender.x + 16, defender.y - 46, "+" + amount + " ENERGY", {
        fontFamily: "Nunito", fontSize: "12px", fontStyle: "900",
        color: "#fff2a6", stroke: "#26344a", strokeThickness: 3
      }).setDepth(46);
      this.tweens.add({
        targets: [orb, glow, label],
        y: "-=28", alpha: 0, duration: 720, ease: "Cubic.Out",
        onComplete: () => { orb.destroy(); glow.destroy(); label.destroy(); }
      });
      this.playSound("energy");
    }

    update(time, delta) {
      if (!this.battleStarted || this.gameOver || this.questionActive || this.upgradeChoiceActive) return;
      const dt = Math.min(delta / 1000, 0.1);
      const energyDt = Math.min(delta / 1000, 1);
      // Baseline energy regeneration is independent of enemy kills or Sunwell placement.
      // Use a separate bounded clock so low frame rates do not silently slow energy income.
      this.passiveEnergyClock += energyDt;
      let passiveEnergyGained = false;
      while (this.passiveEnergyClock >= 1) {
        this.passiveEnergyClock -= 1;
        const before = this.energy;
        this.energy = Math.min(300, this.energy + 3);
        passiveEnergyGained ||= this.energy > before;
      }
      if (passiveEnergyGained) this.updateHud();
      this.defenders.forEach(d => {
        if (d.poisonUntil && this.time.now < d.poisonUntil && this.time.now >= (d.poisonNextTick || 0)) {
          d.hp = Math.max(0, d.hp - 2);
          d.poisonNextTick = this.time.now + 700;
          if (d.healthBar?.active) this.drawGuardianHealth(d.healthBar, d.hp, d.maxHp);
          if (d.group?.active) {
            const poisonSpark = this.add.circle(d.x + Phaser.Math.Between(-12, 12), d.y - 17, 3, 0x9ee66b, .85).setDepth(50);
            this.tweens.add({ targets: poisonSpark, y: "-=13", alpha: 0, duration: 350, onComplete: () => poisonSpark.destroy() });
          }
          if (d.hp <= 0) {
            if (d.healthBar?.active) d.healthBar.destroy();
            this.tweens.add({ targets: d.group, alpha: 0, scale: .6, duration: 220, onComplete: () => d.group?.destroy() });
            this.defenders = this.defenders.filter(item => item !== d);
            this.message.textContent = d.stats.name + " succumbed to venom!";
            this.playSound("defeat");
            return;
          }
        }
        if (d.stats.energyRate) {
          d.energyClock = (d.energyClock || 0) + energyDt;
          while (d.energyClock >= d.stats.energyInterval) {
            d.energyClock -= d.stats.energyInterval;
            const before = this.energy;
            this.energy = Math.min(300, this.energy + d.stats.energyRate);
            const gained = this.energy - before;
            if (gained > 0) this.showSunwellEnergy(d, gained);
          }
        }
        // Only units with an actual attack value fire projectiles; blockers and energy units remain support units.
        if (!(d.stats.damage > 0) || d.stats.energyRate) return;
        d.cooldown -= dt;
        if (d.cooldown <= 0) {
          // Select the nearest valid target in one pass; avoid allocating and sorting
          // temporary arrays for every defender on every animation frame.
          let target = null;
          let nearestDistance = d.stats.range;
          for (let i = 0; i < this.enemies.length; i++) {
            const candidate = this.enemies[i];
            if (!candidate.group.active || (d.unitType !== "titan" && candidate.lane !== d.lane) || candidate.x <= d.x) continue;
            const distance = candidate.x - d.x;
            if (distance < nearestDistance) {
              nearestDistance = distance;
              target = candidate;
            }
          }
          if (target) { this.fireProjectile(d, target); d.cooldown = d.stats.cooldown * (this.teamSurgeUntil && this.time.now < this.teamSurgeUntil ? 0.72 : 1); }
        }
      });
      for (let projectileIndex = this.projectiles.length - 1; projectileIndex >= 0; projectileIndex--) {
        const p = this.projectiles[projectileIndex];
        if (!p.active) {
          this.projectiles.splice(projectileIndex, 1);
          continue;
        }
        const dx = p.target.x - p.x, dy = p.target.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 13 || !p.target.group.active) {
          p.destroy(); p.active = false;
          this.projectiles.splice(projectileIndex, 1);
          if (p.target.group.active) {
            this.damageEnemy(p.target, p.damage);
            if (p.unitType === "mage" && p.target.group.active) {
              if (p.level >= 3) p.target.stunnedUntil = this.time.now + 1500;
              else p.target.slowUntil = this.time.now + (p.level === 2 ? 4500 : 3000);
              this.message.textContent = "Frost magic slows an enemy!";
            }
            if (p.unitType === "archer" && p.level >= 2) {
              let pierced = 0;
              const maxPierce = p.level >= 3 ? 2 : 1;
              for (let i = 0; i < this.enemies.length && pierced < maxPierce; i++) {
                const candidate = this.enemies[i];
                if (candidate !== p.target && candidate.group.active && candidate.lane === p.target.lane && candidate.x > p.target.x && candidate.x - p.target.x < 105) {
                  this.damageEnemy(candidate, Math.max(1, Math.round(p.damage * (p.level >= 3 ? .7 : .45))));
                  pierced++;
                }
              }
            }
            if (p.unitType === "thorn" && p.level >= 2) {
              const thornRadius = p.level >= 3 ? 165 : 105;
              const thornDamage = Math.max(2, Math.round(p.damage * (p.level >= 3 ? .8 : .45)));
              for (let i = 0; i < this.enemies.length; i++) {
                const nearby = this.enemies[i];
                if (nearby !== p.target && nearby.group.active && nearby.lane === p.target.lane && Math.abs(nearby.x - p.target.x) < thornRadius) {
                  this.damageEnemy(nearby, thornDamage);
                }
              }
            }
            if (p.unitType === "ember" || p.unitType === "phoenix") {
              const splashDamage = p.unitType === "phoenix" ? (p.level >= 3 ? 8 : p.level === 2 ? 5 : 3) : (p.level >= 3 ? 6 : p.level === 2 ? 3 : 1);
              const splashRange = p.level >= 3 ? 175 : p.level === 2 ? 130 : 92;
              // Walk backwards because defeated enemies are removed from this.enemies.
              for (let i = this.enemies.length - 1; i >= 0; i--) {
                const nearby = this.enemies[i];
                if (nearby !== p.target && nearby.group.active && nearby.lane === p.target.lane && Math.abs(nearby.x - p.target.x) < splashRange) {
                  this.damageEnemy(nearby, splashDamage);
                }
              }
            }
            if (p.unitType === "titan" && p.level >= 3 && p.target.isBoss && p.target.group.active) {
              this.damageEnemy(p.target, Math.max(1, Math.ceil(p.target.maxHp * 0.06)), true);
            }
            if (p.unitType === "volt" || p.unitType === "stormcaller") {
              // Ignore destroyed targets and select the nearest live enemy without sorting.
              let chainTarget = null;
              let nearestChainDistance = p.unitType === "stormcaller" ? (p.level >= 3 ? 230 : 175) : (p.level >= 3 ? 190 : p.level === 2 ? 165 : 125);
              for (let i = 0; i < this.enemies.length; i++) {
                const candidate = this.enemies[i];
                if (candidate === p.target || !candidate.group.active || candidate.lane !== p.target.lane) continue;
                const distance = Math.abs(candidate.x - p.target.x);
                if (distance < nearestChainDistance) {
                  nearestChainDistance = distance;
                  chainTarget = candidate;
                }
              }
              const chainDamage = p.unitType === "stormcaller"
                ? Math.max(3, Math.round(p.damage * (p.level >= 3 ? .85 : .65)))
                : Math.max(2, Math.round(p.damage * (p.level >= 3 ? .65 : p.level === 2 ? .45 : .25)));
              if (chainTarget) this.damageEnemy(chainTarget, chainDamage);
              if (p.level >= 3 && chainTarget) {
                let second = null, secondDistance = nearestChainDistance;
                for (let i = 0; i < this.enemies.length; i++) {
                  const candidate = this.enemies[i];
                  if (candidate === p.target || candidate === chainTarget || !candidate.group.active || candidate.lane !== p.target.lane) continue;
                  const distance = Math.abs(candidate.x - chainTarget.x);
                  if (distance < secondDistance) { second = candidate; secondDistance = distance; }
                }
                if (second) this.damageEnemy(second, chainDamage);
              }
            }
          }
        } else {
          p.x += dx / dist * p.projectileSpeed * dt; p.y += dy / dist * p.projectileSpeed * dt;
        }
      }
      for (let enemyIndex = this.enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
        const e = this.enemies[enemyIndex];
        if (!e.group.active) {
          this.enemies.splice(enemyIndex, 1);
          continue;
        }
        // Enemies must collide with and attack ANY defender, not walk through attackers.
        let blocker = null;
        for (let i = 0; i < this.defenders.length; i++) {
          const candidate = this.defenders[i];
          if (candidate.group.active && candidate.lane === e.lane && candidate.hp > 0 && candidate.x < e.x && e.x - candidate.x < 42) {
            blocker = candidate;
            break;
          }
        }
        if (blocker) {
          e.x = Math.max(e.x, blocker.x + 34);
          e.attackCooldown = (e.attackCooldown || 0) - dt;
          if (e.attackCooldown <= 0) {
            const baseHit = ["Brute", "War Crusher", "Dread Beast", "Dark Overlord"].includes(e.enemyType) ? 6 : e.enemyType === "Runner" || e.enemyType === "Shadow Stalker" ? 2 : e.enemyType === "Venom Beast" ? 4 : 3;
            const rawHit = Math.ceil(baseHit * (1 + (this.wave - 1) * 0.1));
            const guardReduction = blocker.unitType === "guardian" && blocker.level >= 2
              ? (blocker.level >= 3 ? .45 : .25) : 0;
            const hit = Math.max(1, Math.ceil(rawHit * (1 - guardReduction) * (1 - Math.min(.35, blocker.damageReduction || 0))));
            blocker.hp = Math.max(0, blocker.hp - hit);
            if (e.enemyType === "Venom Beast") {
              const poisonAlreadyActive = blocker.poisonUntil && blocker.poisonUntil > this.time.now;
              blocker.poisonUntil = this.time.now + 3200;
              if (!poisonAlreadyActive) blocker.poisonNextTick = this.time.now + 700;
            }
            if (e.enemyType === "Dark Caster") {
              const drained = Math.min(this.energy, 4);
              this.energy -= drained;
              if (drained > 0) this.message.textContent = "Dark Caster drained " + drained + " energy!";
            }
            if (e.enemyType === "War Crusher" && blocker.unitType === "guardian") {
              blocker.hp = Math.max(0, blocker.hp - Math.ceil(hit * .35));
            }
            if (blocker.healthBar?.active) this.drawGuardianHealth(blocker.healthBar, blocker.hp, blocker.maxHp);
            this.tweens.add({ targets: blocker.group, x: blocker.x - 3, yoyo: true, duration: 70 });
            this.tweens.add({ targets: e.group, x: e.x + 2, yoyo: true, duration: 70 });
            e.attackCooldown = 0.85;
            // A defender struck in melee also retaliates. Ranged defenders keep their
            // projectile damage; support/tank units gain a small close-range counter.
            blocker.retaliateCooldown = (blocker.retaliateCooldown || 0) - dt;
            if (blocker.retaliateCooldown <= 0 && e.group.active) {
              const baseCounterDamage = blocker.stats.damage > 0
                ? Math.max(1, Math.ceil(blocker.stats.damage * (blocker.level >= 3 ? 1.25 : blocker.level === 2 ? .9 : .65)) )
                : blocker.unitType === "titan" ? 14
                : blocker.unitType === "runeblade" ? (blocker.level >= 3 ? 18 : blocker.level === 2 ? 13 : 10)
                : blocker.unitType === "knight" ? 6
                : blocker.unitType === "guardian" ? 3 : 1;
              const counterDamage = Math.max(1, Math.ceil(baseCounterDamage * (blocker.counterDamageMultiplier || 1)));
              this.damageEnemy(e, counterDamage);
              if (blocker.level >= 3 && blocker.unitType === "knight" && e.group.active) {
                this.damageEnemy(e, Math.ceil(counterDamage * .5));
              }
              blocker.retaliateCooldown = blocker.level >= 3 ? .65 : .85;
              if (!e.group.active) continue;
            }
            if (blocker.hp <= 0) {
              if (blocker.healthBar?.active) blocker.healthBar.destroy();
              this.tweens.add({ targets: blocker.group, alpha: 0, scale: .65, duration: 260, onComplete: () => blocker.group?.destroy() });
              this.defenders = this.defenders.filter(d => d !== blocker);
              this.message.textContent = blocker.stats.name + " has fallen! The lane is open.";
              this.playSound("defeat");
            }
          }
        } else {
          const stunned = e.stunnedUntil && this.time.now < e.stunnedUntil;
          const slowed = e.slowUntil && this.time.now < e.slowUntil;
          const pressured = this.time.now < this.enemyPressureUntil;
          const pressureFactor = pressured ? (e.isBoss ? 1.1 : 1.18) : 1;
          if (e.enemyType === "Dread Beast" && !stunned) {
            if (e.chargeCooldown > 0 && !e.chargeWindup && !e.charging) {
              e.chargeCooldown -= dt;
              if (e.chargeCooldown <= 0) {
                // A readable wind-up gives players a brief chance to react.
                e.chargeWindup = .7;
                if (e.aura?.active) e.aura.setFillStyle(0xff8d6b, .34);
                if (e.body?.active) e.body.setStrokeStyle(4, 0xffd27a);
                this.message.textContent = "DREAD BEAST WINDING UP — lane " + (e.lane + 1) + "!";
              }
            }
            if (e.chargeWindup > 0) {
              e.chargeWindup = Math.max(0, e.chargeWindup - dt);
              if (e.chargeWindup === 0) {
                e.charging = true;
                e.chargeRemaining = .8;
                e.chargeCooldown = Phaser.Math.FloatBetween(6.5, 8.5);
              }
            }
            if (e.charging) {
              e.chargeRemaining = Math.max(0, e.chargeRemaining - dt);
              if (e.chargeRemaining === 0) {
                e.charging = false;
                if (e.aura?.active) e.aura.setFillStyle(0xf08ba7, .07);
                if (e.body?.active) e.body.setStrokeStyle(3, e.chargeBodyStroke);
              }
            }
          }
          const chargeFactor = e.charging ? 2.15 : 1;
          e.x -= stunned ? 0 : e.speed * chargeFactor * (slowed ? 0.38 : 1) * pressureFactor * dt;
        }
        // From the second boss onward, the Dark Overlord charges a lane-targeted
        // Rift Pulse. The expanding ring gives players time to react; a boss freeze
        // pauses the charge rather than letting the attack bypass the control power.
        if (e.isBoss && this.wave >= 10 && !(e.stunnedUntil && this.time.now < e.stunnedUntil)) {
          if (e.specialWindup > 0) {
            e.specialWindup = Math.max(0, e.specialWindup - dt);
            if (e.specialRing?.active) {
              const chargeRatio = 1 - e.specialWindup / 1.15;
              e.specialRing.setScale(1 + chargeRatio * .45).setAlpha(.12 + chargeRatio * .5);
              if (e.laneAlert?.active) e.laneAlert.setAlpha(.05 + chargeRatio * .2).setScale(1, 1 + chargeRatio * .025);
            }
            if (e.specialWindup === 0) {
              if (e.specialRing?.active) e.specialRing.destroy();
              if (e.laneAlert?.active) e.laneAlert.destroy();
              e.specialRing = null;
              e.laneAlert = null;
              const pulseDamage = 8 + Math.floor(this.wave / 5) * 2 + (e.phase - 1) * 3;
              let defendersHit = 0;
              for (let i = this.defenders.length - 1; i >= 0; i--) {
                const defender = this.defenders[i];
                if (defender.lane !== e.lane || defender.hp <= 0) continue;
                defender.hp = Math.max(0, defender.hp - Math.max(1, Math.ceil(pulseDamage * (1 - Math.min(.35, defender.damageReduction || 0)))));
                defendersHit++;
                if (defender.healthBar?.active) this.drawGuardianHealth(defender.healthBar, defender.hp, defender.maxHp);
                if (defender.hp <= 0) {
                  if (defender.healthBar?.active) defender.healthBar.destroy();
                  this.tweens.add({ targets: defender.group, alpha: 0, scale: .65, duration: 220, onComplete: () => defender.group?.destroy() });
                  this.defenders.splice(i, 1);
                }
              }
              const energyDrain = 8 + (e.phase - 1) * 4;
              const drained = Math.min(this.energy, energyDrain);
              this.energy -= drained;
              this.message.textContent = "RIFT PULSE — PHASE " + e.phase + "! Lane " + (e.lane + 1) + " takes " + pulseDamage + " damage" + (defendersHit ? " — " + defendersHit + " defender(s) struck" : "") + "; -" + drained + " energy.";
              this.cameras.main.shake(120, .0025);
              this.playSound("boss");
              this.updateHud();
              e.specialCooldown = Math.max(5.2, 7.5 - (e.phase - 1) * 1.1);
            }
          } else {
            e.specialCooldown -= dt;
            if (e.specialCooldown <= 0) {
              e.specialWindup = 1.15;
              e.specialRing = this.add.circle(0, 0, 48, 0xf06caa, .12)
                .setStrokeStyle(3, 0xff9bc8, .95);
              e.group.add(e.specialRing);
              e.specialRing.setScale(1).setAlpha(.12);
              const laneY = GRID_Y + e.lane * TILE_H + TILE_H / 2;
              e.laneAlert = this.add.rectangle(GRID_X + GRID_W / 2, laneY, GRID_W - 6, TILE_H - 7, 0xff4f95, .05)
                .setStrokeStyle(2, 0xff9bc8, .85).setDepth(6);
              this.message.textContent = "RIFT PULSE CHARGING — defend lane " + (e.lane + 1) + "!";
            }
          }
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
      }
      // Projectiles are removed during the reverse traversal, avoiding a
      // second full-array scan and a temporary filtered array.
      this.checkWaveProgress();
    }

    fireProjectile(defender, target) {
      const stats = defender.stats;
      const p = this.add.container(defender.x + 18, defender.y - 5).setDepth(30);
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
      } else if (defender.unitType === "stormcaller") {
        const glow = this.add.circle(0, 0, 20, 0x8fe7f2, .3);
        const bolt = this.add.star(0, 0, 6, 5, 16, 0xe3ffff).setStrokeStyle(2, 0xffffff);
        p.add([glow, bolt]);
      } else if (defender.unitType === "mage") {
        const glow = this.add.circle(0, 0, 18, 0x9deaff, .2);
        const core = this.add.star(0, 0, 6, 5, 10, 0xb9f4ff).setStrokeStyle(2, 0xffffff);
        p.add([glow, core]);
      } else {
        const glow = this.add.circle(0, 0, defender.unitType === "titan" ? 23 : 14, stats.color, .28);
        const core = defender.unitType === "titan"
          ? this.add.star(0, 0, 8, 8, 18, 0xe8d8ff).setStrokeStyle(3, 0xffffff)
          : this.add.circle(0, 0, 7, stats.color).setStrokeStyle(2, 0xfff8d8);
        p.add([glow, core]);
      }
      p.target = target;
      p.damage = stats.damage;
      p.projectileSpeed = stats.projectileSpeed;
      p.unitType = defender.unitType;
      p.level = defender.level || 1;
      this.projectiles.push(p);
      // Keep firing audible without stacking identical sounds when many
      // defenders release projectiles on the same frame.
      if (!this.lastShotSoundAt || this.time.now - this.lastShotSoundAt >= 85) {
        this.lastShotSoundAt = this.time.now;
        this.playSound("shot");
      }
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

    damageEnemy(enemy, amount, bypassArmor = false) {
      if (!enemy.group.active) return;
      const typeAdjustedDamage = ["Brute", "Bone Warrior", "War Crusher"].includes(enemy.enemyType) && !enemy.isBoss ? Math.max(0.75, amount * (enemy.enemyType === "Bone Warrior" ? 0.65 : 0.75)) : amount;
      const appliedDamage = Math.max(0.5, typeAdjustedDamage * (bypassArmor ? 1 : 1 - Math.min(0.4, (enemy.armorLevel || 0) * 0.08)));
      enemy.hp -= appliedDamage;
      if (enemy.isBoss) {
        const healthRatio = enemy.hp / enemy.maxHp;
        const nextPhase = healthRatio <= 0.25 ? 3 : healthRatio <= 0.6 ? 2 : 1;
        if (nextPhase > enemy.phase) {
          enemy.phase = nextPhase;
          enemy.speed = Math.min(enemy.speed * (nextPhase === 2 ? 1.2 : 1.3), 42);
          this.message.textContent = nextPhase === 2
            ? "BOSS PHASE II! The Overlord accelerates its Rift Pulse."
            : "BOSS PHASE III! The Overlord's Rift Pulse reaches maximum power!";
          this.playSound("boss");
          this.tweens.add({ targets: [enemy.body, enemy.aura], alpha: 0.45, yoyo: true, duration: 150, repeat: 2 });
          if (enemy.aura?.active) enemy.aura.setFillStyle(nextPhase === 3 ? 0xff5c9d : 0xd47bff);
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
      // Throttle cosmetic hit feedback so dense waves do not create
      // overlapping tweens or a burst of identical hit sounds.
      const hitFeedbackReady = !enemy.lastHitFeedbackAt || this.time.now - enemy.lastHitFeedbackAt >= 140;
      if (hitFeedbackReady) {
        enemy.lastHitFeedbackAt = this.time.now;
        enemy.group.setScale(1.08);
        this.tweens.add({ targets: enemy.group, scale: 1, duration: 110 });
      }
      if (!this.lastHitSoundAt || this.time.now - this.lastHitSoundAt >= 75) {
        this.lastHitSoundAt = this.time.now;
        this.playSound("hit");
      }
      if (enemy.hp <= 0) {
        if (enemy.laneAlert?.active) enemy.laneAlert.destroy();
        const burst = this.add.circle(enemy.x, enemy.y, 12, 0xffd58c, .8);
        this.tweens.add({ targets: burst, scale: 2.8, alpha: 0, duration: 260, onComplete: () => burst.destroy() });
        enemy.group.destroy();
        this.enemies = this.enemies.filter(e => e !== enemy);
        this.kills++;
        this.playSound("defeat");
        this.energy = Math.min(300, this.energy + (enemy.isBoss ? 25 : 8));
        this.updateHud();
      }
    }

    damageBase(enemy) {
      if (enemy.laneAlert?.active) enemy.laneAlert.destroy();
      enemy.group.destroy();
      this.enemies = this.enemies.filter(e => e !== enemy);
      const lane = enemy.lane;
      if (this.laneLives[lane] > 0) {
        this.laneLives[lane]--;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const other = this.enemies[i];
          if (other.lane !== lane) continue;
          if (other.laneAlert?.active) other.laneAlert.destroy();
          if (other.group.active) other.group.destroy();
          this.enemies.splice(i, 1);
        }
        this.message.textContent = "LANE " + (lane + 1) + " BREACHED! Lane guard cleared the attackers. " + this.laneLives[lane] + " lives left.";
        this.playSound("lane");
      } else {
        const shieldAbsorbed = Math.min(this.baseShield, 10);
        this.baseShield -= shieldAbsorbed;
        this.baseHealth = Math.max(0, this.baseHealth - (10 - shieldAbsorbed));
        this.message.textContent = "LANE " + (lane + 1) + " IS EXPOSED! The keep has taken damage.";
        this.enemies = this.enemies.filter(active => active !== enemy);
        enemy.group.destroy();
      }
      this.cameras.main.shake(130, 0.004);
      this.updateHud();
      if (this.baseHealth <= 0) this.endGame(false);
    }

    showQuestion(isBoss = false) {
      if (!this.battleStarted || this.gameOver) return;
      if (this.upgradeChoiceActive) {
        if (isBoss) this.pendingBossQuestion = true;
        return;
      }
      if (this.questionActive) {
        if (isBoss) this.pendingBossQuestion = true;
        return;
      }
      this.questionActive = true;
      this.questionAnswered = false;
      if (this.spawnTimer) this.spawnTimer.paused = true;
      if (this.questionTimer && isBoss) this.questionTimer.paused = true;
      let pool = isBoss ? BOSS_QUESTIONS : (this.customQuestions.length ? this.customQuestions : QUESTIONS);
      if (!isBoss && !this.customQuestions.length && this.difficulty === "easy") pool = QUESTIONS.filter(q => q.grade === "7–9");
      if (!isBoss && !this.customQuestions.length && this.difficulty === "hard") pool = QUESTIONS.filter(q => q.grade === "10–12");
      if (!Array.isArray(pool) || pool.length === 0) pool = isBoss ? BOSS_QUESTIONS : QUESTIONS;
      const item = pool[(isBoss ? this.bossQuestionIndex++ : this.questionIndex++) % pool.length];
      this.isBossQuestion = isBoss;
      const overlay = this.add.container(0, 0).setDepth(1000);
      this.questionOverlay = overlay;
      const shade = this.add.rectangle(480, 170, 960, 340, 0x071321, .84).setInteractive();
      const panel = this.add.rectangle(480, 170, 770, 310, isBoss ? 0x321d35 : 0x172d49, .99).setStrokeStyle(3, isBoss ? 0xf0a0c3 : 0x91d8c2);
      const topGlow = this.add.rectangle(480, 22, 760, 5, 0x91e5c2, .9);
      const eyebrow = this.add.text(480, 43, isBoss ? "☠  BOSS GRAMMAR TRIAL  ☠" : "✦  GRAMMAR CHALLENGE  ✦", {
        fontFamily: "Nunito", fontSize: "15px", color: "#a9f0cf", fontStyle: "900", letterSpacing: 2
      }).setOrigin(.5);
      const topic = this.add.text(480, 72, item.topic.toUpperCase(), {
        fontFamily: "Nunito", fontSize: "12px", color: "#ffd779", fontStyle: "900", letterSpacing: 1.4
      }).setOrigin(.5);
      const question = this.add.text(480, 111, item.q, {
        fontFamily: "Nunito", fontSize: "22px", color: "#ffffff", fontStyle: "900",
        align: "center", wordWrap: { width: 680 }, lineSpacing: 7
      }).setOrigin(.5);
      const instruction = this.add.text(480, 158, "Choose the correct answer to unleash a battle power", {
        fontFamily: "Nunito", fontSize: "12px", color: "#b6c8dc", fontStyle: "700"
      }).setOrigin(.5);
      overlay.add([shade, panel, topGlow, eyebrow, topic, question, instruction]);
      const compactAnswers = item.a.length >= 4;
      item.a.forEach((answer, index) => {
        // Four-choice banks must fit inside the question panel without covering feedback.
        const y = (compactAnswers ? 184 : 192) + index * (compactAnswers ? 35 : 40);
        const button = this.add.rectangle(480, y, 660, compactAnswers ? 30 : 34, 0x294969, 1).setStrokeStyle(2, 0x587d9b).setInteractive({ useHandCursor: true });
        const label = this.add.text(480, y, (index + 1) + ".  " + answer, {
          fontFamily: "Nunito", fontSize: compactAnswers ? "14px" : "16px", color: "#ffffff", fontStyle: "900",
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
      if (!this.questionActive || this.questionAnswered) return;
      this.questionAnswered = true;
      const correct = index === item.correct;
      this.questionsAnswered++;
      if (correct) this.correctAnswers++; else this.incorrectAnswers++;
      if (typeof window.GD_SAVE_ATTEMPT === "function") {
        Promise.resolve(window.GD_SAVE_ATTEMPT({
          topic: item.topic, question: item.q, selectedAnswer: item.a[index],
          correctAnswer: item.a[item.correct], correct, isBoss: Boolean(this.isBossQuestion)
        })).catch(error => console.warn("Could not save question attempt:", error));
      }
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
        // A wrong answer briefly increases enemy pressure; repeated mistakes
        // extend the effect rather than stacking unbounded speed multipliers.
        this.enemyPressureUntil = Math.max(this.enemyPressureUntil || 0, this.time.now) + 5000;
        this.message.textContent = "Not quite! Enemies surge forward for a moment — defend your lanes!";
      }
      const feedback = this.add.text(480, 319, correct ? "CORRECT! BATTLE POWER ACTIVATED" : "NOT QUITE — THE BATTLE CONTINUES", {
        fontFamily: "Nunito", fontSize: "13px", color: correct ? "#9cf0bf" : "#ffb4b4", fontStyle: "900", letterSpacing: 1
      }).setOrigin(.5);
      this.questionOverlay.add(feedback);
      this.time.delayedCall(1150, () => {
        if (this.questionOverlay) this.questionOverlay.destroy(true);
        this.questionOverlay = null;
        this.questionActive = false;
        this.questionAnswered = false;
        this.isBossQuestion = false;
        if (this.pendingBossQuestion && !this.gameOver) {
          this.pendingBossQuestion = false;
          this.showQuestion(true);
          return;
        }
        if (!this.gameOver && this.spawnTimer) this.spawnTimer.paused = false;
        if (!this.gameOver && this.questionTimer) this.questionTimer.paused = false;
      });
    }

    applyGrammarPower(effect = "POWER SURGE!") {
      const label = String(effect).toUpperCase();
      let feedback = effect;
      let color = "#ffe58c";
      const activeEnemies = () => this.enemies.filter(enemy => enemy.group.active);
      const activeBosses = () => activeEnemies().filter(enemy => enemy.isBoss);
      const boss = activeBosses().sort((a, b) => a.x - b.x)[0] || null;
      const damageFrontEnemies = (amount, limit = 3) => {
        const targets = activeEnemies().sort((a, b) => a.x - b.x).slice(0, limit);
        targets.forEach(enemy => this.damageEnemy(enemy, amount));
        return targets.length;
      };
      const bossDamage = (fraction, minimum) => {
        if (!boss || !boss.group.active) return 0;
        const amount = Math.max(minimum, Math.ceil(boss.maxHp * fraction));
        this.damageEnemy(boss, amount, true);
        return amount;
      };

      if (label.includes("FREEZE")) {
        const enemies = activeEnemies();
        enemies.forEach(enemy => {
          if (enemy.isBoss) {
            enemy.stunnedUntil = this.time.now + 4800;
            enemy.slowUntil = enemy.stunnedUntil;
          } else {
            enemy.slowUntil = this.time.now + 5200;
          }
          this.tweens.add({ targets: enemy.body, tint: 0x8feaff, duration: 180, yoyo: true, repeat: 2 });
        });
        feedback = boss ? "BOSS FROZEN! The boss is stopped for 4.8 seconds." : "FREEZE BLAST! All attackers slowed.";
        color = "#9deaff";
      } else if (label.includes("REGENERATION") || label.includes("DEFENSE UP")) {
        const restored = Math.min(25, 100 - this.baseHealth);
        this.baseHealth += restored;
        this.baseShield = Math.min(60, this.baseShield + 12);
        this.energy = Math.min(300, this.energy + 25);
        feedback = "FORTIFY! +" + restored + "% keep health, +12 shield, +25 energy.";
        color = "#8de1a4";
      } else if (label.includes("ARMOR BREAK") || label.includes("SHIELD PIERCE") || label.includes("WEAKNESS")) {
        const count = damageFrontEnemies(5, 4);
        const dealt = bossDamage(.10, 18);
        feedback = "ARMOR SHATTER! " + count + " attackers hit" + (dealt ? "; boss takes " + dealt + " piercing damage." : ".");
        color = "#ffd27a";
      } else if (label.includes("CRITICAL") || label.includes("PRECISION") || label.includes("RAPID STRIKE") || label.includes("ECHO STRIKE") || label.includes("TARGET LOCK") || label.includes("FUTURE SIGHT") || label.includes("SPELL BREAK") || label.includes("TIME BREAK")) {
        let target = boss || activeEnemies().sort((a, b) => a.x - b.x)[0] || null;
        let dealt = 0;
        if (target) {
          dealt = target.isBoss ? bossDamage(.18, 30) : (this.damageEnemy(target, 12), 12);
        }
        this.energy = Math.min(300, this.energy + 15);
        feedback = target ? (target.isBoss ? "BOSS CRITICAL! " + dealt + " armor-piercing damage!" : "CRITICAL STRIKE! 12 damage!") : "CRITICAL STRIKE! +15 ENERGY";
        color = "#ffb3a8";
      } else if (label.includes("GUARDIAN SHIELD")) {
        this.baseShield = Math.min(60, this.baseShield + 30);
        this.energy = Math.min(300, this.energy + 25);
        feedback = "GUARDIAN SHIELD! +30 shield and +25 energy.";
        color = "#b9d8ff";
      } else if (label.includes("DRAGON FURY")) {
        const enemies = activeEnemies();
        enemies.forEach(enemy => { if (!enemy.isBoss) this.damageEnemy(enemy, 8); });
        const dealt = bossDamage(.12, 24);
        this.energy = Math.min(300, this.energy + 20);
        feedback = "DRAGON FURY! Battlefield blast" + (dealt ? " + " + dealt + " boss damage!" : " +20 energy!");
        color = "#ffb27c";
      } else if (label.includes("SUPPLY") || label.includes("ENERGY SURGE") || label.includes("POWER SURGE") || label.includes("TEAM SURGE") || label.includes("TIME SURGE") || label.includes("FOCUS BONUS") || label.includes("DEADLINE DASH")) {
        this.energy = Math.min(300, this.energy + 45);
        // Correct answers also briefly empower every deployed attacker.
        this.teamSurgeUntil = this.time.now + 9000;
        feedback = "TEAM SURGE! +45 energy and 9 seconds of faster attacks.";
        color = "#ffe58c";
      } else {
        const count = damageFrontEnemies(3, 4);
        const dealt = bossDamage(.08, 15);
        this.energy = Math.min(300, this.energy + 20);
        feedback = "GRAMMAR POWER! " + count + " enemies hit" + (dealt ? "; boss takes " + dealt + " damage." : "; +20 energy.");
      }

      this.updateHud();
      const flash = this.add.rectangle(480, 185, 720, 270, 0xffe58c, .12);
      this.tweens.add({ targets: flash, alpha: 0, duration: 420, onComplete: () => flash.destroy() });
      const toast = this.add.text(480, 42, feedback, {
        fontFamily: "Nunito", fontSize: "17px", color, fontStyle: "900",
        stroke: "#17233a", strokeThickness: 4, align: "center",
        wordWrap: { width: 680 }
      }).setOrigin(.5);
      this.tweens.add({
        targets: toast, y: 48, alpha: 0, duration: 2200, delay: 350,
        onComplete: () => toast.destroy()
      });
    }

    updateHud() {
      this.energyText.textContent = this.energy;
      this.energyFill.style.width = (this.energy / 300 * 100) + "%";
      this.unitCards.forEach(card => {
        const stats = this.unitStats[card.dataset.unit];
        if (stats) {
          const affordable = this.energy >= stats.cost;
          card.classList.toggle("unaffordable", !affordable);
          card.setAttribute("aria-label", stats.name + ", " + stats.role + ", costs " + stats.cost + " energy" + (affordable ? "" : ", not enough energy yet"));
          card.setAttribute("aria-pressed", String(card.dataset.unit === this.selectedUnit));
        }
      });
      this.waveText.textContent = this.wave;
      this.baseText.textContent = this.baseHealth + "%" + (this.baseShield > 0 ? " +" + this.baseShield : "");
      if (this.laneLivesText) this.laneLivesText.textContent = this.laneLives.map((lives, lane) => (lane + 1) + ":" + "♥".repeat(lives) + "♡".repeat(3 - lives)).join("  ");
      this.laneLifeLabels?.forEach((label, lane) => label.setText("♥".repeat(this.laneLives[lane]) + "♡".repeat(3 - this.laneLives[lane])));
      if (this.timerText) {
        const seconds = this.remainingSeconds;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        this.timerText.textContent = String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
      }
    }

    tickBattleClock() {
      if (!this.battleStarted || this.gameOver || this.questionActive || this.upgradeChoiceActive) return;
      {
        this.elapsedSeconds++;
        this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
        if (this.remainingSeconds === 0) {
          this.endGame(this.endlessMode, this.endlessMode ? "TIME LIMIT REACHED!" : "TIME IS UP! DEFENSE INCOMPLETE");
          return;
        }
      }
      this.updateHud();
    }

    endGame(won, customTitle = "") {
      if (this.gameOver) return;
      this.gameOver = true;
      if (typeof window.GD_SAVE_RESULT === "function") {
        const result = {
          questionsAnswered: this.questionsAnswered,
          correctAnswers: this.correctAnswers,
          incorrectAnswers: this.incorrectAnswers,
          accuracy: this.questionsAnswered ? Math.round(this.correctAnswers / this.questionsAnswered * 100) : 0,
          kills: this.kills, wave: this.wave, won: Boolean(won),
          mode: this.endlessMode ? "endless" : "fixed",
          elapsedSeconds: this.elapsedSeconds, remainingSeconds: this.remainingSeconds,
          baseHealth: this.baseHealth
        };
        Promise.resolve(window.GD_SAVE_RESULT(result)).catch(error => console.warn("Could not save game result:", error));
      }
      if (this.spawnTimer) this.spawnTimer.paused = true;
      if (this.questionTimer) this.questionTimer.paused = true;
      this.stopMusic();
      this.add.rectangle(480, 170, 960, 340, 0x081323, .78);
      this.add.text(480, 145, customTitle || (won ? "THE KEEP IS SAFE!" : "THE KEEP HAS FALLEN"), { fontFamily: "Nunito", fontSize: "34px", color: "#fff1c5", fontStyle: "900" }).setOrigin(.5);
      this.add.text(480, 190, "Press Restart to defend the frontier again.", { fontFamily: "Nunito", fontSize: "18px", color: "#ffffff" }).setOrigin(.5);
      this.message.textContent = won ? "Victory!" : "Defeat!";
      this.playSound(won ? "victory" : "defeat");
    }

    clearTimers() { this.time.removeAllEvents(); this.stopMusic(); }
  };
}
