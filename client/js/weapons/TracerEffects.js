import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export class TracerEffects {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 5, 1, true);
    this.tracerGeo.translate(0, 0.5, 0); // pivot at the base so we can scale/orient from origin
    this.tracerGeo.rotateX(Math.PI / 2); // cylinder's default axis is Y; tracers travel along local Z
  }

  spawnTracer(origin, dir, dist) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.95, toneMapped: false });
    const mesh = new THREE.Mesh(this.tracerGeo, mat);
    mesh.position.set(...origin);
    mesh.scale.set(1, 1, Math.max(0.4, dist));
    const dirVec = new THREE.Vector3(...dir).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirVec);
    this.scene.add(mesh);
    this.active.push({ obj: mesh, life: 0.07, maxLife: 0.07, baseOpacity: mat.opacity });
  }

  spawnImpact(point) {
    const geo = new THREE.SphereGeometry(0.05, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 1, toneMapped: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...point);
    this.scene.add(mesh);
    this.active.push({ obj: mesh, life: 0.18, maxLife: 0.18, grow: true, baseOpacity: mat.opacity });
  }

  spawnHitConfetti(point, headshot) {
    const color = headshot ? 0xffd23d : 0x38f2c8;
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, toneMapped: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(point[0], point[1], point[2]);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 2.5, Math.random() * 2.5, (Math.random() - 0.5) * 2.5);
      this.scene.add(mesh);
      this.active.push({ obj: mesh, life: 0.45, maxLife: 0.45, vel, baseOpacity: mat.opacity });
    }
  }

  // A single fading colored puff, used for equipped parkour-trail cosmetics -
  // spawned periodically behind a fast-moving player.
  spawnTrailPuff(pos, colorHex) {
    const geo = new THREE.SphereGeometry(0.14, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.55, toneMapped: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1] + 0.15, pos[2]);
    this.scene.add(mesh);
    this.active.push({ obj: mesh, life: 0.5, maxLife: 0.5, shrink: true, baseOpacity: mat.opacity });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const item = this.active[i];
      item.life -= dt;
      const t = Math.max(0, item.life / item.maxLife);
      if (item.obj.material) item.obj.material.opacity = t * item.baseOpacity;
      if (item.vel) {
        item.vel.y -= 9 * dt;
        item.obj.position.addScaledVector(item.vel, dt);
      }
      if (item.grow && !item.shrink) item.obj.scale.setScalar(1 + (1 - t) * 3);
      if (item.shrink) item.obj.scale.setScalar(0.4 + t * 0.8);
      if (item.life <= 0) {
        this.scene.remove(item.obj);
        this.active.splice(i, 1);
      }
    }
  }
}
