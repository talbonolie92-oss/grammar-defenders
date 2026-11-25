import { createGameScene } from "./scenes/BattleScene.js";
import { firebaseReady, studentSignIn, dbGet, dbSet, dbUpdate, dbWatch, dbPush } from "./firebase.js";

const params = new URLSearchParams(window.location.search);
const setupScreen = document.getElementById("setup-screen");
const gameLayout = document.getElementById("game-layout");
const studentJoinScreen = document.getElementById("student-join-screen");
const sessionId = params.get("session");
const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 960,
  height: 340,
  backgroundColor: "#173b43",
  resolution: pixelRatio,
  render: { antialias: true, pixelArt: false, roundPixels: true, powerPreference: "high-performance", transparent: false },
  fps: { target: 60, min: 30, forceSetTimeOut: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [createGameScene()]
};
const game = new Phaser.Game(config);
let studentSession = null;
let studentUid = null;
let stopSessionWatch = null;
let resultSaved = false;

if (sessionId) {
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
    const battleScene = game.scene.getScene("BattleScene");
    battleScene?.enableMusic?.();
    const settings = {
      mode: document.getElementById("setup-mode")?.value || "endless",
      timeLimitMinutes: Number(document.getElementById("setup-time")?.value || 10),
      questionIntervalSeconds: Number(document.getElementById("setup-interval")?.value || 45),
      difficulty: document.getElementById("setup-difficulty")?.value || "normal"
    };
    window.GRAMMAR_DEFENDERS_CONFIG = settings;
    try { if (screen.orientation?.lock) await screen.orientation.lock("landscape"); } catch (_) {}
    try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch (_) {}
    setupScreen?.classList.add("hidden");
    gameLayout?.classList.remove("hidden");
    requestAnimationFrame(() => game.scale.refresh());
    if (battleScene?.sys?.isActive()) battleScene.startBattle(settings);
    else battleScene.events.once("create", () => battleScene.startBattle(settings));
  });

  const makeStudentLink = async () => {
    const link = new URL(window.location.href);
    link.search = "";
    link.searchParams.set("student", "1");
    link.searchParams.set("mode", document.getElementById("setup-mode")?.value || "endless");
    link.searchParams.set("minutes", document.getElementById("setup-time")?.value || "10");
    link.searchParams.set("interval", document.getElementById("setup-interval")?.value || "45");
    link.searchParams.set("difficulty", document.getElementById("setup-difficulty")?.value || "normal");
    const field = document.getElementById("student-link");
    const status = document.getElementById("setup-status");
    const qrWrap = document.getElementById("student-qr-wrap");
    const qr = document.getElementById("student-qr");
    if (qr && window.QRCode) {
      qr.innerHTML = "";
      new window.QRCode(qr, { text: link.toString(), width: 190, height: 190, colorDark: "#10243c", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.M });
      qrWrap?.classList.remove("hidden");
    }
    if (field) { field.value = link.toString(); field.classList.remove("hidden"); field.select(); }
    try { await navigator.clipboard.writeText(link.toString()); if (status) status.textContent = "Student link copied and QR code generated."; }
    catch (_) { if (status) status.textContent = "Student link is ready below. Select and copy it to share."; }
  };
  document.getElementById("copy-student-link")?.addEventListener("click", makeStudentLink);
  document.getElementById("generate-student-qr")?.addEventListener("click", makeStudentLink);
}
startSoloSetup();

async function initializeStudentJoin() {
  const form = document.getElementById("student-join-form");
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    const name = document.getElementById("student-name").value.trim();
    const classSection = document.getElementById("student-class").value.trim();
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
      await dbSet("sessions/" + sessionId + "/players/" + studentUid, {
        name, classSection, joinedAt: Date.now(), status: "waiting", active: true
      });
      document.getElementById("student-session-name").textContent = studentSession.title || "Your teacher's Grammar Defenders session";
      form.classList.add("hidden");
      document.getElementById("student-waiting").classList.remove("hidden");
      status.textContent = "";
      stopSessionWatch = dbWatch("sessions/" + sessionId + "/public", snap => {
        if (!snap.exists()) { status.textContent = "Your teacher removed this session."; return; }
        studentSession = snap.val();
        if (studentSession.status === "ended") {
          document.getElementById("student-waiting").innerHTML = "<b>Session ended</b><p>Your teacher has ended this game.</p>";
        } else if (studentSession.status === "running") {
          launchStudentGame(name, classSection);
        }
      }, err => { status.textContent = err.message; });
      if (studentSession.status === "running") launchStudentGame(name, classSection);
    } catch (error) { status.textContent = error.message || "Unable to join this session."; }
  });
}

async function launchStudentGame(name, classSection) {
  if (window.GRAMMAR_DEFENDERS_CONFIG?.studentLaunch) return;
  const settings = {
    mode: studentSession.mode || "endless",
    timeLimitMinutes: Number(studentSession.timeLimitMinutes) || 10,
    questionIntervalSeconds: Number(studentSession.questionIntervalSeconds) || 45,
    difficulty: studentSession.difficulty || "normal",
    studentLaunch: true,
    sessionId, playerId: studentUid, playerName: name, classSection
  };
  window.GRAMMAR_DEFENDERS_CONFIG = settings;
  await dbUpdate("sessions/" + sessionId + "/players/" + studentUid, { status: "playing", active: true, startedPlayingAt: Date.now() });
  window.GRAMMAR_DEFENDERS_SESSION = { sessionId, playerId: studentUid, playerName: name, classSection };
  document.getElementById("student-join-screen")?.classList.add("hidden");
  gameLayout?.classList.remove("hidden");
  try { if (screen.orientation?.lock) await screen.orientation.lock("landscape"); } catch (_) {}
  try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch (_) {}
  requestAnimationFrame(() => {
    game.scale.refresh();
    const scene = game.scene.getScene("BattleScene");
    if (scene?.sys?.isActive()) scene.startBattle(settings);
  });
  window.GD_SAVE_ATTEMPT = async attempt => {
    if (!studentUid || resultSaved) return;
    const key = dbPush("sessions/" + sessionId + "/attempts").key;
    await dbSet("sessions/" + sessionId + "/attempts/" + key, { ...attempt, playerId: studentUid, playerName: name, classSection, createdAt: Date.now() });
  };
  window.GD_SAVE_RESULT = async result => {
    if (!studentUid || resultSaved) return;
    resultSaved = true;
    await dbSet("sessions/" + sessionId + "/results/" + studentUid, { ...result, name, classSection, completedAt: Date.now() });
    await dbUpdate("sessions/" + sessionId + "/players/" + studentUid, { status: "finished", finishedAt: Date.now(), active: false });
  };
}

document.addEventListener("visibilitychange", () => {
  if (!game || !game.scene) return;
  if (document.hidden) game.loop.sleep(); else game.loop.wake();
});
window.addEventListener("beforeunload", () => { if (stopSessionWatch) stopSessionWatch(); game.destroy(true); }, { once: true });
