import assert from "node:assert/strict";
import { SESSION_SEAT_IDS, getSeatReservationPlan } from "../src/session-capacity.js";

assert.equal(SESSION_SEAT_IDS.length, 30);
assert.equal(SESSION_SEAT_IDS[0], "01");
assert.equal(SESSION_SEAT_IDS[29], "30");

const twentyNine = Object.fromEntries(SESSION_SEAT_IDS.slice(0, 29).map((id, index) => [id, { uid: "student-" + index }]));
const lastSeat = getSeatReservationPlan(twentyNine, "new-student");
assert.equal(lastSeat.availableSeatIds.length, 1);
assert.equal(lastSeat.availableSeatIds[0], "30");

const full = { ...twentyNine, "30": { uid: "student-29" } };
assert.equal(getSeatReservationPlan(full, "student-30").availableSeatIds.length, 0);

const returning = getSeatReservationPlan(full, "student-8");
assert.equal(returning.existingSeatId, "09");
assert.equal(returning.availableSeatIds.length, 0);

assert.equal(getSeatReservationPlan(null, "first").availableSeatIds.length, 30);
const firstPlan = getSeatReservationPlan(null, "student-1").availableSeatIds;
const retryPlan = getSeatReservationPlan(null, "student-1").availableSeatIds;
assert.deepEqual(retryPlan, firstPlan, "Seat ordering must remain stable for retries from the same student.");

// Firebase anonymous UIDs are random-looking strings; use deterministic
// 28-character IDs here so the distribution test is repeatable.
let uidSeed = 0x12345678;
const studentIds = Array.from({ length: 30 }, () => {
  let uid = "";
  for (let index = 0; index < 28; index++) {
    uidSeed = (Math.imul(uidSeed, 1664525) + 1013904223) >>> 0;
    uid += "abcdefghijklmnopqrstuvwxyz0123456789"[uidSeed % 36];
  }
  return uid;
});
const initialChoices = studentIds.map(uid => getSeatReservationPlan(null, uid).availableSeatIds[0]);
const distributedStarts = new Set(initialChoices);
assert.ok(distributedStarts.size >= 18, "Random-looking simultaneous student UIDs should spread initial choices across at least 18 seats.");

// Simulate 30 students reading the same empty ledger before any transaction
// commits. Collisions must cause each loser to re-read and claim another seat.
const concurrentSeats = {};
for (let index = 0; index < studentIds.length; index++) {
  const uid = studentIds[index];
  let plan = { availableSeatIds: [initialChoices[index]] };
  let attempts = 0;
  while (attempts < 30) {
    const candidate = plan.availableSeatIds.find(id => !concurrentSeats[id]);
    if (candidate) {
      concurrentSeats[candidate] = { uid };
      break;
    }
    plan = getSeatReservationPlan(concurrentSeats, uid);
    attempts++;
  }
  assert.ok(SESSION_SEAT_IDS.some(id => concurrentSeats[id]?.uid === uid), uid + " must eventually reserve exactly one seat.");
}
assert.equal(Object.keys(concurrentSeats).length, 30, "Thirty simultaneous students must fill all thirty unique seats.");
assert.equal(new Set(Object.values(concurrentSeats).map(seat => seat.uid)).size, 30, "No two students may reserve the same seat.");
console.log("Free classroom seat tests passed: 30-seat boundary, full-session rejection, returning-student recognition, and 30-student collision simulation.");
