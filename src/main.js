import { createGameScene } from "./scenes/BattleScene.js?v=mobile-projectile-pixel-snap-1";
import { firebaseReady, studentSignIn, dbGet, dbSet, dbUpdate, dbWatch, dbPush, dbRemove, dbTransaction } from "./firebase.js?v=free-seat-capacity-1";
import { getSeatReservationPlan } from "./session-capacity.js";

const params = new URLSearchParams(window.location.search);
const setupScreen = document.getElementById("setup-screen");
const gameLayout = document.getElementById("game-layout");
const studentJoinScreen = document.getElementById("student-join-screen");
const landingHero = document.getElementById("landing-hero");
const sessionId = params.get("session");
const isTouchDevice = Boolean(window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 0 || window.matchMedia?.("(max-width: 900px)").matches);
const pixelRatio = Math.min(window.devicePixelRatio || 1, isTouchDevice ? 1 : 1.5);
const config = {
  // Canvas rendering is the compatibility path for classroom phones/tablets;
  // the battlefield uses 2D primitives and does not require WebGL.
  type: isTouchDevice ? Phaser.CANVAS : Phaser.AUTO,
  parent: "game-container",
  width: 960,
  height: 420,
  transparent: false,
  clearBeforeRender: true,
  backgroundColor: "#142f3b",
  resolution: pixelRatio,
  render: { antialias: true, pixelArt: false, roundPixels: isTouchDevice, powerPreference: isTouchDevice ? "low-power" : "high-performance" },
  fps: { target: isTouchDevice ? ((navigator.hardwareConcurrency || 4) <= 4 ? 30 : 40) : 60, min: 24, forceSetTimeOut: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [createGameScene()]
};
const game = new Phaser.Game(config);
const gameReady = new Promise(resolve => {
  if (game.isBooted) resolve();
  else game.events.once("ready", resolve);
});
// Keep Phaser alive while students wait in the lobby. The scene update loop
// is lightweight until battleStarted becomes true; avoiding sleep/wake races is
// more reliable than stopping the renderer and trying to revive it remotely.

function waitForAnimationFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function waitForBattleSceneReady() {
  await gameReady;
  const scene = game.scene.getScene("BattleScene");
  if (!scene) throw new Error("Phaser did not create the battle scene. Reload the page and rejoin.");

  if (!scene.worldReady) {
    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        scene.events.off("create", onCreate);
        reject(new Error("The battlefield did not finish initializing. Reload the page and rejoin."));
      }, 15000);
      const onCreate = () => {
        window.clearTimeout(timer);
        if (scene.worldReady) resolve();
        else reject(new Error("The battlefield scene started but did not finish drawing."));
      };
      scene.events.once("create", onCreate);
    });
  }

  if (!scene.worldReady || !scene.sys.isActive()) {
    throw new Error("The battlefield scene is not active. Reload the page and rejoin.");
  }
  return scene;
}

async function revealBattlefield(scene) {
  // The QR join page uses body-level grid styling. Remove that page mode
  // completely once the game starts so it cannot constrain Phaser's canvas.
  document.body.classList.add("playing");
  document.body.classList.remove("student-session-join");
  gameLayout?.classList.remove("hidden");
  studentJoinScreen?.classList.add("hidden");
  setupScreen?.classList.add("hidden");
  landingHero?.classList.add("hidden");

  // Wait until CSS has laid out the previously hidden game container before
  // asking Phaser's Scale Manager to calculate its canvas size.
  await waitForAnimationFrame();
  await waitForAnimationFrame();
  // The game boots while this container is display:none on QR entry. A plain
  // refresh can leave Phaser's CSS canvas size at 0×0, so reapply its logical
  // size after the student page has been fully revealed, then recalculate FIT.
  game.scale.resize(960, 420);
  game.scale.refresh();
  await waitForAnimationFrame();

  const container = document.getElementById("game-container");
  const canvas = container?.querySelector("canvas");
  const bounds = container?.getBoundingClientRect();
  if (!canvas) throw new Error("Phaser created no canvas. Check the browser's graphics support and reload.");
  if (!bounds || bounds.width < 160 || bounds.height < 100 || canvas.width < 160 || canvas.height < 100) {
    throw new Error("The battlefield canvas has no usable size. Rotate the device to landscape, then reload.");
  }
  if (!scene.worldReady || !scene.sys.isActive()) {
    throw new Error("The battlefield stopped during screen setup. Please reload and rejoin.");
  }
  scene.refreshPhoneLayout?.();
  return { canvas, bounds };
}

