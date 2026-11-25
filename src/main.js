import { createGameScene } from "./scenes/BattleScene.js";

const params = new URLSearchParams(window.location.search);
const setupScreen = document.getElementById("setup-screen");
const gameLayout = document.getElementById("game-layout");
const studentLaunch = params.get("student") === "1";

if (studentLaunch) {
  window.GRAMMAR_DEFENDERS_CONFIG = {
    mode: params.get("mode") === "fixed" ? "fixed" : "endless",
    timeLimitMinutes: Number(params.get("minutes")) || 10,
    questionIntervalSeconds: Number(params.get("interval")) || 45,
    difficulty: ["easy", "normal", "hard"].includes(params.get("difficulty")) ? params.get("difficulty") : "normal",
    studentLaunch: true
  };
  setupScreen?.classList.add("hidden");
  gameLayout?.classList.remove("hidden");
}

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

startButtonSetup();
function startButtonSetup() {
  document.getElementById("start-game")?.addEventListener("click", async () => {
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

  document.getElementById("copy-student-link")?.addEventListener("click", async () => {
    const link = new URL(window.location.href);
    link.search = "";
    link.searchParams.set("student", "1");
    link.searchParams.set("mode", document.getElementById("setup-mode")?.value || "endless");
    link.searchParams.set("minutes", document.getElementById("setup-time")?.value || "10");
    link.searchParams.set("interval", document.getElementById("setup-interval")?.value || "45");
    link.searchParams.set("difficulty", document.getElementById("setup-difficulty")?.value || "normal");
    const field = document.getElementById("student-link");
    const status = document.getElementById("setup-status");
    if (field) {
      field.value = link.toString();
      field.classList.remove("hidden");
      field.select();
    }
    try {
      await navigator.clipboard.writeText(link.toString());
      if (status) status.textContent = "Student link copied. Share this link or turn it into a QR code.";
    } catch (_) {
      if (status) status.textContent = "Student link is ready below. Select and copy it to share.";
    }
  });
}

document.addEventListener("visibilitychange", () => {
  if (!game || !game.scene) return;
  if (document.hidden) game.loop.sleep();
  else game.loop.wake();
});
window.addEventListener("beforeunload", () => game.destroy(true), { once: true });
