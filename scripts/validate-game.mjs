import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { QUESTIONS, BOSS_QUESTIONS } from "../src/data/questions.js";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const battle = read("../src/scenes/BattleScene.js");
const main = read("../src/main.js");
const firebase = read("../src/firebase.js");
const dashboard = read("../src/dashboard.js");
const html = read("../index.html");
const practice = read("../practice.html");
const css = read("../css/game.css");
const databaseRules = JSON.parse(read("../database.rules.json"));

assert.match(battle, /const LANES = 5;/, "Battlefield must contain exactly five lanes.");
assert.match(battle, /const TILE_W = 108;/, "Seven-column tile width must remain defined.");
assert.match(battle, /const GRID_W = TILE_W \* 7;/, "Battlefield must contain seven columns.");
assert.match(battle, /this\.defenders\.push\(/, "Defender deployment must register units.");
assert.doesNotMatch(battle, /this\.defenders = this\.defenders\.filter/, "Defender removal must mutate the existing array without allocating a replacement.");
assert.match(battle, /defeatedByPoison = true[\s\S]*?for \(let i = this\.defenders\.length - 1; i >= 0; i--\)/, "Poison deaths must be removed after defender iteration.");
assert.doesNotMatch(battle, /removeModeButton\?\.setAttribute\("aria-pressed", "false"\);\s*this\.upgradeMode = false;/, "Unit selection must not repeat the mode-reset block.");
assert.match(battle, /this\.enemies\.push\(enemy\)/, "Enemy spawning must register attackers.");
assert.match(battle, /const dt = Math\.min\(delta \/ 1000, 0\.35\);/, "Combat delta time must be declared as executable code.");
const damageEnemyStart = battle.indexOf("damageEnemy(enemy, amount");
const damageBaseStart = battle.indexOf("\n    damageBase(", damageEnemyStart);
const damageEnemyBlock = battle.slice(damageEnemyStart, damageBaseStart);
assert.match(damageEnemyBlock, /const reducedCombatEffects = this\.mobilePerformanceMode/, "Damage feedback must declare its own performance flag rather than referencing update() local state.");
assert.match(battle, /enemiesSpawnedThisWave: this\.enemiesSpawnedThisWave/, "Refresh checkpoints must preserve progress through the current wave.");
assert.match(battle, /stats: \{[\s\S]*?energyInterval: item\.stats\.energyInterval/, "Refresh checkpoints must preserve evolved defender combat stats.");
assert.match(battle, /defender\.upgradePaths = Array\.isArray\(item\.upgradePaths\)/, "Refresh checkpoints must preserve defender specialization choices.");
assert.ok(firebase.includes("studentSignInPromise") && firebase.includes("auth.currentUser?.isAnonymous"), "Student sign-in must be serialized and use anonymous player identity.");
assert.ok(css.includes("aspect-ratio:16/7") && !css.includes("aspect-ratio:48/17"), "No stale 48:17 canvas sizing rule may override the 960:420 game canvas.");


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
assert.match(main, /type: isTouchDevice \? Phaser\.CANVAS : Phaser\.AUTO/, "Touch devices must use the single Phaser Canvas renderer.");
assert.match(battle, /this\.drawWorld\(\)/, "BattleScene must draw its battlefield during scene creation.");
assert.match(battle, /const g = this\.add\.graphics\(\)/, "The battlefield must use Phaser Graphics.");
assert.match(battle, /for \(let lane = 0; lane < LANES; lane\+\+\)/, "The battlefield renderer must draw all five lanes.");
assert.match(battle, /g\.fillRoundedRect\(GRID_X, y, GRID_W, TILE_H - 3, 8\)/, "Each lane must have a visible filled tile row.");
assert.match(css, /canvas:not.*z-index:3/, "The Phaser gameplay canvas must remain on the top visual layer.");
assert.match(battle, /group\.setActive\(true\)\.setVisible\(true\)\.setAlpha\(1\)/, "Deployed actors must remain visible.");
assert.ok(!battle.includes('import("../three-world.js")'), "The classroom build must use one Phaser renderer for stable touch-device performance.");
assert.match(css, /PHONE LANDSCAPE/, "Mobile landscape layout rules must remain present.");
assert.match(css, /body\.playing #game-container/, "Active mobile battlefield must use available screen height.");
assert.match(css, /overflow-x:auto!important/, "Defender deck must remain horizontally scrollable on phones.");

console.log("Game structure checks passed: 5 lanes, 7 columns, 12 defender cards, Tier III upgrades, single Phaser renderer, and mobile landscape layout.");

// Lane/actor alignment regression guards.
assert.match(battle, /const x = GRID_X \+ GRID_W - 38;/, "Attackers must spawn inside the final battlefield tile.");


// Gameplay progression, question-bank, and combat regression checks.
const expectedWaveCount = wave => {
  const regularCount = wave <= 4 ? [25, 40, 60, 80][wave - 1] : 80 + (wave - 4) * 20;
  return regularCount + (wave % 5 === 0 ? 50 : 0);
};
const checkedWaves = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25,30,50];
const expectedCounts = checkedWaves.map(expectedWaveCount);
assert.deepEqual(expectedCounts.slice(0, 10), [25,40,60,80,150,120,140,160,180,250],
  "Wave armies must grow progressively, with 50 additional attackers on boss waves.");
assert.ok(expectedCounts.every(count => count >= 25), "Every wave must contain a meaningful attacker army.");
assert.ok(battle.includes("this.enemiesPerWave = getWaveEnemyCount(this.wave)") &&
  battle.includes("return regularCount + (safeWave % 5 === 0 ? 50 : 0)"),
  "The live game must use the escalating wave-count formula and boss bonus.");
assert.match(battle, /Math\.min\(2\.8, 1 \+ \(this\.wave - 1\) \* 0\.055 \+ Math\.max\(0, this\.wave - 5\) \* 0\.025\)/, "Enemy attack damage must scale gradually and have a hard cap.");
assert.match(battle, /speed: isBoss \? Math\.min\(30, 10 \+ this\.wave \* 0\.55\)/, "Boss movement speed must not become excessive in endless late waves.");
assert.match(battle, /Math\.min\(24, 8 \+ Math\.floor\(this\.wave \/ 5\) \* 2 \+ \(e\.phase - 1\) \* 3\)/, "Boss lane-pulse damage must remain capped.");
assert.ok(battle.includes("Math.min(1.8, (this.wave - 1) * 0.08)"),
  "Enemy health growth must remain gradual and capped as army size increases.");
assert.ok(battle.includes("Math.max(300, 600 - Math.floor(this.wave / 5) * 30)") &&
  battle.includes("Math.max(300, 850 - this.wave * 35)"),
  "Spawn pacing must accelerate while retaining a minimum interval.");
assert.match(battle, /const isBoss = this\.enemiesSpawnedThisWave === this\.enemiesPerWave - 1 && this\.wave % 5 === 0/,
  "Every fifth wave must reserve its final spawn for the Dark Overlord.");
assert.match(battle, /const activeEnemyCap = this\.mobilePerformanceMode[\s\S]*?if \(this\.enemies\.length >= activeEnemyCap\)/,
  "Desktop and mobile must enforce their respective active-enemy caps without changing total wave counts.");
assert.match(battle, /const lane = Phaser\.Math\.Between\(0, LANES - 1\)/,
  "Attackers must be assigned to one of the five valid lanes.");
assert.match(battle, /const y = GRID_Y \+ lane \* TILE_H \+ TILE_H \/ 2/,
  "Attacker spawn Y must be centered in its assigned lane.");
assert.match(battle, /const x = GRID_X \+ col \* TILE_W \+ TILE_W \/ 2/,
  "Defenders must deploy at the center of their selected tile.");
assert.match(battle, /if \(this\.pendingBossQuestion && !this\.gameOver\)/,
  "Boss questions must be queued safely if another overlay is already active.");
assert.match(battle, /this\.time\.delayedCall\(900, \(\) => this\.showQuestion\(true\)\)/,
  "Boss arrival must trigger its grammar trial.");
assert.ok(battle.includes("const choices = [") && battle.includes('{ id: "energycore"'),
  "All eight defender specializations must remain available.");
assert.match(battle, /unlockAdvancedDeck\(\)/, "Advanced defenders must unlock after the first boss.");
assert.match(battle, /this\.playSound\("shot"\)/, "Combat audio must be wired to projectile attacks.");
assert.match(battle, /startMusic\(\)/, "Music toggle must start the background score.");

assert.ok(html.includes('id="open-instructions"') && html.includes('id="game-instructions"') &&
  html.includes("Adventurer's Handbook"), "Homepage must expose a clickable, accessible game handbook.");
assert.ok(html.includes("Choose Your Defenders") && html.includes("Manage Your Energy") &&
  html.includes("Defeat Bosses & Ascend") && html.includes("Protect Every Lane"),
  "The handbook must explain core gameplay, progression, bosses, and lane defense.");
assert.ok(css.includes(".instructions-dialog") && css.includes(".codex-entry"),
  "The handbook must use RPG-themed responsive codex styling.");

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

console.log("Gameplay checks passed: wave escalation through wave 50, boss spawn slots, Phaser lane/tile alignment, audio hooks, 8 specializations, and 34 validated questions.");

// Final pre-device-test regression rerun marker: keep this workflow exercising the complete suite.


// Post-playtest improvements: late-game pacing, Tier III signature abilities, and clear end-of-session exit.
assert.ok(battle.includes("Math.min(1.8, (this.wave - 1) * 0.08)"), "Enemy durability growth must remain gradual and capped as attacker counts increase.");
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
assert.match(battle, /const reducedCombatEffects = this\.mobilePerformanceMode/, "The Phaser scene must reduce nonessential effects on touch devices.");
assert.match(battle, /const activeEnemyCap = this\.mobilePerformanceMode/, "The Phaser scene must bound active enemies on touch devices.");
assert.match(battle, /Math\.min\(delta \/ 1000, 0\.35\)/, "Combat simulation must tolerate larger late-wave frame intervals.");

// Final gameplay-session stress regressions: wall-clock timer, overlay pauses, cleanup, and load shedding.
assert.match(battle, /window\.setInterval\(\(\) => this\.tickBattleClock\(\), 250\)/, "Session countdown must use a wall-clock interval independent of Phaser frame rate.");
assert.match(battle, /this\.bossAscensionActive\) \{\s*this\.lastClockAt = now/, "Boss Ascension selection must pause the session clock.");
assert.match(battle, /this\.elapsedSeconds \+= elapsedWholeSeconds/, "Timer must catch up after delayed browser callbacks.");
assert.match(battle, /window\.clearInterval\(this\.battleClockInterval\)/, "Session countdown must be cleared at game end and scene shutdown.");
assert.match(battle, /this\.questionOverlay\?\.destroy\(true\)/, "Ending a session must clean up any active question overlay.");
assert.match(battle, /const reducedCombatEffects = this\.mobilePerformanceMode[\s\S]*?this\.enemies\.length > 6 \|\| this\.projectiles\.length > 18/, "Touch devices must simplify combat visuals at a lower load.");
assert.match(battle, /hitFeedbackReady && !reducedCombatEffects/, "Dense combat must suppress nonessential per-hit tweens.");
assert.match(battle, /const denseSpawn = this\.enemies\.length >= \(this\.mobilePerformanceMode \? 6 : 22\) && !isBoss/, "Phone minion spawns must enter lightweight visual mode earlier.");
assert.match(battle, /e\.details\?\.forEach\(part => part\.setVisible\(!simplifyEnemy\)\)/, "Existing enemies must shed decorative parts under load and restore them afterward.");
assert.match(battle, /else if \(!denseSpawn\)/, "Dense minion spawns must skip portal particles and repeated scale tweens.");
assert.match(battle, /details,\s*reducedVisuals: denseSpawn/, "Enemy visual mode state must be tracked for safe transitions.");
assert.match(battle, /if \(e\.feet && !reducedCombatEffects\)/, "Dense combat must skip per-enemy decorative foot animation.");
assert.match(battle, /const activeEnemyCap = this\.mobilePerformanceMode[\s\S]*?\(bossWave \? 46 : \(this\.wave > 5 \? 40 : 20\)\)/, "Phones and desktops must use bounded active-enemy budgets during stress waves.");
assert.match(battle, /delay: this\.mobilePerformanceMode \? 1050 : 815/, "Phone enemy arrivals must be spaced to reduce mobile frame spikes.");
assert.match(battle, /bossWave \? 12 : \(this\.wave > 5 \? 10 : 8\)/, "Touch-device enemy concurrency must stay low enough to avoid stacked crowds.");
assert.match(battle, /this\.projectilePool\.length < 180/, "Projectile reuse pool must remain capped to prevent unbounded retention.");
assert.match(battle, /const projectileCap = this\.mobilePerformanceMode \? 72 : 180/, "Active projectiles must be bounded on touch devices and desktop.");
assert.match(battle, /phoneQuestionLayout \? 48/, "Phone answer rows must have enough separation for reliable taps.");
assert.match(battle, /hitHeight: buttonHeight \+ \(phoneQuestionLayout \? 6 : 4\)/, "Phone answers must use enlarged camera-mapped hit targets.");


assert.match(main, /mode: Phaser\.Scale\.FIT/, "Phaser must fit the battlefield without distorting its coordinate system.");
assert.doesNotMatch(css, /#game-container canvas\{[^}]*width:100%!important;height:100%!important/, "CSS must not override Phaser's fitted canvas dimensions.");
assert.doesNotMatch(css, /canvas:not\(\.three-world-canvas\)\s*\{[^}]*width:auto!important;height:auto!important/, "Phone CSS must not reset Phaser's fitted canvas dimensions.");
assert.doesNotMatch(css, /body\.playing #game-container canvas:not\(\.three-world-canvas\)\s*\{[^}]*width:100%!important;height:100%!important/, "Mobile landscape CSS must not stretch the Phaser canvas.");
assert.ok(html.includes("game.css?v=student-game-layout-fix-4"), "Student join-to-game CSS visibility fix must be cache-busted.");

// Preserve the 960:420 game canvas aspect ratio on narrow landscape screens.
assert.match(css, /object-fit:contain/, "The battlefield canvas must preserve its aspect ratio instead of stretching to fill the screen.");
assert.ok(main.includes("height: 420,"), "The battlefield must use the expanded 960:420 logical canvas.");
assert.ok(main.includes('matchMedia?.("(pointer: coarse)")') && main.includes("navigator.maxTouchPoints > 0"), "iPads and touch tablets must use the touch-device performance profile.");
assert.ok(battle.includes("this.cameras.main.setZoom(this.phoneLandscape ? 1.12 : 1)"), "Touch devices must enlarge the five-lane battlefield without clipping it.");
assert.ok(battle.includes("refreshPhoneLayout()") && battle.includes('window.addEventListener("orientationchange", this.handleViewportChange') && battle.includes('window.removeEventListener("orientationchange", this.handleViewportChange)'), "Phone camera and question layout must update when a student rotates the device and clean up the orientation listener.");
assert.ok(battle.includes('this.phoneLandscape = Boolean(window.matchMedia?.("(orientation: landscape) and (max-height: 500px)").matches)') && battle.includes("const phoneQuestionLayout = this.phoneLandscape"), "Phone-only layout zoom and compact question sizing must not be applied to full-size tablets.");
assert.ok(battle.includes("passiveEnergyBonus: this.passiveEnergyBonus || 0") && battle.includes("saved.advancedDeckUnlocked"), "Refresh checkpoints must preserve global energy upgrades and elite deck unlocks.");
assert.ok(battle.includes("retaliateCooldown: item.retaliateCooldown || 0"), "Refresh checkpoints must preserve defender retaliation upgrades.");
assert.ok(!battle.includes('import("../three-world.js")'), "The game must not create a second WebGL renderer beside Phaser.");
assert.ok(battle.includes("const TILE_H = 68;") && battle.includes("const GRID_Y = 48;"), "Five lanes must have increased physical height on phones.");
assert.ok(html.includes("game.css?v=student-game-layout-fix-4"), "The corrected canvas sizing stylesheet must be cache-busted.");

// Mobile rendering and question readability regression checks.
assert.ok(!battle.includes('import("../three-world.js")'), "The game must use one renderer instead of creating a second WebGL context.");
assert.ok(battle.includes("const questionFontSize = phoneQuestionLayout") && battle.includes("question.setFixedSize(780, 76)"), "Phone landscape questions must fit a fixed readable area.");
assert.ok(battle.includes("handleQuestionPointer(pointer)") && battle.includes("questionAnswerTargets.push({ index, item, button, label, y, hitHeight: buttonHeight + (phoneQuestionLayout ? 6 : 4) })"), "Question taps must map by Phaser camera coordinates rather than scaled object hit tests.");
assert.ok(battle.includes("g.lineStyle(3, lane % 2 ? 0xd0efaa : 0xffe4a0, 0.72)"), "Five battlefield lanes must have high-contrast row boundaries.");
assert.ok(battle.includes("phoneQuestionLayout ? 190") && battle.includes('phoneQuestionLayout ? "15px"'), "Phone answers must use compact sizing and remain visible.");
assert.ok(main.includes("fps: { target: isTouchDevice ? ((navigator.hardwareConcurrency || 4) <= 4 ? 30 : 40) : 60"), "Phones must use a stable 30–40 FPS target while desktop retains 60 FPS.");
assert.ok(main.includes("antialias: true") && main.includes("roundPixels: isTouchDevice"), "All devices must use consistent smooth vector rendering without pixel snapping artifacts.");
assert.ok(main.includes("isTouchDevice ? 1 : 1.5"), "Touch devices must receive a modestly improved render resolution without excessive GPU load.");
assert.ok(battle.includes("this.mobilePerformanceMode ? Math.round(e.x) : e.x") && battle.includes("this.mobilePerformanceMode ? Math.round(renderY) : renderY"), "Moving enemy containers must use whole logical pixels on touch GPUs to prevent edge trails.");
assert.ok(!battle.includes("const speedTrail = this.add.rectangle"), "Enemy runner accessories must not use thin moving rectangles that can stretch into visual streaks on some GPUs.");
assert.ok(!battle.slice(battle.indexOf("const enemyParts = [shadow"), battle.indexOf("group.setActive(true).setVisible(true)", battle.indexOf("const enemyParts = [shadow"))).includes("child.setVisible(true)"), "Dense-wave visibility culling must not be undone during enemy container initialization.");


// Refresh recovery regression checks.
assert.ok(battle.includes("this.restoreCheckpoint();"), "A returning player must restore their latest local battle checkpoint.");
assert.ok(battle.includes("saveCheckpoint()"), "The battle must periodically persist progress locally.");
assert.ok(battle.includes("delay: 3500, loop: true, callback: () => this.saveCheckpoint()"), "Progress checkpoints must be written throughout active play.");
assert.ok(battle.includes("emerald-frontier:"), "Checkpoints must be scoped to a session and player.");
assert.ok(main.includes("form.requestSubmit()"), "A returning student must be able to rejoin automatically after refresh.");
assert.ok(!main.includes("game.loop.sleep()") && !main.includes("game.loop.wake()"), "The Phaser game loop must not be manually slept or woken during classroom startup.");
assert.ok(main.includes("type: isTouchDevice ? Phaser.CANVAS : Phaser.AUTO"), "Touch devices must use the compatible 2D renderer to avoid fragile mobile WebGL startup.");
assert.ok(main.includes("async function revealBattlefield(scene)") && main.includes("bounds.width < 160") && main.includes("canvas.height < 100"), "The game must reveal and validate a real, non-zero canvas before starting play.");
assert.ok(!main.includes("enableMusic?.()"), "Background music must remain opt-in instead of starting automatically on every student device.");
assert.ok(main.includes("if (document.hidden) game.scene.getScene(\"BattleScene\")?.saveCheckpoint?.();"), "Visibility changes must checkpoint progress without manually suspending the Phaser loop.");
assert.ok(main.includes("const scene = await waitForBattleSceneReady();") && main.includes("await revealBattlefield(scene);") && main.includes("scene.startBattle(settings);"), "Classroom launch must reveal and validate the canvas before starting the battle.");
assert.ok(!main.slice(main.indexOf("async function launchStudentGame"), main.indexOf("window.GD_SAVE_ATTEMPT", main.indexOf("async function launchStudentGame"))).includes("requestFullscreen") &&
  !main.slice(main.indexOf("async function launchStudentGame"), main.indexOf("window.GD_SAVE_ATTEMPT", main.indexOf("async function launchStudentGame"))).includes("orientation.lock"),
  "Classroom launch must not request fullscreen or orientation from a background Firebase callback.");
assert.ok(main.includes("await waitForAnimationFrame();\n  await waitForAnimationFrame();\n  game.scale.refresh();"), "The game canvas must be measured only after its hidden parent becomes visible.");
assert.ok(main.includes('waiting.innerHTML = "<b>Game could not start</b>'), "A failed classroom launch must show a visible recovery message instead of leaving a blank screen.");
assert.ok(main.includes("await revealBattlefield(battleScene);\n      battleScene.startBattle(settings);"), "Solo practice must use the same verified canvas startup path as classroom play.");
assert.ok(main.includes("saveCheckpoint?.()"), "The current checkpoint must be saved when the page is hidden or exited.");
assert.ok(firebase.includes("auth.authStateReady()"), "Refresh recovery must wait for Firebase to restore the existing anonymous student UID.");


// Offline-safe Firebase synchronization regression checks.
assert.ok(main.includes("emerald-frontier:pending-attempts:"), "Unsent question attempts must have a device-local queue.");
assert.ok(main.includes("localStorage.setItem(attemptQueueStorageKey()"), "Question attempts must be persisted before network sync.");
assert.ok(main.includes('dbSet("sessions/" + sessionId + "/attempts/" + item.key, item.data)'), "Queued question attempts must sync with stable Firebase keys.");
assert.ok(main.includes("emerald-frontier:pending-result:"), "Unsent final results must survive a page refresh.");
assert.ok(main.includes("localStorage.setItem(resultStorageKey(), JSON.stringify(pendingResultMeta))"), "The final score must be persisted locally before Firebase sync.");
assert.ok(main.includes('window.addEventListener("online"'), "Pending attempts and results must retry when the browser reconnects.");
assert.ok(main.includes('dbWatch(".info/connected"'), "Firebase connectivity must be monitored independently of browser online state.");
assert.ok(main.includes("if (navigator.onLine === false) throw new Error"), "Offline final results must remain pending instead of being reported as synced.");
assert.ok(battle.includes("Number(saved.energy ?? 150)"), "A zero-energy checkpoint must restore as zero, not reset to the starting energy.");
assert.ok(battle.includes("Number(saved.baseHealth ?? 100)"), "A zero-health checkpoint must restore as zero, not reset to full health.");


// Firebase rules must allow idempotent retries only for the authenticated player's own attempt.
const attemptWriteRule = databaseRules.rules.sessions.$sessionId.attempts.$attemptId[".write"];
assert.ok(attemptWriteRule.includes("data.child('playerId').val() === auth.uid"), "A student may retry only their own existing question-attempt record.");
assert.ok(attemptWriteRule.includes("blockedPlayers"), "Blocked students must not be able to submit or retry attempts.");
const resultRule = databaseRules.rules.sessions.$sessionId.results.$uid;
assert.ok(resultRule[".write"].includes("auth.uid === $uid") && resultRule[".write"].includes("blockedPlayers"), "Only an active, unblocked student may submit their own final result.");
assert.ok(resultRule[".validate"].includes("accuracy") && resultRule[".validate"].includes("completedAt") && resultRule[".validate"].includes("isBoolean"), "Final result records must enforce the expected score, status, and timestamp data types.");


// Rejoin must preserve existing players even when late joining is disabled.
assert.ok(main.includes('!studentSession.allowLateJoin && !existingPlayer.exists()'), "Late-join restrictions must not block an existing student from reconnecting.");
assert.ok(main.includes('localStorage.getItem("emerald-frontier:pending-attempts:" + sessionId + ":" + user.uid)'), "A finished player's unsynced attempts must trigger a rejoin for recovery.");
assert.ok(main.includes('existingPlayer.val().status === "finished" && !hasPendingSaves'), "A completed student must not accidentally start a second attempt without pending data.");

// Firebase Realtime Database rule compatibility and cache-refresh guards.
assert.ok(!JSON.stringify(databaseRules).includes("numChildren("), "Realtime Database rules must not use the unsupported numChildren() method.");
assert.ok(databaseRules.rules.sessions.$sessionId.players.$uid[".write"].includes("auth.uid === $uid"), "A student must only write their own player record.");
assert.ok(main.includes("firebase.js?v=free-seat-capacity-1"), "Firebase client module cache must refresh with the new transaction helper.");
assert.ok(main.includes("reserveClassroomSeat") && main.includes("dbTransaction"), "New classroom students must reserve a seat through an atomic Realtime Database transaction.");
assert.equal(Object.keys(databaseRules.rules.sessions.$sessionId.seats).includes("$seatId"), true, "The free seat ledger must expose individual protected seat records.");
assert.ok(databaseRules.rules.sessions.$sessionId.seats[".read"] === true, "Students must be able to inspect anonymous seat occupancy without reading other students' personal records.");
const allowedTeacherRule = databaseRules.rules.allowedTeachers.$uid;
assert.equal(allowedTeacherRule[".write"], false, "Clients must not be able to grant themselves teacher access.");
assert.ok(allowedTeacherRule[".read"].includes("auth.uid === $uid"), "A signed-in account may check only its own teacher allowlist entry.");
assert.ok(databaseRules.rules.sessions.$sessionId.public[".write"].includes("allowedTeachers"), "Only allowlisted teachers may create or update classroom sessions.");
assert.ok(databaseRules.rules.sessions.$sessionId[".write"].includes("allowedTeachers"), "Only allowlisted teachers may delete or manage an entire classroom session.");
assert.ok(databaseRules.rules.teacherSessions.$uid[".read"].includes("allowedTeachers") && databaseRules.rules.teacherSessions.$uid[".write"].includes("allowedTeachers"), "Teacher question banks and session indexes must require an explicit allowlist entry.");
assert.ok(dashboard.includes('dbGet("allowedTeachers/"+user.uid)') && dashboard.includes("await teacherSignOut()"), "The dashboard must reject and sign out accounts that are not explicitly allowlisted.");
assert.ok(read("../teacher-dashboard.html").includes("src/dashboard.js?v=teacher-username-login-1"), "The teacher dashboard must bypass stale cached authorization code.");
assert.ok(databaseRules.rules.sessions.$sessionId.seats.$seatId[".write"].includes("!data.exists()"), "A seat may only be claimed while it is empty.");
assert.ok(main.includes("This classroom session is full (30 students)."), "The join flow must clearly reject students when all 30 seats are reserved.");
assert.ok(dashboard.includes('dbGet(sessionPath+"/seats")') && dashboard.includes('dbRemove(sessionPath+"/seats/"+reservedSeat[0])'), "Removing a student must release their reserved seat for a replacement.");

assert.ok(html.includes("src/main.js?v=classroom-canvas-reveal-3"), "The entry module cache token must refresh after tablet stability changes.");
assert.ok(practice.includes("css/game.css?v=student-game-layout-fix-4") && practice.includes("src/main.js?v=classroom-canvas-reveal-3"), "Standalone practice must load the current shared gameplay assets.");

// Ensure nested gameplay module also bypasses stale browser caches.
assert.ok(main.includes("BattleScene.js?v=classroom-canvas-reveal-3"), "The BattleScene module cache token must refresh phone question layout changes.");

// Important player actions must checkpoint immediately, not only on the periodic timer.
assert.ok(battle.includes("this.saveCheckpoint();\n      } catch (error)"), "A successful defender deployment must immediately persist the checkpoint.");
assert.ok(battle.includes("this.updateHud();\n      this.saveCheckpoint();\n      if (this.pendingBossQuestion"), "A selected defender specialization must be checkpointed immediately.");
assert.ok(battle.includes("this.lastAscensionWave = this.wave;\n      this.saveCheckpoint();"), "Boss ascension progress must be checkpointed before the next wave transition.");
assert.ok(battle.includes("this.updateHud();\n      this.saveCheckpoint();\n    }\n\n    showSunwellEnergy"), "Starting the next wave must immediately persist the new wave number.");
assert.ok(battle.includes('this.playSound("remove");\n      this.updateHud();\n      this.saveCheckpoint();'), "Removing a defender must immediately persist the checkpoint.");
assert.ok(battle.includes("// Persist the answered question and resulting battle state immediately") && battle.includes("this.saveCheckpoint();\n      const feedback"), "Answering a question must immediately persist the updated score and battle state.");
assert.ok(main.includes("BattleScene.js?v=classroom-canvas-reveal-3"), "The BattleScene cache token must refresh after phone question layout changes.");


// 960x420 overlay geometry and phone answer-control regression checks.
assert.ok(battle.includes('this.add.rectangle(480, 210, 960, 420, 0x071321, .9)'), "Tier upgrade overlays must cover the full 960x420 battlefield.");
assert.ok(battle.includes('this.add.rectangle(480, 210, 960, 420, 0x071321, .92)'), "Boss ascension overlays must cover the full 960x420 battlefield.");
assert.ok(battle.includes('this.add.rectangle(480, 210, 960, 420, 0x06101e, .88)'), "The end-game overlay must cover the full 960x420 battlefield.");
assert.ok(battle.includes('const phoneQuestionLayout = this.phoneLandscape;') && battle.includes('phoneQuestionLayout ? 410 : 360'), "Phone question panels must use the taller screen without changing desktop sizing.");
assert.ok(battle.includes('const continueY = this.phoneLandscape ? 394 : 365;'), "Continue controls must not overlap the fourth phone answer.");
assert.ok(battle.includes('this.add.text(480, this.phoneLandscape ? 364 : 335'), "Question feedback must be placed below the answer rows.");


// Lifecycle and offline-retry regression checks.
assert.ok(battle.includes('this.events.once("shutdown"') && battle.includes('this.input.off("pointerdown", this.handleBoardPointerInput)'), "Scene shutdown must not accumulate duplicate listeners after a restart.");
assert.ok(battle.includes("window.clearTimeout(this.questionResolutionTimer)") && battle.includes("this.questionResolutionToken++;"), "Browser question timers must be cancelled when the scene shuts down.");
assert.ok(main.includes("function scheduleAttemptRetry()") && main.includes("function scheduleResultRetry()"), "Failed classroom saves must schedule automatic retries.");
assert.ok(main.includes("Math.min(30000, attemptRetryDelay * 2)") && main.includes("Math.min(30000, resultRetryDelay * 2)"), "Automatic save retries must use bounded exponential backoff.");


// Phone upgrade and answer overlay fit checks.
assert.ok(battle.includes('this.phoneLandscape ? 820 : 940') && battle.includes('this.phoneLandscape ? 390 : 360'), "Phone tier-upgrade panels must fit inside the zoomed phone viewport.");
assert.ok(battle.includes('const x = phoneLayout ? (col === 0 ? 260 : 700) : 125 + col * 237;') && battle.includes('const y = phoneLayout ? 125 + row * 65'), "All eight tier choices must remain visible and tappable in a two-column phone layout.");
assert.ok(battle.includes('const answerStartY = phoneQuestionLayout ? 190 :') && battle.includes('const continueY = this.phoneLandscape ? 394 : 365;'), "Four phone answers and the Continue control must occupy separate vertical space.");


// Teacher username login maps public usernames to Firebase's internal synthetic email identifiers.
assert.match(read("../teacher-dashboard.html"), /Username or email/);
assert.match(read("../teacher-dashboard.html"), /teacher-username-login-1/);
assert.match(dashboard, /username\s*=\s*identifier\.toLowerCase\(\)/);
assert.match(dashboard, /username\+"@teachers\.grammar-defenders\.invalid"/);
assert.match(dashboard, /Use a username with 3–32 letters/);
assert.match(dashboard, /Teacher: \"\+user\.email\.split\("@"\)\[0\]/);


// QR-code student entry must show only the Join Class Session form.
assert.match(main, /document\.body\.classList\.add\("student-session-join"\)/);
assert.match(main, /document\.getElementById\("teacher-access"\)\?\.remove\(\)/, "Student session links must remove teacher access from the join page.");
assert.match(css, /body\.student-session-join:not\(\.playing\) \.app-shell > :not\(#student-join-screen\)/, "The QR join-only layout must stop hiding the game once gameplay begins.");
assert.match(css, /body\.student-session-join #student-join-screen/);
assert.match(html, /css\/game\.css\?v=student-game-layout-fix-4/);
assert.match(html, /src\/main\.js\?v=classroom-canvas-reveal-3/);


// One public entry point: the homepage introduces the game and provides teacher login.
// Students enter through the session-specific QR/link generated inside the dashboard.
const publicHome = read("../index.html");
assert.match(publicHome, /id="landing-hero"/, "The shared public link must open the Emerald Frontier game homepage.");
assert.match(publicHome, /id="teacher-access"/, "Teacher login must be displayed below the game homepage.");
assert.ok(!publicHome.includes('id="teacher-access" class="teacher-access-section hidden"'), "Teacher login must not be hidden on the public homepage.");
assert.match(css, /body:not\(\.playing\) \.teacher-access-section/, "Teacher login must remain visible outside active gameplay.");
assert.match(css, /#teacher-access\.teacher-access-section\{display:block!important/, "Teacher login must be explicitly visible on the public homepage.");
assert.match(css, /height:230px!important/, "Desktop homepage hero must be compact enough to reveal teacher login.");
assert.match(css, /height:210px!important/, "Mobile homepage hero must be compact enough to reveal teacher login.");
assert.match(css, /body\.playing\{min-height:100dvh;height:100dvh;overflow:hidden;padding:3px 6px\}/, "Short-landscape viewport locking must be limited to active gameplay.");
assert.match(css, /body\.playing \.app-shell\{height:100%;max-width:none;display:flex;flex-direction:column\}/, "Short-landscape app-shell sizing must not clip the public homepage.");
assert.doesNotMatch(css, /html, body \{ width:100%; height:100%; min-height:0; overflow:hidden; \}/, "Public homepage must retain vertical scrolling on landscape touch devices.");
assert.ok(html.includes('id="homepage-teacher-email"') && html.includes('id="homepage-teacher-password"'), "Public homepage must expose both teacher login fields.");
assert.match(css, /body:not\(\.playing\) \.landing-hero\{min-height:230px!important;height:230px!important/, "The public hero must be compact enough to reveal teacher login beneath it.");
assert.match(css, /#teacher-access \.teacher-access-card\{display:block!important;visibility:visible!important;opacity:1!important;width:min\(650px,100%\)!important;margin:0 auto!important;padding:18px 24px!important\}/, "The teacher login card must remain visible with compact homepage spacing.");
assert.match(publicHome, /Username or email/, "The homepage teacher login must support the existing username accounts.");
assert.ok(publicHome.includes("@teachers.grammar-defenders.invalid"), "Homepage username login must map to the same internal teacher account format.");
assert.ok(!publicHome.includes('id="homepage-entry"') && publicHome.includes('<section class="homepage-play-section"') && publicHome.includes('id="play-game-button"') && !publicHome.includes("Teacher Dashboard</a>"), "The public homepage must provide a standalone no-login solo Play Game action outside the clipped hero.");
assert.ok(publicHome.includes("css/game.css?v=student-game-layout-fix-4"), "The homepage stylesheet cache must refresh for the standalone Play Game action.");
assert.ok(publicHome.includes("src/main.js?v=classroom-canvas-reveal-3"), "The homepage game module cache must refresh for the unified entry point.");

assert.ok(dashboard.includes('window.location.replace("./#teacher-access")'), "Unauthenticated dashboard visitors must be sent to the single public homepage login.");


// Classroom lobby, safe Phaser scene startup, and unrecorded solo-play regression checks.
assert.match(main, /function teacherHasStartedSession\(session\)/, "A classroom battle must require the teacher's explicit start timestamp.");
assert.match(main, /session\?\.status === "running" && Number\(session\.startedAt\) > 0/, "Students must not enter the battle merely because a session status is stale or malformed.");
assert.match(main, /async function waitForBattleSceneReady\(\)/, "Gameplay must wait for the Phaser scene create event before starting.");
assert.match(main, /scene\.worldReady/, "The battlefield must expose a completed world-ready state.");
assert.ok(main.includes("!scene.worldReady || !scene.sys.isActive()") && main.includes("if (!scene.worldReady || !scene.sys.isActive())"), "Scene readiness must verify both completed drawing and active Phaser lifecycle state.");
assert.ok(battle.includes("this.worldReady = false;\n      this.drawWorld();") && battle.includes("this.worldReady = false;\n        this.battleStarted = false;"), "Scene readiness must be invalidated on shutdown and rebuilt on restart.");
assert.doesNotMatch(battle, /if \(launchConfig && launchConfig\.studentLaunch\) this\.startBattle\(launchConfig\)/, "BattleScene must not auto-start before main.js has verified readiness.");
assert.match(html, /id="play-game-button"/, "The public homepage must restore the no-login Play Game button.");
assert.match(main, /document\.getElementById\("play-game-button"\)/, "The solo Play Game button must open practice setup.");
assert.match(main, /document\.getElementById\("back-home"\)/, "Solo setup must provide a return-to-home control.");
assert.match(css, /body\.playing #teacher-access/, "Teacher login must be hidden during active solo or classroom gameplay.");


// Homepage solo-play button visibility regression checks.
assert.match(html, /<section class="homepage-play-section"[\s\S]*?id="play-game-button"[\s\S]*?<\/section>/, "The solo Play Game button must be placed in its own visible section outside the hero.");
assert.match(css, /body:not\(\.playing\) \.homepage-play-section\{[^}]*display:flex!important/, "The homepage Play Game section must remain visible outside active gameplay.");
assert.match(css, /\.homepage-play-button\{[^}]*min-height:48px!important/, "The homepage Play Game button must have a clear, usable tap target.");
assert.match(css, /@media\(max-width:760px\)\{body:not\(\.playing\) \.homepage-play-section\{flex-direction:column/, "The homepage Play Game action must stack cleanly on narrow screens.");
