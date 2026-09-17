import * as THREE from 'three';
import { WEAPONS } from '/shared/constants.js';
import { getCosmetic } from '/shared/cosmetics.js';

let muzzleFlashTexture = null;
function getMuzzleFlashTexture() {
  if (muzzleFlashTexture) return muzzleFlashTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,240,1)');
  grad.addColorStop(0.35, 'rgba(255,214,120,0.9)');
  grad.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  muzzleFlashTexture = new THREE.CanvasTexture(c);
  return muzzleFlashTexture;
}

// Simple, deliberately abstract low-poly weapon silhouettes built from primitives -
// distinct proportions per weapon type, no attempt to mimic any real or copyrighted gun.
function buildWeaponMesh(weaponId, skinColor) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: skinColor, flatShading: true, roughness: 0.45, metalness: 0.55 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x1c2229, flatShading: true, roughness: 0.4, metalness: 0.6 });

  const dims = {
    pistol: { body: [0.09, 0.14, 0.28], grip: [0.08, 0.18, 0.09], barrel: [0.05, 0.05, 0.12] },
    smg: { body: [0.1, 0.16, 0.46], grip: [0.08, 0.2, 0.09], barrel: [0.05, 0.05, 0.16] },
    assault_rifle: { body: [0.1, 0.17, 0.62], grip: [0.08, 0.22, 0.09], barrel: [0.05, 0.05, 0.24] },
    shotgun: { body: [0.12, 0.18, 0.58], grip: [0.09, 0.22, 0.1], barrel: [0.07, 0.07, 0.3] },
    sniper: { body: [0.1, 0.15, 0.82], grip: [0.08, 0.2, 0.09], barrel: [0.045, 0.045, 0.36] },
  }[weaponId];

  const body = new THREE.Mesh(new THREE.BoxGeometry(...dims.body), mat);
  group.add(body);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(...dims.grip), accentMat);
  grip.position.set(0, -dims.body[1] / 2 - dims.grip[1] / 2 + 0.04, dims.body[2] * 0.15);
  grip.rotation.x = 0.25;
  group.add(grip);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(...dims.barrel), accentMat);
  barrel.position.set(0, dims.body[1] * 0.12, -dims.body[2] / 2 - dims.barrel[2] / 2);
  group.add(barrel);
  if (weaponId === 'sniper') {
    const scope = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.2), accentMat);
    scope.position.set(0, dims.body[1] / 2 + 0.05, -0.05);
    group.add(scope);
  }
  group.userData.muzzleLocalPos = new THREE.Vector3(0, dims.body[1] * 0.12, -dims.body[2] / 2 - dims.barrel[2]);
  return group;
}

export class WeaponView {
  constructor(camera) {
    this.camera = camera;
    this.rig = new THREE.Group();
    this.rig.position.set(0.24, -0.24, -0.75);
    this.rig.rotation.y = -0.14; // slight turn so the barrel reads as a receding shape, not a flat side profile
    camera.add(this.rig);
    this.meshes = {};
    this.currentWeaponId = null;
    this.hidden = false;
    this.bobT = 0;
    this.recoilOffset = 0;
    this.sway = new THREE.Vector2();

    this.muzzleFlash = new THREE.PointLight(0xffcc66, 0, 4, 2);
    this.rig.add(this.muzzleFlash);
    const flashMat = new THREE.SpriteMaterial({ map: getMuzzleFlashTexture(), transparent: true, opacity: 0, depthTest: false, toneMapped: false });
    this.flashMesh = new THREE.Sprite(flashMat);
    this.flashMesh.scale.set(0.28, 0.28, 1);
    this.rig.add(this.flashMesh);
  }

  setLoadout(weaponOrder, cosmetics) {
    for (const key of Object.keys(this.meshes)) this.rig.remove(this.meshes[key]);
    this.meshes = {};
    const skin = getCosmetic(cosmetics?.weaponSkin)?.color || '#8a8f98';
    for (const id of weaponOrder) {
      const mesh = buildWeaponMesh(id, skin);
      mesh.visible = false;
      this.rig.add(mesh);
      this.meshes[id] = mesh;
    }
  }

  ensureWeapon(weaponId, weaponOrder, cosmetics) {
    if (!this.meshes[weaponId]) this.setLoadout(weaponOrder, cosmetics);
    if (this.currentWeaponId && this.meshes[this.currentWeaponId]) this.meshes[this.currentWeaponId].visible = false;
    this.currentWeaponId = weaponId;
    if (this.meshes[weaponId]) this.meshes[weaponId].visible = !this.hidden;
  }

  // Hides the viewmodel while scoped in (sniper ADS) - it would otherwise
  // block most of the zoomed view for no benefit, same convention most
  // shooters use for high-zoom scopes.
  setHidden(hidden) {
    this.hidden = hidden;
    const mesh = this.meshes[this.currentWeaponId];
    if (mesh) mesh.visible = !hidden;
  }

  playFire() {
    this.recoilOffset = 1;
    this.muzzleFlash.intensity = 3.5;
    this.flashMesh.material.opacity = 1;
    const mesh = this.meshes[this.currentWeaponId];
    if (mesh) {
      const pos = mesh.userData.muzzleLocalPos.clone();
      this.muzzleFlash.position.copy(pos);
      this.flashMesh.position.copy(pos);
    }
  }

  playReload() {
    this.reloadT = 1;
  }

  update(dt, speedFrac, isMoving, ads) {
    this.bobT += dt * (isMoving ? 9 : 2.2);
    const bobAmp = isMoving ? 0.018 : 0.004;
    const bobX = Math.cos(this.bobT) * bobAmp;
    const bobY = Math.abs(Math.sin(this.bobT)) * bobAmp;

    this.recoilOffset = Math.max(0, this.recoilOffset - dt * 6);
    this.muzzleFlash.intensity = Math.max(0, this.muzzleFlash.intensity - dt * 20);
    this.flashMesh.material.opacity = Math.max(0, this.flashMesh.material.opacity - dt * 18);

    const adsTarget = ads ? 0 : 0.24;
    this.rig.position.x += (adsTarget - this.rig.position.x) * Math.min(1, dt * 10);
    const baseY = ads ? -0.16 : -0.24;
    this.rig.position.y = baseY + bobY + this.recoilOffset * 0.05;
    this.rig.position.z = -0.75 + this.recoilOffset * 0.06;
    this.rig.rotation.x = -this.recoilOffset * 0.15;
    this.rig.rotation.z = bobX * 0.6;

    if (this.reloadT > 0) {
      this.reloadT -= dt / 1.2;
      this.rig.rotation.x += Math.sin(Math.max(0, this.reloadT) * Math.PI) * 0.6;
    }
  }
}
