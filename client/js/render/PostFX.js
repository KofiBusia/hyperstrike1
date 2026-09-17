import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// Lightweight post-processing stack: a single modest bloom pass (for muzzle
// flashes, emissive pickups/trims, the sun glow) plus the output pass that
// restores correct tone mapping/color space after the composer chain.
export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.enabled = true;
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.55, 0.86);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    // SMAA runs last, on the final display-ready image - the composer's render
    // targets aren't MSAA'd, so without this the low-poly edges look noticeably
    // more jagged through post-processing than a direct renderer.render() would.
    const pixelRatio = renderer.getPixelRatio();
    this.smaaPass = new SMAAPass(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio);
    this.composer.addPass(this.smaaPass);
  }

  // EffectComposer caches the renderer's pixel ratio at construction time and
  // never re-reads it - if the renderer's pixel ratio changes later (graphics
  // quality toggle), the composer must be told explicitly or its internal
  // render targets end up the wrong resolution.
  setPixelRatio(pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
  }

  setBloomEnabled(on) {
    this.bloomPass.enabled = on;
  }

  setQuality(quality) {
    // 'low' skips the whole composer (cheapest - plain renderer.render());
    // 'medium'/'high' get bloom + SMAA, with bloom strength scaled by tier.
    if (quality === 'low') {
      this.enabled = false;
      this.bloomPass.enabled = false;
      this.smaaPass.enabled = false;
    } else {
      this.enabled = true;
      this.bloomPass.enabled = true;
      this.smaaPass.enabled = true;
      this.bloomPass.strength = quality === 'high' ? 0.65 : 0.45;
    }
  }

  setSize(w, h) {
    // composer.setSize() already resizes every added pass (including SMAA)
    // at composer._pixelRatio * w/h - no need to size passes individually.
    this.composer.setSize(w, h);
  }

  render(dt) {
    if (!this.enabled) {
      this.renderer.render(this.renderPass.scene, this.renderPass.camera);
      return;
    }
    this.composer.render(dt);
  }
}
