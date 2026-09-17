// Deterministic, code-generated map layout shared by client (rendering + prediction)
// and server (authoritative collision + validation). Because both sides run this
// exact same generator with the same seed, no map geometry needs to be sent over
// the network - only a version tag, so we can catch drift early.
export const MAP_VERSION = 'hyperstrike-district-1';

// Tiny deterministic PRNG (mulberry32) so client & server always agree.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Block types:
//  box      - solid axis-aligned building/structure. Optional flags: wallrun, climbable
//  ramp     - walkable sloped surface (rises along +local X after yaw rotation), solid at its base height
//  ladder   - vertical climb zone, not solid (player passes through, climbs when overlapping)
//  platform - thin walkable slab (bridges, catwalks)
export function buildMapBlocks() {
  const blocks = [];
  const rng = mulberry32(1337);

  const add = (b) => blocks.push(b);

  // Ground plane represented as one giant flat box so the ground-height query
  // always has a floor to fall back on.
  add({ type: 'box', pos: [0, -1, 0], size: [400, 2, 400], id: 'ground' });

  // ---- City block grid: buildings with rooftops, alleys between them ----
  const gridSpacing = 26;
  const gridCount = 7; // 7x7 grid of building lots centered at origin
  const half = Math.floor(gridCount / 2);
  let bId = 0;
  for (let gx = -half; gx <= half; gx++) {
    for (let gz = -half; gz <= half; gz++) {
      // Leave a cross-shaped open plaza in the middle for spawns / open combat.
      if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue;
      const cx = gx * gridSpacing;
      const cz = gz * gridSpacing;
      const w = 10 + rng() * 6;
      const d = 10 + rng() * 6;
      const h = 8 + rng() * 22;
      add({
        type: 'box',
        pos: [cx, h / 2, cz],
        size: [w, h, d],
        id: `bldg_${bId}`,
        wallrun: true,
        climbable: rng() > 0.5,
        roof: true,
      });

      // Rooftop-access ladder on one side of taller buildings.
      if (h > 16) {
        const side = rng() > 0.5 ? 1 : -1;
        add({
          type: 'ladder',
          pos: [cx + (w / 2 + 0.05) * side, h / 2, cz],
          size: [0.4, h, 1.6],
          id: `ladder_${bId}`,
        });
      }

      // Small rooftop cover blocks for combat variety.
      if (rng() > 0.4) {
        add({
          type: 'box',
          pos: [cx + (rng() - 0.5) * w * 0.4, h + 0.75, cz + (rng() - 0.5) * d * 0.4],
          size: [2.2, 1.5, 2.2],
          id: `roofcover_${bId}`,
          wallrun: true,
        });
      }
      bId++;
    }
  }

  // ---- Rooftop bridges connecting adjacent tall buildings (parkour routes) ----
  add({ type: 'platform', pos: [gridSpacing * 0.5, 18, 0], size: [gridSpacing, 0.4, 2.2], id: 'bridge_1' });
  add({ type: 'platform', pos: [-gridSpacing * 0.5, 14, gridSpacing], size: [2.2, 0.4, gridSpacing], id: 'bridge_2' });
  add({ type: 'platform', pos: [gridSpacing * 1.5, 22, gridSpacing * 1.5], size: [gridSpacing, 0.4, 2], id: 'bridge_3' });

  // ---- Central plaza set pieces ----
  add({ type: 'box', pos: [0, 1, 0], size: [6, 2, 6], id: 'plaza_fountain', climbable: false });
  add({ type: 'ramp', pos: [10, 1.5, 0], size: [8, 3, 5], rotationY: 0, id: 'plaza_ramp_e' });
  add({ type: 'ramp', pos: [-10, 1.5, 0], size: [8, 3, 5], rotationY: Math.PI, id: 'plaza_ramp_w' });
  add({ type: 'ramp', pos: [0, 1.5, 10], size: [8, 3, 5], rotationY: -Math.PI / 2, id: 'plaza_ramp_n' });
  add({ type: 'ramp', pos: [0, 1.5, -10], size: [8, 3, 5], rotationY: Math.PI / 2, id: 'plaza_ramp_s' });

  // ---- Construction zone (NE quadrant): scaffolding, ramps, jump gaps ----
  const cz0 = [gridSpacing * 2.4, 0, gridSpacing * 2.4];
  add({ type: 'box', pos: [cz0[0], 4, cz0[2]], size: [16, 8, 16], id: 'construction_core', wallrun: true });
  for (let i = 0; i < 4; i++) {
    add({
      type: 'platform',
      pos: [cz0[0] + 10 + i * 5.5, 4 + i * 3, cz0[2] - 6],
      size: [4.5, 0.3, 3],
      id: `scaffold_${i}`,
    });
  }
  add({ type: 'ladder', pos: [cz0[0] - 8.2, 4, cz0[2]], size: [0.4, 8, 1.6], id: 'construction_ladder' });
  add({ type: 'box', pos: [cz0[0], 9, cz0[2] + 6], size: [3, 1, 3], id: 'crane_counterweight', wallrun: true });

  // ---- Bridge across a "river" gap (SW quadrant) ----
  const bridgeZ = -gridSpacing * 2.4;
  add({ type: 'box', pos: [-40, -1.5, bridgeZ], size: [400, 1, 14], id: 'river_gap_marker' }); // visual only marker handled client side
  add({ type: 'platform', pos: [-40, 3, bridgeZ], size: [10, 0.5, 16], id: 'main_bridge' });
  add({ type: 'box', pos: [-40, 1, bridgeZ - 9], size: [10, 2, 0.6], id: 'bridge_rail_a' });
  add({ type: 'box', pos: [-40, 1, bridgeZ + 9], size: [10, 2, 0.6], id: 'bridge_rail_b' });

  // ---- Wall-run alley corridor (SE quadrant) ----
  const alleyX = gridSpacing * 2.4;
  const alleyZ = -gridSpacing * 2.4;
  add({ type: 'box', pos: [alleyX - 3, 5, alleyZ], size: [1, 10, 40], id: 'alley_wall_a', wallrun: true });
  add({ type: 'box', pos: [alleyX + 3, 5, alleyZ], size: [1, 10, 40], id: 'alley_wall_b', wallrun: true });

  // ---- Parkour race route markers (rings of low geometry spiraling upward) ----
  const raceCenter = [gridSpacing * -3, 0, gridSpacing * 0.2];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2.4;
    const r = 8 + i * 1.6;
    const y = 1 + i * 2.4;
    add({
      type: 'platform',
      pos: [raceCenter[0] + Math.cos(angle) * r, y, raceCenter[2] + Math.sin(angle) * r],
      size: [3.4, 0.3, 3.4],
      id: `race_platform_${i}`,
      checkpoint: i,
    });
  }

  // ---- Battle royale storm boundary reference (visual ring, not solid) ----
  // Handled purely client-side via MAP.size and shrinking circle UI; no collider needed.

  return blocks;
}

export const MAP_SPAWNS = {
  ffa: [
    [0, 2, 0], [30, 2, 0], [-30, 2, 0], [0, 2, 30], [0, 2, -30],
    [60, 22, 60], [-60, 10, -60], [60, 10, -60], [-60, 14, 60],
  ],
  teamA: [[-90, 2, -90], [-95, 2, -80], [-85, 2, -95], [-90, 2, -100]],
  teamB: [[90, 2, 90], [95, 2, 80], [85, 2, 95], [90, 2, 100]],
  battleRoyale: (() => {
    const pts = [];
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      pts.push([Math.cos(angle) * 150, 40, Math.sin(angle) * 150]);
    }
    return pts;
  })(),
  parkourRaceStart: [-96, 2, 15.2],
};

export const RACE_CHECKPOINT_COUNT = 10;
