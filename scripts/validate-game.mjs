import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const battle = read("../src/scenes/BattleScene.js");
const main = read("../src/main.js");
const world = read("../src/three-world.js");
const html = read("../index.html");
const css = read("../css/game.css");

assert.match(battle, /const LANES = 5;/, "Battlefield must contain exactly five lanes.");
assert.match(battle, /const TILE_W = 108;/, "Seven-column tile width must remain defined.");
assert.match(battle, /const GRID_W = TILE_W \* 7;/, "Battlefield must contain seven columns.");
assert.match(battle, /this\.defenders\.push\(/, "Defender deployment must register units.");
assert.doesNotMatch(battle, /this\.defenders = this\.defenders\.filter/, "Defender removal must mutate the existing array without allocating a replacement.");
assert.match(battle, /defeatedByPoison = true[\s\S]*?for \(let i = this\.defenders\.length - 1; i >= 0; i--\)/, "Poison deaths must be removed after defender iteration.");
assert.doesNotMatch(battle, /removeModeButton\?\.setAttribute\("aria-pressed", "false"\);\s*this\.upgradeMode = false;/, "Unit selection must not repeat the mode-reset block.");
assert.match(battle, /this\.enemies\.push\(enemy\)/, "Enemy spawning must register attackers.");
assert.match(battle, /const dt = Math\.min\(delta \/ 1000, 0\.25\);/, "Combat delta time must be declared as executable code.");
assert.doesNotMatch(battle, /spikes\\\\n\\s+const dt/, "Combat delta declaration must not be swallowed by a line comment.");

const units = ["sunwell","archer","guardian","mage","ember","volt","thorn","knight","phoenix","titan","stormcaller","runeblade"];
for (const unit of units) {
  assert.match(battle, new RegExp("\\b" + unit + ": \\{"), `Missing stats for defender: ${unit}`);
  assert.match(html, new RegExp('data-unit="' + unit + '"'), `Missing deck card: ${unit}`);
}
assert.match(html, /id="upgrade-mode-button"/, "Upgrade control must be present.");
assert.match(battle, /upgradeDefender\(defender\)/, "Defender evolution handler must exist.");
assert.match(battle, /defender\.level >= 3/, "Defenders must have a Tier III cap.");
assert.match(battle, /showUpgradeChoices\(defender, nextLevel\)/, "Evolution must offer specialization choices.");

assert.match(main, /transparent: true/, "Phaser canvas must support transparency.");
assert.match(world, /scene\.background = null/, "Three.js background must remain transparent.");
assert.match(world, /setClearColor\(0x000000, 0\)/, "Three.js canvas must clear with alpha zero.");
assert.match(css, /three-world-canvas.*z-index:2/, "3D battlefield must render below the Phaser gameplay canvas.");
assert.match(css, /canvas:not.*three-world-canvas.*z-index:3/, "Phaser defender and attacker sprites must remain on the top visual layer.");
assert.match(world, /const frameInterval = isSmallScreen \? 42 : 32/, "3D render loop must remain frame-throttled.");
assert.match(world, /renderer\.render\(scene, camera\);\n  raf = requestAnimationFrame\(render\);/, "3D renderer must complete its first frame before activation.");
assert.doesNotMatch(world, /projectile\.setVisible\?\.\(false\)/, "Phaser projectile fallback must remain visible.");
assert.match(battle, /group\.setActive\(true\)\.setVisible\(true\)\.setAlpha\(1\)/, "Deployed actors must remain visible.");
assert.match(battle, /keeping the classic battlefield/, "Classic battlefield fallback must remain available.");
assert.match(css, /PHONE LANDSCAPE/, "Mobile landscape layout rules must remain present.");
assert.match(css, /body\.playing #game-container/, "Active mobile battlefield must use available screen height.");
assert.match(css, /overflow-x:auto!important/, "Defender deck must remain horizontally scrollable on phones.");

console.log("Game structure checks passed: 5 lanes, 7 columns, 12 defender cards, Tier III upgrades, transparent hybrid renderer, and mobile landscape layout.");

// Lane/actor alignment regression guards.
assert.match(battle, /const x = GRID_X \+ GRID_W - 38;/, "Attackers must spawn inside the final battlefield tile.");
assert.match(world, /camera\.position\.set\(0, 20, 0\)/, "3D board camera must remain top-down for exact Phaser coordinate alignment.");
assert.match(world, /camera\.up\.set\(0, 0, -1\)/, "Top-down camera up vector must preserve lane row orientation.");
assert.match(world, /mesh\.position\.set\(\(px - 480\) \/ 50, 0\.19 \+ bob, \(py - 170\) \/ 50\)/, "3D actors must stand above tile surfaces and align with Phaser coordinates.");
