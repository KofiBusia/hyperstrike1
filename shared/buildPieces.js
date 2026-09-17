// Converts a placed build piece (server-tracked or client-mirrored) into the
// same block shape shared/collision.js and shared/movement.js understand, so
// build pieces are collidable exactly like static map geometry on both sides.
export function pieceToBlock(piece) {
  return {
    type: piece.type === 'ramp' ? 'ramp' : 'box',
    pos: piece.pos,
    size: piece.size,
    rotationY: piece.rotationY,
    id: piece.id,
    wallrun: piece.type === 'wall',
    isBuildPiece: true,
  };
}
