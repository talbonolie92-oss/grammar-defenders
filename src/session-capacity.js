export const SESSION_SEAT_IDS = Array.from({ length: 30 }, (_, index) => String(index + 1).padStart(2, "0"));

function getPreferredSeatOffset(uid) {
  // Stable per-student distribution avoids every simultaneous joiner contending
  // for seat 01. Firebase UIDs are high-entropy, so their starting seats spread
  // across the 30-seat ledger while retries remain deterministic.
  let hash = 2166136261;
  for (const character of String(uid || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % SESSION_SEAT_IDS.length;
}

export function getSeatReservationPlan(seats, uid) {
  const occupied = seats && typeof seats === "object" ? seats : {};
  const existing = SESSION_SEAT_IDS.find(id => occupied[id]?.uid === uid);
  if (existing) return { existingSeatId: existing, availableSeatIds: [] };
  const offset = getPreferredSeatOffset(uid);
  const availableSeatIds = Array.from({ length: SESSION_SEAT_IDS.length }, (_, index) =>
    SESSION_SEAT_IDS[(offset + index) % SESSION_SEAT_IDS.length]
  ).filter(id => !occupied[id]);
  return { existingSeatId: null, availableSeatIds };
}
