// All damage, hit detection and ammo bookkeeping happens here, server-side only.
// Clients only ever request "I fired" / "I want to reload" - they never tell the
// server who got hit or for how much, which closes the door on the most common
// class of shooter cheats (damage hacks, aimbot-reported kills).
import { WEAPONS, HEALTH, MOVEMENT } from '../../shared/constants.js';
import { raycastBlocks } from '../../shared/collision.js';

const HEAD_FRACTION_FROM_TOP = 0.22;

function eyeHeight(session) {
  return session.movement.crouching ? MOVEMENT.eyeHeightCrouch : MOVEMENT.eyeHeightStand;
}

function capsuleHeight(session) {
  return session.movement.crouching ? MOVEMENT.capsuleHeightCrouch : MOVEMENT.capsuleHeightStand;
}

// Ray vs vertical capsule. Our capsules never tilt, so this reduces to a 2D
// (x,z) circle-sweep against the ray, then a Y range check at the hit t.
function rayVsPlayerCapsule(origin, dir, session) {
  const [px, py, pz] = session.movement.pos;
  const radius = MOVEMENT.capsuleRadius + 0.05;
  const yMin = py;
  const yMax = py + capsuleHeight(session);

  const ax = origin[0] - px;
  const az = origin[2] - pz;
  const a = dir[0] * dir[0] + dir[2] * dir[2];
  const b = 2 * (ax * dir[0] + az * dir[2]);
  const c = ax * ax + az * az - radius * radius;

  let t = null;
  if (a < 1e-6) {
    if (c > 0) return null;
    t = 0;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const sqrtDisc = Math.sqrt(disc);
    const t0 = (-b - sqrtDisc) / (2 * a);
    const t1 = (-b + sqrtDisc) / (2 * a);
    t = t0 >= 0 ? t0 : t1 >= 0 ? t1 : null;
  }
  if (t === null) return null;

  const hitY = origin[1] + dir[1] * t;
  if (hitY < yMin - radius || hitY > yMax + radius) return null;

  const headshot = hitY >= yMax - (yMax - yMin) * HEAD_FRACTION_FROM_TOP;
  return { dist: t, headshot, point: [origin[0] + dir[0] * t, hitY, origin[2] + dir[2] * t] };
}

function applySpread(dir, spread, rng) {
  if (spread <= 0) return dir;
  // Small-angle cone jitter around the aim direction using an orthonormal basis.
  const up = Math.abs(dir[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
  const right = normalize(cross(dir, up));
  const trueUp = cross(right, dir);
  const angle = rng() * Math.PI * 2;
  const radius = rng() * spread;
  const ox = Math.cos(angle) * radius;
  const oy = Math.sin(angle) * radius;
  return normalize([
    dir[0] + right[0] * ox + trueUp[0] * oy,
    dir[1] + right[1] * ox + trueUp[1] * oy,
    dir[2] + right[2] * ox + trueUp[2] * oy,
  ]);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

// Resolves a single trigger-pull. Returns { shots: [{hitPlayerId, damage, headshot, point}], tracerDir }
export function resolveFire(shooter, weaponId, aimDir, blocks, otherAlivePlayers, rng = Math.random, ads = false) {
  const def = WEAPONS[weaponId];
  const eye = [shooter.movement.pos[0], shooter.movement.pos[1] + eyeHeight(shooter), shooter.movement.pos[2]];
  const speed = Math.hypot(shooter.movement.vel[0], shooter.movement.vel[2]);
  const isMoving = speed > 1.5;
  let spread = def.baseSpread * (isMoving ? def.movingSpreadMultiplier : 1);
  if (ads) spread *= def.adsSpreadMultiplier;

  const pellets = def.pellets || 1;
  const results = [];

  for (let i = 0; i < pellets; i++) {
    const dir = applySpread(aimDir, spread, rng);
    const worldHit = raycastBlocks(eye, dir, def.range, blocks, (b) => b.type === 'box' || b.type === 'ramp');
    const maxDist = worldHit ? worldHit.dist : def.range;

    let closestPlayerHit = null;
    for (const target of otherAlivePlayers) {
      const hit = rayVsPlayerCapsule(eye, dir, target);
      if (hit && hit.dist <= maxDist && (!closestPlayerHit || hit.dist < closestPlayerHit.dist)) {
        closestPlayerHit = { ...hit, target };
      }
    }

    if (closestPlayerHit) {
      const falloff = closestPlayerHit.dist > def.falloffStart
        ? 1 - ((closestPlayerHit.dist - def.falloffStart) / (def.range - def.falloffStart)) * (1 - def.falloffMultiplier)
        : 1;
      const dmg = def.damage * Math.max(def.falloffMultiplier, falloff) * (closestPlayerHit.headshot ? def.headshotMultiplier : 1);
      results.push({
        hitPlayerId: closestPlayerHit.target.id,
        damage: dmg,
        headshot: closestPlayerHit.headshot,
        point: closestPlayerHit.point,
      });
    } else if (worldHit && worldHit.block.isBuildPiece) {
      results.push({ hitBuildPieceId: worldHit.block.id, damage: def.damage, point: worldHit.point });
    }
  }

  return { results, origin: eye, dir: aimDir, range: def.range };
}

// Applies damage to a defender session, accounting for shield absorption.
// Returns { died, damageDealt, shieldBefore, healthBefore }
export function applyDamage(defender, rawDamage) {
  const healthBefore = defender.health;
  const shieldBefore = defender.shield;
  let remaining = rawDamage;
  if (defender.shield > 0) {
    const shieldPortion = Math.min(defender.shield, remaining * HEALTH.shieldDamageAbsorb);
    defender.shield -= shieldPortion;
    remaining -= shieldPortion;
  }
  defender.health -= remaining;
  const died = defender.health <= 0;
  if (died) defender.health = 0;
  return { died, damageDealt: healthBefore + shieldBefore - (defender.health + defender.shield), healthBefore, shieldBefore };
}

export function canFire(session, weaponId, now) {
  const def = WEAPONS[weaponId];
  const inv = session.weapons[weaponId];
  if (!inv || inv.ammoInMag <= 0) return false;
  if (session.isReloading) return false;
  const minInterval = 1000 / def.fireRate;
  return now - session.lastFireTime >= minInterval;
}

export function startReload(session, weaponId, now) {
  const def = WEAPONS[weaponId];
  const inv = session.weapons[weaponId];
  if (!inv || session.isReloading) return false;
  if (inv.ammoInMag >= def.magSize || inv.ammoReserve <= 0) return false;
  session.isReloading = true;
  session.reloadingUntil = now + def.reloadTime * 1000;
  return true;
}

export function finishReload(session, weaponId) {
  const def = WEAPONS[weaponId];
  const inv = session.weapons[weaponId];
  if (!inv) return;
  if (def.reloadPerShell && inv.ammoInMag < def.magSize && inv.ammoReserve > 0) {
    inv.ammoInMag += 1;
    inv.ammoReserve -= 1;
    if (inv.ammoInMag < def.magSize && inv.ammoReserve > 0) {
      session.reloadingUntil = Date.now() + def.reloadTime * 1000;
      return; // stay in reloading state, loop another shell
    }
  } else {
    const needed = def.magSize - inv.ammoInMag;
    const take = Math.min(needed, inv.ammoReserve);
    inv.ammoInMag += take;
    inv.ammoReserve -= take;
  }
  session.isReloading = false;
}
