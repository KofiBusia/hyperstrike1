import * as THREE from 'three';
import { makeBuildingFacadeTexture, makeGroundTexture, makeRampTexture } from './proceduralTextures.js';

// Renders the shared, code-generated map data as stylized low-poly geometry.
// Original color-blocked look (flat-shaded, procedurally-textured) - not a
// reproduction of any existing game's art style or assets.
const BUILDING_PALETTE = [0x3d4a5a, 0x455566, 0x39485a, 0x4a5568, 0x415061, 0x3a4756];
const ROOF_COLOR = 0x1f2a34;
const RAMP_COLOR = 0xff6a3d;
const PLATFORM_COLOR = 0x38c8f2;
const LADDER_COLOR = 0xffd23d;
const GROUND_COLOR = 0x2a323a;

function colorForBlock(block, index) {
  if (block.id === 'ground') return GROUND_COLOR;
  if (block.type === 'ramp') return RAMP_COLOR;
  if (block.type === 'platform') return PLATFORM_COLOR;
  if (block.id === 'plaza_fountain') return 0x556677;
  return BUILDING_PALETTE[index % BUILDING_PALETTE.length];
}

// One facade texture per palette color, generated once and reused across every
// building of that color - keeps GPU memory bounded regardless of map size.
let facadeTextureCache = null;
function facadeTextureFor(colorHex, seed) {
  if (!facadeTextureCache) facadeTextureCache = new Map();
  const key = `${colorHex}_${seed % 5}`;
  if (!facadeTextureCache.has(key)) {
    facadeTextureCache.set(key, makeBuildingFacadeTexture(colorHex, seed));
  }
  return facadeTextureCache.get(key);
}

export function buildMapScene(scene, blocks) {
  const group = new THREE.Group();
  group.name = 'map';

  const groundMat = new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.95, metalness: 0.02 });
  const rampMat = new THREE.MeshStandardMaterial({ map: makeRampTexture(RAMP_COLOR), roughness: 0.75, metalness: 0.1 });
  const roofCapMat = new THREE.MeshStandardMaterial({ color: ROOF_COLOR, flatShading: true, roughness: 0.9 });

  let idx = 0;
  for (const block of blocks) {
    if (block.type === 'ladder') {
      group.add(buildLadderMesh(block));
      continue;
    }
    const mesh = buildBlockMesh(block, idx, { groundMat, rampMat, roofCapMat });
    group.add(mesh);
    if (block.roof && block.id !== 'ground') {
      // Thin bright roof trim so rooftops read clearly from a distance (parkour landmarks).
      const trimGeo = new THREE.BoxGeometry(block.size[0] + 0.1, 0.15, block.size[2] + 0.1);
      const trim = new THREE.Mesh(trimGeo, new THREE.MeshStandardMaterial({ color: 0x6fe3d0, flatShading: true, emissive: 0x1c6f5f, emissiveIntensity: 0.4 }));
      trim.position.set(block.pos[0], block.pos[1] + block.size[1] / 2 + 0.08, block.pos[2]);
      group.add(trim);
      addRoofClutter(group, block);
    }
    idx++;
  }

  scene.add(group);
  return group;
}

function buildBlockMesh(block, index, sharedMats) {
  if (block.id === 'ground') {
    const geo = new THREE.BoxGeometry(block.size[0], block.size[1], block.size[2]);
    const mesh = new THREE.Mesh(geo, sharedMats.groundMat);
    mesh.position.set(...block.pos);
    mesh.receiveShadow = true;
    mesh.userData.blockId = block.id;
    return mesh;
  }

  if (block.type === 'ramp') {
    const geo = buildRampGeometry(block.size);
    const mesh = new THREE.Mesh(geo, sharedMats.rampMat);
    mesh.position.set(...block.pos);
    if (block.rotationY) mesh.rotation.y = block.rotationY;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.userData.blockId = block.id;
    return mesh;
  }

  const geo = new THREE.BoxGeometry(block.size[0], block.size[1], block.size[2]);
  const color = colorForBlock(block, index);
  let mesh;
  if (block.type === 'platform') {
    const mat = new THREE.MeshStandardMaterial({ color: PLATFORM_COLOR, flatShading: true, roughness: 0.6, metalness: 0.2 });
    mesh = new THREE.Mesh(geo, mat);
  } else if (block.roof) {
    // Actual city buildings: textured window facade on the 4 side faces, a flat
    // dark cap on top/bottom (BoxGeometry auto-groups its 6 faces, so a
    // material array just works).
    const facade = new THREE.MeshStandardMaterial({ map: facadeTextureFor(color, index), roughness: 0.8, metalness: 0.1 });
    const materials = [facade, facade, sharedMats.roofCapMat, sharedMats.roofCapMat, facade, facade];
    mesh = new THREE.Mesh(geo, materials);
  } else {
    // Non-building structures (props, scaffolding, walls, fountain) keep a
    // plain flat-shaded material - a window facade would look out of place.
    const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, metalness: 0.25 });
    mesh = new THREE.Mesh(geo, mat);
  }
  mesh.position.set(...block.pos);
  if (block.rotationY) mesh.rotation.y = block.rotationY;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.userData.blockId = block.id;
  return mesh;
}

