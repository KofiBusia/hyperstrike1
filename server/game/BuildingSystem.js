// Server-authoritative build-piece placement. The client only sends "I want to
// place <type> while aiming this direction" - the server re-derives the actual
// placement point via its own raycast so players can't phantom-place structures
// through walls or far outside their reach.
import { BUILDING, MOVEMENT } from '../../shared/constants.js';
import { raycastBlocks } from '../../shared/collision.js';
import { pieceToBlock } from '../../shared/buildPieces.js';

let nextPieceId = 1;

function snap(v, grid) {
  return Math.round(v / grid) * grid;
}

export function tryPlaceBuild(session, pieceType, aimDir, worldBlocks, existingPieces) {
  const def = BUILDING.pieces[pieceType];
  if (!def) return { ok: false, reason: 'unknown_piece' };
  if (session.resources < def.cost) return { ok: false, reason: 'not_enough_resources' };

  const eye = [session.movement.pos[0], session.movement.pos[1] + MOVEMENT.eyeHeightStand, session.movement.pos[2]];
  const combined = worldBlocks.concat(existingPieces.map(pieceToBlock));
  const hit = raycastBlocks(eye, aimDir, BUILDING.maxPlaceDistance, combined, (b) => b.type === 'box' || b.type === 'ramp');
  if (!hit) return { ok: false, reason: 'no_surface' };

  const gx = snap(hit.point[0], BUILDING.gridSize);
  const gz = snap(hit.point[2], BUILDING.gridSize);
  let gy = hit.point[1];
  const facingYaw = Math.atan2(aimDir[0], aimDir[2]);
  const rotationY = Math.round(facingYaw / (Math.PI / 2)) * (Math.PI / 2);

  let size;
  let pos;
  if (pieceType === 'wall') {
    size = [def.width, def.height, def.thickness];
    const base = Math.round(gy / def.height) * def.height;
    pos = [gx, base + def.height / 2, gz];
  } else if (pieceType === 'ramp') {
    size = [def.width, def.height, def.depth];
    pos = [gx, gy + def.height / 2, gz];
  } else {
    size = [def.width, def.thickness, def.depth];
    pos = [gx, gy + def.thickness / 2, gz];
  }

  // Prevent overlapping an existing piece at (almost) the same spot.
  const overlap = existingPieces.some((p) => Math.hypot(p.pos[0] - pos[0], p.pos[2] - pos[2]) < 1 && Math.abs(p.pos[1] - pos[1]) < def.height + 0.5);
  if (overlap) return { ok: false, reason: 'occupied' };

  const piece = {
    id: `build_${nextPieceId++}`,
    ownerId: session.id,
    type: pieceType,
    pos,
    rotationY,
    size,
    health: def.health,
    maxHealth: def.health,
    createdAt: Date.now(),
  };

  session.resources -= def.cost;
  return { ok: true, piece };
}

export function damageBuildPiece(piece, amount) {
  piece.health -= amount;
  return piece.health <= 0;
}
