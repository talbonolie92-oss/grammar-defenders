export const SESSION_SEAT_IDS = Array.from({ length: 30 }, (_, index) => String(index + 1).padStart(2, "0"));

export function getSeatReservationPlan(seats, uid) {
  const occupied = seats && typeof seats === "object" ? seats : {};
  const existing = SESSION_SEAT_IDS.find(id => occupied[id]?.uid === uid);
  if (existing) return { existingSeatId: existing, availableSeatIds: [] };
  return {
    existingSeatId: null,
    availableSeatIds: SESSION_SEAT_IDS.filter(id => !occupied[id])
  };
}
