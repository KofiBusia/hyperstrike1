import * as THREE from 'three';
import { buildMapBlocks, MAP_SPAWNS } from '/shared/mapData.js';
import { createMovementState, simulateMovementTick } from '/shared/movement.js';
import { MOVEMENT, WEAPONS, HEALTH } from '/shared/constants.js';
import { pieceToBlock } from '/shared/buildPieces.js';

import { NetworkManager } from './network/NetworkManager.js';
import { InputManager } from './input/InputManager.js';
import { MobileControls } from './input/MobileControls.js';
import { InputState, consumeEdges } from './input/InputState.js';
import { isTouchDevice, getOrCreateProfileId, loadSettings } from './utils/deviceUtils.js';
import { buildMapScene } from './world/MapBuilder.js';
import { BuildingView } from './world/BuildingView.js';
import { PickupView } from './world/PickupView.js';
import { buildSkyDome, buildClouds } from './world/SkyDome.js';
import { buildEnvironmentTexture } from './world/EnvironmentMap.js';
import { scatterDetailProps } from './world/DetailProps.js';
import { RemotePlayer } from './entities/RemotePlayer.js';
import { BlobShadow } from './entities/BlobShadow.js';
import { CameraController } from './player/CameraController.js';
import { WeaponView } from './weapons/WeaponView.js';
import { TracerEffects } from './weapons/TracerEffects.js';
import { HUD } from './ui/HUD.js';
import { MenuController } from './ui/MenuController.js';
import { PostFX } from './render/PostFX.js';

const settings = loadSettings();
const profileId = getOrCreateProfileId();
const WORLD_BLOCKS = buildMapBlocks();
const BUILD_PIECE_TYPES = ['wall', 'ramp', 'platform'];

const QUALITY_PRESETS = {
  low: { pixelRatioCap: 1, shadows: false, shadowMapSize: 1024, fog: [60, 240], bloom: false },
  medium: { pixelRatioCap: 1.5, shadows: true, shadowMapSize: 1536, fog: [80, 360], bloom: true },
  high: { pixelRatioCap: 2, shadows: true, shadowMapSize: 2048, fog: [90, 460], bloom: true },
};

