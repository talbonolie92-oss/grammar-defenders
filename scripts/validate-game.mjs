import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { QUESTIONS, BOSS_QUESTIONS } from "../src/data/questions.js";

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
assert.match(battle, /const dt = Math\.min\(delta \/ 1000, 0\.35\);/, "Combat delta time must be declared as executable code.");
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
assert.match(world, /const normalFrameInterval = isSmallScreen \? 42 : 32/, "3D render loop must remain frame-throttled at normal load.");
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
assert.match(world, /const z = \(38 \+ lane \* 54 \+ 27\) \/ 50 - 3\.4;/, "3D tile centers must match the exact Phaser lane centers.");


// Gameplay progression, question-bank, and combat regression checks.
const expectedWaveCount = wave => wave === 1 ? 8
  : wave % 5 === 0
    ? Math.min(55, wave === 5 ? 21 : 32 + Math.floor(wave / 5) * 3 + Math.max(0, wave - 10) * 2)
    : wave <= 5 ? Math.min(20, 8 + Math.floor((wave - 1) * 1.2))
      : Math.min(55, 22 + (wave - 6) * 4);
const checkedWaves = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25,30,50];
const expectedCounts = checkedWaves.map(expectedWaveCount);
assert.deepEqual(expectedCounts.slice(0, 15), [8,9,10,11,21,22,26,30,34,38,42,46,50,54,51],
  "Early and mid-game wave quantities must follow the intended progression.");
assert.ok(expectedCounts.every(count => count >= 8 && count <= 55), "Wave quantities must remain within safe limits.");
assert.ok(battle.includes("this.enemiesPerWave = bossWave") && battle.includes("Math.min(55, 22 + (this.wave - 6) * 4)"),
  "Wave progression must preserve the escalating normal/boss formulas.");
assert.match(battle, /const isBoss = this\.enemiesSpawnedThisWave === this\.enemiesPerWave - 1 && this\.wave % 5 === 0/,
  "Every fifth wave must reserve its final spawn for the Dark Overlord.");
assert.match(battle, /this\.enemies\.length >= \(bossWave \? 46 : \(this\.wave > 5 \? 40 : 20\)\)/,
  "Active enemy caps must protect performance without changing total wave counts.");
assert.match(battle, /const lane = Phaser\.Math\.Between\(0, LANES - 1\)/,
  "Attackers must be assigned to one of the five valid lanes.");
assert.match(battle, /const y = GRID_Y \+ lane \* TILE_H \+ TILE_H \/ 2/,
  "Attacker spawn Y must be centered in its assigned lane.");
assert.match(battle, /const x = GRID_X \+ col \* TILE_W \+ TILE_W \/ 2/,
  "Defenders must deploy at the center of their selected tile.");
assert.match(battle, /this\.world\?\.syncActors\(this\.defenders, this\.enemies, this\.projectiles, time\)/,
  "The 3D actor renderer must receive live defender, attacker, and projectile positions.");
assert.match(battle, /if \(this\.pendingBossQuestion && !this\.gameOver\)/,
  "Boss questions must be queued safely if another overlay is already active.");
assert.match(battle, /this\.time\.delayedCall\(900, \(\) => this\.showQuestion\(true\)\)/,
  "Boss arrival must trigger its grammar trial.");
assert.ok(battle.includes("const choices = [") && battle.includes('{ id: "energycore"'),
  "All eight defender specializations must remain available.");
assert.match(battle, /unlockAdvancedDeck\(\)/, "Advanced defenders must unlock after the first boss.");
assert.match(battle, /this\.playSound\("shot"\)/, "Combat audio must be wired to projectile attacks.");
assert.match(battle, /startMusic\(\)/, "Music toggle must start the background score.");

const validateQuestion = (item, index, bankName) => {
  assert.ok(item && typeof item.topic === "string" && item.topic.trim(), `${bankName} question ${index + 1} needs a topic.`);
  assert.ok(typeof item.q === "string" && item.q.trim(), `${bankName} question ${index + 1} needs question text.`);
  assert.ok(Array.isArray(item.a) && item.a.length >= 2 && item.a.length <= 4, `${bankName} question ${index + 1} needs 2–4 choices.`);
  assert.ok(item.a.every(choice => typeof choice === "string" && choice.trim()), `${bankName} question ${index + 1} has an empty choice.`);
  assert.ok(Number.isInteger(item.correct) && item.correct >= 0 && item.correct < item.a.length, `${bankName} question ${index + 1} has an invalid correct-answer index.`);
  assert.ok(typeof item.effect === "string" && item.effect.trim(), `${bankName} question ${index + 1} needs a battle effect label.`);
};
QUESTIONS.forEach((item, index) => validateQuestion(item, index, "Regular"));
BOSS_QUESTIONS.forEach((item, index) => validateQuestion(item, index, "Boss"));
assert.equal(QUESTIONS.length, 24, "The regular question bank should contain 24 curated questions.");
assert.equal(BOSS_QUESTIONS.length, 10, "The boss question bank should contain 10 curated questions.");
assert.equal(new Set(QUESTIONS.map(item => item.q.trim())).size, QUESTIONS.length, "Regular questions must not contain duplicate prompts.");
assert.equal(new Set(BOSS_QUESTIONS.map(item => item.q.trim())).size, BOSS_QUESTIONS.length, "Boss questions must not contain duplicate prompts.");

