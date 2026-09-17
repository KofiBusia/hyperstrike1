import * as THREE from 'three';
import { makeSkyGradientTexture } from './proceduralTextures.js';

// A big inward-facing sphere painted with a vertical gradient - cheap, and a
// large visual upgrade over a flat background color.
export function buildSkyDome(scene) {
  const tex = makeSkyGradientTexture('#3d7fc1', '#8fd3e8');
  const geo = new THREE.SphereGeometry(500, 24, 16);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -10;
  scene.add(dome);

  // Soft sun glow billboard, roughly toward the directional light's direction.
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const gctx = glowCanvas.getContext('2d');
  const grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,250,230,0.9)');
  grad.addColorStop(0.4, 'rgba(255,240,200,0.35)');
  grad.addColorStop(1, 'rgba(255,240,200,0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(140, 140, 1);
  glow.position.set(220, 160, -300);
  scene.add(glow);

  return dome;
}

let cloudTexture = null;
function getCloudTexture() {
  if (cloudTexture) return cloudTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  // A handful of overlapping soft blobs reads as a puffy cloud better than one circle.
  const blobs = [[64, 70, 40], [40, 60, 30], [90, 60, 30], [55, 45, 26], [80, 45, 24]];
  for (const [x, y, r] of blobs) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  cloudTexture = new THREE.CanvasTexture(c);
  return cloudTexture;
}

// Sparse, slow-drifting cloud billboards - purely decorative, no collision.
export function buildClouds(scene) {
  const group = new THREE.Group();
  const mat = new THREE.SpriteMaterial({ map: getCloudTexture(), transparent: true, opacity: 0.75, depthWrite: false, fog: false });
  const rng = mulberry32(4242);
  const clouds = [];
  for (let i = 0; i < 18; i++) {
    const sprite = new THREE.Sprite(mat);
    const angle = rng() * Math.PI * 2;
    const dist = 120 + rng() * 260;
    const scale = 40 + rng() * 60;
    sprite.position.set(Math.cos(angle) * dist, 90 + rng() * 60, Math.sin(angle) * dist);
    sprite.scale.set(scale, scale * 0.55, 1);
    group.add(sprite);
    clouds.push({ sprite, speed: 0.4 + rng() * 0.6, radius: dist, angle });
  }
  scene.add(group);

  return {
    update(dt) {
      for (const c of clouds) {
        c.angle += dt * 0.001 * c.speed;
        c.sprite.position.x = Math.cos(c.angle) * c.radius;
        c.sprite.position.z = Math.sin(c.angle) * c.radius;
      }
    },
  };
}

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
