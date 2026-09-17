import * as THREE from '/vendor/three.module.js';

const COLORS = { weapon: 0xffd23d, ammo: 0x38f2c8, resource: 0xd9a86b, shield: 0x4fb0ff };

export class PickupView {
  constructor(scene) {
    this.scene = scene;
    this.meshes = new Map();
  }

  sync(pickups) {
    const ids = new Set(pickups.map((p) => p.id));
    for (const [id, mesh] of this.meshes) {
      if (!ids.has(id)) {
        this.scene.remove(mesh);
        this.meshes.delete(id);
      }
    }
    for (const p of pickups) {
      if (this.meshes.has(p.id)) continue;
      const geo = new THREE.OctahedronGeometry(0.35, 0);
      const mat = new THREE.MeshStandardMaterial({ color: COLORS[p.type] || 0xffffff, flatShading: true, emissive: COLORS[p.type] || 0x000000, emissiveIntensity: 0.4 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.pos[0], p.pos[1] + 0.5, p.pos[2]);
      mesh.userData.baseY = p.pos[1] + 0.5;
      this.scene.add(mesh);
      this.meshes.set(p.id, mesh);
    }
  }

  update(dt, t) {
    for (const mesh of this.meshes.values()) {
      mesh.rotation.y += dt * 1.6;
      mesh.position.y = mesh.userData.baseY + Math.sin(t * 2 + mesh.position.x) * 0.12;
    }
  }
}
