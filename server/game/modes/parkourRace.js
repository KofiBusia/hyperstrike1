import { MODE_CONFIG, GAME_MODES } from '../../../shared/constants.js';
import { MAP_SPAWNS, RACE_CHECKPOINT_COUNT, buildMapBlocks } from '../../../shared/mapData.js';
import { grantCheckpointReward } from '../../persistence/progression.js';

const cfg = MODE_CONFIG[GAME_MODES.PARKOUR_RACE];
const CHECKPOINT_RADIUS = 2.6;

let checkpointBlocks = null;
function getCheckpointBlocks() {
  if (!checkpointBlocks) {
    checkpointBlocks = buildMapBlocks()
      .filter((b) => typeof b.checkpoint === 'number')
      .sort((a, b) => a.checkpoint - b.checkpoint);
  }
  return checkpointBlocks;
}

export default {
  id: GAME_MODES.PARKOUR_RACE,
  config: cfg,
  noCombat: true,

  init(match) {
    match.raceStart = Date.now();
    match.finishers = [];
  },

  onPlayerJoin(match, session) {
    session.team = null;
    session.raceCheckpoint = 0;
    session.raceFinishTime = null;
  },

  getSpawnPoint() {
    return MAP_SPAWNS.parkourRaceStart;
  },

  onKill() {
    // No combat in this mode.
  },

  update(match) {
    const cps = getCheckpointBlocks();
    for (const p of match.players.values()) {
      if (p.raceFinishTime !== null || p.raceCheckpoint === undefined) continue;
      const target = cps[p.raceCheckpoint];
      if (!target) continue;
      const d = Math.hypot(p.movement.pos[0] - target.pos[0], p.movement.pos[1] - target.pos[1], p.movement.pos[2] - target.pos[2]);
      if (d <= CHECKPOINT_RADIUS) {
        p.raceCheckpoint += 1;
        p.checkpointEvent = { index: target.checkpoint, total: RACE_CHECKPOINT_COUNT };
        if (p.profileId) {
          grantCheckpointReward(p.profileId)
            .then((r) => p.socket.emit('progress', { profile: r.profile, xpGain: r.xpGain, coinGain: r.coinGain, leveledUp: r.leveledUp, reason: 'checkpoint' }))
            .catch(() => {});
        }
        if (p.raceCheckpoint >= RACE_CHECKPOINT_COUNT) {
          p.raceFinishTime = Date.now() - match.raceStart;
          match.finishers.push(p.id);
        }
      }
    }
  },

  isMatchOver(match) {
    return match.finishers.length >= match.players.size || Date.now() >= match.endTime;
  },

  getResults(match) {
    const finished = match.finishers.map((id, i) => {
      const p = match.players.get(id);
      return { id, name: p?.name, rank: i + 1, won: i === 0, timeMs: p?.raceFinishTime };
    });
    const unfinished = [...match.players.values()]
      .filter((p) => p.raceFinishTime === null)
      .map((p) => ({ id: p.id, name: p.name, rank: finished.length + 1, won: false, checkpoint: p.raceCheckpoint }));
    return { winnerId: finished[0]?.id ?? null, players: [...finished, ...unfinished] };
  },
};
