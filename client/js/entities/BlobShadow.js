import * as THREE from 'three';
import { groundHeightAt } from '/shared/collision.js';

let sharedTexture = null;
function getTexture() {
  if (sharedTexture) return sharedTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  sharedTexture = new THREE.CanvasTexture(c);
  return sharedTexture;
}

// Cheap fake contact shadow: a flat decal that hugs the ground beneath a
// character and fades out with height, instead of a real-time shadow map
// per player (far cheaper, and reads just as well at this scale).
export class BlobShadow {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: getTexture(), transparent: true, depthWrite: false });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
  }

  update(pos, blocks) {
    const groundY = groundHeightAt(pos[0], pos[2], blocks, pos[1] + 0.5);
    const heightAbove = Math.max(0, pos[1] - groundY);
    const fade = Math.max(0, 1 - heightAbove / 3);
    this.mesh.visible = fade > 0.02 && groundY > -50;
    this.mesh.position.set(pos[0], groundY + 0.03, pos[2]);
    const scale = 0.9 * (1 - heightAbove * 0.05 + 0.15);
    this.mesh.scale.set(Math.max(0.3, scale), 1, Math.max(0.3, scale));
    this.mesh.material.opacity = 0.7 * fade;
  }

  dispose(scene) {
    scene.remove(this.mesh);
  }
}
