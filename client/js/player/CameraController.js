import * as THREE from '/vendor/three.module.js';

const ADS_FOV_SCALE = 0.55;
const ADS_ZOOM_SCALE = { sniper: 0.16 };

export class CameraController {
  constructor(camera, baseFov) {
    this.camera = camera;
    this.baseFov = baseFov;
    this.camera.fov = baseFov;
    this.currentFov = baseFov;
    this.roll = 0;
    this.bobPhase = 0;
    this.landDip = 0;
    this.eyeHeight = 1.7;
  }

  setBaseFov(fov) {
    this.baseFov = fov;
  }

  onLand(impactFraction) {
    this.landDip = Math.min(0.35, impactFraction);
  }

  update(dt, { crouching, sliding, wallRunning, wallRunSide, ads, grounded, speed, targetEyeHeight, weaponId }) {
    const zoomScale = (ads && ADS_ZOOM_SCALE[weaponId]) || ADS_FOV_SCALE;
    const targetFov = ads ? this.baseFov * zoomScale : this.baseFov;
    this.currentFov += (targetFov - this.currentFov) * Math.min(1, dt * 10);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    const targetRoll = wallRunning ? (wallRunSide === 'right' ? -0.12 : 0.12) : sliding ? 0.05 : 0;
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 8);

    this.eyeHeight += (targetEyeHeight - this.eyeHeight) * Math.min(1, dt * 12);

    this.landDip *= Math.max(0, 1 - dt * 8);

    if (grounded && speed > 0.5) {
      this.bobPhase += dt * (speed > 6 ? 11 : 7);
    }
    const bobY = grounded ? Math.abs(Math.sin(this.bobPhase)) * Math.min(0.06, speed * 0.006) : 0;
    const bobX = grounded ? Math.cos(this.bobPhase) * Math.min(0.04, speed * 0.004) : 0;

    this.camera.rotation.z = this.roll;
    return { bobY: bobY - this.landDip, bobX, eyeHeight: this.eyeHeight };
  }
}
