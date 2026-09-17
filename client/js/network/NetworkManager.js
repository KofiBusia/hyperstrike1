// Thin wrapper around socket.io-client (loaded globally via /socket.io/socket.io.js).
export class NetworkManager {
  constructor() {
    this.socket = null;
    this.handlers = {};
    this.connected = false;
    this.latencyMs = 60;
  }

  connect() {
    if (this.socket) return;
    this.socket = io({ transports: ['websocket', 'polling'] });
    this.socket.on('connect', () => {
      this.connected = true;
      this._emitLocal('connect');
      this._startLatencyLoop();
    });
    this.socket.on('disconnect', () => {
      this.connected = false;
      this._emitLocal('disconnect');
    });
    const events = [
      'profile', 'joined', 'snapshot', 'fireEvent', 'playerDied', 'matchEnded',
      'pickupCollected', 'buildResult', 'emotePlayed', 'progress', 'purchaseError', 'latencyPong',
    ];
    for (const ev of events) {
      this.socket.on(ev, (payload) => this._emitLocal(ev, payload));
    }
  }

  _startLatencyLoop() {
    setInterval(() => {
      const t0 = performance.now();
      this.socket.emit('latencyPing', t0);
    }, 3000);
    this.on('latencyPong', (sentAt) => {
      const rtt = performance.now() - sentAt;
      this.latencyMs = this.latencyMs * 0.7 + rtt * 0.3;
      this.socket.emit('latencyReport', this.latencyMs);
    });
  }

  on(event, cb) {
    (this.handlers[event] = this.handlers[event] || []).push(cb);
  }

  _emitLocal(event, payload) {
    for (const cb of this.handlers[event] || []) cb(payload);
  }

  send(event, payload) {
    if (this.socket && this.connected) this.socket.emit(event, payload);
  }

  hello(profileId, name) {
    this.send('hello', { profileId, name });
  }

  joinMode(modeId) {
    this.send('joinMode', { modeId });
  }

  sendInput(input) {
    this.send('input', input);
  }

  fire(weaponId, yaw, pitch, ads) {
    this.send('fire', { weaponId, yaw, pitch, ads });
  }

  reload(weaponId) {
    this.send('reload', { weaponId });
  }

  switchWeapon(index) {
    this.send('switchWeapon', { index });
  }

  build(pieceType, yaw, pitch) {
    this.send('build', { pieceType, yaw, pitch });
  }

  emote(emoteId) {
    this.send('emote', { emoteId });
  }

  purchaseCosmetic(cosmeticId) {
    this.send('purchaseCosmetic', { cosmeticId });
  }

  equipCosmetic(cosmeticId) {
    this.send('equipCosmetic', { cosmeticId });
  }
}
