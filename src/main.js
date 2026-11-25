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
document.addEventListener("visibilitychange", () => {
  if (!game || !game.scene) return;
  if (document.hidden) game.loop.sleep();
  else game.loop.wake();
});
window.addEventListener("beforeunload", () => game.destroy(true), { once: true });
