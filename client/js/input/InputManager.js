import { InputState } from './InputState.js';
import { loadKeybinds } from './Keybinds.js';

export class InputManager {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.keybinds = loadKeybinds();
    this.keys = new Set();
    this.pointerLocked = false;
    this.enabled = false;
    this.sprintToggleOn = false;
    this.crouchToggleOn = false;
    this.aimToggleOn = false;

    this._onKeyDown = this.onKeyDown.bind(this);
    this._onKeyUp = this.onKeyUp.bind(this);
    this._onMouseMove = this.onMouseMove.bind(this);
    this._onMouseDown = this.onMouseDown.bind(this);
    this._onMouseUp = this.onMouseUp.bind(this);
    this._onWheel = this.onWheel.bind(this);
    this._onPointerLockChange = this.onPointerLockChange.bind(this);
    this._onContextMenu = (e) => e.preventDefault();
    this._onKeybindsChanged = (e) => { this.keybinds = e.detail; };
    window.addEventListener('hs-keybinds-changed', this._onKeybindsChanged);
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('wheel', this._onWheel);
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this.canvas.addEventListener('click', () => {
      if (!this.pointerLocked) this.canvas.requestPointerLock();
    });
  }

  disable() {
    this.enabled = false;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
    this.canvas.removeEventListener('contextmenu', this._onContextMenu);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
  }

  onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  }

  onKeyDown(e) {
    const kb = this.keybinds;
    this.keys.add(e.code);
    this.updateMoveAxes();
    if (e.repeat) return;

    if (e.code === kb.jump) InputState.jumpPressed = true;

    if (e.code === kb.crouch) {
      const isMoving = InputState.moveZ !== 0 || InputState.moveX !== 0;
      if (InputState.sprint && isMoving) InputState.slidePressed = true;
      if (this.settings.crouchMode === 'toggle') {
        this.crouchToggleOn = !this.crouchToggleOn;
        InputState.crouch = this.crouchToggleOn;
      } else {
        InputState.crouch = true;
      }
    }

    if (e.code === kb.sprint) {
      if (this.settings.sprintMode === 'toggle') {
        this.sprintToggleOn = !this.sprintToggleOn;
        InputState.sprint = this.sprintToggleOn;
      } else {
        InputState.sprint = true;
      }
    }

    if (e.code === kb.reload) InputState.reloadPressed = true;
    if (e.code === kb.weapon1) InputState.switchWeaponIndex = 0;
    if (e.code === kb.weapon2) InputState.switchWeaponIndex = 1;
    if (e.code === kb.weapon3) InputState.switchWeaponIndex = 2;
    if (e.code === kb.toggleBuild || e.code === 'Tab') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('hs-toggle-build'));
    }
    if (e.code === kb.buildWall) InputState.buildPieceSelect = 0;
    if (e.code === kb.buildRamp) InputState.buildPieceSelect = 1;
    if (e.code === kb.buildPlatform) InputState.buildPieceSelect = 2;
  }

  onKeyUp(e) {
    const kb = this.keybinds;
    this.keys.delete(e.code);
    this.updateMoveAxes();
    if (e.code === kb.crouch && this.settings.crouchMode !== 'toggle') InputState.crouch = false;
    if (e.code === kb.sprint && this.settings.sprintMode !== 'toggle') InputState.sprint = false;
  }

  updateMoveAxes() {
    const kb = this.keybinds;
    let x = 0, z = 0;
    if (this.keys.has(kb.moveForward)) z += 1;
    if (this.keys.has(kb.moveBack)) z -= 1;
    if (this.keys.has(kb.moveRight)) x += 1;
    if (this.keys.has(kb.moveLeft)) x -= 1;
    const len = Math.hypot(x, z) || 1;
    InputState.moveX = x / len;
    InputState.moveZ = z / len;
  }

  onMouseMove(e) {
    if (!this.pointerLocked) return;
    const sens = (this.settings.sensitivity || 1) * 0.0022;
    InputState.yaw -= e.movementX * sens;
    const dy = e.movementY * sens * (this.settings.invertY ? -1 : 1);
    InputState.pitch = Math.max(-1.5, Math.min(1.5, InputState.pitch - dy));
  }

  onMouseDown(e) {
    if (!this.pointerLocked) return;
    if (e.button === 0) {
      InputState.fireHeld = true;
      InputState.firePressedEdge = true;
      window.dispatchEvent(new CustomEvent('hs-primary-action'));
    }
    if (e.button === 2) {
      if (this.settings.aimMode === 'toggle') {
        this.aimToggleOn = !this.aimToggleOn;
        InputState.ads = this.aimToggleOn;
      } else {
        InputState.ads = true;
      }
    }
  }

  onMouseUp(e) {
    if (e.button === 0) InputState.fireHeld = false;
    if (e.button === 2 && this.settings.aimMode !== 'toggle') InputState.ads = false;
  }

  onWheel(e) {
    const dir = e.deltaY > 0 ? 1 : -1;
    window.dispatchEvent(new CustomEvent('hs-cycle-weapon', { detail: dir }));
  }
}
