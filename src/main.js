import { createGameScene } from "./scenes/BattleScene.js";

const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 960,
  height: 540,
  backgroundColor: "#173b43",
  resolution: pixelRatio,
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
    powerPreference: "high-performance",
    transparent: false
  },
  fps: { target: 60, min: 30, forceSetTimeOut: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [createGameScene()]
};

const game = new Phaser.Game(config);

const setupScreen = document.getElementById("setup-screen");
const gameLayout = document.getElementById("game-layout");
const startButton = document.getElementById("start-game");
startButton?.addEventListener("click", async () => {
  const settings = {
    mode: document.getElementById("setup-mode")?.value || "endless",
    timeLimitMinutes: Number(document.getElementById("setup-time")?.value || 10),
    questionIntervalSeconds: Number(document.getElementById("setup-interval")?.value || 45),
    difficulty: document.getElementById("setup-difficulty")?.value || "normal"
  };
  window.GRAMMAR_DEFENDERS_CONFIG = settings;
  try {
    if (screen.orientation?.lock) await screen.orientation.lock("landscape");
  } catch (_) {
    // Some browsers and iOS devices do not allow orientation locking.
  }
  try {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch (_) {
    // Fullscreen is optional; the game remains playable without it.
  }
  setupScreen?.classList.add("hidden");
  gameLayout?.classList.remove("hidden");
  requestAnimationFrame(() => game.scale.refresh());
  game.scene.getScene("BattleScene").startBattle(settings);
});

document.addEventListener("visibilitychange", () => {
  if (!game || !game.scene) return;
  if (document.hidden) game.loop.sleep();
  else game.loop.wake();
});
window.addEventListener("beforeunload", () => game.destroy(true), { once: true });
