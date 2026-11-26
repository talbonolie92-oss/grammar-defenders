import { createGameScene } from "./scenes/BattleScene.js?v=mobile-performance-1";
import { firebaseReady, studentSignIn, dbGet, dbSet, dbUpdate, dbWatch, dbPush } from "./firebase.js";

const params = new URLSearchParams(window.location.search);
const setupScreen = document.getElementById("setup-screen");
const gameLayout = document.getElementById("game-layout");
const studentJoinScreen = document.getElementById("student-join-screen");
const landingHero = document.getElementById("landing-hero");
const sessionId = params.get("session");
const isSmallScreen = window.matchMedia?.("(max-width: 900px)").matches || false;
const pixelRatio = Math.min(window.devicePixelRatio || 1, isSmallScreen ? 1 : 1.5);
const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 960,
  height: 340,
  transparent: true,
  resolution: pixelRatio,
  render: { antialias: !isSmallScreen, pixelArt: false, roundPixels: true, powerPreference: isSmallScreen ? "low-power" : "high-performance" },
  fps: { target: isSmallScreen ? 50 : 60, min: 30, forceSetTimeOut: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [createGameScene()]
};
const game = new Phaser.Game(config);
const gameReady = new Promise(resolve => {
  if (game.isBooted) resolve();
  else game.events.once("ready", resolve);
});
let studentSession = null;
let studentUid = null;
let stopSessionWatch = null;
let stopPlayerWatch = null;
let stopBlockedWatch = null;
let resultSaved = false;
let resultSavePromise = null;
let pendingResult = null;
let studentLaunchStarted = false;

if (sessionId) {
  landingHero?.classList.add("hidden");
  setupScreen?.classList.add("hidden");
  studentJoinScreen?.classList.remove("hidden");
  gameLayout?.classList.add("hidden");
  if (!firebaseReady) {
    document.getElementById("student-join-status").textContent = "This classroom game is not connected to Firebase yet. Please tell your teacher.";
    document.getElementById("student-join-form").classList.add("hidden");
  } else {
    initializeStudentJoin();
  }
}

function startSoloSetup() {
  document.getElementById("start-game")?.addEventListener("click", async () => {
    const initialScene = game.scene.getScene("BattleScene");
    initialScene?.enableMusic?.();
    if (initialScene) initialScene.soundOn = true;
    const soundToggle = document.getElementById("sound-toggle");
    if (soundToggle) soundToggle.textContent = "SFX: On";
    const settings = {
      mode: document.getElementById("setup-mode")?.value || "endless",
      timeLimitMinutes: Number(document.getElementById("setup-time")?.value || 10),
      questionIntervalSeconds: Number(document.getElementById("setup-interval")?.value || 45),
      difficulty: document.getElementById("setup-difficulty")?.value || "normal"
    };
    window.GRAMMAR_DEFENDERS_CONFIG = settings;
    try { if (screen.orientation?.lock) await screen.orientation.lock("landscape"); } catch (_) {}
    try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch (_) {}
    try {
      await gameReady;
      const battleScene = game.scene.getScene("BattleScene");
      if (!battleScene) throw new Error("The battle scene could not be initialized. Please reload the game.");
      setupScreen?.classList.add("hidden");
      landingHero?.classList.add("hidden");
      document.body.classList.add("playing");
      gameLayout?.classList.remove("hidden");
      requestAnimationFrame(() => {
        game.scale.refresh();
        if (battleScene.sys.isActive()) battleScene.startBattle(settings);
        else battleScene.events.once("create", () => battleScene.startBattle(settings));
      });
    } catch (error) {
      const status = document.getElementById("setup-status");
      if (status) status.textContent = error.message || "The game could not start. Please reload and try again.";
      console.error("Emerald Frontier failed to start:", error);
    }
  });


}
startSoloSetup();

