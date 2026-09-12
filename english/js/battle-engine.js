'use strict';

// Action simulation, independent of DOM/audio: also used by node regression tests.
class AdventureEngine {
  constructor(stage, rng = Math.random) {
    this.stage = stage; this.rng = rng; this.width = 900; this.height = 520;
    this.player = { x: 190, y: 260, hp: 6, maxHP: 6, facing: 1, invincible: 0, dash: 0, dashCD: 0, attackCD: 0, swing: 0 };
    this.input = { x: 0, y: 0, attack: false };
    this.enemies = []; this.drops = []; this.effects = []; this.events = [];
    this.phase = 'fight'; this.wave = 0; this.xp = 0; this.level = 1; this.kills = 0;
    this.spells = { cat: 0, bed: 0, dog: 0 }; this.shield = 0; this.time = 0;
    this.nextWave();
  }
  emit(type, extra = {}) { this.events.push({ type, ...extra }); }
  nextWave() {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.wave++; this.phase = this.wave >= this.stage.waves ? 'boss' : 'fight';
    this.enemies = []; this.drops = [];
    const count = this.phase === 'boss' ? 1 : this.stage.perWave + this.wave - 1;
    for (let i = 0; i < count; i++) {
      const boss = this.phase === 'boss';
      this.enemies.push({ x: 580 + this.rng() * 250, y: 90 + this.rng() * 330,
        hp: boss ? 18 + this.stage.id * 4 : 2 + (this.stage.id >= 4 ? 1 : 0),
        maxHP: boss ? 18 + this.stage.id * 4 : 2 + (this.stage.id >= 4 ? 1 : 0),
        speed: boss ? 46 : 44 + this.stage.id * 7 + this.rng() * 16,
        boss, windup: 0, cooldown: boss ? 1.8 : 0, target: null, flash: 0, recoil: 0,
        color: ['#65cfaf', '#bc98e8', '#f1ac7b'][i % 3], dead: false });
    }
    this.emit(this.phase === 'boss' ? 'boss' : 'wave', { wave: this.wave });
  }
  move(x, y) { const length = Math.hypot(x, y); this.input.x = length > 1 ? x / length : x; this.input.y = length > 1 ? y / length : y; }
  attack() {
    if (!['fight', 'boss'].includes(this.phase) || this.player.attackCD > 0) return false;
    this.player.attackCD = 0.42; this.player.swing = 0.2;
    // 검 사거리를 좁혀서 바짝 붙어야 벨 수 있게 한다 (서서 휘두르기만 하면 안 되도록)
    const target = this.enemies.filter(e => !e.dead && Math.hypot(e.x - this.player.x, e.y - this.player.y) < (e.boss ? 78 : 60))
      .sort((a, b) => Math.hypot(a.x-this.player.x, a.y-this.player.y) - Math.hypot(b.x-this.player.x,b.y-this.player.y))[0];
    if (target) {
      this.player.facing = target.x >= this.player.x ? 1 : -1;
      this.hitEnemy(target, this.level >= 3 ? 2 : 1);
    }
    this.emit('swing'); return true;
  }
  dash() {
    const p = this.player;
    if (!['fight','boss'].includes(this.phase) || p.dashCD > 0) return false;
    p.dash = 0.19; p.dashCD = 1.8; p.invincible = Math.max(p.invincible, 0.32);
    this.emit('dash'); return true;
  }
  hitEnemy(e, damage) {
    if (e.dead) return;
    e.hp -= damage; e.flash = 0.16;
    const dx = e.x - this.player.x, dy = e.y - this.player.y, len = Math.hypot(dx,dy) || 1;
    // 넉백을 짧게: 사거리를 좁혔기 때문에 크게 밀려나면 이어서 벨 수 없다
    if (!e.boss) { e.x = Math.max(30, Math.min(870, e.x + dx/len*6)); e.y = Math.max(45, Math.min(475,e.y+dy/len*6)); }
    this.effects.push({ x:e.x, y:e.y-25, text:'−'+damage, ttl:0.5 });
    this.emit('hit');
    if (!e.boss) e.recoil = 0.18; // 맞으면 잠깐 주춤했다가 더 빠르게 달려든다
    if (e.hp <= 0) {
      e.dead = true; this.kills++;
      this.drops.push({ x:e.x, y:e.y, kind:'gem' });
      if (this.kills % 4 === 0) this.drops.push({ x:e.x+20, y:e.y, kind:'heart' });
      // 방패 아이템: 주우면 공격을 3번 막아 준다
      if (this.kills % 3 === 0 || e.boss) this.drops.push({ x:e.x-20, y:e.y, kind:'shield' });
      this.emit('defeat', { boss:e.boss });
    }
  }
  hurt() {
    if (this.player.invincible > 0 || ['won','lost'].includes(this.phase)) return;
    if (this.shield) { this.shield--; this.emit('shield'); }
    else { this.player.hp--; this.emit('hurt'); }
    this.player.invincible = 1;
    if (this.player.hp <= 0) { this.phase = 'lost'; this.emit('lost'); }
  }
  cast(word) {
    if (!['fight','boss'].includes(this.phase) || !(this.spells[word] > 0)) return false;
    if (word === 'bed' && this.player.hp === this.player.maxHP) return false;
    this.spells[word]--;
    if (word === 'bed') this.player.hp = Math.min(this.player.maxHP, this.player.hp + 3);
    if (word === 'dog') this.shield += 2;
    if (word === 'cat') this.enemies.filter(e=>!e.dead).forEach(e=>this.hitEnemy(e,2));
    this.effects.push({ x:this.player.x, y:this.player.y-45, text:word, ttl:0.9 });
    this.emit('magic', { word }); return true;
  }
  // 작업대에서 만든 어떤 낱말이든 마법이 된다: 동물=공격(cat), 쉬는 물건=회복(bed), 나머지=보호(dog)
  static spellOf(word) {
    if (['cat','dog','pig','fox','cow','hen'].includes(word)) return word === 'dog' ? 'dog' : 'cat';
    if (['bed','cup'].includes(word)) return 'bed';
    return 'dog';
  }
  forge(word) {
    if (this.phase !== 'chest' || typeof word !== 'string' || !word) return false;
    this.spells[AdventureEngine.spellOf(word)]++;
    this.nextWave(); return true;
  }
  update(delta) {
    if (['won','lost'].includes(this.phase)) return;
    const dt = Math.min(0.05, Math.max(0,delta)), p = this.player;
    this.time += dt;
    for (const k of ['invincible','dash','dashCD','attackCD','swing']) p[k]=Math.max(0,p[k]-dt);
    const sprint = p.dash > 0;
    const dx = sprint && !this.input.x && !this.input.y ? p.facing : this.input.x;
    p.x = Math.max(30, Math.min(870,p.x+dx*(sprint ? 560 : 180)*dt));
    p.y = Math.max(45, Math.min(475,p.y+this.input.y*(sprint ? 560 : 180)*dt));
    if (this.input.x) p.facing = this.input.x > 0 ? 1 : -1;
    if (this.input.attack) this.attack();
    for (const e of this.enemies) {
      if (e.dead || this.phase === 'lost') continue;
      e.flash=Math.max(0,e.flash-dt);
      if (e.boss) {
        e.cooldown -= dt;
        if (e.windup > 0) {
          e.windup -= dt;
          if (e.windup <= 0) {
            this.effects.push({ x:e.target.x,y:e.target.y,text:'💥',ttl:0.4 });
            if (Math.hypot(p.x-e.target.x,p.y-e.target.y)<105) this.hurt();
            e.target = null; e.cooldown = 1.7;
          }
          continue;
        }
        if (e.cooldown <= 0) { e.windup=1.15; e.target={x:p.x,y:p.y}; this.emit('warning'); continue; }
      }
      const ex=p.x-e.x, ey=p.y-e.y, distance=Math.hypot(ex,ey)||1;
      if (e.recoil > 0) {
        // 맞은 직후 제자리에서 잠깐 멈칫한다 (넉백으로 이미 밀려나 있으므로 더 물러나지는 않는다)
        e.recoil = Math.max(0, e.recoil - dt);
        if (e.recoil === 0) e.lunge = 1.1; // 멈칫이 끝나면 더 빠르게 달려든다
        continue;
      }
      // 물러났다 돌아올 때는 훨씬 빠르게 달려든다 (서서 기다리는 전법 차단)
      const rush = e.lunge > 0 ? 1.7 : 1;
      if (e.lunge > 0) e.lunge = Math.max(0, e.lunge - dt);
      if (distance > 26) { e.x+=ex/distance*e.speed*rush*dt; e.y+=ey/distance*e.speed*rush*dt; }
      if (distance < (e.boss ? 45 : 30)) this.hurt();
    }
    this.enemies=this.enemies.filter(e=>!e.dead);
    this.drops=this.drops.filter(d=>{
      if (Math.hypot(d.x-p.x,d.y-p.y)>48) return true;
      if (d.kind==='heart') p.hp=Math.min(p.maxHP,p.hp+1);
      // 방패 아이템은 겹쳐 쌓이지 않는다: 이미 방패가 있으면 그대로 둔다
      else if (d.kind==='shield') { if (this.shield < 1) { this.shield = 1; this.emit('shieldup'); } }
      else { this.xp++; const level=1+Math.floor(this.xp/3); if(level>this.level) { this.level=level; this.emit('level'); } }
      this.emit('pickup'); return false;
    });
    this.effects.forEach(e=>e.ttl-=dt); this.effects=this.effects.filter(e=>e.ttl>0);
    if (!this.enemies.length && ['fight','boss'].includes(this.phase)) {
      if (this.phase==='boss') { this.phase='won'; this.emit('won'); }
      else { this.phase='chest'; this.emit('chest'); }
    }
  }
}
