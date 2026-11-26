export const MAX_SESSION_PLAYERS = 30;

export function createSeatReservation(currentPlayers, uid, player, maxPlayers = MAX_SESSION_PLAYERS) {
  const players = currentPlayers && typeof currentPlayers === "object" ? currentPlayers : {};
  if (Object.prototype.hasOwnProperty.call(players, uid)) {
    return { committed: true, created: false, players };
  }
  const count = Object.keys(players).length;
  if (count >= maxPlayers) return { committed: false, created: false, players };
  return {
    committed: true,
    created: true,
    players: { ...players, [uid]: player }
  };
}