function teacherHasStartedSession(session) {
  return session?.status === "running" && Number(session.startedAt) > 0;
}
let studentSession = null;
let studentUid = null;
let stopSessionWatch = null;
let stopPlayerWatch = null;
let stopBlockedWatch = null;
let resultSaved = false;
let resultSavePromise = null;
let pendingResult = null;
let pendingResultMeta = null;
let pendingAttempts = [];
let attemptFlushPromise = null;
let attemptRetryTimer = null;
let resultRetryTimer = null;
let attemptRetryDelay = 1500;
let resultRetryDelay = 2000;
let stopConnectionWatch = null;
let studentLaunchStarted = false;

function attemptQueueStorageKey() {
  return "emerald-frontier:pending-attempts:" + sessionId + ":" + studentUid;
}
function resultStorageKey() {
  return "emerald-frontier:pending-result:" + sessionId + ":" + studentUid;
}
function loadPendingSaves() {
  try {
    const attempts = JSON.parse(localStorage.getItem(attemptQueueStorageKey()) || "[]");
    pendingAttempts = Array.isArray(attempts) ? attempts : [];
  } catch (_) { pendingAttempts = []; }
  try {
    const saved = JSON.parse(localStorage.getItem(resultStorageKey()) || "null");
    if (saved?.result && typeof saved.result === "object") {
      pendingResult = saved.result;
      pendingResultMeta = saved;
    }
  } catch (_) { pendingResult = null; pendingResultMeta = null; }
}
function scheduleAttemptRetry() {
  if (navigator.onLine === false || attemptRetryTimer || !pendingAttempts.length) return;
  const delay = attemptRetryDelay;
  attemptRetryDelay = Math.min(30000, attemptRetryDelay * 2);
  attemptRetryTimer = window.setTimeout(() => {
    attemptRetryTimer = null;
    flushPendingAttempts().catch(error => console.warn("Question attempt retry remains queued:", error));
  }, delay);
}
function scheduleResultRetry() {
  if (navigator.onLine === false || resultRetryTimer || !pendingResult) return;
  const delay = resultRetryDelay;
  resultRetryDelay = Math.min(30000, resultRetryDelay * 2);
  resultRetryTimer = window.setTimeout(() => {
    resultRetryTimer = null;
    syncPendingResult().catch(error => console.warn("Final result retry remains queued:", error));
  }, delay);
}
function persistPendingAttempts() {
  try { localStorage.setItem(attemptQueueStorageKey(), JSON.stringify(pendingAttempts)); }
  catch (error) { console.warn("Could not store pending question attempts locally:", error); }
}
async function flushPendingAttempts() {
  if (!studentUid || !pendingAttempts.length || navigator.onLine === false) return;
  if (attemptFlushPromise) return attemptFlushPromise;
  attemptFlushPromise = (async () => {
    while (pendingAttempts.length && navigator.onLine !== false) {
      const item = pendingAttempts[0];
      try {
        await dbSet("sessions/" + sessionId + "/attempts/" + item.key, item.data);
        pendingAttempts.shift();
        persistPendingAttempts();
      } catch (error) {
        console.warn("Question attempt remains safely queued for sync:", error);
        scheduleAttemptRetry();
        break;
      }
    }
  })();
  try { await attemptFlushPromise; }
  finally {
    attemptFlushPromise = null;
    if (!pendingAttempts.length) {
      attemptRetryDelay = 1500;
      if (attemptRetryTimer) {
        window.clearTimeout(attemptRetryTimer);
        attemptRetryTimer = null;
      }
    }
  }
}
async function syncPendingResult() {
  if (!studentUid || !pendingResult || !pendingResultMeta) return;
  if (navigator.onLine === false) throw new Error("The device is offline; the result remains saved locally.");
  if (resultSavePromise) return resultSavePromise;
  const saved = pendingResultMeta;
  resultSavePromise = (async () => {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await dbSet("sessions/" + sessionId + "/results/" + studentUid, {
          ...saved.result, name: saved.name, classSection: saved.classSection, completedAt: saved.completedAt
        });
        await dbUpdate("sessions/" + sessionId + "/players/" + studentUid, {
          status: "finished", finishedAt: saved.completedAt, active: false
        });
        resultSaved = true;
        pendingResult = null;
        pendingResultMeta = null;
        localStorage.removeItem(resultStorageKey());
        resultRetryDelay = 2000;
        if (resultRetryTimer) {
          window.clearTimeout(resultRetryTimer);
          resultRetryTimer = null;
        }
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise(resolve => window.setTimeout(resolve, attempt * 700));
      }
    }
    throw lastError;
  })();
  try { await resultSavePromise; }
  catch (error) {
    const message = document.getElementById("battle-message");
    if (message) message.textContent = "Result saved on this device; reconnect to sync it with your teacher.";
    scheduleResultRetry();
    throw error;
  } finally {
    resultSavePromise = null;
  }
}

