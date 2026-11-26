import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { createSeatReservation, MAX_SESSION_PLAYERS } from "./capacity.js";

initializeApp();

export const reserveSessionSeat = onCall(
  { region: "asia-southeast1", maxInstances: 20 },
  async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in before joining this classroom session.");

    const sessionId = String(request.data?.sessionId || "");
    const name = String(request.data?.name || "").trim().slice(0, 70);
    const classSection = String(request.data?.classSection || "").trim().slice(0, 40);
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(sessionId) || !name || !classSection) {
      throw new HttpsError("invalid-argument", "A valid session, student name, and class/section are required.");
    }

    const uid = request.auth.uid;
    const db = getDatabase();
    const sessionRef = db.ref("sessions/" + sessionId);
    const [publicSnapshot, blockedSnapshot] = await Promise.all([
      sessionRef.child("public").get(),
      sessionRef.child("blockedPlayers/" + uid).get()
    ]);
    if (!publicSnapshot.exists()) throw new HttpsError("not-found", "This classroom session is invalid or has been removed.");
    if (blockedSnapshot.val() === true) throw new HttpsError("permission-denied", "Your teacher removed you from this session.");
    const session = publicSnapshot.val() || {};
    if (session.status === "ended") throw new HttpsError("failed-precondition", "This classroom session has already ended.");

    const playersRef = sessionRef.child("players");
    const transaction = await playersRef.transaction(current => {
      const result = createSeatReservation(current, uid, {
        name,
        classSection,
        joinedAt: Date.now(),
        status: "waiting",
        active: true
      });
      return result.committed ? result.players : undefined;
    }, undefined, false);

    if (!transaction.committed) {
      const latest = transaction.snapshot.val() || {};
      if (Object.prototype.hasOwnProperty.call(latest, uid)) {
        return { ok: true, existing: true, playerCount: Object.keys(latest).length, capacity: MAX_SESSION_PLAYERS };
      }
      throw new HttpsError("resource-exhausted", "This classroom session is full (30 students). Please tell your teacher.");
    }

    const savedPlayers = transaction.snapshot.val() || {};
    return {
      ok: true,
      existing: !Object.prototype.hasOwnProperty.call(savedPlayers, uid) || savedPlayers[uid]?.joinedAt !== undefined,
      playerCount: Object.keys(savedPlayers).length,
      capacity: MAX_SESSION_PLAYERS
    };
  }
);
