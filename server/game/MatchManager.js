import { Match } from './Match.js';
import { GAME_MODES } from '../../shared/constants.js';

// One persistent, always-running match per game mode. Players join the mode's
// shared match rather than spinning up isolated instances - simplest possible
// matchmaking that still supports several concurrent modes.
export class MatchManager {
  constructor(io) {
    this.io = io;
    this.matches = new Map();
    for (const modeId of Object.values(GAME_MODES)) {
      this.matches.set(modeId, new Match(modeId, modeId, io));
    }
  }

  getMatch(modeId) {
    return this.matches.get(modeId);
  }

  joinMode(session, modeId) {
    if (session.matchId) {
      const prev = this.matches.get(session.matchId);
      if (prev) prev.removePlayer(session.id);
      session.socket.leave(session.matchId);
    }
    const match = this.matches.get(modeId);
    match.addPlayer(session);
    session.socket.join(modeId);
    return match;
  }

  removePlayerEverywhere(sessionId) {
    for (const match of this.matches.values()) match.removePlayer(sessionId);
  }

  tickAll() {
    for (const match of this.matches.values()) {
      match.tick();
    }
  }

  broadcastSnapshots() {
    for (const match of this.matches.values()) {
      if (match.players.size === 0) continue;
      this.io.to(match.id).emit('snapshot', match.serializeSnapshot());
      match.clearTransientEvents();
    }
  }
}
