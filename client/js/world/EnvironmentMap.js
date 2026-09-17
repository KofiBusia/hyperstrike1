import * as THREE from 'three';
import { makeSkyGradientTexture } from './proceduralTextures.js';

// Bakes a small standalone sky-gradient scene into a PMREM environment map, so
// metallic/reflective materials (weapon skins, ramps, build pieces) pick up a
// believable sky reflection instead of looking flat and matte. Deliberately
// NOT baked from the full game scene - that would be far more expensive to
// generate and would bake in odd reflections of nearby low-poly geometry.
export function buildEnvironmentTexture(renderer) {
  const probeScene = new THREE.Scene();
  const tex = makeSkyGradientTexture('#3d7fc1', '#8fd3e8');
  const geo = new THREE.SphereGeometry(50, 16, 12);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
  probeScene.add(new THREE.Mesh(geo, mat));
  probeScene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.6));

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(probeScene, 0.02);
  pmrem.dispose();
  geo.dispose();
  mat.dispose();
  tex.dispose();
  return rt.texture;
}