// ---------------- Renderer / Scene ----------------
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const initialPreset = QUALITY_PRESETS[settings.graphics] || QUALITY_PRESETS.high;
renderer.setPixelRatio(Math.min(initialPreset.pixelRatioCap, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = initialPreset.shadows;

const scene = new THREE.Scene();
const fogColor = 0xdff1e8; // matches the sky dome's horizon gradient stop, so fog blends in seamlessly
scene.fog = new THREE.Fog(fogColor, ...initialPreset.fog);
buildSkyDome(scene);

const camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.05, 600);
camera.rotation.order = 'YXZ';
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x445566, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d9, 2.2);
sun.position.set(120, 180, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(initialPreset.shadowMapSize, initialPreset.shadowMapSize);
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150;
sun.shadow.camera.bottom = -150;
sun.shadow.camera.far = 500;
sun.shadow.bias = -0.0015;
scene.add(sun);
scene.add(new THREE.AmbientLight(0x8fa3c8, 0.35));

buildMapScene(scene, WORLD_BLOCKS);
scatterDetailProps(scene, WORLD_BLOCKS);
const clouds = buildClouds(scene);
const buildingView = new BuildingView(scene);
const pickupView = new PickupView(scene);
const tracerEffects = new TracerEffects(scene);
const localBlobShadow = new BlobShadow(scene);
const cameraController = new CameraController(camera, settings.fov);
const weaponView = new WeaponView(camera);
const postFX = new PostFX(renderer, scene, camera);
postFX.setQuality(initialPreset.bloom ? settings.graphics : 'low');

// Baked once from a small standalone sky probe (not the live game scene) so
// metallic surfaces - weapon skins, build pieces, roof trims - pick up a
// believable sky reflection instead of looking flat.
scene.environment = buildEnvironmentTexture(renderer);

function applyGraphicsQuality(quality) {
  const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.high;
  const pixelRatio = Math.min(preset.pixelRatioCap, window.devicePixelRatio || 1);
  renderer.setPixelRatio(pixelRatio);
  postFX.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = preset.shadows;
  scene.fog.near = preset.fog[0];
  scene.fog.far = preset.fog[1];
  postFX.setQuality(preset.bloom ? quality : 'low');
  onResize();
}
window.addEventListener('hs-graphics-changed', (e) => applyGraphicsQuality(e.detail));

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  postFX.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
onResize();

// ---------------- Input ----------------
const desktopInput = new InputManager(canvas, settings);
const mobileControls = new MobileControls(settings);
const useMobile = isTouchDevice() || settings.forceMobile;

window.addEventListener('hs-fov-changed', (e) => cameraController.setBaseFov(e.detail));

// ---------------- Networking ----------------
const network = new NetworkManager();
network.connect();

const menu = new MenuController(settings, network);
const hud = new HUD();

let selfId = null;
let currentModeId = null;
let localMovement = createMovementState([0, 5, 0]);
let localBlocks = WORLD_BLOCKS;
let serverSelfSnapshot = null;
let wasAlive = true;
let currentWeaponOrder = ['assault_rifle', 'pistol'];
let currentWeaponIndex = 0;
let buildMode = false;
let selectedBuildPiece = 'wall';
let lastFireSentAt = 0;
let inGame = false;
let lastInputSendAt = 0;
let pendingNetworkJump = false;
let pendingNetworkSlide = false;
let cosmetics = { outfit: 'default_outfit', weaponSkin: 'default_skin', trail: 'default_trail' };

network.on('connect', () => {
  document.getElementById('connection-status').classList.add('hidden');
  network.hello(profileId, document.getElementById('player-name-input').value.trim() || 'Guest');
});
network.on('disconnect', () => {
  document.getElementById('connection-status').classList.remove('hidden');
});

network.on('profile', (profile) => {
  menu.setProfile(profile);
  cosmetics = { ...profile.equipped };
});

network.on('progress', ({ profile, xpGain, coinGain, leveledUp }) => {
  menu.setProfile(profile);
  cosmetics = { ...profile.equipped };
  let msg = `+${xpGain} XP`;
  if (coinGain) msg += `  +${coinGain}🪙`;
  if (leveledUp && leveledUp.length) msg += `  LEVEL UP! ${leveledUp[leveledUp.length - 1]}`;
  hud.showXpToast(msg);
});

network.on('joined', ({ matchId, modeId, selfId: id }) => {
  selfId = id;
  currentModeId = modeId;
  hud.setMode(modeId);
  enterGame();
});

network.on('snapshot', (snapshot) => {
  handleSnapshot(snapshot);
});

network.on('fireEvent', (evt) => handleFireEvent(evt));
network.on('playerDied', (evt) => handlePlayerDied(evt));
network.on('matchEnded', (results) => {
  exitGame();
  menu.showResults(results, currentModeId);
});
network.on('purchaseError', ({ message }) => {
  console.warn('Purchase failed:', message);
});

menu.onPlay = (modeId, name) => {
  network.hello(profileId, name);
  network.joinMode(modeId);
};

// ---------------- Remote players ----------------
const remotePlayers = new Map();

function handleSnapshot(snapshot) {
  if (!inGame) return;
  const seenIds = new Set();
  for (const p of snapshot.players) {
    seenIds.add(p.id);
    if (p.id === selfId) {
      serverSelfSnapshot = p;
      continue;
    }
    let rp = remotePlayers.get(p.id);
    if (!rp) {
      rp = new RemotePlayer(scene, p);
      remotePlayers.set(p.id, rp);
    }
    rp.updateFromSnapshot(p);
  }
  for (const [id, rp] of remotePlayers) {
    if (!seenIds.has(id)) {
      rp.dispose(scene);
      remotePlayers.delete(id);
    }
  }

  buildingView.sync(snapshot.buildPieces);
  pickupView.sync(snapshot.pickups);
  localBlocks = WORLD_BLOCKS.concat(snapshot.buildPieces.map(pieceToBlock));

  if (serverSelfSnapshot) {
    const self = serverSelfSnapshot;
    if (self.weaponOrder && JSON.stringify(currentWeaponOrder) !== JSON.stringify(self.weaponOrder)) {
      currentWeaponOrder = [...self.weaponOrder];
      weaponView.setLoadout(currentWeaponOrder, cosmetics);
      weaponView.ensureWeapon(self.weaponId, currentWeaponOrder, cosmetics);
    } else if (weaponView.currentWeaponId !== self.weaponId) {
      weaponView.ensureWeapon(self.weaponId, currentWeaponOrder, cosmetics);
    }
    currentWeaponIndex = self.weaponIndex ?? currentWeaponIndex;
    hud.renderWeaponSlots(currentWeaponOrder, currentWeaponIndex);

    const dist = Math.hypot(
      self.pos[0] - localMovement.pos[0],
      self.pos[1] - localMovement.pos[1],
      self.pos[2] - localMovement.pos[2]
    );
    const justRespawned = self.alive && !wasAlive;
    if (dist > 4 || justRespawned) {
      localMovement.pos = [...self.pos];
      localMovement.vel = [0, 0, 0];
    }
    wasAlive = self.alive;
  }

  hud.update(snapshot, selfId);
}

function handleFireEvent(evt) {
  if (!inGame) return;
  const isSelf = evt.shooterId === selfId;
  if (isSelf) weaponView.playFire();
  const def = WEAPONS[evt.weaponId];
  tracerEffects.spawnTracer(evt.origin, evt.dir, def?.range || 40);
  for (const e of evt.events) {
    if (e.type === 'hit' && e.point) {
      tracerEffects.spawnHitConfetti(e.point, e.headshot);
      if (e.shooterId === selfId) hud.showHitMarker(e.headshot);
    } else if (e.type === 'buildDestroyed' && e.point) {
      tracerEffects.spawnImpact(e.point);
    }
  }
}

function handlePlayerDied(evt) {
  if (!inGame) return;
  const nameOf = (id) => (id === selfId ? 'You' : remotePlayers.get(id)?.name || 'A player');
  const text = evt.killerId
    ? `${nameOf(evt.killerId)} eliminated ${nameOf(evt.victimId)}${evt.headshot ? ' (headshot)' : ''}`
    : `${nameOf(evt.victimId)} fell`;
  hud.addKillFeedEntry(text);
}

// ---------------- Game lifecycle ----------------
function enterGame() {
  inGame = true;
  menu.hideAll();
  hud.show();
  localMovement = createMovementState(MAP_SPAWNS.ffa[0]);
  wasAlive = true;
  weaponView.setLoadout(['assault_rifle', 'pistol'], cosmetics);
  weaponView.ensureWeapon('assault_rifle', ['assault_rifle', 'pistol'], cosmetics);
  currentWeaponOrder = ['assault_rifle', 'pistol'];
  currentWeaponIndex = 0;

  if (useMobile) {
    mobileControls.show();
  } else {
    desktopInput.enable();
    canvas.requestPointerLock();
  }
}

function exitGame() {
  inGame = false;
  hud.hide();
  hud.setScoped(false);
  weaponView.setHidden(false);
  mobileControls.hide();
  localBlobShadow.mesh.visible = false;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  for (const [id, rp] of remotePlayers) rp.dispose(scene);
  remotePlayers.clear();
}

// ---------------- Build mode ----------------
window.addEventListener('hs-toggle-build', () => {
  if (!inGame || currentModeId === 'parkour_race') return;
  buildMode = !buildMode;
  hud.setBuildMode(buildMode, selectedBuildPiece);
});

window.addEventListener('hs-cycle-weapon', (e) => {
  if (!inGame) return;
  currentWeaponIndex = (currentWeaponIndex + (e.detail > 0 ? 1 : -1) + currentWeaponOrder.length) % currentWeaponOrder.length;
  network.switchWeapon(currentWeaponIndex);
});

window.addEventListener('hs-primary-action', () => {
  if (!inGame || !buildMode) return;
  network.build(selectedBuildPiece, InputState.yaw, InputState.pitch);
});

network.on('buildResult', (res) => {
  if (!res.ok) console.debug('Build failed:', res.reason);
});

// ---------------- Main loop ----------------
let lastTime = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  dt = Math.min(dt, 0.1);

  if (inGame) updateGame(dt, now);

  tracerEffects.update(dt);
  clouds.update(dt);
  pickupView.update(dt, now / 1000);
  for (const rp of remotePlayers.values()) rp.tick(dt, localBlocks, tracerEffects);

  postFX.render(dt);
}
requestAnimationFrame(frame);

