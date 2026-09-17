import { InputState } from './InputState.js';

export class MobileControls {
  constructor(settings) {
    this.settings = settings;
    this.root = document.getElementById('mobile-controls');
    this.moveJoystick = document.getElementById('joystick-move');
    this.moveKnob = this.moveJoystick.querySelector('.joystick-knob');
    this.lookZone = document.getElementById('joystick-look');
    this.moveTouchId = null;
    this.lookTouchId = null;
    this.lookLast = null;
    this.selectedBuildIndex = 0;
    this.buildMode = false;
    this.sprintToggleOn = false;
    this.crouchToggleOn = false;
    this.aimToggleOn = false;
    this._bind();
    this.applyControlSize();
    window.addEventListener('hs-control-size-changed', () => this.applyControlSize());
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  applyControlSize() {
    const scale = this.settings.controlSize || 1;
    this.root.style.setProperty('--control-scale', scale);
  }

  _bind() {
    this.moveJoystick.addEventListener('touchstart', (e) => this._moveStart(e), { passive: false });
    this.moveJoystick.addEventListener('touchmove', (e) => this._moveMove(e), { passive: false });
    this.moveJoystick.addEventListener('touchend', (e) => this._moveEnd(e), { passive: false });
    this.moveJoystick.addEventListener('touchcancel', (e) => this._moveEnd(e), { passive: false });

    this.lookZone.addEventListener('touchstart', (e) => this._lookStart(e), { passive: false });
    this.lookZone.addEventListener('touchmove', (e) => this._lookMove(e), { passive: false });
    this.lookZone.addEventListener('touchend', (e) => this._lookEnd(e), { passive: false });
    this.lookZone.addEventListener('touchcancel', (e) => this._lookEnd(e), { passive: false });

    const bind = (id, downFn, upFn) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); downFn(); }, { passive: false });
      if (upFn) el.addEventListener('touchend', (e) => { e.preventDefault(); upFn(); }, { passive: false });
    };

    bind('btn-jump', () => { InputState.jumpPressed = true; InputState.jumpHeld = true; }, () => { InputState.jumpHeld = false; });
    bind('btn-slide', () => { InputState.slidePressed = true; });
    bind('btn-crouch', () => {
      const isMoving = InputState.moveZ !== 0 || InputState.moveX !== 0;
      if (InputState.sprint && isMoving) InputState.slidePressed = true;
      if (this.settings.crouchMode === 'toggle') {
        this.crouchToggleOn = !this.crouchToggleOn;
        InputState.crouch = this.crouchToggleOn;
      } else {
        InputState.crouch = true;
      }
    }, () => { if (this.settings.crouchMode !== 'toggle') InputState.crouch = false; });
    bind('btn-sprint', () => {
      if (this.settings.sprintMode === 'toggle') {
        this.sprintToggleOn = !this.sprintToggleOn;
        InputState.sprint = this.sprintToggleOn;
      } else {
        InputState.sprint = true;
      }
      document.getElementById('btn-sprint').classList.toggle('active', InputState.sprint);
    }, () => {
      if (this.settings.sprintMode !== 'toggle') {
        InputState.sprint = false;
        document.getElementById('btn-sprint').classList.remove('active');
      }
    });
    bind('btn-reload', () => { InputState.reloadPressed = true; });
    bind('btn-ads', () => {
      if (this.settings.aimMode === 'toggle') {
        this.aimToggleOn = !this.aimToggleOn;
        InputState.ads = this.aimToggleOn;
      } else {
        InputState.ads = true;
      }
    }, () => { if (this.settings.aimMode !== 'toggle') InputState.ads = false; });
    bind('btn-fire', () => { InputState.fireHeld = true; InputState.firePressedEdge = true; }, () => { InputState.fireHeld = false; });
    bind('btn-build', () => { window.dispatchEvent(new CustomEvent('hs-toggle-build')); });

    document.querySelectorAll('#mobile-weapon-switch [data-slot]').forEach((btn) => {
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        InputState.switchWeaponIndex = Number(btn.dataset.slot);
      }, { passive: false });
    });
  }

  _moveStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    this.moveTouchId = t.identifier;
    this.moveOrigin = { x: t.clientX, y: t.clientY };
  }
  _moveMove(e) {
    e.preventDefault();
    const t = [...e.changedTouches].find((t) => t.identifier === this.moveTouchId);
    if (!t) return;
    const dx = t.clientX - this.moveOrigin.x;
    const dy = t.clientY - this.moveOrigin.y;
    const maxR = 46;
    const len = Math.hypot(dx, dy) || 1;
    const clampedLen = Math.min(len, maxR);
    const nx = (dx / len) * clampedLen;
    const ny = (dy / len) * clampedLen;
    this.moveKnob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
    InputState.moveX = nx / maxR;
    InputState.moveZ = -ny / maxR;
  }
  _moveEnd(e) {
    e.preventDefault();
    this.moveTouchId = null;
    this.moveKnob.style.transform = 'translate(-50%, -50%)';
    InputState.moveX = 0;
    InputState.moveZ = 0;
  }

  _lookStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    this.lookTouchId = t.identifier;
    this.lookLast = { x: t.clientX, y: t.clientY };
  }
  _lookMove(e) {
    e.preventDefault();
    const t = [...e.changedTouches].find((t) => t.identifier === this.lookTouchId);
    if (!t) return;
    const dx = t.clientX - this.lookLast.x;
    const dy = t.clientY - this.lookLast.y;
    this.lookLast = { x: t.clientX, y: t.clientY };
    const sens = (this.settings.sensitivity || 1) * 0.006;
    InputState.yaw -= dx * sens;
    const dyAdj = dy * sens * (this.settings.invertY ? -1 : 1);
    InputState.pitch = Math.max(-1.5, Math.min(1.5, InputState.pitch - dyAdj));
  }
  _lookEnd(e) {
    e.preventDefault();
    this.lookTouchId = null;
  }
}
