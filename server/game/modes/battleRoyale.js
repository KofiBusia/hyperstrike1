import { MODE_CONFIG, GAME_MODES } from '../../../shared/constants.js';
import { MAP_SPAWNS } from '../../../shared/mapData.js';
import { randomFrom } from './common.js';

const cfg = MODE_CONFIG[GAME_MODES.BATTLE_ROYALE];
const STORM_RADII = [190, 150, 110, 75, 50, 30, 16, 6, 0];

export default {
  id: GAME_MODES.BATTLE_ROYALE,
  config: cfg,

  init(match) {
    match.storm = {
      center: [0, 0],
      radius: STORM_RADII[0],
      phase: -1,
      phaseEndsAt: match.startTime + 20000, // initial calm period
      shrinking: false,
    };
    match.eliminationOrder = [];
  },

  onPlayerJoin(match, session) {
    session.team = null;
  },

  getSpawnPoint() {
    return randomFrom(MAP_SPAWNS.battleRoyale);
  },

  onKill(match, killer, victim) {
    victim.alive = false;
    match.eliminationOrder.push(victim.id);
  },

  update(match, dt) {
    const storm = match.storm;
    const now = Date.now();
    if (now >= storm.phaseEndsAt) {
      storm.phase += 1;
      if (storm.phase < STORM_RADII.length - 1) {
        const shrinkSeconds = cfg.stormShrinkIntervals[storm.phase] ?? 30;
        storm.shrinking = true;
        storm.shrinkFrom = STORM_RADII[storm.phase];
        storm.shrinkTo = STORM_RADII[storm.phase + 1];
        storm.shrinkStart = now;
        storm.shrinkDuration = shrinkSeconds * 1000;
        storm.phaseEndsAt = now + shrinkSeconds * 1000 + 15000; // shrink then hold
      }
    }
    if (storm.shrinking) {
      const t = Math.min(1, (now - storm.shrinkStart) / storm.shrinkDuration);
      storm.radius = storm.shrinkFrom + (storm.shrinkTo - storm.shrinkFrom) * t;
      if (t >= 1) storm.shrinking = false;
    }

    for (const p of match.players.values()) {
      if (!p.alive) continue;
      const dist = Math.hypot(p.movement.pos[0] - storm.center[0], p.movement.pos[2] - storm.center[1]);
      if (dist > storm.radius) {
        p.stormDamageAccum = (p.stormDamageAccum || 0) + (2 + storm.phase * 0.8) * dt;
        if (p.stormDamageAccum >= 1) {
          const dmg = Math.floor(p.stormDamageAccum);
          p.stormDamageAccum -= dmg;
          p.health -= dmg;
          if (p.health <= 0) {
            p.health = 0;
            p.alive = false;
            match.eliminationOrder.push(p.id);
          }
        }
      }
    }
  },

  isMatchOver(match) {
    const aliveCount = [...match.players.values()].filter((p) => p.alive).length;
    // A lone early joiner isn't a "last one standing" winner - only end via
    // elimination once at least two players have actually contested the match,
    // or once everyone (including a solo player) is dead.
    const eliminationEnd = aliveCount === 0 || (match.players.size >= 2 && aliveCount <= 1);
    return eliminationEnd || Date.now() >= match.endTime;
  },

  getResults(match) {
    const alive = [...match.players.values()].filter((p) => p.alive);
    const winner = alive[0] ?? null;
    const eliminationRank = [...match.eliminationOrder].reverse();
    const ranked = [];
    if (winner) ranked.push({ id: winner.id, name: winner.name, rank: 1, won: true });
    eliminationRank.forEach((id, i) => {
      const p = match.players.get(id);
      if (p) ranked.push({ id, name: p.name, rank: ranked.length + 1, won: false, kills: p.kills });
    });
    return { winnerId: winner?.id ?? null, players: ranked };
  },
};
