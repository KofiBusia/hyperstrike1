import { WEAPONS, MODE_CONFIG, HEALTH } from '/shared/constants.js';

const MODE_LABELS = {
  team_deathmatch: 'Team Deathmatch',
  free_for_all: 'Free-for-All',
  battle_royale: 'Battle Royale',
  parkour_race: 'Parkour Race',
};

function fmtTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.healthFill = document.getElementById('health-fill');
    this.healthValue = document.getElementById('health-value');
    this.shieldFill = document.getElementById('shield-fill');
    this.shieldValue = document.getElementById('shield-value');
    this.resourceValue = document.getElementById('resource-value');
    this.weaponName = document.getElementById('weapon-name');
    this.ammoMag = document.getElementById('ammo-mag');
    this.ammoReserve = document.getElementById('ammo-reserve');
    this.weaponSlots = document.getElementById('weapon-slots');
    this.modeLabel = document.getElementById('mode-label');
    this.timer = document.getElementById('timer');
    this.scoreDisplay = document.getElementById('score-display');
    this.stormWarning = document.getElementById('storm-warning');
    this.killFeed = document.getElementById('kill-feed');
    this.checkpointToast = document.getElementById('checkpoint-toast');
    this.xpToast = document.getElementById('xp-toast');
    this.hitMarker = document.getElementById('hit-marker');
    this.buildBar = document.getElementById('build-bar');
    this.playerCount = document.getElementById('player-count');
    this.crosshair = document.getElementById('crosshair');
    this.scopeOverlay = document.getElementById('scope-overlay');
  }

  setScoped(isScoped) {
    this.scopeOverlay.classList.toggle('hidden', !isScoped);
    this.crosshair.classList.toggle('hidden', isScoped);
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  setMode(modeId) {
    this.modeLabel.textContent = MODE_LABELS[modeId] || modeId;
    this.buildBar.classList.toggle('hidden', modeId === 'parkour_race');
  }

  update(snapshot, selfId) {
    const self = snapshot.players.find((p) => p.id === selfId);
    if (self) {
      this.healthFill.style.width = `${(self.health / HEALTH.maxHealth) * 100}%`;
      this.healthValue.textContent = Math.ceil(self.health);
      this.shieldFill.style.width = `${(self.shield / HEALTH.maxShield) * 100}%`;
      this.shieldValue.textContent = Math.ceil(self.shield);
      this.resourceValue.textContent = self.resources;

      const def = WEAPONS[self.weaponId];
      this.weaponName.textContent = self.isReloading ? `${def?.name || ''} (reloading)` : def?.name || '';
      this.ammoMag.textContent = self.ammoInMag;
      this.ammoReserve.textContent = self.ammoReserve;

      if (self.checkpointEvent) {
        this.showCheckpointToast(`Checkpoint ${self.checkpointEvent.index + 1} / ${self.checkpointEvent.total}`);
      }
    }

    this.timer.textContent = fmtTime(snapshot.timeRemaining);

    if (snapshot.teamScores) {
      this.scoreDisplay.textContent = `A ${snapshot.teamScores.A} — ${snapshot.teamScores.B} B`;
    } else if (snapshot.modeId === 'battle_royale') {
      const alive = snapshot.players.filter((p) => p.alive).length;
      this.scoreDisplay.textContent = `${alive} alive`;
    } else if (self) {
      this.scoreDisplay.textContent = `Kills: ${self.kills}`;
    }

    this.playerCount.textContent = `${snapshot.players.length} players`;

    if (snapshot.storm) {
      const self2 = self;
      const dist = self2 ? Math.hypot(self2.pos[0] - snapshot.storm.center[0], self2.pos[2] - snapshot.storm.center[1]) : 0;
      this.stormWarning.classList.toggle('hidden', !self2 || dist <= snapshot.storm.radius);
    } else {
      this.stormWarning.classList.add('hidden');
    }
  }

  renderWeaponSlots(weaponOrder, currentIndex) {
    this.weaponSlots.innerHTML = '';
    weaponOrder.forEach((id, i) => {
      const div = document.createElement('div');
      div.textContent = WEAPONS[id]?.name.split(' ')[0] || id;
      if (i === currentIndex) div.classList.add('active');
      this.weaponSlots.appendChild(div);
    });
  }

  setBuildMode(active, selectedPiece) {
    this.buildBar.querySelectorAll('.build-slot').forEach((el) => {
      el.classList.toggle('active', active && el.dataset.piece === selectedPiece);
    });
  }

  showHitMarker(headshot) {
    this.hitMarker.style.borderColor = headshot ? '#ffd23d' : '#ff4757';
    this.hitMarker.classList.add('show');
    clearTimeout(this._hitMarkerTimeout);
    this._hitMarkerTimeout = setTimeout(() => this.hitMarker.classList.remove('show'), 120);
  }

  addKillFeedEntry(text) {
    const el = document.createElement('div');
    el.className = 'kill-feed-entry';
    el.textContent = text;
    this.killFeed.appendChild(el);
    setTimeout(() => el.remove(), 4600);
  }

  showCheckpointToast(text) {
    this.checkpointToast.textContent = text;
    this.checkpointToast.classList.remove('hidden');
    clearTimeout(this._cpTimeout);
    this._cpTimeout = setTimeout(() => this.checkpointToast.classList.add('hidden'), 1800);
  }

  showXpToast(text) {
    this.xpToast.textContent = text;
    this.xpToast.classList.remove('hidden');
    clearTimeout(this._xpTimeout);
    this._xpTimeout = setTimeout(() => this.xpToast.classList.add('hidden'), 2200);
  }
}
