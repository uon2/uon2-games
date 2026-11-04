'use strict';

// DOM/save independent. AdventureEngine and data.js must already be loaded.
class SwarmEngine extends AdventureEngine {
  constructor(stage, rng = Math.random) {
    super(stage, rng); // nextWave is virtual; its initialization guard is intentional.
    this.swarm = true; this.totalWaves = 3; this.wave = 0;
    this.weapons = { seed: 1 }; this.evolved = {}; this.available = ['seed'];
    this.bladeLevel = 1; this.pendingLevels = 0; this.nextXP = 4;
    this.shield = 1; // One free opening hit of protection for every new run.
    this._shieldDrops = 0;
    this.specialCharge = 100; this.paused = false; this.waveTime = 0; this.waveRemaining = 0;
    this.shots = []; this.fields = []; this.spawnWarnings = [];
    this.boons.power = 0; this._cooldowns = {}; this._offer = null; this._offerTurn = 0; this._configured = false; this._volley = 0;
    this.power = Math.max(1, Math.min(6, Number(this.power) || 1));
    this.nextWave();
  }
  emit(type, extra = {}) {
    super.emit(type, extra);
    if (this.events.length > 128) this.events.splice(0, this.events.length - 128);
  }
  _active() { return !this.paused && !this.pendingLevels && ['fight', 'boss'].includes(this.phase); }
  _terminal() { return this.phase === 'won' || this.phase === 'lost'; }
  configureLoadout({ available = ['seed'], start = 'seed', bladeLevel = 1 } = {}) {
    if (this._configured || this.time || this.wave !== 1 || this.kills || this.phase !== 'fight') return false;
    const ids = ['seed', 'blade', 'fire', 'bomb'];
    this.available = [...new Set(['seed', ...(Array.isArray(available) ? available : []).filter(id => ids.includes(id))])];
    this.bladeLevel = Math.max(1, Math.min(5, Math.floor(Number(bladeLevel) || 1)));
    const id = this.available.includes(start) ? start : 'seed';
    this.weapons = { [id]: id === 'blade' ? this.bladeLevel : 1 }; this.evolved = {};
    this._configured = true; this._syncBlade(); return true;
  }
  _syncBlade() {
    const n = this.weapons.blade;
    this.blade = n ? { orbs: 2 + Math.floor((n - 1) / 2) + (this.evolved.blade ? 1 : 0),
      radius: 68 + n * 4 + (this.evolved.blade ? 18 : 0), speed: 2.4 + n * 0.2,
      recharge: 0.7, damage: 1.5 + (n - 1) * 0.25 + this.boons.power * 0.2 } : null;
  }
  nextWave() {
    if (!this.swarm || this._terminal() || this.pendingLevels) return false;
    if (++this.wave > this.totalWaves || this.bossDown) return this.finish();
    this._clearCombat(); this.drops = []; this.waveTime = 0; this._spawnClock = 0.9; this._spawned = 0; this._heartDrops = 0;
    this.waveKills = 0; this.waveGoal = (this.wave === 1 ? 12 : 30) + (this.power - 1) * 2;
    this._cooldowns = {}; this.phase = this.wave === this.totalWaves ? 'boss' : 'fight';
    const duration = Array.isArray(this.stage.duration) ? this.stage.duration[this.wave - 1] : this.stage.duration;
    this.waveRemaining = this.phase === 'boss' ? 0 : Number.isFinite(duration) && duration > 0 ? duration : this.wave === 1 ? 40 : 55;
    this._duration = this.waveRemaining;
    this.rescue = this.stage.learningRoute === true && this.phase === 'fight'
      ? { x: this.wave === 1 ? 620 : 280, y: this.wave === 1 ? 160 : 370, progress: 0, done: false, active: false } : null;
    this._routeGuardSpawned = false;
    if (this.phase === 'boss') { const p = this._safeEdge(); this.enemies.push(this._enemy('boss', p.x, p.y)); }
    else this._warn();
    this.emit(this.phase === 'boss' ? 'boss' : 'wave', { wave: this.wave }); return true;
  }
  _clearCombat() {
    this.enemies = []; this.projectiles = []; this.shots = []; this.fields = []; this.spawnWarnings = []; this.vents = [];
    if (this.rescue) this.rescue.active = false;
  }
  _chest(boss = false, resumed = false) {
    if (this._terminal() || this.phase === 'chest') return false;
    this.phase = 'chest'; this.bossDown = boss; this.waveRemaining = 0; this._clearCombat();
    // Only earned XP is gathered here. Healing/protection must be reached during combat.
    const drops = this.drops.splice(0); drops.filter(d => d.kind === 'gem').forEach(d => this._collect(d));
    this.emit('chest', { boss, ...(resumed ? { resumed: true } : {}) }); return true;
  }
  resumeBossChest() {
    if (this._terminal() || (this.phase === 'chest' && this.bossDown)) return false;
    this.wave = this.totalWaves; this.phase = 'boss'; this.rescue = null; return this._chest(true, true);
  }
  finish() {
    if (this._terminal()) return false;
    this._clearCombat(); this.drops = []; this.pendingLevels = 0; this._offer = null;
    return super.finish();
  }
  forge(word) {
    if (this.phase !== 'chest' || this.pendingLevels || typeof word !== 'string' || !word.trim()) return false;
    this.spells[AdventureEngine.spellOf(word)]++;
    if (this.bossDown) this.finish(); else this.nextWave();
    return true;
  }
  upgradeChoices() {
    if (!this.pendingLevels || this._terminal()) return [];
    if (!this._offer) {
      const names = { seed: ['🌱', '새싹 발사기'], blade: ['⚔️', '빙글검'], fire: ['🔥', '관통 지팡이'], bomb: ['💣', '폭발 봉'] };
      const equipped = Object.keys(this.weapons), [main, support] = equipped;
      const upgrades = equipped.filter(id => this.weapons[id] < 5);
      const availableSupport = this.available.filter(id => id !== main);
      if (!support && availableSupport.length) upgrades.push(availableSupport[this._offerTurn % availableSupport.length]);
      const choices = upgrades.map(id => ({ id, title: names[id][1],
        desc: this.weapons[id] ? `무기 레벨 ${this.weapons[id] + 1}` : '보조 자동 무기를 배워요 (무기 최대 2개)', icon: names[id][0] }));
      const passives = [{ id: 'power', title: '힘찬 공격', desc: '모든 무기 피해 +0.2', icon: '💪' },
        { id: 'swift', title: '빠른 발', desc: '이동 속도 +8, 대시 회복도 빨라져요', icon: '👟' },
        { id: 'heart', title: '튼튼한 마음', desc: this._heartDescription(), icon: '❤️' }];
      // Main and equipped support upgrades stay visible; unchosen support/passives rotate.
      for (let i = 0; choices.length < 3; i++) choices.push(passives[(this._offerTurn + i) % passives.length]);
      this._offer = choices;
    }
    return this._offer.map(c => ({ ...c }));
  }
  chooseUpgrade(id) {
    if (!this.pendingLevels || this._terminal() || !this._offer?.some(c => c.id === id)) return false;
    if (this.available.includes(id)) {
      if ((this.weapons[id] || 0) >= 5 || (!this.weapons[id] && Object.keys(this.weapons).length >= 2)) return false;
      this.weapons[id] = this.weapons[id] ? this.weapons[id] + 1 : id === 'blade' ? this.bladeLevel : 1;
    } else if (['power', 'swift', 'heart'].includes(id)) this._passive(id);
    else return false;
    this.pendingLevels--; this._offer = null; this._offerTurn++; this._syncBlade(); this.emit('upgrade', { id }); return true;
  }
  _passive(id) {
    this.boons[id]++;
    if (id === 'heart') { this.player.maxHP = Math.min(8, this.player.maxHP + 1); this.player.hp = Math.min(this.player.maxHP, this.player.hp + 1); }
  }
  _heartDescription() { return this.player.maxHP < 8 ? '최대 하트 +1 (최대 8개), 하트 1 회복' : '하트 1 회복'; }
  evolutionChoices() {
    if (this.phase !== 'chest' || this.boonWaves[this.wave]) return [];
    const names = { seed: ['🌳', '숲의 발사기'], blade: ['🌀', '별빛 빙글검'], fire: ['☄️', '유성 관통 지팡이'], bomb: ['🌋', '커다란 폭발 봉'] };
    const choices = Object.keys(this.weapons).filter(id => !this.evolved[id]).map(id => ({ id: 'evolve:' + id,
      title: names[id][1], desc: id === 'blade' ? '검이 하나 더 생기고 궤도가 커져요' : id === 'bomb' ? '폭발 범위가 크게 넓어져요' : '발사 수와 관통 범위가 늘어요', icon: names[id][0] }));
    return choices.length ? choices : [{ id: 'heart', title: '튼튼한 마음', desc: this._heartDescription(), icon: '❤️' }];
  }
  grantBoon(id) {
    if (this.phase !== 'chest' || this.boonWaves[this.wave]) return false;
    if (id === 'heart') this._passive('heart'); // Legacy chest buttons can always use this fallback.
    else {
      if (!this.evolutionChoices().some(c => c.id === id)) return false;
      this.evolved[id.slice(7)] = true;
    }
    this.boonWaves[this.wave] = id; this._syncBlade(); this.emit('boon', { kind: id }); return true;
  }
  _collect(d) {
    if (d.kind === 'heart') this.player.hp = Math.min(this.player.maxHP, this.player.hp + 1);
    else if (d.kind === 'shield') { if (this.shield < 1) { this.shield = 1; this.emit('shieldup'); } }
    else {
      this.xp++; this.specialCharge = Math.min(100, this.specialCharge + 1);
      while (this.xp >= this.nextXP) {
        this.level++; this.pendingLevels++; this.nextXP += this.level * 4;
        this.emit('level', { level: this.level, pendingLevels: this.pendingLevels });
      }
    }
    this.emit('pickup');
  }
  _limits() {
    while (this.drops.length > 80) {
      const d = this.drops.shift(); if (d.kind === 'gem') this._collect(d);
    }
    this.effects.splice(0, Math.max(0, this.effects.length - 80));
    this.projectiles.splice(96); this.shots.splice(Math.max(0, 96 - this.projectiles.length)); this.fields.splice(32);
  }
  hitEnemy(e, damage) {
    if (!this._active() || e.dead || !this.enemies.includes(e) || !Number.isFinite(damage) || damage <= 0) return false;
    const dropStart = this.drops.length;
    // Automatic hits must not inherit the legacy melee interruption/knockback loop.
    const steady = ['archer', 'charger'].includes(e.kind) ? { x: e.x, y: e.y, recoil: e.recoil } : null;
    super.hitEnemy(e, damage);
    if (steady) Object.assign(e, steady);
    if (e.dead) {
      // Replace the legacy every-3 shield/every-4 heart economy for this mode only.
      this.drops.splice(dropStart); this.waveKills++;
      if (e.boss || this.kills % 2 === 0) this.drops.push({ x:e.x, y:e.y, kind:'gem' });
      if (!e.boss && this.kills % 20 === 0 && this._heartDrops < 2 && this.player.hp < this.player.maxHP) {
        this.drops.push({ x:e.x+16, y:e.y, kind:'heart' }); this._heartDrops++;
      }
      if (!e.boss && this.kills % 34 === 0 && this._shieldDrops < 1 && !this.shield) {
        this.drops.push({ x:e.x-16, y:e.y, kind:'shield' }); this._shieldDrops++;
      }
      this.specialCharge = Math.min(100, this.specialCharge + 2);
    }
    this._limits();
    if (e.dead && e.boss) this._chest(true);
    return true;
  }
  hurt() {
    if (!this._active()) return;
    super.hurt();
    if (this.phase === 'lost') { this._clearCombat(); this.drops = []; }
  }
  dash() { return this._active() ? super.dash() : false; }
  cast(word) { if (!this._active()) return false; const ok = super.cast(word); this._limits(); return ok; }
  attack() { return this.special(); }
  special() {
    if (!this._active() || this.specialCharge < 100) return false;
    this.specialCharge = 0;
    const p = this.player, volley = ++this._volley;
    this.fields.push({ x: p.x, y: p.y, r: 200, ttl: 0.4, kind: 'special', exploded: true });
    for (let i = 0; i < 12; i++) this._shot('special', i * Math.PI / 6, 520, 0.8, 5 + this.boons.power * 0.25, 6, volley);
    for (const e of this.enemies.slice()) if (Math.hypot(e.x - p.x, e.y - p.y) < 200) {
      if (this.hitEnemy(e, 6 + this.boons.power * 0.25)) this._interrupt(e, volley);
    }
    this.emit('special'); this._limits(); return true;
  }
  _interrupt(e, volley) {
    if (e.dead || !['archer', 'charger'].includes(e.kind) || e.interruptedVolley === volley) return;
    e.interruptedVolley = volley;
    e.aim = null; e.shootWindup = 0; e.shootCD = Math.max(e.shootCD, 1.5);
    e.chargeAim = null; e.chargeWindup = 0; e.chargeTime = 0; e.chargeVX = 0; e.chargeVY = 0;
    e.chargeCD = Math.max(e.chargeCD, 1.5); e.recoil = 0; e.recovery = 0.8;
    this.emit('interrupt', { kind: e.kind, elite: !!e.elite, x: e.x, y: e.y });
  }
  _random() { return Math.max(0, Math.min(0.999999, Number(this.rng()) || 0)); }
  _safeEdge() {
    const y = 60 + this._random() * 400, x = 45 + this._random() * 810, p = this.player;
    const spots = [{ x: 45, y }, { x: 855, y }, { x, y: 60 }, { x, y: 460 }];
    const safe = spots.filter(s => Math.hypot(s.x - p.x, s.y - p.y) >= 210);
    return safe[Math.floor(this._random() * safe.length)];
  }
  _warn() {
    // Reserve one slot so the route guard can arrive even in a full second wave.
    const cap = this.rescue && !this._routeGuardSpawned ? 23 : 24;
    if (this.enemies.filter(e => !e.dead).length + this.spawnWarnings.length >= cap) return;
    this.spawnWarnings.push({ ...this._safeEdge(), t: 0.65 });
  }
  _learningRoute(dt) {
    const r = this.rescue;
    if (!r || r.done || this.waveTime < 12 - 1e-9) return;
    if (!r.active) {
      r.active = true;
      this.emit('rescue-ready', { wave: this.wave, x: r.x, y: r.y });
    }
    if (!this._routeGuardSpawned) {
      const p = this._safeEdge(), kind = this.wave === 1 ? 'archer' : 'charger';
      const guard = this._enemy(kind, p.x, p.y);
      guard.elite = true; guard.hp = guard.maxHP = this.wave === 1 ? 14 : 18;
      guard.shootCD = 0.6; guard.chargeCD = 0.8;
      this.enemies.push(guard); this._routeGuardSpawned = true;
      this.emit('elite', { wave: this.wave, kind, x: guard.x, y: guard.y });
    }
    if (Math.hypot(this.player.x - r.x, this.player.y - r.y) <= 68) {
      // Only combat time after activation counts, including on the activation frame.
      r.progress = Math.min(1.2, r.progress + Math.min(dt, Math.max(0, this.waveTime - 12)));
      if (r.progress >= 1.2 - 1e-9) {
        r.progress = 1.2; r.done = true; r.active = false;
        this.emit('rescued', { wave: this.wave, x: r.x, y: r.y });
      }
    }
  }
  _enemy(kind, x, y) {
    const boss = kind === 'boss';
    const hp = boss ? 120 + this.power * 20 : kind === 'charger' ? 4 + Math.floor(this.power / 2)
      : kind === 'archer' ? 3 + Math.floor(this.power / 3) : 2 + Math.floor((this.power - 1) / 2);
    return { x, y, hp, maxHP: hp, speed: boss ? 48 + this.power * 2 : 46 + this.power * 3 + (this.wave === 2 ? 4 : 0), kind, boss, dead: false,
      chargeAim: null, chargeWindup: 0, chargeTime: 0, chargeCD: 2.4, recovery: 0,
      aim: null, shootWindup: 0, shootCD: 1.8, windup: 0, cooldown: 1.8, target: null,
      flash: 0, recoil: 0, color: '#65cfaf' };
  }
  _spawns(dt) {
    for (const w of this.spawnWarnings) {
      w.t -= dt;
      if (w.t > 1e-9) continue;
      if (Math.hypot(w.x - this.player.x, w.y - this.player.y) < 180) { Object.assign(w, this._safeEdge(), { t: 0.65 }); continue; }
      let kind = 'moss'; this._spawned++;
      if (this.power >= 2 && this._spawned % 7 === 0 && this.enemies.filter(e => e.kind === 'archer').length < 2) kind = 'archer';
      else if (this.power >= 3 && this._spawned % 9 === 0) kind = 'charger';
      if (this.enemies.filter(e => !e.dead).length < 24) this.enemies.push(this._enemy(kind, w.x, w.y));
      w.t = 0;
    }
    this.spawnWarnings = this.spawnWarnings.filter(w => w.t > 0);
    if (this.phase !== 'fight') return;
    this._spawnClock -= dt;
    if (this._spawnClock <= 0) {
      this._spawnClock += this.wave === 1 ? 0.9 : 0.65;
      for (let i = 0; i < (this.wave === 1 ? 1 : 2); i++) this._warn();
    }
  }
  _shot(kind, angle, speed, ttl, damage, pierce, volley) {
    if (this.shots.length + this.projectiles.length >= 96) return;
    this.shots.push({ x: this.player.x, y: this.player.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      kind, ttl, damage, pierce, volley, hit: new Set() });
  }
  _weapons(dt) {
    this._syncBlade();
    if (this.blade) {
      this.bladeAngle = (this.bladeAngle + this.blade.speed * dt) % (Math.PI * 2);
      const spots = this.bladeSpots();
      for (const e of this.enemies) {
        e.bladeCD = Math.max(0, (e.bladeCD || 0) - dt);
        if (!e.dead && !e.bladeCD && spots.some(s => Math.hypot(s.x - e.x, s.y - e.y) < 34)) {
          e.bladeCD = this.blade.recharge; this.hitEnemy(e, this.blade.damage);
        }
      }
    }
    for (const id of Object.keys(this.weapons).filter(id => id !== 'blade')) {
      if (!this._active()) return;
      this._cooldowns[id] = Math.max(0, (this._cooldowns[id] || 0) - dt);
      if (this._cooldowns[id]) continue;
      const n = this.weapons[id], evolved = !!this.evolved[id], p = this.player;
      const range = id === 'seed' ? (evolved ? 410 : 300) : id === 'bomb' ? 500 : 700;
      const target = this.enemies.filter(e => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= range)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (!target) continue;
      const a = Math.atan2(target.y - p.y, target.x - p.x), damage = this.boons.power * 0.2 + (n - 1) * 0.25;
      if (id === 'bomb') {
        if (this.fields.length < 32) this.fields.push({ x: target.x, y: target.y, r: 85 + n * 9 + (evolved ? 65 : 0),
          ttl: 1.05, delay: 0.65, damage: 3 + damage, kind: 'bomb', exploded: false });
      } else {
        const count = id === 'seed' ? 3 + Math.floor(n / 2) + (evolved ? 2 : 0) : 1 + (n >= 3 ? 1 : 0) + (evolved ? 2 : 0);
        const volley=++this._volley;
        for (let i = 0; i < count; i++) this._shot(id, a + (i - (count - 1) / 2) * 0.12,
          id === 'seed' ? 440 : 560, id === 'seed' ? evolved ? 0.94 : 0.68 : 1.3,
          (id === 'seed' ? 1 : 2) + damage, id === 'seed' ? 2 : 4, volley);
      }
      this._cooldowns[id] = (id === 'bomb' ? 2 : id === 'fire' ? 1.05 : 0.85) - (n - 1) * 0.07;
    }
  }
  static _segment(x, y, nx, ny, e) {
    const dx = nx - x, dy = ny - y;
    const t = Math.max(0, Math.min(1, ((e.x - x) * dx + (e.y - y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x + dx * t - e.x, y + dy * t - e.y);
  }
  _shots(dt) {
    for (const s of this.shots) {
      const x = s.x, y = s.y, step = Math.min(dt, s.ttl);
      s.x += s.vx * step; s.y += s.vy * step; s.ttl -= dt;
      const targets = this.enemies.filter(e => !e.dead && !s.hit.has(e) && SwarmEngine._segment(x, y, s.x, s.y, e) < (e.boss ? 38 : 24))
        .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
      for (const e of targets) {
        s.hit.add(e);
        // A fan clears a crowd, but overlapping rays cannot instantly erase a boss.
        if(e.boss && s.volley!==undefined) {
          e.hitVolleys ||= new Set();
          if(e.hitVolleys.has(s.volley)) continue;
          e.hitVolleys.add(s.volley);
          if(e.hitVolleys.size>8)e.hitVolleys.delete(e.hitVolleys.values().next().value);
        }
        this.hitEnemy(e, s.damage); s.pierce--;
        if (s.kind === 'special') this._interrupt(e, s.volley);
        if (!this._active()) return;
        if (!s.pierce) { s.ttl = 0; break; }
      }
    }
    this.shots = this.shots.filter(s => s.ttl > 0 && s.x > 0 && s.x < 900 && s.y > 0 && s.y < 520);
  }
  _fields(dt) {
    for (const f of this.fields) {
      f.ttl -= dt;
      if (f.exploded) continue;
      f.delay -= dt;
      if (f.delay > 1e-9) continue;
      f.exploded = true;
      for (const e of this.enemies.slice()) {
        if (Math.hypot(e.x - f.x, e.y - f.y) <= f.r) this.hitEnemy(e, f.damage);
        if (!this._active()) return;
      }
    }
    this.fields = this.fields.filter(f => f.ttl > 0);
  }
  _telegraphsFull(e) {
    return this.enemies.filter(other => other !== e && !other.dead &&
      (other.shootWindup > 0 || other.chargeWindup > 0 || other.chargeTime > 0)).length >= 2;
  }
  updateArcher(e, dt) {
    if (e.recovery > 0) { e.recovery = Math.max(0, e.recovery - dt); return; }
    if (!e.shootWindup && this._telegraphsFull(e)) e.shootCD = Math.max(e.shootCD, dt + 1e-6);
    super.updateArcher(e, dt);
  }
  updateCharger(e, dt) {
    if (!e.chargeWindup && !e.chargeTime && this._telegraphsFull(e)) e.chargeCD = Math.max(e.chargeCD, dt + 1e-6);
    super.updateCharger(e, dt);
  }
  _ai(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (!this._active()) return;
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt);
      if (e.kind === 'archer') { this.updateArcher(e, dt); continue; }
      if (e.kind === 'charger') { this.updateCharger(e, dt); continue; }
      if (e.boss) {
        const angry = e.hp <= e.maxHP * 0.5;
        if (angry && !e.angry) { e.angry = true; this._warn(); this._warn(); this.emit('boss-angry'); }
        e.cooldown -= dt;
        if (e.windup > 0) {
          e.windup = Math.max(0, e.windup - dt);
          if (!e.windup) {
            this.effects.push({ x: e.target.x, y: e.target.y, text: '💥', ttl: 0.4 });
            if (Math.hypot(p.x - e.target.x, p.y - e.target.y) < 105) this.hurt();
            const aim = Math.atan2(e.target.y-e.y, e.target.x-e.x), count = angry ? 5 : 3;
            for (let i=0;i<count && this.projectiles.length+this.shots.length<96;i++) {
              const a=aim+(i-(count-1)/2)*0.24, speed=210+this.power*8;
              this.projectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,ttl:3});
            }
            e.target = null; e.cooldown = angry ? 1.35 : 1.8;
          }
          continue;
        }
        if (e.cooldown <= 0) { e.windup = angry ? 1 : 1.15; e.target = { x: p.x, y: p.y }; this.emit('warning'); continue; }
      }
      if (e.recoil > 0) { e.recoil = Math.max(0, e.recoil - dt); continue; }
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (d > 26) { e.x += dx / d * e.speed * dt; e.y += dy / d * e.speed * dt; }
      if (d < (e.boss ? 45 : 30)) this.hurt();
    }
  }
  update(delta) {
    if (this._terminal() || this.paused || this.pendingLevels || !Number.isFinite(delta) || delta <= 0) return;
    const dt = Math.min(0.05, delta), p = this.player;
    this.time += dt;
    for (const k of ['invincible', 'dash', 'dashCD', 'attackCD', 'swing']) p[k] = Math.max(0, p[k] - dt);
    const sprint = p.dash > 0, speed = sprint ? 560 : 180 + this.boons.swift * 8;
    const dx = sprint && !this.input.x && !this.input.y ? p.facing : this.input.x;
    p.x = Math.max(30, Math.min(870, p.x + dx * speed * dt));
    p.y = Math.max(45, Math.min(475, p.y + this.input.y * speed * dt));
    if (this.input.x) p.facing = this.input.x > 0 ? 1 : -1;
    this.effects.forEach(e => e.ttl -= dt); this.effects = this.effects.filter(e => e.ttl > 0);
    if (this.phase === 'chest') return;
    if (this.phase === 'fight') {
      this.waveTime += dt; this.waveRemaining = Math.max(0, this._duration - this.waveTime);
      this._learningRoute(dt);
      if (this.waveRemaining < 1e-9 && this.waveKills >= this.waveGoal && (!this.rescue || this.rescue.done)) { this._chest(); return; }
    }
    if (this.phase === 'fight' || this.phase === 'boss') this._spawns(dt);
    this._ai(dt);
    if (!this._active()) { this._limits(); return; }
    this.updateProjectiles(dt); this._limits();
    if (this._terminal()) this._clearCombat(); // The inherited projectile filter may finish after hurt().
    if (!this._active()) return;
    this._weapons(dt);
    if (this._active()) this._shots(dt);
    if (this._active()) this._fields(dt);
    if (this._active()) {
      const drops = this.drops; this.drops = [];
      for (const d of drops) {
        if (Math.hypot(d.x - p.x, d.y - p.y) <= 55) this._collect(d); else this.drops.push(d);
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead); this._limits();
  }
}