console.log("Gameplay checks passed: wave escalation through wave 50, boss spawn slots, lane/tile centers, 3D actor sync, audio hooks, 8 specializations, and 34 validated questions.");

// Final pre-device-test regression rerun marker: keep this workflow exercising the complete suite.


// Post-playtest improvements: late-game pacing, Tier III signature abilities, and clear end-of-session exit.
assert.match(battle, /Math\.max\(0, this\.wave - 5\) \* 0\.10/, "Late-game enemy durability growth must be softened for upgraded teams.");
assert.match(battle, /Gatling Ranger/, "Tier III Archer must have its Gatling evolution identity.");
assert.match(battle, /this\.fireProjectile\(d, target, 0\.55, true, -5\)/, "Tier III Archer must fire bonus gatling bolts.");
assert.match(battle, /GLACIAL BURST!/, "Tier III Frost Mage must apply its lane-wide crowd-control burst.");
assert.match(battle, /PLAY AGAIN  •  BACK TO SETUP/, "The end-of-session overlay must provide a visible in-game restart action.");
assert.match(battle, /restartButton\.on\("pointerdown", \(\) => window\.location\.reload\(\)\)/, "The end-of-session restart action must return to setup.");
assert.match(css, /cinematic 3D-era landing refresh/, "Homepage must use the refreshed 3D-era visual design.");


// Question answer recovery: explicit continue action, browser timer cleanup, and update-loop watchdog.
assert.match(battle, /CONTINUE BATTLE/, "Answered grammar questions must offer a manual continue action.");
assert.match(battle, /questionResolutionTimer = window\.setTimeout/, "Question close must have a browser-level fallback timer.");
assert.match(battle, /questionAnsweredAt = Date\.now\(\)/, "Question answers must timestamp the recovery watchdog.");
assert.match(battle, /Date\.now\(\) - this\.questionAnsweredAt >= 2600/, "The battle update loop must recover a stuck answered question.");
assert.match(battle, /window\.clearTimeout\(this\.questionResolutionTimer\)/, "Question finish must clear its browser fallback timer.");

// Boss Ascension reward regression checks.
assert.match(battle, /this\.wave % 5 === 0 && this\.lastAscensionWave !== this\.wave/, "Every cleared boss wave must offer one Ascension reward.");
assert.match(battle, /showBossAscension\(\)/, "Boss reward selection overlay must exist.");
assert.match(battle, /applyBossAscension\(existing\)/, "Players must be able to select a deployed defender for Ascension.");
assert.ok(battle.includes("defender.stats.energyRate = Math.round((defender.stats.energyRate || base.energyRate || 7) * 3)"), "Three-Headed Sunwell must triple energy production.");
assert.match(battle, /defender\.ascensionVolley/, "Ascended Archer must unlock its multi-shot volley.");
assert.match(battle, /defender\.ascensionFreeze = true/, "Ascended Frost Mage must unlock its freeze ability.");
assert.match(battle, /defender\.ascensionChain = true/, "Ascended lightning defenders must unlock chain power.");
assert.match(battle, /startNextWave\(\)/, "Battle must resume after an Ascension choice or skip.");
assert.match(battle, /this\.questionActive \|\| this\.upgradeChoiceActive \|\| this\.bossAscensionActive/, "Combat updates must pause during Ascension selection.");
assert.match(battle, /this\.bossAscensionFinal[\s\S]*?this\.endGame\(true\)/, "The final fixed-mode boss must still grant its Ascension reward before victory.");

// Late-wave adaptive rendering keeps combat responsive on mobile devices.
assert.match(world, /let performanceMode = false/, "3D renderer must support adaptive high-load mode.");
assert.match(world, /enemies\.length > 22 \|\| projectiles\.length > 48/, "Crowded late waves must trigger reduced 3D detail.");
assert.match(world, /if \(!performanceMode\) syncList\(enemies, true\)/, "High-load mode must retain lightweight Phaser enemy sprites instead of expensive 3D enemy rigs.");
assert.match(world, /performanceMode \? \(isSmallScreen \? 100 : 66\)/, "3D rendering cadence must reduce under heavy combat load.");
assert.match(battle, /Math\.min\(delta \/ 1000, 0\.35\)/, "Combat simulation must tolerate larger late-wave frame intervals.");
