import { createMovementState } from '../../shared/movement.js';
import { HEALTH, WEAPON_TYPES, WEAPONS, BUILDING } from '../../shared/constants.js';

export const STARTER_LOADOUT = [WEAPON_TYPES.ASSAULT_RIFLE, WEAPON_TYPES.PISTOL];

export function createPlayerSession({ id, socket, name, profileId }) {
  return {
    id,
    socket,
    name: name || `Player${id.slice(0, 4)}`,
    profileId,
    team: null,
    matchId: null,
    movement: createMovementState([0, 5, 0]),
    health: HEALTH.maxHealth,
    shield: 0,
    alive: true,
    respawnAt: 0,
    weapons: buildLoadout(),
    weaponOrder: [...STARTER_LOADOUT],
    currentWeaponIndex: 0,
    lastFireTime: 0,
    reloadingUntil: 0,
    isReloading: false,
    kills: 0,
    deaths: 0,
    assists: 0,
    headshots: 0,
    score: 0,
    resources: BUILDING.startingResources,
    latencyMs: 60,
    posHistory: [],
    lastInputSeq: 0,
    checkpointsReached: new Set(),
    raceFinishTime: null,
    cosmetics: { outfit: 'default_outfit', weaponSkin: 'default_skin', trail: 'default_trail' },
    lastPingSentAt: 0,
    connectedAt: Date.now(),
  };
}

function buildLoadout() {
  const weapons = {};
  for (const id of STARTER_LOADOUT) {
    const def = WEAPONS[id];
    weapons[id] = { ammoInMag: def.magSize, ammoReserve: def.reserveMax };
  }
  return weapons;
}

export function currentWeaponId(session) {
  return session.weaponOrder[session.currentWeaponIndex];
}

export function resetForRespawn(session, spawnPos) {
  session.movement = createMovementState(spawnPos);
  session.health = HEALTH.maxHealth;
  session.shield = 0;
  session.alive = true;
  session.isReloading = false;
  for (const id of session.weaponOrder) {
    const def = WEAPONS[id];
    session.weapons[id] = { ammoInMag: def.magSize, ammoReserve: def.reserveMax };
  }
}
