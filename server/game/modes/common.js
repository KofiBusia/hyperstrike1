export function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function furthestSpawnFrom(spawns, match) {
  let best = spawns[0];
  let bestScore = -Infinity;
  for (const s of spawns) {
    let minDist = Infinity;
    for (const p of match.players.values()) {
      if (!p.alive) continue;
      const d = Math.hypot(p.movement.pos[0] - s[0], p.movement.pos[2] - s[2]);
      if (d < minDist) minDist = d;
    }
    if (minDist > bestScore) {
      bestScore = minDist;
      best = s;
    }
  }
  return best;
}
