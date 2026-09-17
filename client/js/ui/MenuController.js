import { COSMETICS, cosmeticsForType } from '/shared/cosmetics.js';
import { xpForLevel } from '/shared/constants.js';
import { saveSettings } from '../utils/deviceUtils.js';
import { DEFAULT_KEYBINDS, ACTION_LABELS, loadKeybinds, saveKeybinds, codeToLabel, rebind } from '../input/Keybinds.js';

const SCREENS = ['main-menu', 'mode-select', 'locker', 'settings', 'results-screen'];

export class MenuController {
  constructor(settings, network) {
    this.settings = settings;
    this.network = network;
    this.profile = null;
    this.activeLockerCat = 'outfit';
    this.onPlay = null;
    this.keybinds = loadKeybinds();
    this.listeningAction = null;
    this._bindNav();
    this._bindModeSelect();
    this._bindSettings();
    this._bindSettingsTabs();
    this._bindLocker();
    this._bindKeybinds();
    window.dispatchEvent(new CustomEvent('hs-keybinds-changed', { detail: this.keybinds }));
  }

  showScreen(name) {
    for (const id of SCREENS) {
      document.getElementById(id).classList.toggle('hidden', id !== name);
    }
  }

  hideAll() {
    for (const id of SCREENS) document.getElementById(id).classList.add('hidden');
  }

