import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <link rel="stylesheet" href="/css/game.css">
  <script src="/node_modules/phaser/dist/phaser.min.js"></script>
</head>
<body class="student-session-join">
  <main class="app-shell">\n    <section id="student-join-screen">Student waiting room</section>
    <section id="game-layout" class="game-layout hidden" aria-label="Game">
      <div class="top-actions game-controls">
        <button id="music-toggle">Music</button><button id="sound-toggle">SFX</button>
        <button id="upgrade-mode-button">Upgrade</button><button id="remove-mode-button">Remove</button>
        <button id="restart-button">Restart</button>
      </div>
      <aside class="side-panel"><div class="deck-grid">
        ${["sunwell","archer","guardian","mage","ember","volt","thorn","knight","phoenix","titan","stormcaller","runeblade"].map(unit => `<button class="unit-card" data-unit="${unit}" type="button"><span class="unit-icon">•</span><span class="unit-copy"><strong>${unit}</strong><small>Test</small></span><span class="unit-cost">50</span></button>`).join("")}
      </div></aside>
      <section class="battle-panel">
        <div class="battle-hud">
          <div class="hud-stat"><span class="hud-label">ENERGY</span><strong id="energy-value">100</strong></div>
          <div class="energy-track"><div id="energy-fill"></div></div>
          <div class="hud-stat"><span class="hud-label">WAVE</span><strong id="wave-value">1</strong></div>
          <div class="hud-stat"><span class="hud-label">TIME</span><strong id="battle-time">10:00</strong></div>
          <div class="hud-stat"><span class="hud-label">BASE</span><strong id="base-value">100%</strong></div>
          <div class="hud-stat lane-life-stat"><span class="hud-label">LANES</span><strong id="lane-value">5</strong></div>
        </div>
        <div id="game-container" role="img" aria-label="Five-lane battlefield"></div>
        <div class="battle-footer"><span id="battle-mode"></span><span id="battle-message">Ready</span></div>
      </section>
    </section>
  </main>
  <script type="module">
    const Phaser = window.Phaser;
    if (!Phaser) throw new Error("The Phaser browser bundle did not load.");
    const { createGameScene } = await import("/src/scenes/BattleScene.js");
    const touch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0 || matchMedia("(max-width: 900px)").matches;
    const game = new Phaser.Game({
      type: touch ? Phaser.CANVAS : Phaser.AUTO,
      parent: "game-container",
      width: 960,
      height: 420,
      transparent: true,
      resolution: 1,
      render: { antialias: true, roundPixels: touch },
      fps: { target: 40, min: 24 },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [createGameScene()]
    });
    window.__game = game;
    window.__battleReady = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("BattleScene did not become ready within 10 seconds.")), 10000);
      const poll = () => {
        const scene = game.scene.getScene("BattleScene");
        if (scene?.worldReady && scene.sys.isActive()) {
          clearTimeout(timeout);
          resolve(scene);
        } else requestAnimationFrame(poll);
      };
      poll();
    });
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (pathname === "/harness.html" || pathname === "/") {
      res.writeHead(200, { "content-type": mime[".html"] });
      res.end(html);
      return;
    }
    const target = path.resolve(root, "." + pathname);
    assert.ok(target.startsWith(root + path.sep), "Blocked a path outside the repository.");
    const body = await readFile(target);
    res.writeHead(200, { "content-type": mime[path.extname(target)] || "application/octet-stream" });
    res.end(body);
  } catch (error) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(String(error.message || error));
  }
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

