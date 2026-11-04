'use strict';

// Test play has its own save slot; the mode switch belongs to this browser tab.
class PlaySession {
  constructor(storage, tabStorage, makeSave, key) {
    this.storage = storage; this.tabStorage = tabStorage; this.makeSave = makeSave;
    this.key = key; this.testKey = key + '-test'; this.modeKey = key + '-test-active';
    this.normal = this.read(this.key) || makeSave();
    const resumed = this.get(tabStorage, this.modeKey) === 'on' && this.read(this.testKey);
    this.testMode = !!(resumed && resumed.profile);
    this.current = this.testMode ? resumed : this.normal;
  }
  get(storage, key) { try { return storage?.getItem(key); } catch (_) { return null; } }
  put(storage, key, value) {
    try { storage?.setItem(key, value); } catch (_) { /* Keep playing in memory. */ }
  }
  read(key) {
    try {
      const value = JSON.parse(this.get(this.storage, key));
      return value && typeof value === 'object' && !Array.isArray(value)
        ? { ...this.makeSave(), ...value } : null;
    } catch (_) { return null; }
  }
  persist(value) {
    this.current = value;
    this.put(this.storage, this.testMode ? this.testKey : this.key, JSON.stringify(value));
  }
  enter(value, prepare) {
    if (this.testMode) return this.current;
    this.normal = value;
    const copy = prepare(JSON.parse(JSON.stringify(value)));
    this.testMode = true;
    this.persist(copy);
    this.put(this.tabStorage, this.modeKey, 'on');
    return this.current;
  }
  exit() {
    if (!this.testMode) return this.current;
    this.testMode = false;
    this.put(this.tabStorage, this.modeKey, 'off');
    this.current = this.normal;
    return this.current;
  }
}

class ProfileTapGate {
  constructor() { this.reset(); }
  reset() { this.count = 0; this.startedAt = null; }
  tap(now = Date.now()) {
    if (this.startedAt === null || now - this.startedAt > 3000) {
      this.count = 0; this.startedAt = now;
    }
    if (++this.count < 5) return false;
    this.reset(); return true;
  }
}
