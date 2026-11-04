'use strict';

// Shared progress for the workshop and adventures. Collection is not mastery.
class WordLearning {
  constructor(saved, recipes, rng = Math.random) {
    this.save = saved; this.recipes = recipes;
    this.rng = rng;
    this.store = saved.learning ||= { session: 0, words: {} };
    this.store.words ||= {};
    this.store.session = Math.max(0, Number(this.store.session) || 0);
  }
  stat(word) {
    if (!this.recipes.some(r => r.word === word)) return null;
    const legacy = this.save.craft?.made?.[word] || this.save.battle?.words?.[word];
    const r = this.store.words[word] ||= { introduced: !!legacy, tasks: {}, nextReview: 0, delayed: 0 };
    r.tasks ||= {};
    return r;
  }
  count(word, type) { return this.stat(word)?.tasks[type]?.solo || 0; }
  beginSession() { return ++this.store.session; }
  teach(word, session = this.store.session) {
    const r = this.stat(word); if (!r) return false;
    r.introduced = true; r.taughtIn = session; r.lastShownAt = Date.now(); r.nextReview = session + 1;
    return true;
  }
  record(word, type, helped, session = this.store.session, checkpoint = null) {
    const r = this.stat(word);
    if (!r || !['listen', 'meaning', 'reading', 'partial', 'spelling'].includes(type)) return false;
    this.store.completed ||= {};
    if(checkpoint && this.store.completed[checkpoint]) return false;
    if(checkpoint) {
      this.store.completed[checkpoint]=true;
      Object.keys(this.store.completed).slice(0,-200).forEach(key=>delete this.store.completed[key]);
    }
    const task = r.tasks[type] ||= { solo: 0, helped: 0 };
    task[helped ? 'helped' : 'solo']++;
    // A new session alone is not delayed recall if we just displayed the answer.
    if (!helped && r.introduced && session > (r.taughtIn ?? session)
        && session > (r.lastRecallSession ?? -1)) {
      r.recalledLater = (r.recalledLater || 0) + 1;
      // Re-entering immediately is a new run, not evidence of next-day retention.
      if(r.lastShownAt && Date.now()-r.lastShownAt>=20*60*60*1000) r.delayed = (r.delayed || 0) + 1;
    }
    if (r.taughtIn === undefined) r.taughtIn = session;
    if (helped) r.taughtIn = session;
    r.lastShownAt = Date.now();
    r.introduced = true; r.lastTask = type;
    if (!helped) r.lastRecallSession = session;
    r.nextReview = session + (helped ? 1 : r.delayed >= 2 ? 4 : 2);
    return true;
  }
  due(pool = this.recipes, session = this.store.session) {
    return pool.filter(r => this.stat(r.word).introduced && (this.stat(r.word).nextReview || 0) <= session)
      .sort((a, b) => (this.stat(a.word).nextReview || 0) - (this.stat(b.word).nextReview || 0));
  }
  beginRoute() {
    const session = this.beginSession(), pool = this.recipes;
    const fresh = pool.filter(r => !this.stat(r.word).introduced).slice(0, 2);
    const known = pool.filter(r => this.stat(r.word).introduced).sort((a,b) => {
      const x=this.stat(a.word), y=this.stat(b.word);
      const xd=(x.nextReview||0)<=session, yd=(y.nextReview||0)<=session;
      return Number(yd)-Number(xd) || (xd&&yd?(x.nextReview||0)-(y.nextReview||0):0)
        || (x.lastAssigned||0)-(y.lastAssigned||0);
    });
    // Two new words plus one review; with no new words, rotate three older ones.
    // The very first run has two taught words and one spaced repeat.
    const words=[...fresh,...known.slice(0,3-fresh.length)].map(r=>r.word);
    words.forEach(word=>{ this.stat(word).lastAssigned=session; });
    return { session, words };
  }
  validRoute(plan) {
    return plan && Number.isSafeInteger(plan.session) && plan.session > 0 && Array.isArray(plan.words)
      && [2,3].includes(plan.words.length) && new Set(plan.words).size === plan.words.length
      && plan.words.every(w => this.recipes.some(r => r.word === w));
  }
  spellingLevel(word) {
    // Old completions had no reliable task type. Retain them, but do not call them listening mastery.
    const partial = this.count(word, 'partial'), full = this.count(word, 'spelling');
    return full >= 2 ? 4 : partial >= 3 || full ? 3 : partial >= 1 ? 2 : 1;
  }
  recallType(word) {
    if (this.recognition(word) < 3 || this.count(word, 'reading') < 1) return 'reading';
    return this.count(word, 'partial') >= 2 ? 'spelling' : 'partial';
  }
  checkpointType(word, wave) {
    const last = this.stat(word).lastTask;
    // A word's position in the route must not lock it to the same exercise forever.
    if (last) return last === 'listen' ? this.recallType(word) : 'listen';
    return wave === 1 ? 'listen' : this.recallType(word);
  }
  recognition(word) { return ['listen','meaning','reading'].reduce((n,type)=>n+this.count(word,type),0); }
  shuffled(items) {
    const out=[...items];
    for(let i=out.length-1;i>0;i--) {
      const j=Math.floor(Math.max(0,Math.min(.999999,Number(this.rng())||0))*(i+1));
      [out[i],out[j]]=[out[j],out[i]];
    }
    return out;
  }
  choiceWords(word) {
    const target=this.recipes.find(r=>r.word===word);
    let pool=this.shuffled(this.recipes.filter(r=>r.word!==word && this.stat(r.word).introduced));
    const ready=this.recognition(word)>=3;
    if(ready) {
      // Familiar, confusable choices require noticing the whole word.
      const similarity=r=>(r.group===target.group?3:0)+[...r.word].filter((ch,i)=>ch===word[i]).length;
      pool.sort((a,b)=>similarity(b)-similarity(a));
    }
    return this.shuffled([word,...pool.slice(0,(ready?4:3)-1).map(r=>r.word)]);
  }
}

function wordLearning() { return new WordLearning(save, RECIPES); }
