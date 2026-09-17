import { TICK_DT, MODE_CONFIG, HEALTH, WEAPONS, BUILDING } from '../../shared/constants.js';
import { buildMapBlocks } from '../../shared/mapData.js';
import { simulateMovementTick } from '../../shared/movement.js';
import { getModeController } from './modes/index.js';
import { resolveFire, applyDamage, canFire, startReload, finishReload } from './CombatSystem.js';
import { tryPlaceBuild, damageBuildPiece } from './BuildingSystem.js';
import { pieceToBlock } from '../../shared/buildPieces.js';
import { resetForRespawn, currentWeaponId, STARTER_LOADOUT } from '../state/PlayerSession.js';
import { grantKillReward, grantMatchEndReward } from '../persistence/progression.js';
import { createPickupState, updatePickups } from './PickupSystem.js';

const WORLD_BLOCKS = buildMapBlocks();
const HISTORY_LENGTH = 20; // ~0.66s of lag-compensation history at 30Hz

export class Match {
  constructor(id, modeId, io) {
    this.id = id;
    this.io = io;
    this.mode = getModeController(modeId);
    this.players = new Map();
    this.buildPieces = new Map();
    this.startTime = Date.now();
    this.endTime = this.startTime + this.mode.config.timeLimit * 1000;
    this.history = [];
    this.ended = false;
    this.pickups = createPickupState();
    this.mode.init(this);
  }

  get blocks() {
    if (this.buildPieces.size === 0) return WORLD_BLOCKS;
    return WORLD_BLOCKS.concat([...this.buildPieces.values()].map(pieceToBlock));
  }

