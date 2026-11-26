import assert from "node:assert/strict";
import { createSeatReservation, MAX_SESSION_PLAYERS } from "./capacity.js";

const makePlayer = n => ({ name: "Student " + n, classSection: "11A", status: "waiting" });
const initial = Object.fromEntries(Array.from({ length: 29 }, (_, i) => ["uid-" + i, makePlayer(i)]));
const thirtieth = createSeatReservation(initial, "uid-29", makePlayer(29));
assert.equal(thirtieth.committed, true);
assert.equal(thirtieth.created, true);
assert.equal(Object.keys(thirtieth.players).length, MAX_SESSION_PLAYERS);

const thirtyFirst = createSeatReservation(thirtieth.players, "uid-30", makePlayer(30));
assert.equal(thirtyFirst.committed, false);
assert.equal(thirtyFirst.created, false);
assert.equal(Object.keys(thirtyFirst.players).length, MAX_SESSION_PLAYERS);

const returning = createSeatReservation(thirtieth.players, "uid-4", { name: "Changed", classSection: "12B" });
assert.equal(returning.committed, true);
assert.equal(returning.created, false);
assert.equal(returning.players["uid-4"].name, "Student 4");

const empty = createSeatReservation(null, "first", makePlayer(1));
assert.equal(empty.committed, true);
assert.equal(Object.keys(empty.players).length, 1);

console.log("Capacity helper tests passed: 30-seat boundary, full-session rejection, returning-student idempotency.");