async function initializeStudentJoin() {
  const form = document.getElementById("student-join-form");
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    const audioScene = game.scene.getScene("BattleScene");
    audioScene?.prepareAudio?.();
    if (audioScene) audioScene.soundOn = true;
    const soundToggle = document.getElementById("sound-toggle");
    if (soundToggle) soundToggle.textContent = "SFX: On";
    let name = document.getElementById("student-name").value.trim();
    let classSection = document.getElementById("student-class").value.trim();
    const status = document.getElementById("student-join-status");
    if (!name || !classSection) { status.textContent = "Please enter your name and class/section."; return; }
    status.textContent = "Joining your classroom session…";
    try {
      const user = await studentSignIn();
      studentUid = user.uid;
      const snapshot = await dbGet("sessions/" + sessionId + "/public");
      if (!snapshot.exists()) throw new Error("This session link is invalid or has been removed.");
      studentSession = snapshot.val();
      if (studentSession.status === "ended") throw new Error("This classroom session has already ended.");
      if (studentSession.status === "running" && !studentSession.allowLateJoin) throw new Error("Your teacher has disabled late joining.");
      const blocked = await dbGet("sessions/" + sessionId + "/blockedPlayers/" + studentUid);
      if (blocked.exists() && blocked.val() === true) throw new Error("Your teacher removed you from this session. Please speak with your teacher.");
      // Do not read the entire players collection here: database rules intentionally
      // keep other students' names and class details private. The Firebase rule on
      // this student's own player record enforces the 30-player session limit.
      const existingPlayer = await dbGet("sessions/" + sessionId + "/players/" + studentUid);
      if (existingPlayer.exists()) {
        name = existingPlayer.val().name || name;
        classSection = existingPlayer.val().classSection || classSection;
      } else {
        await dbSet("sessions/" + sessionId + "/players/" + studentUid, {
          name, classSection, joinedAt: Date.now(), status: "waiting", active: true
        });
      }
      document.getElementById("student-session-name").textContent = studentSession.title || "Your teacher's Emerald Frontier session";
      form.classList.add("hidden");
      document.getElementById("student-waiting").classList.remove("hidden");
      status.textContent = "";
      stopPlayerWatch = dbWatch("sessions/" + sessionId + "/players/" + studentUid, snap => {
        if (!snap.exists()) {
          const scene = game.scene.getScene("BattleScene");
          if (scene?.battleStarted && !scene.gameOver) scene.endGame(false, "REMOVED FROM CLASS SESSION");
          else {
            document.getElementById("student-waiting").innerHTML = "<b>Access removed</b><p>Your teacher removed you from this session.</p>";
            form.classList.add("hidden");
          }
        }
      }, err => { status.textContent = err.message; });
      stopBlockedWatch = dbWatch("sessions/" + sessionId + "/blockedPlayers/" + studentUid, snap => {
        if (snap.exists() && snap.val() === true) {
          const scene = game.scene.getScene("BattleScene");
          if (scene?.battleStarted && !scene.gameOver) scene.endGame(false, "REMOVED FROM CLASS SESSION");
          else {
            document.getElementById("student-waiting").innerHTML = "<b>Access removed</b><p>Your teacher removed you from this session.</p>";
            form.classList.add("hidden");
          }
        }
      }, err => { status.textContent = err.message; });
      stopSessionWatch = dbWatch("sessions/" + sessionId + "/public", snap => {
        if (!snap.exists()) { const scene=game.scene.getScene("BattleScene"); if(scene?.battleStarted&&!scene.gameOver)scene.endGame(false,"SESSION REMOVED BY TEACHER"); else status.textContent = "Your teacher removed this session."; return; }
        studentSession = snap.val();
        if (studentSession.status === "ended") {
          const scene=game.scene.getScene("BattleScene");
          if(scene?.battleStarted&&!scene.gameOver)scene.endGame(false,"SESSION ENDED BY TEACHER");
          else document.getElementById("student-waiting").innerHTML = "<b>Session ended</b><p>Your teacher has ended this game.</p>";
        } else if (studentSession.status === "running") {
          launchStudentGame(name, classSection);
        }
      }, err => { status.textContent = err.message; });
      if (studentSession.status === "running") launchStudentGame(name, classSection);
    } catch (error) { status.textContent = error.message || "Unable to join this session."; }
  });

  // A returning student on the same browser can rejoin without typing their
  // details again. Firebase's persisted anonymous UID identifies their record.
  studentSignIn().then(async user => {
    const existing = await dbGet("sessions/" + sessionId + "/players/" + user.uid);
    if (!existing.exists()) return;
    const player = existing.val();
    if (!["waiting", "playing"].includes(player.status) || form.dataset.autoResume === "done") return;
    form.dataset.autoResume = "done";
    document.getElementById("student-name").value = player.name || "";
    document.getElementById("student-class").value = player.classSection || "";
    form.requestSubmit();
  }).catch(() => {});
}

