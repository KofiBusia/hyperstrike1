import { MODE_CONFIG, GAME_MODES, HEALTH } from '../../../shared/constants.js';
import { MAP_SPAWNS } from '../../../shared/mapData.js';
import { furthestSpawnFrom } from './common.js';

const cfg = MODE_CONFIG[GAME_MODES.TEAM_DEATHMATCH];

export default {
  id: GAME_MODES.TEAM_DEATHMATCH,
  config: cfg,

  init(match) {
    match.teamScores = { A: 0, B: 0 };
  },

  onPlayerJoin(match, session) {
    const aCount = [...match.players.values()].filter((p) => p.team === 'A').length;
    const bCount = [...match.players.values()].filter((p) => p.team === 'B').length;
    session.team = aCount <= bCount ? 'A' : 'B';
  },

  getSpawnPoint(match, session) {
    const pool = session.team === 'A' ? MAP_SPAWNS.teamA : MAP_SPAWNS.teamB;
    return furthestSpawnFrom(pool, match);
  },

  onKill(match, killer, victim) {
    if (killer && killer.team && killer.team !== victim.team) {
      match.teamScores[killer.team] += 1;
    }
    victim.respawnAt = Date.now() + HEALTH.respawnTime * 1000;
  },

  update(match) {
    // Respawns handled centrally by Match; nothing extra per-tick for TDM.
  },

  isMatchOver(match) {
    const timeUp = Date.now() >= match.endTime;
    const scoreHit = match.teamScores.A >= cfg.scoreLimit || match.teamScores.B >= cfg.scoreLimit;
    return timeUp || scoreHit;
  },

  getResults(match) {
    const winner = match.teamScores.A === match.teamScores.B ? null : match.teamScores.A > match.teamScores.B ? 'A' : 'B';
    return {
      winnerTeam: winner,
      teamScores: match.teamScores,
      players: [...match.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        kills: p.kills,
        deaths: p.deaths,
        won: winner !== null && p.team === winner,
      })),
    };
  },
};