function updateGame(dt, now) {
  // Handle build piece selection edges.
  if (InputState.buildPieceSelect >= 0 && InputState.buildPieceSelect < BUILD_PIECE_TYPES.length) {
    selectedBuildPiece = BUILD_PIECE_TYPES[InputState.buildPieceSelect];
    hud.setBuildMode(buildMode, selectedBuildPiece);
  }
  if (InputState.switchWeaponIndex >= 0 && InputState.switchWeaponIndex < currentWeaponOrder.length) {
    currentWeaponIndex = InputState.switchWeaponIndex;
    network.switchWeapon(currentWeaponIndex);
  }
  if (InputState.reloadPressed) {
    network.reload(currentWeaponOrder[currentWeaponIndex]);
    weaponView.playReload();
  }

  const alive = serverSelfSnapshot ? serverSelfSnapshot.alive : true;

  // ---- Local movement prediction ----
  const input = {
    moveX: alive ? InputState.moveX : 0,
    moveZ: alive ? InputState.moveZ : 0,
    yaw: InputState.yaw,
    jumpPressed: alive && InputState.jumpPressed,
    jumpHeld: InputState.jumpHeld,
    sprint: InputState.sprint,
    crouch: InputState.crouch,
    slidePressed: alive && InputState.slidePressed,
    dt,
  };
  simulateMovementTick(localMovement, input, localBlocks);

  // Latch jump/slide edges until they actually go out on a (throttled) network
  // send - otherwise a press consumed by this frame's local prediction could
  // be cleared before the next scheduled send ever sees it.
  pendingNetworkJump = pendingNetworkJump || input.jumpPressed;
  pendingNetworkSlide = pendingNetworkSlide || input.slidePressed;

  // Gentle continuous correction toward server-authoritative self position.
  if (serverSelfSnapshot) {
    const s = serverSelfSnapshot.pos;
    const correction = Math.min(1, dt * 3);
    localMovement.pos[0] += (s[0] - localMovement.pos[0]) * correction * 0.15;
    localMovement.pos[2] += (s[2] - localMovement.pos[2]) * correction * 0.15;
  }

  // ---- Camera ----
  const weaponId = currentWeaponOrder[currentWeaponIndex];
  const targetEyeHeight = localMovement.crouching ? MOVEMENT.eyeHeightCrouch : MOVEMENT.eyeHeightStand;
  const speed = Math.hypot(localMovement.vel[0], localMovement.vel[2]);
  const { bobY, bobX, eyeHeight } = cameraController.update(dt, {
    crouching: localMovement.crouching,
    sliding: localMovement.sliding,
    wallRunning: localMovement.wallRunning,
    wallRunSide: localMovement.wallRunSide,
    ads: InputState.ads,
    grounded: localMovement.grounded,
    speed,
    targetEyeHeight,
    weaponId,
  });
  camera.position.set(localMovement.pos[0] + bobX, localMovement.pos[1] + eyeHeight + bobY, localMovement.pos[2]);
  camera.rotation.x = InputState.pitch;
  camera.rotation.y = InputState.yaw;
  localBlobShadow.update(localMovement.pos, localBlocks);

  weaponView.update(dt, speed / MOVEMENT.sprintSpeed, speed > 0.5, InputState.ads);

  const isScoped = InputState.ads && weaponId === 'sniper';
  hud.setScoped(isScoped);
  weaponView.setHidden(isScoped);

  // ---- Weapon firing ----
  const def = WEAPONS[weaponId];
  if (alive && !buildMode && def) {
    const minInterval = 1000 / def.fireRate;
    const wantsFire = def.automatic ? InputState.fireHeld : InputState.firePressedEdge;
    if (wantsFire && now - lastFireSentAt >= minInterval) {
      network.fire(weaponId, InputState.yaw, InputState.pitch, InputState.ads);
      lastFireSentAt = now;
    }
  }

  // ---- Network input send (throttled to ~30/s) ----
  if (now - lastInputSendAt >= 33) {
    lastInputSendAt = now;
    network.sendInput({
      moveX: input.moveX,
      moveZ: input.moveZ,
      yaw: input.yaw,
      jumpPressed: pendingNetworkJump,
      jumpHeld: input.jumpHeld,
      sprint: input.sprint,
      crouch: input.crouch,
      slidePressed: pendingNetworkSlide,
    });
    pendingNetworkJump = false;
    pendingNetworkSlide = false;
  }

  consumeEdges();
}
