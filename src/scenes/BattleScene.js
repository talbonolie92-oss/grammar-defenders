const LANES = 5;
const TILE_W = 108;
const TILE_H = 88;
const GRID_X = 72;
const GRID_Y = 86;
const GRID_W = TILE_W * 7;
const GRID_H = TILE_H * LANES;
const QUESTIONS = [
  { q: "Choose the correct sentence.", a: ["She go to school.", "She goes to school.", "She going school."], correct: 1, effect: "CRITICAL HIT!" },
  { q: "Which word is an adjective?", a: ["Quickly", "Beautiful", "Run"], correct: 1, effect: "ARMOR BREAK!" },
  { q: "Choose the correct past tense.", a: ["Buyed", "Bought", "Buying"], correct: 1, effect: "WEAKNESS REVEALED!" },
  { q: "Which sentence uses 'their' correctly?", a: ["Their books are here.", "There books are here.", "They're books are here."], correct: 0, effect: "POWER SURGE!" }
];

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
    }

    create() {
      this.drawWorld();
      this.createHud();
      this.input.on("pointerdown", pointer => this.handleBoardTap(pointer));
      this.time.addEvent({ delay: 1000, loop: true, callback: () => this.regenerateEnergy() });
      this.time.addEvent({ delay: 3200, loop: true, callback: () => this.spawnEnemy() });
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
      document.querySelectorAll("[data-unit]").forEach(card => {
        card.addEventListener("click", () => {
          document.querySelectorAll("[data-unit]").forEach(c => c.classList.remove("selected"));
          card.classList.add("selected");
        });
      });
      document.getElementById("restart-button").addEventListener("click", () => window.location.reload());
      document.getElementById("sound-toggle").addEventListener("click", e => {
        this.soundOn = !this.soundOn;
        e.currentTarget.textContent = this.soundOn ? "♫ Sound: On" : "♫ Sound: Off";
        this.message.setText ? this.message.setText(this.soundOn ? "Sound enabled." : "Sound muted.") : null;
      });
    }

    handleBoardTap(pointer) {
      if (this.gameOver || pointer.x < GRID_X || pointer.x >= GRID_X + GRID_W || pointer.y < GRID_Y || pointer.y >= GRID_Y + GRID_H) return;
      const col = Math.floor((pointer.x - GRID_X) / TILE_W);
      const lane = Math.floor((pointer.y - GRID_Y) / TILE_H);
      if (this.defenders.some(d => d.lane === lane && d.col === col)) return;
      if (this.energy < 50) { this.message.textContent = "Not enough energy!"; return; }
      this.energy -= 50;
      this.deployDefender(lane, col);
      this.updateHud();
    }

    deployDefender(lane, col) {
      const x = GRID_X + col * TILE_W + TILE_W / 2;
      const y = GRID_Y + lane * TILE_H + TILE_H / 2;
      const group = this.add.container(x, y);
      const shadow = this.add.ellipse(0, 25, 58, 14, 0x10251d, .28);
      const body = this.add.circle(0, 0, 22, 0x8de1a4).setStrokeStyle(3, 0x2b7957);
      const leaf = this.add.ellipse(-13, -21, 18, 29, 0x4baf77).setRotation(-.65);
      const leaf2 = this.add.ellipse(13, -21, 18, 29, 0x5fc98a).setRotation(.65);
      const face = this.add.text(0, 0, "✦", { fontFamily: "Arial", fontSize: "22px", color: "#fff6c9", fontStyle: "bold" }).setOrigin(.5);
      group.add([shadow, leaf, leaf2, body, face]);
      this.tweens.add({ targets: group, scale: { from: .3, to: 1 }, duration: 260, ease: "Back.Out" });
      this.defenders.push({ lane, col, x, y, group, cooldown: 0 });
      this.message.textContent = "Grammar Sprout deployed!";
    }

    spawnEnemy() {
      if (this.gameOver || this.enemies.length > 14) return;
      const lane = Phaser.Math.Between(0, LANES - 1);
      const x = GRID_X + GRID_W + 25;
      const y = GRID_Y + lane * TILE_H + TILE_H / 2;
      const type = this.wave % 3;
      const color = [0xc87973, 0x8c82c7, 0xc69b5b][type];
      const group = this.add.container(x, y);
      const shadow = this.add.ellipse(0, 25, 52, 13, 0x10251d, .3);
      const body = this.add.circle(0, 0, 23, color).setStrokeStyle(3, 0x4c3949);
      const horn = this.add.triangle(0, -22, -12, 8, 12, 8, 0, 0xead9ad);
      const eyes = this.add.text(0, -2, "••", { fontSize: "17px", color: "#fff" }).setOrigin(.5);
      group.add([shadow, body, horn, eyes]);
      const hp = this.wave > 2 ? 3 : 2;
      const bar = this.add.graphics();
      bar.fillStyle(0x342d39); bar.fillRoundedRect(-23, -37, 46, 6, 3);
      bar.fillStyle(0x83e39a); bar.fillRoundedRect(-22, -36, 44, 4, 2);
      group.add(bar);
      this.enemies.push({ lane, x, y, group, hp, maxHp: hp, speed: 17 + this.wave * 1.2, bar });
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
          const target = this.enemies.find(e => e.lane === d.lane && e.x > d.x && e.x - d.x < 490);
          if (target) { this.fireProjectile(d, target); d.cooldown = 1.15; }
        }
      });
      this.projectiles.forEach(p => {
        if (!p.active) return;
        const dx = p.target.x - p.x, dy = p.target.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 13 || !p.target.group.active) {
          p.destroy(); p.active = false;
          if (p.target.group.active) this.damageEnemy(p.target, 1);
        } else {
          p.x += dx / dist * 330 * dt; p.y += dy / dist * 330 * dt;
        }
      });
      this.enemies.slice().forEach(e => {
        e.x -= e.speed * dt;
        e.group.x = e.x;
        if (e.x < 65) this.damageBase(e);
      });
    }

    fireProjectile(defender, target) {
      const p = this.add.circle(defender.x + 18, defender.y - 5, 7, 0xffe58c).setStrokeStyle(2, 0xfff8d8);
      p.target = target; this.projectiles.push(p);
      this.tweens.add({ targets: defender.group, scaleY: .92, yoyo: true, duration: 100 });
    }

    damageEnemy(enemy, amount) {
      if (!enemy.group.active) return;
      enemy.hp -= amount;
      enemy.group.setScale(1.12);
      this.tweens.add({ targets: enemy.group, scale: 1, duration: 120 });
      if (enemy.hp <= 0) {
        const burst = this.add.circle(enemy.x, enemy.y, 12, 0xffd58c, .8);
        this.tweens.add({ targets: burst, scale: 2.8, alpha: 0, duration: 260, onComplete: () => burst.destroy() });
        enemy.group.destroy();
        this.enemies = this.enemies.filter(e => e !== enemy);
        this.energy = Math.min(150, this.energy + 8);
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
      document.getElementById("question-text").textContent = item.q;
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
            this.applyGrammarPower();
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

    applyGrammarPower() {
      const targets = this.enemies.slice().sort((a,b) => a.x - b.x).slice(0, 3);
      targets.forEach(e => this.damageEnemy(e, 1));
      this.energy = Math.min(150, this.energy + 12);
      this.updateHud();
      const flash = this.add.rectangle(480, 315, 720, 440, 0xffe58c, .12);
      this.tweens.add({ targets: flash, alpha: 0, duration: 420, onComplete: () => flash.destroy() });
    }

    updateHud() {
      this.energyText.textContent = this.energy;
      this.energyFill.style.width = (this.energy / 150 * 100) + "%";
      this.waveText.textContent = this.wave;
      this.baseText.textContent = this.baseHealth + "%";
    }

    endGame(won) {
      this.gameOver = true;
      this.add.rectangle(480, 315, 960, 540, 0x081323, .76);
      this.add.text(480, 260, won ? "THE KEEP IS SAFE!" : "THE KEEP HAS FALLEN", { fontFamily: "Nunito", fontSize: "34px", color: "#fff1c5", fontStyle: "900" }).setOrigin(.5);
      this.add.text(480, 315, "Press Restart to defend the frontier again.", { fontFamily: "Nunito", fontSize: "18px", color: "#ffffff" }).setOrigin(.5);
      this.message.textContent = won ? "Victory!" : "Defeat!";
    }

    clearTimers() { this.time.removeAllEvents(); }
  };
}
