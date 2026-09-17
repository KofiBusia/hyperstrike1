import { MODE_CONFIG, GAME_MODES, HEALTH } from '../../../shared/constants.js';
import { MAP_SPAWNS } from '../../../shared/mapData.js';
import { furthestSpawnFrom } from './common.js';

const cfg = MODE_CONFIG[GAME_MODES.FREE_FOR_ALL];

export default {
  id: GAME_MODES.FREE_FOR_ALL,
  config: cfg,

  init(match) {},
  onPlayerJoin(match, session) {
    session.team = null;
  },

  getSpawnPoint(match) {
    return furthestSpawnFrom(MAP_SPAWNS.ffa, match);
  },

  onKill(match, killer, victim) {
    victim.respawnAt = Date.now() + HEALTH.respawnTime * 1000;
  },

  update(match) {},

  isMatchOver(match) {
    const timeUp = Date.now() >= match.endTime;
    const leader = [...match.players.values()].sort((a, b) => b.kills - a.kills)[0];
    return timeUp || (leader && leader.kills >= cfg.scoreLimit);
  },

  getResults(match) {
    const ranked = [...match.players.values()].sort((a, b) => b.kills - a.kills);
    return {
      winnerId: ranked[0]?.id ?? null,
      players: ranked.map((p, i) => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths, rank: i + 1, won: i === 0 })),
    };
  },
};
