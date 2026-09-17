import * as THREE from 'three';
import { getBlockBounds } from '/shared/collision.js';

// Purely decorative street furniture (trees, lamp posts, planters) scattered
// across open ground - adds color/life to the city and gives bloom something
// to catch after dark-ish areas, without being solid (keeps collision simple).
// Candidates are grid-sampled then rejected if they'd intersect any building/
// prop block, so nothing visually clips through existing geometry.

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

function overlapsAnyBlock(x, z, blocks, pad) {
  for (const b of blocks) {
    if (b.id === 'ground' || b.type === 'ladder') continue;
    const bounds = getBlockBounds(b);
    if (x >= bounds.minX - pad && x <= bounds.maxX + pad && z >= bounds.minZ - pad && z <= bounds.maxZ + pad) {
      return true;
    }
  }
  return false;
}

function buildTree(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, flatShading: true, roughness: 0.9 });
  const canopyColors = [0x4a8f4a, 0x5a9c4f, 0x3f7d4a, 0x6bab52];
  const canopyMat = new THREE.MeshStandardMaterial({
    color: canopyColors[Math.floor(rng() * canopyColors.length)],
    flatShading: true,
    roughness: 0.85,
  });
  const trunkH = 1.4 + rng() * 0.6;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, trunkH, 6), trunkMat);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  group.add(trunk);

  const canopyScale = 1 + rng() * 0.4;
  const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * canopyScale, 0), canopyMat);
  canopy.position.y = trunkH + 0.9 * canopyScale;
  canopy.rotation.y = rng() * Math.PI;
  canopy.castShadow = true;
  group.add(canopy);
  return group;
}

function buildLamp() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b333c, flatShading: true, roughness: 0.5, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 6), poleMat);
  pole.position.y = 1.7;
  pole.castShadow = true;
  group.add(pole);

  const armGeo = new THREE.BoxGeometry(0.6, 0.06, 0.06);
  const arm = new THREE.Mesh(armGeo, poleMat);
  arm.position.set(0.3, 3.35, 0);
  group.add(arm);

  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd97a, emissiveIntensity: 1.1, flatShading: true });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), bulbMat);
  bulb.position.set(0.58, 3.3, 0);
  group.add(bulb);
  return group;
}

function buildPlanter(rng) {
  const group = new THREE.Group();
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x6b4a3a, flatShading: true, roughness: 0.8 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), boxMat);
  box.position.y = 0.25;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x5a9c4f, flatShading: true, roughness: 0.85 });
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), bushMat);
  bush.position.y = 0.75;
  bush.scale.y = 0.8 + rng() * 0.3;
  group.add(bush);
  return group;
}

export function scatterDetailProps(scene, blocks) {
  const rng = mulberry32(99);
  const group = new THREE.Group();
  group.name = 'detailProps';

  const spacing = 13;
  const extent = 140;
  let placed = 0;
  const maxProps = 70;

  for (let x = -extent; x <= extent && placed < maxProps; x += spacing) {
    for (let z = -extent; z <= extent && placed < maxProps; z += spacing) {
      const jx = x + (rng() - 0.5) * 6;
      const jz = z + (rng() - 0.5) * 6;
      if (overlapsAnyBlock(jx, jz, blocks, 2.2)) continue;
      if (rng() > 0.34) continue; // keep it sparse, not a forest

      const roll = rng();
      let prop;
      if (roll < 0.55) prop = buildTree(rng);
      else if (roll < 0.8) prop = buildLamp();
      else prop = buildPlanter(rng);

      prop.position.set(jx, 0, jz);
      prop.rotation.y = rng() * Math.PI * 2;
      group.add(prop);
      placed += 1;
    }
  }

  scene.add(group);
  return group;
}