  addPlayer(session) {
    this.mode.onPlayerJoin(this, session);
    session.matchId = this.id;
    const spawn = this.mode.getSpawnPoint(this, session);
    resetForRespawn(session, spawn);
    this.players.set(session.id, session);
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  handleInput(session, input) {
    session.pendingInput = input;
  }

  handleFire(session, weaponId, rawYaw, rawPitch, ads) {
    if (!session.alive || this.mode.noCombat) return;
    if (currentWeaponId(session) !== weaponId) return;
    const now = Date.now();
    if (!canFire(session, weaponId, now)) return;

    const pitch = Math.max(-1.53, Math.min(1.53, rawPitch));
    const dir = [Math.sin(rawYaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(rawYaw) * Math.cos(pitch)];

    session.lastFireTime = now;
    session.weapons[weaponId].ammoInMag -= 1;

    const rewindTargets = this.getLagCompensatedTargets(session);
    const { results } = resolveFire(session, weaponId, dir, this.blocks, rewindTargets, Math.random, !!ads);

    const events = [];
    for (const r of results) {
      if (r.hitBuildPieceId) {
        const piece = this.buildPieces.get(r.hitBuildPieceId);
        if (piece && damageBuildPiece(piece, r.damage)) {
          this.buildPieces.delete(r.hitBuildPieceId);
          events.push({ type: 'buildDestroyed', pieceId: r.hitBuildPieceId, point: r.point });
        }
        continue;
      }
      const victim = this.players.get(r.hitPlayerId);
      if (!victim || !victim.alive) continue;
      const { died } = applyDamage(victim, r.damage);
      events.push({ type: 'hit', targetId: victim.id, damage: r.damage, headshot: r.headshot, shooterId: session.id, point: r.point });
      if (died) this.handleDeath(victim, session, r.headshot);
    }

    this.io.to(this.id).emit('fireEvent', { shooterId: session.id, weaponId, origin: [session.movement.pos[0], session.movement.pos[1] + 1.5, session.movement.pos[2]], dir, events });
  }

  handleReload(session, weaponId) {
    if (currentWeaponId(session) !== weaponId) return;
    startReload(session, weaponId, Date.now());
  }

  handleSwitchWeapon(session, index) {
    if (index >= 0 && index < session.weaponOrder.length) {
      session.currentWeaponIndex = index;
      session.isReloading = false;
    }
  }

  handleBuild(session, pieceType, yaw, pitch) {
    if (this.mode.noCombat) return null;
    const p = Math.max(-1.53, Math.min(1.53, pitch));
    const dir = [Math.sin(yaw) * Math.cos(p), Math.sin(p), Math.cos(yaw) * Math.cos(p)];
    const res = tryPlaceBuild(session, pieceType, dir, WORLD_BLOCKS, [...this.buildPieces.values()]);
    if (res.ok) this.buildPieces.set(res.piece.id, res.piece);
    return res;
  }

  handleDeath(victim, killer, headshot) {
    victim.deaths += 1;
    if (killer && killer.id !== victim.id) {
      killer.kills += 1;
      killer.score += 100;
      if (headshot) killer.headshots += 1;
      if (killer.profileId) {
        grantKillReward(killer.profileId, { headshot })
          .then((r) => killer.socket.emit('progress', { profile: r.profile, xpGain: r.xpGain, coinGain: r.coinGain, leveledUp: r.leveledUp, reason: 'kill' }))
          .catch(() => {});
      }
    }
    this.mode.onKill(this, killer, victim);
    this.io.to(this.id).emit('playerDied', { victimId: victim.id, killerId: killer?.id ?? null, headshot });
  }

  getLagCompensatedTargets(shooter) {
    const rewindMs = Math.min(200, (shooter.latencyMs || 0) / 2 + 50);
    const targetTime = Date.now() - rewindMs;
    let snapshot = this.history[0];
    for (const h of this.history) {
      if (h.time <= targetTime) snapshot = h;
      else break;
    }
    const others = [...this.players.values()].filter((p) => p.id !== shooter.id && p.alive);
    if (!snapshot) return others;
    return others.map((p) => {
      const rewound = snapshot.positions[p.id];
      if (!rewound) return p;
      return { ...p, movement: { ...p.movement, pos: rewound, crouching: p.movement.crouching } };
    });
  }

  tick() {
    const now = Date.now();
    for (const session of this.players.values()) {
      if (!session.alive) continue;
      const input = session.pendingInput || { moveX: 0, moveZ: 0, yaw: session.movement.yaw, jumpPressed: false, jumpHeld: false, sprint: false, crouch: false, slidePressed: false };
      input.dt = TICK_DT; // never trust client-reported delta time
      const events = simulateMovementTick(session.movement, input, this.blocks);
      for (const ev of events) {
        if (ev.type === 'fallDamage' && ev.amount > 0) {
          const { died } = applyDamage(session, ev.amount);
          if (died) this.handleDeath(session, null, false);
        }
      }
      if (session.isReloading && now >= session.reloadingUntil) {
        finishReload(session, currentWeaponId(session));
      }
    }

    // Respawns (non-BR / non-race modes only).
    if (this.mode.config.respawns) {
      for (const session of this.players.values()) {
        if (!session.alive && session.respawnAt && now >= session.respawnAt) {
          const spawn = this.mode.getSpawnPoint(this, session);
          resetForRespawn(session, spawn);
        }
      }
    }

    this.mode.update(this, TICK_DT);
    updatePickups(this);
    this.recordHistory(now);

    if (!this.ended && this.mode.isMatchOver(this)) {
      this.endMatch();
    }
  }

  recordHistory(now) {
    const positions = {};
    for (const p of this.players.values()) positions[p.id] = [...p.movement.pos];
    this.history.push({ time: now, positions });
    if (this.history.length > HISTORY_LENGTH) this.history.shift();
  }

  endMatch() {
    this.ended = true;
    const results = this.mode.getResults(this);
    this.io.to(this.id).emit('matchEnded', results);
    for (const p of this.players.values()) {
      if (p.profileId) {
        const won = results.winnerId === p.id || (results.winnerTeam && results.winnerTeam === p.team);
        grantMatchEndReward(p.profileId, { won })
          .then((r) => p.socket.emit('progress', { profile: r.profile, xpGain: r.xpGain, coinGain: r.coinGain, leveledUp: r.leveledUp, reason: 'matchEnd' }))
          .catch(() => {});
      }
    }
    setTimeout(() => this.restart(), 12000);
  }

  restart() {
    this.ended = false;
    this.buildPieces.clear();
    this.startTime = Date.now();
    this.endTime = this.startTime + this.mode.config.timeLimit * 1000;
    this.history = [];
    this.pickups = createPickupState();
    this.mode.init(this);
    for (const session of this.players.values()) {
      this.mode.onPlayerJoin(this, session);
      session.kills = 0;
      session.deaths = 0;
      session.headshots = 0;
      session.score = 0;
      session.resources = BUILDING.startingResources;
      session.weaponOrder = [...STARTER_LOADOUT];
      session.currentWeaponIndex = 0;
      const spawn = this.mode.getSpawnPoint(this, session);
      resetForRespawn(session, spawn);
    }
  }

  serializeSnapshot() {
    return {
      matchId: this.id,
      modeId: this.mode.id,
      timeRemaining: Math.max(0, this.endTime - Date.now()),
      ended: this.ended,
      teamScores: this.teamScores || null,
      storm: this.storm ? { radius: this.storm.radius, center: this.storm.center } : null,
      pickups: this.pickups.filter((p) => p.active).map((p) => ({ id: p.id, pos: p.pos, type: p.type, weaponId: p.weaponId })),
      buildPieces: [...this.buildPieces.values()].map((p) => ({ id: p.id, type: p.type, pos: p.pos, size: p.size, rotationY: p.rotationY, health: p.health, maxHealth: p.maxHealth, ownerId: p.ownerId })),
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        pos: p.movement.pos,
        yaw: p.movement.yaw,
        grounded: p.movement.grounded,
        crouching: p.movement.crouching,
        sliding: p.movement.sliding,
        wallRunning: p.movement.wallRunning,
        climbing: p.movement.climbing,
        vaulting: p.movement.vaulting,
        health: p.health,
        shield: p.shield,
        alive: p.alive,
        weaponId: currentWeaponId(p),
        weaponOrder: p.weaponOrder,
        weaponIndex: p.currentWeaponIndex,
        ammoInMag: p.weapons[currentWeaponId(p)]?.ammoInMag ?? 0,
        ammoReserve: p.weapons[currentWeaponId(p)]?.ammoReserve ?? 0,
        isReloading: p.isReloading,
        kills: p.kills,
        deaths: p.deaths,
        score: p.score,
        resources: p.resources,
        cosmetics: p.cosmetics,
        raceCheckpoint: p.raceCheckpoint,
        raceFinishTime: p.raceFinishTime,
        checkpointEvent: p.checkpointEvent || null,
      })),
    };
  }

  clearTransientEvents() {
    for (const p of this.players.values()) p.checkpointEvent = null;
  }
}