try {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  const browserMessages = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") browserMessages.push(message.text());
  });
  page.on("requestfailed", request => browserMessages.push("Request failed: " + request.url() + " — " + request.failure()?.errorText));
  await page.goto(`http://127.0.0.1:${address.port}/harness.html`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(() => Boolean(window.__battleReady), null, { timeout: 15000 });
  } catch (error) {
    throw new Error("Phaser harness did not initialize. " + JSON.stringify({
      runtimeErrors, browserMessages,
      gameExists: await page.evaluate(() => Boolean(window.__game)),
      scriptCount: await page.locator("script").count(),
      containerExists: await page.locator("#game-container").count()
    }) + " Original: " + error.message);
  }
  const scene = await page.evaluate(async () => {
    const battle = await window.__battleReady;
    // Reproduce the real QR-student transition: the canvas is initialized
    // while its parent is hidden and the join-only body layout is active.
    document.body.classList.add("playing");
    document.body.classList.remove("student-session-join");
    document.getElementById("game-layout").classList.remove("hidden");
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.__game.scale.refresh();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const canvas = window.__game?.canvas || document.querySelector("#game-container canvas") || document.querySelector("canvas");
    if (!canvas) throw new Error("Phaser created no canvas: " + JSON.stringify({
      gameExists: Boolean(window.__game),
      gameCanvas: Boolean(window.__game?.canvas),
      canvasCount: document.querySelectorAll("canvas").length,
      parentExists: Boolean(document.getElementById("game-container")),
      parentChildren: [...(document.getElementById("game-container")?.children || [])].map(node => node.tagName + "." + node.className),
      bodyChildren: [...document.body.children].map(node => node.tagName + "#" + node.id + "." + node.className)
    }));
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("The touch-device renderer did not expose a 2D canvas context.");
    const lanePixels = [];
    for (let lane = 0; lane < 5; lane++) {
      const logicalX = 450;
      const logicalY = 48 + lane * 68 + 34;
      const px = Math.max(0, Math.min(canvas.width - 1, Math.round(logicalX * canvas.width / 960)));
      const py = Math.max(0, Math.min(canvas.height - 1, Math.round(logicalY * canvas.height / 420)));
      lanePixels.push(Array.from(context.getImageData(px, py, 1, 1).data));
    }
    return {
      rendererType: window.__game.renderer.type,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      cssWidth: Math.round(rect.width),
      cssHeight: Math.round(rect.height),
      containerWidth: Math.round(document.querySelector("#game-container").getBoundingClientRect().width),
      containerHeight: Math.round(document.querySelector("#game-container").getBoundingClientRect().height),
      lanePixels,
      worldGraphicsVisible: Boolean(battle.worldGraphics?.visible),
      laneLifeLabels: battle.laneLifeLabels?.length || 0
    };
  });
  assert.equal(scene.rendererType,  CanvasRendererType(), "Touch devices must use Phaser's Canvas renderer.");
  assert.ok(scene.canvasWidth >= 160 && scene.canvasHeight >= 100, "The Phaser backing canvas must have usable dimensions.");
  assert.ok(scene.cssWidth >= 160 && scene.cssHeight >= 100, "The Phaser canvas must be visible at a usable CSS size.");
  assert.equal(scene.laneLifeLabels, 5, "The scene must create all five lane labels.");
  assert.ok(scene.worldGraphicsVisible, "The battlefield graphics object must remain visible.");
  for (let lane = 0; lane < 5; lane++) {
    assert.ok(scene.lanePixels[lane][3] > 0, `Battlefield lane ${lane + 1} rendered no visible pixels: ${JSON.stringify(scene.lanePixels[lane])}`);
  }

  await page.evaluate(() => {
    const battle = window.__game.scene.getScene("BattleScene");
    battle.startBattle({ mode: "endless", timeLimitMinutes: 10, questionIntervalSeconds: 45, difficulty: "normal", studentLaunch: true, sessionId: "browser-test-session", playerId: "browser-test-student", questions: [] });
  });
  const battleState = await page.evaluate(() => {
    const battle = window.__game.scene.getScene("BattleScene");
    return { started: battle.battleStarted, enemyCount: battle.enemies.length, wave: battle.wave };
  });
  assert.equal(battleState.started, true, "Battle must enter the started state.");
  assert.ok(battleState.enemyCount > 0, "At least one attacker must spawn when the battle starts.");
  assert.equal(battleState.wave, 1, "The first battle must begin on wave one.");
  assert.deepEqual(runtimeErrors, [], `Browser runtime errors: ${runtimeErrors.join("; ")}`);
  console.log("Mobile battlefield browser smoke test passed:", JSON.stringify({ scene, battleState }));
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

function CanvasRendererType() {
  return 1; // Phaser.CANVAS in Phaser 3.80.1
}