  _bindNav() {
    document.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.nav;
        if (target === 'play') this.showScreen('mode-select');
        else if (target === 'main') this.showScreen('main-menu');
        else this.showScreen(target);
        if (target === 'locker') this.renderLocker();
      });
    });
  }

  _bindModeSelect() {
    document.querySelectorAll('.mode-card').forEach((card) => {
      card.addEventListener('click', () => {
        const modeId = card.dataset.mode;
        const name = document.getElementById('player-name-input').value.trim() || 'Guest';
        if (this.onPlay) this.onPlay(modeId, name);
      });
    });
  }

  _bindSettings() {
    const sens = document.getElementById('sens-slider');
    const sensVal = document.getElementById('sens-value');
    const fov = document.getElementById('fov-slider');
    const fovVal = document.getElementById('fov-value');
    const vol = document.getElementById('vol-slider');
    const volVal = document.getElementById('vol-value');
    const forceMobile = document.getElementById('force-mobile-toggle');
    const invertY = document.getElementById('invert-y-toggle');
    const graphics = document.getElementById('graphics-select');
    graphics.value = this.settings.graphics;
    graphics.addEventListener('change', () => {
      this.settings.graphics = graphics.value;
      saveSettings(this.settings);
      window.dispatchEvent(new CustomEvent('hs-graphics-changed', { detail: this.settings.graphics }));
    });

    sens.value = this.settings.sensitivity;
    sensVal.textContent = Number(this.settings.sensitivity).toFixed(2);
    fov.value = this.settings.fov;
    fovVal.textContent = this.settings.fov;
    vol.value = this.settings.volume;
    volVal.textContent = Number(this.settings.volume).toFixed(2);
    forceMobile.checked = this.settings.forceMobile;
    invertY.checked = this.settings.invertY;

    sens.addEventListener('input', () => {
      this.settings.sensitivity = Number(sens.value);
      sensVal.textContent = this.settings.sensitivity.toFixed(2);
      saveSettings(this.settings);
    });
    fov.addEventListener('input', () => {
      this.settings.fov = Number(fov.value);
      fovVal.textContent = this.settings.fov;
      saveSettings(this.settings);
      window.dispatchEvent(new CustomEvent('hs-fov-changed', { detail: this.settings.fov }));
    });
    vol.addEventListener('input', () => {
      this.settings.volume = Number(vol.value);
      volVal.textContent = this.settings.volume.toFixed(2);
      saveSettings(this.settings);
    });
    forceMobile.addEventListener('change', () => {
      this.settings.forceMobile = forceMobile.checked;
      saveSettings(this.settings);
    });
    invertY.addEventListener('change', () => {
      this.settings.invertY = invertY.checked;
      saveSettings(this.settings);
    });

    const sprintMode = document.getElementById('sprint-mode-select');
    const crouchMode = document.getElementById('crouch-mode-select');
    const aimMode = document.getElementById('aim-mode-select');
    const controlSize = document.getElementById('control-size-slider');
    const controlSizeVal = document.getElementById('control-size-value');

    sprintMode.value = this.settings.sprintMode;
    crouchMode.value = this.settings.crouchMode;
    aimMode.value = this.settings.aimMode;
    controlSize.value = this.settings.controlSize;
    controlSizeVal.textContent = Number(this.settings.controlSize).toFixed(2);

    sprintMode.addEventListener('change', () => {
      this.settings.sprintMode = sprintMode.value;
      saveSettings(this.settings);
    });
    crouchMode.addEventListener('change', () => {
      this.settings.crouchMode = crouchMode.value;
      saveSettings(this.settings);
    });
    aimMode.addEventListener('change', () => {
      this.settings.aimMode = aimMode.value;
      saveSettings(this.settings);
    });
    controlSize.addEventListener('input', () => {
      this.settings.controlSize = Number(controlSize.value);
      controlSizeVal.textContent = this.settings.controlSize.toFixed(2);
      saveSettings(this.settings);
      window.dispatchEvent(new CustomEvent('hs-control-size-changed', { detail: this.settings.controlSize }));
    });
  }

  _bindSettingsTabs() {
    document.querySelectorAll('.settings-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.settings-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.settingsTab;
        document.getElementById('settings-panel-display').classList.toggle('hidden', target !== 'display');
        document.getElementById('settings-panel-controls').classList.toggle('hidden', target !== 'controls');
      });
    });
  }

  _bindKeybinds() {
    document.getElementById('reset-keybinds-btn').addEventListener('click', () => {
      this.keybinds = { ...DEFAULT_KEYBINDS };
      saveKeybinds(this.keybinds);
      window.dispatchEvent(new CustomEvent('hs-keybinds-changed', { detail: this.keybinds }));
      this.renderKeybinds();
    });
    this.renderKeybinds();
  }

  renderKeybinds() {
    const list = document.getElementById('keybind-list');
    list.innerHTML = '';
    for (const action of Object.keys(ACTION_LABELS)) {
      const row = document.createElement('div');
      row.className = 'keybind-row';
      const label = document.createElement('span');
      label.className = 'keybind-label';
      label.textContent = ACTION_LABELS[action];
      const keyBtn = document.createElement('button');
      keyBtn.className = 'keybind-key';
      keyBtn.textContent = codeToLabel(this.keybinds[action]);
      keyBtn.addEventListener('click', () => this.startListening(action, keyBtn));
      row.appendChild(label);
      row.appendChild(keyBtn);
      list.appendChild(row);
    }
  }

  startListening(action, keyBtn) {
    if (this.listeningAction) return; // one capture at a time
    this.listeningAction = action;
    keyBtn.classList.add('listening');
    keyBtn.textContent = 'Press a key…';
    keyBtn.blur(); // avoid the browser treating a captured Space/Enter as "activate this button"

    const onKey = (e) => {
      e.preventDefault();
      if (e.code === 'Escape') {
        keyBtn.textContent = codeToLabel(this.keybinds[action]);
      } else {
        this.keybinds = rebind(this.keybinds, action, e.code);
        saveKeybinds(this.keybinds);
        window.dispatchEvent(new CustomEvent('hs-keybinds-changed', { detail: this.keybinds }));
        this.renderKeybinds();
      }
      keyBtn.classList.remove('listening');
      this.listeningAction = null;
      window.removeEventListener('keydown', onKey, true);
    };
    window.addEventListener('keydown', onKey, true);
  }

  _bindLocker() {
    document.querySelectorAll('#locker .locker-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#locker .locker-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeLockerCat = tab.dataset.cat;
        this.renderLocker();
      });
    });
  }

  setProfile(profile) {
    this.profile = profile;
    document.getElementById('profile-level').textContent = profile.level;
    document.getElementById('profile-coins').textContent = profile.coins;
    const needed = xpForLevel(profile.level);
    document.getElementById('profile-xp-bar').style.width = `${Math.min(100, (profile.xp / needed) * 100)}%`;
    if (!document.getElementById('locker').classList.contains('hidden')) this.renderLocker();
  }

  renderLocker() {
    const grid = document.getElementById('locker-grid');
    grid.innerHTML = '';
    if (!this.profile) return;
    const items = cosmeticsForType(this.activeLockerCat);
    for (const item of items) {
      const unlocked = this.profile.unlocked.includes(item.id);
      const equipped = this.profile.equipped[item.type] === item.id;
      const div = document.createElement('div');
      div.className = `locker-item ${unlocked ? '' : 'locked'} ${equipped ? 'equipped' : ''}`;
      div.innerHTML = `
        <div class="swatch" style="background:${item.color || '#38f2c8'}"></div>
        <div class="name">${item.name}</div>
        <div class="cost">${unlocked ? (equipped ? 'Equipped' : 'Tap to equip') : `Lv.${item.unlockLevel} · 🪙${item.cost}`}</div>
      `;
      div.addEventListener('click', () => {
        if (unlocked) {
          this.network.equipCosmetic(item.id);
        } else if (this.profile.level >= item.unlockLevel && this.profile.coins >= item.cost) {
          this.network.purchaseCosmetic(item.id);
        }
      });
      grid.appendChild(div);
    }
  }

  showResults(results, modeId) {
    this.showScreen('results-screen');
    const title = document.getElementById('results-title');
    const list = document.getElementById('results-list');
    title.textContent = results.winnerId || results.winnerTeam ? 'Victory Declared' : 'Match Complete';
    list.innerHTML = '';
    (results.players || []).forEach((p) => {
      const row = document.createElement('div');
      row.className = 'results-row' + (p.won ? ' winner' : '');
      const extra = p.kills !== undefined ? `${p.kills} kills` : p.timeMs !== undefined && p.timeMs !== null ? `${(p.timeMs / 1000).toFixed(1)}s` : '';
      row.innerHTML = `<span>#${p.rank ?? '-'} ${p.name || ''}</span><span>${extra}</span>`;
      list.appendChild(row);
    });
  }
}