if (sessionId) {
  // QR-code visitors get a focused student-only join page, not the public homepage.
  document.body.classList.add("student-session-join");
  landingHero?.classList.add("hidden");
  document.getElementById("teacher-access")?.remove();
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
  document.getElementById("play-game-button")?.addEventListener("click", () => {
    landingHero?.classList.add("hidden");
    setupScreen?.classList.remove("hidden");
    setupScreen?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("back-home")?.addEventListener("click", () => {
    setupScreen?.classList.add("hidden");
    landingHero?.classList.remove("hidden");
    landingHero?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("start-game")?.addEventListener("click", async () => {
    const initialScene = game.scene.getScene("BattleScene");
    initialScene?.prepareAudio?.();
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
      const battleScene = await waitForBattleSceneReady();
      await revealBattlefield(battleScene);
      battleScene.startBattle(settings);
      if (!battleScene.battleStarted) throw new Error("Phaser did not enter the battle state. Please try again.");
    } catch (error) {
      document.body.classList.remove("playing");
      gameLayout?.classList.add("hidden");
      setupScreen?.classList.remove("hidden");
      const status = document.getElementById("setup-status");
      if (status) status.textContent = error.message || "The game could not start. Please reload and try again.";
      console.error("Emerald Frontier failed to start:", error);
    }
  });
}
startSoloSetup();

async function reserveClassroomSeat() {
  const seatsPath = "sessions/" + sessionId + "/seats";
  const triedSeatIds = new Set();
  while (triedSeatIds.size < 30) {
    const seatsSnapshot = await dbGet(seatsPath);
    const plan = getSeatReservationPlan(seatsSnapshot.val() || {}, studentUid);
    if (plan.existingSeatId) return plan.existingSeatId;
    const seatId = plan.availableSeatIds.find(id => !triedSeatIds.has(id));
    if (!seatId) break;
    triedSeatIds.add(seatId);
    const reservation = await dbTransaction(seatsPath + "/" + seatId, current =>
      current === null ? { uid: studentUid, reservedAt: Date.now() } : undefined
    );
    if (reservation.committed) return seatId;
    // Another student may have won this slot, or a duplicate join from this
    // same browser may have completed. Re-read before trying another seat.
  }
  throw new Error("This classroom session is full (30 students). Please tell your teacher.");
}

function requestStudentImmersiveMode() {
  // Call from the student's Join tap; a later Firebase start signal is not a user gesture.
  try { if (screen.orientation?.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (_) {}
  const request = document.documentElement.requestFullscreen;
  if (request && !document.fullscreenElement) {
    try { Promise.resolve(request.call(document.documentElement)).catch(() => document.getElementById('student-fullscreen-button')?.classList.remove('hidden')); }
    catch (_) { document.getElementById('student-fullscreen-button')?.classList.remove('hidden'); }
  } else if (!document.fullscreenElement) {
    document.getElementById('student-fullscreen-button')?.classList.remove('hidden');
  }
}
async function initializeStudentJoin() {
  const form = document.getElementById("student-join-form");
  const fullscreenButton = document.getElementById("student-fullscreen-button");
  fullscreenButton?.addEventListener("click", requestStudentImmersiveMode);
  document.addEventListener("fullscreenchange", () => {
    fullscreenButton?.classList.toggle("hidden", Boolean(document.fullscreenElement));
  });
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    requestStudentImmersiveMode();
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
      loadPendingSaves();
      stopConnectionWatch = dbWatch(".info/connected", snap => {
        const connected = snap.val() === true;
        document.body.dataset.firebaseConnection = connected ? "connected" : "disconnected";
        if (connected) {
          flushPendingAttempts().catch(error => console.warn("Pending question sync will retry:", error));
          if (pendingResult) syncPendingResult().catch(error => console.warn("Pending result sync will retry:", error));
        }
      }, error => console.warn("Firebase connection monitor unavailable:", error));
      const snapshot = await dbGet("sessions/" + sessionId + "/public");
      if (!snapshot.exists()) throw new Error("This session link is invalid or has been removed.");
      studentSession = snapshot.val();
      const blocked = await dbGet("sessions/" + sessionId + "/blockedPlayers/" + studentUid);
      if (blocked.exists() && blocked.val() === true) throw new Error("Your teacher removed you from this session. Please speak with your teacher.");
      // Do not read the entire players collection here: database rules intentionally
      // keep other students' names and class details private. Verify only this
      // student's record and blocked status before allowing a join.
      const existingPlayer = await dbGet("sessions/" + sessionId + "/players/" + studentUid);
      const hasPendingSaves = pendingAttempts.length > 0 || Boolean(pendingResult);
      if (studentSession.status === "ended" && !hasPendingSaves) throw new Error("This classroom session has already ended.");
      if (teacherHasStartedSession(studentSession) && !studentSession.allowLateJoin && !existingPlayer.exists() && !hasPendingSaves) {
        throw new Error("Your teacher has disabled late joining.");
      }
      if (existingPlayer.exists()) {
        name = existingPlayer.val().name || name;
        classSection = existingPlayer.val().classSection || classSection;
        if (existingPlayer.val().status === "finished" && !hasPendingSaves) {
          throw new Error("You have already completed this classroom game.");
        }
      } else {
        let reservedSeatId = null;
        try {
          reservedSeatId = await reserveClassroomSeat();
          await dbSet("sessions/" + sessionId + "/players/" + studentUid, {
            name, classSection, joinedAt: Date.now(), status: "waiting", active: true
          });
        } catch (joinError) {
          if (reservedSeatId) {
            try { await dbRemove("sessions/" + sessionId + "/seats/" + reservedSeatId); }
            catch (cleanupError) { console.warn("Unused seat cleanup will need teacher attention:", cleanupError); }
          }
          throw joinError;
        }
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
        } else if (teacherHasStartedSession(studentSession)) {
          launchStudentGame(name, classSection);
        }
      }, err => { status.textContent = err.message; });
      if (pendingResult) {
        try { await syncPendingResult(); }
        catch (_) {
          status.textContent = "Your previous result is saved on this device. Reconnect to sync it before starting another game.";
          return;
        }
        if (resultSaved) {
          document.getElementById("student-waiting").innerHTML = "<b>Result safely synced!</b><p>Your previous game result has been delivered to your teacher.</p>";
          return;
        }
      }
      flushPendingAttempts().catch(error => console.warn("Pending question sync will retry:", error));
      if (teacherHasStartedSession(studentSession)) launchStudentGame(name, classSection);
    } catch (error) { status.textContent = error.message || "Unable to join this session."; }
  });

  // A returning student on the same browser can rejoin without typing their
  // details again. Firebase's persisted anonymous UID identifies their record.
  studentSignIn().then(async user => {
    const existing = await dbGet("sessions/" + sessionId + "/players/" + user.uid);
    if (!existing.exists()) return;
    const player = existing.val();
    const hasPendingSaves = Boolean(localStorage.getItem("emerald-frontier:pending-attempts:" + sessionId + ":" + user.uid) ||
      localStorage.getItem("emerald-frontier:pending-result:" + sessionId + ":" + user.uid));
    if ((!["waiting", "playing"].includes(player.status) && !hasPendingSaves) || form.dataset.autoResume === "done") return;
    form.dataset.autoResume = "done";
    document.getElementById("student-name").value = player.name || "";
    document.getElementById("student-class").value = player.classSection || "";
    form.requestSubmit();
  }).catch(() => {});
}

