// Deterministic balance probe, not a model of a child's skill.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = ['data.js', 'battle-engine.js', 'swarm-engine.js']
  .map(f => fs.readFileSync(path.join(__dirname, '../english/js', f), 'utf8')).join('\n');
const script = new vm.Script(source + '\nthis.Engine=SwarmEngine;');

function simulate({ seed=1, power=1, owned=false, available, style='circle', start='seed', learningRoute=false }={}) {
  let n=seed;
  const rng=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  const ctx=vm.createContext({Math});script.runInContext(ctx);
  const g=new ctx.Engine({id:power,power,learningRoute},rng);
  available ||= owned?['seed','blade','fire','bomb']:['seed'];
  g.configureLoadout({available,start,bladeLevel:1});
  let minHP=6, shots=0;
  for(let i=0;i<8000&&!['won','lost'].includes(g.phase);i++) {
    while(g.pendingLevels) {
      const opts=g.upgradeChoices();
      const priority=available.length>1?['fire','bomb','seed','blade','power','heart','swift']:['seed','power','heart','swift'];
      g.chooseUpgrade(priority.find(id=>opts.some(c=>c.id===id)));
    }
    if(g.phase==='chest') {
      const opts=g.evolutionChoices();if(opts.length)g.grantBoon(opts[0].id);
      g.forge('cat');
    }
    if(g.phase==='won') break;
    const p=g.player,a=Math.PI+g.time*.7;
    if(style==='still') g.move(0,0);
    else if(style==='circle') g.move(450+250*Math.cos(a)-p.x,260+140*Math.sin(a)-p.y);
    else if(style==='route') {
      const goal=g.rescue?.active&&!g.rescue.done?g.rescue:{x:450+250*Math.cos(a),y:260+140*Math.sin(a)};
      const distance=Math.hypot(goal.x-p.x,goal.y-p.y);
      g.move(distance<40?0:goal.x-p.x,distance<40?0:goal.y-p.y);
    }
    else {
      // Follow visible drops, then choose a safe direction using short predictions.
      const drops=g.drops.filter(d=>d.kind!=='heart'||p.hp<p.maxHP);
      const goal=(g.rescue?.active&&!g.rescue.done?g.rescue:null)||drops.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]
        || {x:450+250*Math.cos(a),y:260+140*Math.sin(a)};
      let best, bestScore=-Infinity;
      for(let k=0;k<16;k++) {
        const angle=k*Math.PI/8,dx=Math.cos(angle),dy=Math.sin(angle);
        const x=p.x+dx*90,y=p.y+dy*90;
        let score=-Math.hypot(x-goal.x,y-goal.y)*.03;
        if(x<55||x>845||y<65||y>455)score-=30;
        for(const e of g.enemies) {
          const d=Math.hypot(x-e.x,y-e.y);
          score-=Math.max(0,100-d)*.4;
          if(e.target)score-=Math.max(0,130-Math.hypot(x-e.target.x,y-e.target.y))*.6;
          if(e.chargeAim&&e.chargeWindup>0)score-=Math.max(0,65-g.constructor._segment(e.x,e.y,e.chargeAim.x,e.chargeAim.y,{x,y}))*.3;
        }
        for(const s of g.projectiles)score-=Math.max(0,65-g.constructor._segment(s.x,s.y,s.x+s.vx*.6,s.y+s.vy*.6,{x,y}))*.5;
        if(score>bestScore){bestScore=score;best={dx,dy};}
      }
      g.move(best.dx,best.dy);
      const close=g.enemies.filter(e=>Math.hypot(e.x-p.x,e.y-p.y)<190);
      if(g.specialCharge===100&&(close.length>=5||close.some(e=>e.boss)||p.hp<=2&&close.length>=2))g.special();
      if(!p.invincible&&g.enemies.some(e=>e.target&&e.windup<.3&&Math.hypot(e.target.x-p.x,e.target.y-p.y)<110))g.dash();
    }
    g.update(.05);minHP=Math.min(minHP,p.hp);
    shots=Math.max(shots,g.projectiles.length);g.events=[];
  }
  return {won:g.phase==='won',phase:g.phase,wave:g.wave,time:+g.time.toFixed(1),hp:g.player.hp,minHP,kills:g.kills,xp:g.xp,level:g.level,shots};
}
module.exports={simulate};
if(require.main===module) {
  for(const power of [1,3,5])for(const style of ['circle','active']) {
    const runs=Array.from({length:8},(_,i)=>simulate({seed:i+1,power,style,owned:power>1,start:power>1?'blade':'seed'}));
    console.log(JSON.stringify({power,style,wins:runs.filter(r=>r.won).length,runs}));
  }
}