// A true triangular-prism wedge: zero height at the low end (local -X),
// rising to full height at the high end (local +X) - matching the walkable
// surface formula in shared/collision.js exactly (which interpolates from
// the block's bottom at x=-hw to its top at x=+hw).
function buildRampGeometry(size) {
  const [w, h, d] = size;
  const hw = w / 2, hh = h / 2, hd = d / 2;

  // A = bottom-low-back, B = bottom-low-front, C = bottom-high-back,
  // D = bottom-high-front, E = top-high-back, F = top-high-front.
  const A = [-hw, -hh, -hd], B = [-hw, -hh, hd], C = [hw, -hh, -hd];
  const D = [hw, -hh, hd], E = [hw, hh, -hd], F = [hw, hh, hd];

  const verts = [];
  const uvs = [];
  const pushTri = (p0, p1, p2, uv0, uv1, uv2) => {
    verts.push(...p0, ...p1, ...p2);
    uvs.push(...uv0, ...uv1, ...uv2);
  };

  pushTri(A, C, D, [0, 0], [1, 0], [1, 1]); // bottom
  pushTri(A, D, B, [0, 0], [1, 1], [0, 1]);
  pushTri(A, B, F, [0, 0], [0, 1], [1, 1]); // sloped top surface
  pushTri(A, F, E, [0, 0], [1, 1], [1, 0]);
  pushTri(C, E, F, [0, 0], [0, 1], [1, 1]); // vertical high-end face
  pushTri(C, F, D, [0, 0], [1, 1], [1, 0]);
  pushTri(A, E, C, [0, 0], [0.5, 1], [1, 0]); // back triangular cap
  pushTri(B, D, F, [0, 0], [1, 0], [0.5, 1]); // front triangular cap

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.computeVertexNormals();
  return geo;
}

// Purely decorative rooftop clutter (AC units, water tanks, antennas) for
// skyline variety - offset toward one corner so it never sits in the middle
// of a rooftop landing zone, and non-solid so it can't interfere with parkour.
function addRoofClutter(group, block) {
  if (Math.random() > 0.55) return;
  const [w, h, d] = block.size;
  if (w < 8 || d < 8) return;
  const topY = block.pos[1] + h / 2;
  const cornerX = block.pos[0] + (Math.random() > 0.5 ? 1 : -1) * (w / 2 - 1.6);
  const cornerZ = block.pos[2] + (Math.random() > 0.5 ? 1 : -1) * (d / 2 - 1.6);

  const roll = Math.random();
  if (roll < 0.4) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a929c, flatShading: true, roughness: 0.6, metalness: 0.4 });
    const unit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), mat);
    unit.position.set(cornerX, topY + 0.45, cornerZ);
    unit.rotation.y = Math.random() * Math.PI;
    unit.castShadow = true;
    group.add(unit);
  } else if (roll < 0.75) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b7680, flatShading: true, roughness: 0.55, metalness: 0.45 });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 8), mat);
    tank.position.set(cornerX, topY + 0.8, cornerZ);
    tank.castShadow = true;
    group.add(tank);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3a4148, flatShading: true });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 4), legMat);
      leg.position.set(cornerX + Math.cos(angle) * 0.6, topY + 0.25, cornerZ + Math.sin(angle) * 0.6);
      group.add(leg);
    }
  } else {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b333c, flatShading: true, metalness: 0.5 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 5), poleMat);
    pole.position.set(cornerX, topY + 1.2, cornerZ);
    group.add(pole);
    const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff4757, emissive: 0xff4757, emissiveIntensity: 1.2, flatShading: true });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), beaconMat);
    beacon.position.set(cornerX, topY + 2.42, cornerZ);
    group.add(beacon);
  }
}

function buildLadderMesh(block) {
  const group = new THREE.Group();
  const [w, h, d] = block.size;
  const railMat = new THREE.MeshStandardMaterial({ color: LADDER_COLOR, flatShading: true, emissive: 0x7a5a00, emissiveIntensity: 0.5, roughness: 0.5, metalness: 0.4 });
  const railGeo = new THREE.BoxGeometry(0.08, h, 0.08);
  const rail1 = new THREE.Mesh(railGeo, railMat);
  rail1.position.set(0, 0, -d / 2 + 0.05);
  const rail2 = rail1.clone();
  rail2.position.z = d / 2 - 0.05;
  group.add(rail1, rail2);

  const rungCount = Math.max(2, Math.floor(h / 0.5));
  const rungGeo = new THREE.BoxGeometry(0.08, 0.05, d - 0.1);
  for (let i = 0; i < rungCount; i++) {
    const rung = new THREE.Mesh(rungGeo, railMat);
    rung.position.set(0, -h / 2 + (i / (rungCount - 1)) * h, 0);
    group.add(rung);
  }
  group.position.set(block.pos[0], block.pos[1], block.pos[2]);
  return group;
}

export function buildPieceMesh(piece) {
  const colorByType = { wall: 0x8fa3ab, ramp: RAMP_COLOR, platform: PLATFORM_COLOR };
  let geo;
  if (piece.type === 'ramp') geo = buildRampGeometry(piece.size);
  else geo = new THREE.BoxGeometry(piece.size[0], piece.size[1], piece.size[2]);
  const mat = new THREE.MeshStandardMaterial({
    color: colorByType[piece.type] || 0xffffff,
    flatShading: true,
    transparent: true,
    opacity: 0.95,
    roughness: 0.55,
    metalness: 0.35,
    emissive: colorByType[piece.type] || 0xffffff,
    emissiveIntensity: 0.12,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(piece.pos[0], piece.pos[1], piece.pos[2]);
  mesh.rotation.y = piece.rotationY || 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
