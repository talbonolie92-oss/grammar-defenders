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
console.log("Free classroom seat tests passed: 30-seat boundary, full-session rejection, returning-student recognition.");
