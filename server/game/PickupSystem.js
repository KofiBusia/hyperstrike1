import { PICKUP_POINTS, PICKUP_RADIUS, PICKUP_RESPAWN_MS } from '../../shared/pickups.js';
import { WEAPONS, BUILDING, HEALTH } from '../../shared/constants.js';

export function createPickupState() {
  return PICKUP_POINTS.map((p) => ({ ...p, active: true, respawnAt: 0 }));
}

export function updatePickups(match) {
  const now = Date.now();
  for (const pickup of match.pickups) {
    if (!pickup.active && now >= pickup.respawnAt) pickup.active = true;
    if (!pickup.active) continue;

    for (const session of match.players.values()) {
      if (!session.alive) continue;
      const d = Math.hypot(
        session.movement.pos[0] - pickup.pos[0],
        session.movement.pos[1] + 0.9 - pickup.pos[1],
        session.movement.pos[2] - pickup.pos[2]
      );
      if (d > PICKUP_RADIUS) continue;

      let collected = true;
      if (pickup.type === 'weapon') {
        if (!session.weapons[pickup.weaponId]) {
          const def = WEAPONS[pickup.weaponId];
          session.weapons[pickup.weaponId] = { ammoInMag: def.magSize, ammoReserve: def.reserveMax };
          const freeSlot = session.weaponOrder.length < 3 ? session.weaponOrder.length : session.currentWeaponIndex;
          if (session.weaponOrder.length < 3) session.weaponOrder.push(pickup.weaponId);
          else session.weaponOrder[freeSlot] = pickup.weaponId;
        } else {
          const def = WEAPONS[pickup.weaponId];
          session.weapons[pickup.weaponId].ammoReserve = Math.min(def.reserveMax, session.weapons[pickup.weaponId].ammoReserve + Math.round(def.magSize * 1.5));
        }
      } else if (pickup.type === 'ammo') {
        for (const wid of session.weaponOrder) {
          const def = WEAPONS[wid];
          session.weapons[wid].ammoReserve = Math.min(def.reserveMax, session.weapons[wid].ammoReserve + Math.round(def.magSize));
        }
      } else if (pickup.type === 'resource') {
        session.resources = Math.min(BUILDING.maxResources, session.resources + BUILDING.resourcePerScrapPickup);
      } else if (pickup.type === 'shield') {
        if (session.shield >= HEALTH.maxShield) {
          collected = false;
        } else {
          session.shield = Math.min(HEALTH.maxShield, session.shield + 50);
        }
      }

      if (collected) {
        pickup.active = false;
        pickup.respawnAt = now + PICKUP_RESPAWN_MS;
        match.io.to(match.id).emit('pickupCollected', { pickupId: pickup.id, byId: session.id });
      }
      break;
    }
  }
}
