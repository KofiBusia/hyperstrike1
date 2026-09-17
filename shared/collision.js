// Lightweight collision primitives shared by client prediction & server authority.
// Deliberately simple (AABB + analytic ramps) instead of a full physics engine so
// the exact same code can run identically and cheaply on both sides every tick.

const EPS = 1e-4;

// World-space AABB for a block, accounting for the 4 cardinal rotations we use.
export function getBlockBounds(block) {
  const [px, py, pz] = block.pos;
  let [sx, sy, sz] = block.size;
  const rot = block.rotationY || 0;
  // Only cardinal rotations are authored in mapData; swap X/Z extents for +/-90deg.
  const quarter = Math.abs(Math.round(rot / (Math.PI / 2))) % 2 === 1;
  if (quarter) {
    const tmp = sx;
    sx = sz;
    sz = tmp;
  }
  return {
    minX: px - sx / 2,
    maxX: px + sx / 2,
    minY: py - sy / 2,
    maxY: py + sy / 2,
    minZ: pz - sz / 2,
    maxZ: pz + sz / 2,
  };
}

function xzOverlaps(bounds, x, z, pad = 0) {
  return x >= bounds.minX - pad && x <= bounds.maxX + pad && z >= bounds.minZ - pad && z <= bounds.maxZ + pad;
}

// Height of a ramp's walkable surface at world (x,z), or null if outside footprint.
function rampSurfaceHeight(block, x, z) {
  const bounds = getBlockBounds(block);
  if (!xzOverlaps(bounds, x, z)) return null;
  const [px, , pz] = block.pos;
  const rot = block.rotationY || 0;
  // Transform into ramp local space (un-rotate).
  const dx = x - px;
  const dz = z - pz;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const lx = dx * cos - dz * sin;
  const width = block.size[0];
  const height = block.size[1];
  const baseY = block.pos[1] - height / 2;
  const t = (lx + width / 2) / width; // 0 at low end, 1 at high end
  const clamped = Math.min(1, Math.max(0, t));
  return baseY + clamped * height;
}

// Returns the highest walkable surface at (x,z) that is at or below `maxY`
// (feet position + small step tolerance), or -Infinity if nothing found.
export function groundHeightAt(x, z, blocks, maxY) {
  let best = -Infinity;
  for (const block of blocks) {
    if (block.type === 'ladder') continue;
    if (block.type === 'ramp') {
      const h = rampSurfaceHeight(block, x, z);
      if (h !== null && h <= maxY + 0.05 && h > best) best = h;
      continue;
    }
    const bounds = getBlockBounds(block);
    if (!xzOverlaps(bounds, x, z)) continue;
    if (bounds.maxY <= maxY + 0.05 && bounds.maxY > best) best = bounds.maxY;
  }
  return best;
}

// Cylinder-vs-AABB horizontal push-out. Only 'box' type blocks (buildings, walls,
// built structures) block horizontal movement; ramps/platforms only affect ground
// height so players can walk up/along them freely.
export function resolveHorizontal(x, z, radius, blocks, yMin, yMax) {
  let cx = x;
  let cz = z;
  for (const block of blocks) {
    if (block.type !== 'box' || block.id === 'ground') continue;
    const b = getBlockBounds(block);
    if (yMax <= b.minY + EPS || yMin >= b.maxY - EPS) continue; // no vertical overlap
    const closestX = Math.min(Math.max(cx, b.minX), b.maxX);
    const closestZ = Math.min(Math.max(cz, b.minZ), b.maxZ);
    const dx = cx - closestX;
    const dz = cz - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) continue;
    if (distSq < EPS) {
      // Center is inside the box; push out along the shallowest axis.
      const overlaps = [
        { axis: 'x', amt: b.maxX - cx, sign: 1 },
        { axis: 'x', amt: cx - b.minX, sign: -1 },
        { axis: 'z', amt: b.maxZ - cz, sign: 1 },
        { axis: 'z', amt: cz - b.minZ, sign: -1 },
      ].sort((a, c) => a.amt - c.amt)[0];
      if (overlaps.axis === 'x') cx += overlaps.sign * (overlaps.amt + radius);
      else cz += overlaps.sign * (overlaps.amt + radius);
      continue;
    }
    const dist = Math.sqrt(distSq);
    const push = radius - dist;
    cx += (dx / dist) * push;
    cz += (dz / dist) * push;
  }
  return { x: cx, z: cz };
}

// Simple ray vs AABB (slab method). Returns { t, normal:[x,y,z] } or null.
function rayAABB(origin, dir, b) {
  let tmin = -Infinity;
  let tmax = Infinity;
  let axis = -1;
  let sign = 1;
  const axes = [
    [b.minX, b.maxX, origin[0], dir[0]],
    [b.minY, b.maxY, origin[1], dir[1]],
    [b.minZ, b.maxZ, origin[2], dir[2]],
  ];
  for (let i = 0; i < 3; i++) {
    const [min, max, o, d] = axes[i];
    if (Math.abs(d) < EPS) {
      if (o < min || o > max) return null;
    } else {
      let t1 = (min - o) / d;
      let t2 = (max - o) / d;
      let s = -1;
      if (t1 > t2) {
        [t1, t2] = [t2, t1];
        s = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        axis = i;
        sign = s;
      }
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  if (tmax < 0) return null;
  const t = tmin >= 0 ? tmin : tmax;
  const normal = [0, 0, 0];
  if (axis >= 0) normal[axis] = sign;
  return { t, normal };
}

export function raycastBlocks(origin, dir, maxDist, blocks, filterFn) {
  let closest = null;
  for (const block of blocks) {
    if (block.type === 'ladder') continue;
    if (filterFn && !filterFn(block)) continue;
    const b = getBlockBounds(block);
    const hit = rayAABB(origin, dir, b);
    if (hit && hit.t <= maxDist && (closest === null || hit.t < closest.dist)) {
      const point = [origin[0] + dir[0] * hit.t, origin[1] + dir[1] * hit.t, origin[2] + dir[2] * hit.t];
      closest = { dist: hit.t, block, normal: hit.normal, point };
    }
  }
  return closest;
}

export function findLadderAt(x, y, z, blocks, radius = 0.6) {
  for (const block of blocks) {
    if (block.type !== 'ladder') continue;
    const b = getBlockBounds(block);
    if (y < b.minY - 0.2 || y > b.maxY + 0.2) continue;
    if (xzOverlaps(b, x, z, radius)) return block;
  }
  return null;
}

// Horizontal wall probe used for wall-running: casts short rays to the left and
// right of the player's facing direction and returns the nearest wallrunnable hit.
export function probeWalls(pos, rightDir, blocks, rayLength) {
  const origin = [pos[0], pos[1], pos[2]];
  const leftDir = [-rightDir[0], 0, -rightDir[2]];
  const rightRes = raycastBlocks(origin, rightDir, rayLength, blocks, (b) => b.type === 'box' && b.wallrun);
  const leftRes = raycastBlocks(origin, leftDir, rayLength, blocks, (b) => b.type === 'box' && b.wallrun);
  if (rightRes && (!leftRes || rightRes.dist < leftRes.dist)) return { side: 'right', ...rightRes };
  if (leftRes) return { side: 'left', ...leftRes };
  return null;
}
