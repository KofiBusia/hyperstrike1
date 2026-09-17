import * as THREE from 'three';
import { getCosmetic } from '/shared/cosmetics.js';
import { BlobShadow } from './BlobShadow.js';

function makeNameSprite(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '600 34px Rajdhani, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(11,15,20,0.55)';
  ctx.fillRect(0, 8, 256, 48);
  ctx.fillStyle = '#eaf6f4';
  ctx.fillText(name, 128, 42);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}

// A simple articulated low-poly "blockman" - original silhouette, clearly not
// a copy of any real character: torso + head + 4 limb boxes, all primitives.
export class RemotePlayer {
  constructor(scene, data) {
    this.id = data.id;
    this.name = data.name || 'Player';
    this.scene = scene;
    this.group = new THREE.Group();
    this.targetPos = new THREE.Vector3(...data.pos);
    this.group.position.copy(this.targetPos);
    this.displayYaw = data.yaw;
    this.targetYaw = data.yaw;
    this.trailId = data.cosmetics?.trail || 'default_trail';
    this.lastPos = this.targetPos.clone();
    this.trailTimer = 0;

    const outfit = getCosmetic(data.cosmetics?.outfit) || { color: '#5b6b7c' };
    const bodyColor = data.team === 'A' ? '#3d7fc1' : data.team === 'B' ? '#c1443c' : outfit.color;
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0c9a6, flatShading: true, roughness: 0.8 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, flatShading: true, roughness: 0.65, metalness: 0.1 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1c2229, flatShading: true, roughness: 0.6 });

    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), bodyMat);
    this.torso.position.y = 1.15;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    const beltGeo = new THREE.BoxGeometry(0.64, 0.1, 0.38);
    const belt = new THREE.Mesh(beltGeo, trimMat);
    belt.position.y = 0.78;
    this.group.add(belt);

    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
    this.head.position.y = 1.78;
    this.head.castShadow = true;
    this.group.add(this.head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.08), trimMat);
    visor.position.set(0, 1.8, 0.22);
    this.group.add(visor);

    // Pivot at the top of the box (shoulder), so rotation.x swings it like a
    // real limb instead of rotating around its own center.
    const armGeo = new THREE.BoxGeometry(0.2, 0.62, 0.2);
    armGeo.translate(0, -0.31, 0);
    this.armL = new THREE.Mesh(armGeo, bodyMat);
    this.armL.position.set(-0.42, 1.5, 0);
    this.armL.castShadow = true;
    this.armR = this.armL.clone();
    this.armR.position.x = 0.42;
    this.group.add(this.armL, this.armR);

    const legGeo = new THREE.BoxGeometry(0.24, 0.68, 0.24);
    legGeo.translate(0, -0.34, 0);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2b323c, flatShading: true, roughness: 0.75 });
    this.legL = new THREE.Mesh(legGeo, legMat);
    this.legL.position.set(-0.17, 0.78, 0);
    this.legL.castShadow = true;
    this.legR = this.legL.clone();
    this.legR.position.x = 0.17;
    this.group.add(this.legL, this.legR);

    this.nameSprite = makeNameSprite(data.name || 'Player');
    this.nameSprite.position.y = 2.35;
    this.group.add(this.nameSprite);

    this.blobShadow = new BlobShadow(scene);
    scene.add(this.group);
  }

  updateFromSnapshot(data) {
    this.targetPos.set(data.pos[0], data.pos[1], data.pos[2]);
    this.targetYaw = data.yaw;
    this.trailId = data.cosmetics?.trail || this.trailId;
    const crouchLean = data.crouching ? 0.3 : 0;
    this.torso.rotation.x = crouchLean * 0.3;
    this.torso.position.y = data.crouching ? 0.95 : 1.15;
    this.head.position.y = data.crouching ? 1.55 : 1.78;
    this.group.visible = data.alive;
  }

  tick(dt, blocks, tracerEffects) {
    // Smooth interpolation toward the latest authoritative snapshot.
    this.group.position.lerp(this.targetPos, Math.min(1, dt * 12));
    let dYaw = this.targetYaw - this.displayYaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    this.displayYaw += dYaw * Math.min(1, dt * 10);
    this.group.rotation.y = this.displayYaw;

    const speed = this.lastPos.distanceTo(this.group.position) / Math.max(dt, 0.0001);
    this.lastPos.copy(this.group.position);

    if (blocks) this.blobShadow.update([this.group.position.x, this.group.position.y, this.group.position.z], blocks);
    this.blobShadow.mesh.visible = this.blobShadow.mesh.visible && this.group.visible;

    if (tracerEffects && this.group.visible && speed > 6.5 && this.trailId !== 'default_trail') {
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.05;
        const cosmetic = getCosmetic(this.trailId);
        if (cosmetic) {
          tracerEffects.spawnTrailPuff(
            [this.group.position.x, this.group.position.y, this.group.position.z],
            cosmetic.color
          );
        }
      }
    }

    // Simple walk-cycle swing on limbs, driven by movement speed.
    const swing = Math.min(1, speed / 8);
    const t = performance.now() / 1000;
    const phase = Math.sin(t * 9) * swing * 0.6;
    this.armL.rotation.x = phase;
    this.armR.rotation.x = -phase;
    this.legL.rotation.x = -phase;
    this.legR.rotation.x = phase;
  }

  dispose(scene) {
    scene.remove(this.group);
    this.blobShadow.dispose(scene);
  }
}