async function launchStudentGame(name, classSection) {
  if (studentLaunchStarted || resultSaved || pendingResult || window.GRAMMAR_DEFENDERS_CONFIG?.studentLaunch) return;
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
  window.GRAMMAR_DEFENDERS_SESSION = { sessionId, playerId: studentUid, playerName: name, classSection };

  try {
    const scene = await waitForBattleSceneReady();
    await revealBattlefield(scene);
    scene.startBattle(settings);
    if (!scene.battleStarted) throw new Error("Phaser did not enter the battle state. Please reload and rejoin.");
    await dbUpdate("sessions/" + sessionId + "/players/" + studentUid, {
      status: "playing", active: true, startedPlayingAt: Date.now()
    });
  } catch (error) {
    console.error("Student battle startup failed:", error);
    studentLaunchStarted = false;
    delete window.GRAMMAR_DEFENDERS_CONFIG;
    delete window.GRAMMAR_DEFENDERS_SESSION;
    document.body.classList.remove("playing");
    document.body.classList.add("student-session-join");
    gameLayout?.classList.add("hidden");
    studentJoinScreen?.classList.remove("hidden");
    document.getElementById("student-waiting")?.classList.remove("hidden");
    const waiting = document.getElementById("student-waiting");
    if (waiting) waiting.innerHTML = "<b>Game could not start</b><p>" + String(error?.message || "Please reload and rejoin.") + "</p>";
    const joinStatus = document.getElementById("student-join-status");
    if (joinStatus) joinStatus.textContent = "If this continues, tell your teacher to reload the session.";
    return;
  }

  // Register classroom result hooks only after the student has a live scene.
  window.GD_SAVE_ATTEMPT = async attempt => {
    if (!studentUid || resultSaved) return;
    const key = dbPush("sessions/" + sessionId + "/attempts").key;
    pendingAttempts.push({
      key,
      data: { ...attempt, playerId: studentUid, playerName: name, classSection, createdAt: Date.now() }
    });
    persistPendingAttempts();
    await flushPendingAttempts();
  };
  window.GD_SAVE_RESULT = async result => {
    if (!studentUid || resultSaved) return;
    pendingResult = result;
    pendingResultMeta = { result, name, classSection, completedAt: Date.now() };
    try {
      localStorage.setItem(resultStorageKey(), JSON.stringify(pendingResultMeta));
    } catch (error) {
      console.warn("Could not persist the pending result locally:", error);
    }
    await syncPendingResult();
  };
}

document.addEventListener("visibilitychange", () => {
  // Let Phaser/browser manage frame suspension. We only checkpoint on hide;
  // no manual game-loop sleep/wake calls are used during classroom startup.
  if (document.hidden) game.scene.getScene("BattleScene")?.saveCheckpoint?.();
});
window.addEventListener("online", () => {
  flushPendingAttempts().catch(error => console.warn("Question attempts will retry when the connection returns:", error));
  if (pendingResult) syncPendingResult().catch(error => console.warn("Result sync will retry when the connection returns:", error));
});
window.addEventListener("pagehide", () => {
  game.scene.getScene("BattleScene")?.saveCheckpoint?.();
});
window.addEventListener("beforeunload", () => {
  if (stopSessionWatch) stopSessionWatch();
  if (stopPlayerWatch) stopPlayerWatch();
  if (stopBlockedWatch) stopBlockedWatch();
  if (stopConnectionWatch) stopConnectionWatch();
  game.destroy(true);
}, { once: true });
