'use strict';

// Action simulation, independent of DOM/audio: also used by node regression tests.
class AdventureEngine {
  constructor(stage, rng = Math.random) {
    this.stage = stage; this.rng = rng; this.width = 900; this.height = 520;
    this.player = { x: 190, y: 260, hp: 6, maxHP: 6, facing: 1, invincible: 0, dash: 0, dashCD: 0, attackCD: 0, swing: 0 };
    this.input = { x: 0, y: 0, attack: false };
    this.enemies = []; this.projectiles = []; this.drops = []; this.effects = []; this.events = [];
    this.vents = [];
    this.phase = 'fight'; this.wave = 0; this.xp = 0; this.level = 1; this.kills = 0;
    this.spells = { cat: 0, bed: 0, dog: 0 }; this.shield = 0; this.time = 0;
    // 용암은 숲 뒤를 이어야 하므로 난이도 기준값을 지역 번호와 따로 둔다
    this.power = stage.power || stage.id;
    this.lava = stage.world === 'lava';
    this.bossDown = false;
    this.nextWave();
  }
  emit(type, extra = {}) { this.events.push({ type, ...extra }); }
  nextWave() {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.wave++; this.phase = this.wave >= this.stage.waves ? 'boss' : 'fight';
    this.enemies = []; this.projectiles = []; this.drops = [];
    const count = this.phase === 'boss' ? 1 : this.stage.perWave + this.wave - 1;
    const power = this.power;
    for (let i = 0; i < count; i++) {
      const boss = this.phase === 'boss';
      // 2단계는 한 마리, 3단계부터 두 마리까지. 첫 사격은 시차를 둔다.
      const archer = !boss && power >= 2 && i < (power >= 3 ? 2 : 1);
      const charger = !boss && power >= 3 && i === 2;
      this.enemies.push({ x: 580 + this.rng() * 250, y: 90 + this.rng() * 330,
        hp: boss ? 18 + power * 4 : charger ? 4 : 2 + (power >= 4 ? 1 : 0),
        maxHP: boss ? 18 + power * 4 : charger ? 4 : 2 + (power >= 4 ? 1 : 0),
        speed: boss ? 46 : charger ? 34 : 44 + power * 7 + this.rng() * 16,
        boss, kind: boss ? 'boss' : archer ? 'archer' : charger ? 'charger' : 'moss',
        chargeAim: null, chargeWindup: 0, chargeTime: 0, chargeCD: 2.4, recovery: 0,
        aim: null, shootWindup: 0, shootCD: 1.5 + i * 1.2,
        windup: 0, cooldown: boss ? 1.8 : 0, target: null, flash: 0, recoil: 0,
        color: ['#65cfaf', '#bc98e8', '#f1ac7b'][i % 3], dead: false });
    }
    this.spawnVents();
    this.emit(this.phase === 'boss' ? 'boss' : 'wave', { wave: this.wave });
  }
  // 용암 분출구: 예고를 보고 피하면 맞지 않는다.
  // 입구(왼쪽)와 문장 상자 자리(가운데)에는 놓지 않아 안전 지점을 남긴다.
  spawnVents() {
    this.vents = [];
    if (!this.lava) return;
    for (let i = 0; i < (this.stage.vents || 2); i++) {
      let spot = null;
      for (let tries = 0; tries < 8 && !spot; tries++) {
        const x = 330 + this.rng() * 500, y = 80 + this.rng() * 350;
        if (Math.hypot(x - 450, y - 260) > 145) spot = { x, y };
      }
      if (spot) this.vents.push({ x: spot.x, y: spot.y, r: 58, state: 'idle', t: 1.2 + this.rng() * 2.4 });
    }
  }
  updateVents(dt) {
    for (const v of this.vents) {
      v.t -= dt;
      if (v.t > 0) continue;
      if (v.state === 'idle') { v.state = 'warn'; v.t = 1.1; this.emit('vent-warn'); }
      else if (v.state === 'warn') {
        v.state = 'erupt'; v.t = 0.5; this.emit('vent');
        // 터지는 순간에만 판정한다. 예고를 보고 비켰으면 안전하다.
        if (Math.hypot(this.player.x - v.x, this.player.y - v.y) < v.r) this.hurt();
      }
      else if (v.state === 'erupt') { v.state = 'cool'; v.t = 1.5; }
      else { v.state = 'idle'; v.t = 1.4 + this.rng() * 2.2; }
    }
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
      // 방패 아이템: 주우면 공격을 한 번 막아 준다
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
    const recipe = RECIPES.find(r => r.word === word);
    if (recipe?.spell) return recipe.spell;
    if (['cat','dog','pig','fox','cow','hen'].includes(word)) return word === 'dog' ? 'dog' : 'cat';
    if (['bed','cup'].includes(word)) return 'bed';
    return 'dog';
  }
  // 보스만 잡고 나간 아이가 다시 들어오면 마지막 문장 상자부터 시작한다.
  // 보스를 또 잡게 만들지 않는다.
  resumeBossChest() {
    if (!this.lava) return false;
    this.wave = this.stage.waves; this.phase = 'chest'; this.bossDown = true;
    this.enemies = []; this.projectiles = []; this.vents = [];
    this.emit('chest', { boss: true, resumed: true });
    return true;
  }
  // 용암 마지막 문장 상자를 풀면 여기서 구역이 끝난다
  finish() {
    if (this.phase === 'won' || this.phase === 'lost') return false;
    this.phase = 'won'; this.emit('won'); return true;
  }
  forge(word) {
    if (this.phase !== 'chest' || typeof word !== 'string' || !word) return false;
    this.spells[AdventureEngine.spellOf(word)]++;
    this.nextWave(); return true;
  }
  updateArcher(e, dt) {
    const p = this.player;
    if (e.recoil > 0) {
      e.recoil = Math.max(0, e.recoil - dt);
      // 근접 공격을 맞히면 준비 중인 사격을 끊을 수 있다.
      e.aim = null; e.shootWindup = 0; e.shootCD = Math.max(e.shootCD, 0.8);
      return;
    }
    if (e.shootWindup > 0) {
      e.shootWindup = Math.max(0, e.shootWindup - dt);
      if (!e.shootWindup) {
        const dx = e.aim.x-e.x, dy = e.aim.y-e.y, len = Math.hypot(dx,dy)||1;
        const speed = 185 + this.power * 10;
        this.projectiles.push({x:e.x, y:e.y, vx:dx/len*speed, vy:dy/len*speed, ttl:5});
        e.aim = null; e.shootCD = 2.6;
        this.emit('arrow');
      }
      return;
    }
    const dx=p.x-e.x, dy=p.y-e.y, len=Math.hypot(dx,dy)||1;
    // 너무 가까우면 천천히 물러나고, 멀면 사정거리로 접근한다.
    const direction=len<145 ? -0.55 : len>300 ? 0.65 : 0;
    e.x=Math.max(45,Math.min(855,e.x+dx/len*e.speed*direction*dt));
    e.y=Math.max(60,Math.min(460,e.y+dy/len*e.speed*direction*dt));
    e.shootCD-=dt;
    if(e.shootCD<=0) {
      e.aim={x:p.x,y:p.y}; e.shootWindup=0.95;
      this.emit('aim');
    }
  }
  updateCharger(e, dt) {
    const p=this.player;
    if(e.recoil>0) {
      e.recoil=Math.max(0,e.recoil-dt);
      e.chargeWindup=0;e.chargeTime=0;e.chargeAim=null;
      e.recovery=0.8;e.chargeCD=1.5;
      return;
    }
    if(e.recovery>0) { e.recovery=Math.max(0,e.recovery-dt); return; }
    if(e.chargeWindup>0) {
      e.chargeWindup=Math.max(0,e.chargeWindup-dt);
      if(!e.chargeWindup) {
        const dx=e.chargeAim.x-e.x,dy=e.chargeAim.y-e.y,len=Math.hypot(dx,dy)||1;
        e.chargeVX=dx/len*320;e.chargeVY=dy/len*320;e.chargeTime=0.75;
      }
      return;
    }
    if(e.chargeTime>0) {
      const x=e.x,y=e.y,step=Math.min(dt,e.chargeTime);
      const nx=x+e.chargeVX*step,ny=y+e.chargeVY*step;
      e.x=Math.max(45,Math.min(855,nx));e.y=Math.max(60,Math.min(460,ny));
      const dx=e.x-x,dy=e.y-y;
      const t=Math.max(0,Math.min(1,((p.x-x)*dx+(p.y-y)*dy)/(dx*dx+dy*dy||1)));
      if(Math.hypot(x+dx*t-p.x,y+dy*t-p.y)<32) this.hurt();
      e.chargeTime=Math.max(0,e.chargeTime-dt);
      if(!e.chargeTime || e.x!==nx || e.y!==ny) {
        e.chargeTime=0;e.chargeAim=null;e.recovery=1.2;e.chargeCD=2;
      }
      return;
    }
    const dx=p.x-e.x,dy=p.y-e.y,distance=Math.hypot(dx,dy)||1;
    e.chargeCD=Math.max(0,e.chargeCD-dt);
    if(e.chargeCD===0 && distance<330) {
      e.chargeAim={x:p.x,y:p.y};e.chargeWindup=1;
      return;
    }
    if(distance>36) {
      e.x=Math.max(45,Math.min(855,e.x+dx/distance*e.speed*dt));
      e.y=Math.max(60,Math.min(460,e.y+dy/distance*e.speed*dt));
    }
    if(distance<33) this.hurt();
  }
  updateProjectiles(dt) {
    const p=this.player;
    this.projectiles=this.projectiles.filter(a=>{
      const x=a.x,y=a.y;
      a.x+=a.vx*dt; a.y+=a.vy*dt; a.ttl-=dt;
      // 선분 충돌: 낮은 프레임에서도 화살이 플레이어를 관통하지 않는다.
      const dx=a.x-x,dy=a.y-y;
      const t=Math.max(0,Math.min(1,((p.x-x)*dx+(p.y-y)*dy)/(dx*dx+dy*dy||1)));
      if(Math.hypot(x+dx*t-p.x,y+dy*t-p.y)<20) { this.hurt(); return false; }
      return a.ttl>0 && a.x>15 && a.x<885 && a.y>25 && a.y<495;
    });
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
    if (this.lava && ['fight','boss'].includes(this.phase)) this.updateVents(dt);
    for (const e of this.enemies) {
      if (e.dead || this.phase === 'lost') continue;
      e.flash=Math.max(0,e.flash-dt);
      if (e.kind === 'charger') { this.updateCharger(e,dt); continue; }
      if (e.kind === 'archer') { this.updateArcher(e,dt); continue; }
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
    if(this.enemies.length && this.phase!=='lost') this.updateProjectiles(dt);
    else this.projectiles=[];
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
      // 용암은 보스를 잡아도 바로 끝나지 않는다: 마지막 문장 상자를 풀어야 구역이 끝난다
      if (this.phase==='boss' && this.lava) { this.bossDown=true; this.vents=[]; this.phase='chest'; this.emit('chest',{ boss:true }); }
      else if (this.phase==='boss') { this.phase='won'; this.emit('won'); }
      else { this.phase='chest'; this.emit('chest'); }
    }
  }
}
