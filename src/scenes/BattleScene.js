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
      this.events.on("shutdown", () => this.clearTimers());
      this.updateHud();
    }

    drawWorld() {
      const g = this.add.graphics();
      g.fillGradientStyle(0x244c4b, 0x244c4b, 0x365d50, 0x365d50, 1);
      g.fillRect(0, 0, 960, 540);
      for (let lane = 0; lane < LANES; lane++) {
        const y = GRID_Y + lane * TILE_H;
        g.fillStyle(lane % 2 ? 0x3b7058 : 0x477b5e, 0.9);
        g.fillRoundedRect(GRID_X, y, GRID_W, TILE_H, 5);
        g.lineStyle(2, 0x8bb78a, 0.22);
        g.strokeRoundedRect(GRID_X, y, GRID_W, TILE_H, 5);
        for (let col = 0; col < 7; col++) {
          const x = GRID_X + col * TILE_W;
          g.lineStyle(1, 0xd1e3ad, 0.18);
          g.strokeRect(x, y, TILE_W, TILE_H);
          if ((lane + col) % 3 === 0) {
            g.fillStyle(0x9dc57c, 0.18);
            g.fillCircle(x + 24, y + 24, 3);
            g.fillCircle(x + 78, y + 63, 2);
          }
        }
      }
      // Friendly base and enemy gate
      g.fillStyle(0x9ad5a4, 1); g.fillRoundedRect(18, GRID_Y + 68, 42, 350, 12);
      g.fillStyle(0x6b4b54, 1); g.fillRoundedRect(850, GRID_Y + 68, 88, 350, 12);
      this.add.text(28, 54, "KEEP", { fontFamily: "Nunito", fontSize: "13px", color: "#d8ffe4", fontStyle: "900" });
      this.add.text(864, 54, "DARK GATE", { fontFamily: "Nunito", fontSize: "13px", color: "#ffe1e1", fontStyle: "900" });
      this.add.text(480, 28, "THE EMERALD FRONTIER", { fontFamily: "Nunito", fontSize: "16px", color: "#e8f5d5", fontStyle: "900" }).setOrigin(.5);
      for (let i = 0; i < LANES; i++) {
        this.add.text(39, GRID_Y + i * TILE_H + TILE_H / 2, String(i + 1), { fontFamily: "Nunito", fontSize: "16px", color: "#163d36", fontStyle: "900" }).setOrigin(.5);
      }
    }

    createHud() {
      this.energyText = document.getElementById("energy-value");
      this.energyFill = document.getElementById("energy-fill");
      this.waveText = document.getElementById("wave-value");
      this.baseText = document.getElementById("base-value");
      this.message = document.getElementById("battle-message");
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
        if (this.audioContext && this.audioContext.state === "suspended") this.audioContext.resume();
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
      const shadow = this.add.ellipse(0, 25, 58, 14, 0x10251d, .28);
      const body = this.add.circle(0, 0, unitType === "mage" ? 23 : 22, stats.body).setStrokeStyle(3, unitType === "archer" ? 0x8a5d28 : 0x2b7957);
      const accent = unitType === "sprout"
        ? [this.add.ellipse(-13, -21, 18, 29, 0x4baf77).setRotation(-.65), this.add.ellipse(13, -21, 18, 29, 0x5fc98a).setRotation(.65)]
        : [this.add.circle(0, -25, 9, unitType === "mage" ? 0x83eaff : 0xf5d58e)];
      const face = this.add.text(0, 0, stats.symbol, { fontFamily: "Arial", fontSize: unitType === "archer" ? "21px" : "22px", color: "#fff6c9", fontStyle: "bold" }).setOrigin(.5);
      group.add([shadow, ...accent, body, face]);
      this.tweens.add({ targets: group, scale: { from: .3, to: 1 }, duration: 260, ease: "Back.Out" });
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
      const color = [0xc87973, 0x8c82c7, 0xc69b5b][type];
      const isBoss = this.enemiesSpawnedThisWave === this.enemiesPerWave - 1 && this.wave % 5 === 0;
      const radius = isBoss ? 31 : [23, 19, 27][type];
      const group = this.add.container(x, y);
      const shadow = this.add.ellipse(0, 25, isBoss ? 76 : radius * 2.25, 13, 0x10251d, .3);
      const body = this.add.circle(0, 0, radius, isBoss ? 0x9f4264 : color).setStrokeStyle(3, 0x4c3949);
      const horn = this.add.triangle(0, isBoss ? -29 : -radius, -12, 8, 12, 8, 0, 0xead9ad);
      const eyes = this.add.text(0, -2, isBoss ? "◆" : ["••", "»", "▰"][type], { fontSize: isBoss ? "20px" : "17px", color: "#fff" }).setOrigin(.5);
      group.add([shadow, body, horn, eyes]);

      const baseHp = (this.wave > 2 ? 3 + Math.floor((this.wave - 1) / 3) : 2);
      const hp = (baseHp + [0, -1, 2][type]) * (isBoss ? 5 : 1);
      const barWidth = isBoss ? 64 : 46;
      const bar = this.add.graphics();
      bar.fillStyle(0x342d39); bar.fillRoundedRect(-barWidth / 2, isBoss ? -48 : -37, barWidth, 6, 3);
      bar.fillStyle(0x83e39a); bar.fillRoundedRect(-barWidth / 2 + 1, isBoss ? -47 : -36, barWidth - 2, 4, 2);
      group.add(bar);
      const speedFactor = [1, 1.65, 0.68][type];
      this.enemies.push({
        lane, x, y, group, hp, maxHp: hp,
        speed: isBoss ? 10 + this.wave * 0.6 : (17 + this.wave * 1.2) * speedFactor,
        bar, isBoss, enemyType, phase: 1, body
      });
      this.enemiesSpawnedThisWave++;
      if (isBoss) {
        this.message.textContent = "BOSS APPROACHING!";
        this.playSound("boss");
      }
    }

    checkWaveProgress() {
      if (this.gameOver || !this.waveActive || this.waveTransitioning) return;
      if (this.enemiesSpawnedThisWave < this.enemiesPerWave || this.enemies.length > 0) return;

      this.waveActive = false;
      this.waveTransitioning = true;
      this.spawnTimer.paused = true;
      if (this.wave >= this.maxWaves) {
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
      const dt = delta / 1000;
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
        if (e.x < 65) this.damageBase(e);
      });
      this.projectiles = this.projectiles.filter(p => p.active);
      this.checkWaveProgress();
    }

    fireProjectile(defender, target) {
      const stats = defender.stats;
      const p = this.add.circle(defender.x + 18, defender.y - 5, stats.radius, stats.color).setStrokeStyle(2, 0xfff8d8);
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
          enemy.speed *= nextPhase === 2 ? 1.2 : 1.3;
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
    }

    endGame(won) {
      this.gameOver = true;
      if (this.spawnTimer) this.spawnTimer.paused = true;
      this.add.rectangle(480, 315, 960, 540, 0x081323, .76);
      this.add.text(480, 260, won ? "THE KEEP IS SAFE!" : "THE KEEP HAS FALLEN", { fontFamily: "Nunito", fontSize: "34px", color: "#fff1c5", fontStyle: "900" }).setOrigin(.5);
      this.add.text(480, 315, "Press Restart to defend the frontier again.", { fontFamily: "Nunito", fontSize: "18px", color: "#ffffff" }).setOrigin(.5);
      this.message.textContent = won ? "Victory!" : "Defeat!";
      this.playSound(won ? "victory" : "defeat");
    }

    clearTimers() { this.time.removeAllEvents(); }
  };
}
