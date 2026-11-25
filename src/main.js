import { createGameScene } from "./scenes/BattleScene.js";

const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 960,
  height: 540,
  backgroundColor: "#294b4d",
  pixelArt: false,
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [createGameScene()]
};

const game = new Phaser.Game(config);
window.addEventListener("beforeunload", () => game.destroy(true));
