import { createPlayerSession, currentWeaponId } from '../state/PlayerSession.js';
import { getPlayerProfile, purchaseCosmetic, equipCosmetic } from '../persistence/progression.js';
import { getCosmetic } from '../../shared/cosmetics.js';
import { GAME_MODES } from '../../shared/constants.js';

const sessions = new Map(); // socket.id -> session

function sanitizeInput(raw) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));
  return {
    moveX: clamp(raw.moveX, -1, 1),
    moveZ: clamp(raw.moveZ, -1, 1),
    yaw: Number.isFinite(raw.yaw) ? raw.yaw : 0,
    jumpPressed: !!raw.jumpPressed,
    jumpHeld: !!raw.jumpHeld,
    sprint: !!raw.sprint,
    crouch: !!raw.crouch,
    slidePressed: !!raw.slidePressed,
  };
}

export function registerSocketHandlers(io, matchManager) {
  io.on('connection', (socket) => {
    const session = createPlayerSession({ id: socket.id, socket, name: null, profileId: null });
    sessions.set(socket.id, session);

    socket.on('hello', async ({ profileId, name }) => {
      session.profileId = typeof profileId === 'string' && profileId.length <= 64 ? profileId : socket.id;
      if (typeof name === 'string' && name.trim().length > 0) session.name = name.trim().slice(0, 16);
      try {
        const profile = await getPlayerProfile(session.profileId);
        session.cosmetics = { ...profile.equipped };
        socket.emit('profile', profile);
      } catch (err) {
        console.error('[hello] profile load failed', err);
      }
    });

    socket.on('joinMode', ({ modeId }) => {
      if (!Object.values(GAME_MODES).includes(modeId)) return;
      const match = matchManager.joinMode(session, modeId);
      socket.emit('joined', { matchId: match.id, modeId, selfId: session.id });
    });

    socket.on('input', (raw) => {
      const match = matchManager.getMatch(session.matchId);
      if (!match) return;
      match.handleInput(session, sanitizeInput(raw || {}));
    });

    socket.on('fire', ({ weaponId, yaw, pitch, ads }) => {
      const match = matchManager.getMatch(session.matchId);
      if (!match || typeof weaponId !== 'string') return;
      match.handleFire(session, weaponId, Number(yaw) || 0, Number(pitch) || 0, !!ads);
    });

    socket.on('reload', ({ weaponId }) => {
      const match = matchManager.getMatch(session.matchId);
      if (!match) return;
      match.handleReload(session, weaponId);
    });

    socket.on('switchWeapon', ({ index }) => {
      const match = matchManager.getMatch(session.matchId);
      if (!match) return;
      match.handleSwitchWeapon(session, Number(index));
    });

    socket.on('build', ({ pieceType, yaw, pitch }) => {
      const match = matchManager.getMatch(session.matchId);
      if (!match) return;
      const res = match.handleBuild(session, pieceType, Number(yaw) || 0, Number(pitch) || 0);
      if (res) socket.emit('buildResult', res);
    });

    socket.on('emote', ({ emoteId }) => {
      const match = matchManager.getMatch(session.matchId);
      if (!match) return;
      io.to(match.id).emit('emotePlayed', { playerId: session.id, emoteId });
    });

    socket.on('latencyPing', (clientTime) => {
      socket.emit('latencyPong', clientTime);
    });
    socket.on('latencyReport', (rttMs) => {
      if (Number.isFinite(rttMs)) session.latencyMs = Math.max(0, Math.min(500, rttMs));
    });

    socket.on('purchaseCosmetic', async ({ cosmeticId }) => {
      const cosmetic = getCosmetic(cosmeticId);
      if (!cosmetic || !session.profileId) return;
      try {
        const profile = await purchaseCosmetic(session.profileId, cosmetic);
        socket.emit('profile', profile);
      } catch (err) {
        socket.emit('purchaseError', { message: err.message });
      }
    });

    socket.on('equipCosmetic', async ({ cosmeticId }) => {
      const cosmetic = getCosmetic(cosmeticId);
      if (!cosmetic || !session.profileId) return;
      try {
        const profile = await equipCosmetic(session.profileId, cosmetic);
        session.cosmetics = { ...profile.equipped };
        socket.emit('profile', profile);
      } catch (err) {
        socket.emit('purchaseError', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      matchManager.removePlayerEverywhere(socket.id);
      sessions.delete(socket.id);
    });
  });
}