async function launchStudentGame(name, classSection) {
  if (studentLaunchStarted || window.GRAMMAR_DEFENDERS_CONFIG?.studentLaunch) return;
  studentLaunchStarted = true;
  const settings = {
    mode: studentSession.mode || "endless",
    timeLimitMinutes: Number(studentSession.timeLimitMinutes) || 10,
    questionIntervalSeconds: Number(studentSession.questionIntervalSeconds) || 45,
    difficulty: studentSession.difficulty || "normal",
    studentLaunch: true,
    questions: Array.isArray(studentSession.questions) ? studentSession.questions : [],
    sessionId, playerId: studentUid, playerName: name, classSection
  };
  window.GRAMMAR_DEFENDERS_CONFIG = settings;
  try {
    await gameReady;
    const battleScene = game.scene.getScene("BattleScene");
    if (!battleScene) throw new Error("The battle scene could not be initialized. Please reload the game.");
    await dbUpdate("sessions/" + sessionId + "/players/" + studentUid, { status: "playing", active: true, startedPlayingAt: Date.now() });
  } catch (error) {
    studentLaunchStarted = false;
    delete window.GRAMMAR_DEFENDERS_CONFIG;
    document.getElementById("student-join-screen")?.classList.remove("hidden");
    gameLayout?.classList.add("hidden");
    document.getElementById("student-join-status").textContent = "Could not join the game. Please try again.";
    console.warn("Could not start student session:", error);
    return;
  }
  window.GRAMMAR_DEFENDERS_SESSION = { sessionId, playerId: studentUid, playerName: name, classSection };
  document.getElementById("student-join-screen")?.classList.add("hidden");
  landingHero?.classList.add("hidden");
  document.body.classList.add("playing");
  gameLayout?.classList.remove("hidden");
  game.scene.getScene("BattleScene")?.enableMusic?.();
  try { if (screen.orientation?.lock) await screen.orientation.lock("landscape"); } catch (_) {}
  try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch (_) {}
  requestAnimationFrame(() => {
    game.scale.refresh();
    const scene = game.scene.getScene("BattleScene");
    if (!scene) {
      document.getElementById("student-join-status").textContent = "The battle could not start. Please reload and rejoin.";
      return;
    }
    if (scene.sys.isActive()) scene.startBattle(settings);
    else {
      scene.events.once("create", () => scene.startBattle(settings));
      scene.scene.start();
    }
  });
  window.GD_SAVE_ATTEMPT = async attempt => {
    if (!studentUid || resultSaved) return;
    const key = dbPush("sessions/" + sessionId + "/attempts").key;
    await dbSet("sessions/" + sessionId + "/attempts/" + key, { ...attempt, playerId: studentUid, playerName: name, classSection, createdAt: Date.now() });
  };
  window.GD_SAVE_RESULT = async result => {
    if (!studentUid || resultSaved) return;
    pendingResult = result;
    if (resultSavePromise) return resultSavePromise;
    resultSavePromise = (async () => {
      const completedAt = Date.now();
      let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await dbSet("sessions/" + sessionId + "/results/" + studentUid, {
            ...result, name, classSection, completedAt
          });
          await dbUpdate("sessions/" + sessionId + "/players/" + studentUid, {
            status: "finished", finishedAt: completedAt, active: false
          });
          resultSaved = true;
          pendingResult = null;
          return;
        } catch (error) {
          lastError = error;
          if (attempt < 3) await new Promise(resolve => window.setTimeout(resolve, attempt * 700));
        }
      }
      throw lastError;
    })();
    try {
      await resultSavePromise;
    } catch (error) {
      resultSavePromise = null;
      const message = document.getElementById("battle-message");
      if (message) message.textContent = "Result not synced yet. Keep this page open and reconnect before leaving.";
      throw error;
    }
  };
}

document.addEventListener("visibilitychange", () => {
  if (!game || !game.scene) return;
  if (document.hidden) {
    game.scene.getScene("BattleScene")?.saveCheckpoint?.();
    game.loop.sleep();
  } else game.loop.wake();
});
window.addEventListener("online", () => {
  if (pendingResult && !resultSaved && typeof window.GD_SAVE_RESULT === "function") {
    window.GD_SAVE_RESULT(pendingResult).catch(error => console.warn("Result sync will retry when the connection returns:", error));
  }
});
window.addEventListener("pagehide", () => {
  game.scene.getScene("BattleScene")?.saveCheckpoint?.();
});
window.addEventListener("beforeunload", () => {
  if (stopSessionWatch) stopSessionWatch();
  if (stopPlayerWatch) stopPlayerWatch();
  if (stopBlockedWatch) stopBlockedWatch();
  game.destroy(true);
}, { once: true });
