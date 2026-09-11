'use strict';

// ---------- 오디오 컨텍스트 (효과음과 발음 파일 재생에 같이 사용) ----------
let audioCtx = null;

function ac() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// ---------- 기기 음성 (발음 파일을 못 불러올 때만 대신 사용) ----------

// 맥의 장난감·효과 음성과 기계음이 강한 음성은 발음 학습에 맞지 않아 제외
const NOVELTY_VOICES = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Eddy|Flo|Fred|Good News|Grandma|Grandpa|Jester|Junior|Kathy|Organ|Ralph|Reed|Rocko|Sandy|Shelley|Superstar|Trinoids|Whisper|Wobble|Zarvox)\b/i;
const NATURAL_NAMES = /\b(Samantha|Ava|Allison|Susan|Zoe|Nicky|Evan|Tom|Aaron|Nathan|Joelle|Noelle|Aria|Jenny|Guy|Zira|Daniel|Serena|Kate|Oliver)\b/i;

function voiceScore(v) {
  let score = 0;
  if (/en[-_]US/i.test(v.lang)) score += 20;
  else if (/en[-_]GB/i.test(v.lang)) score += 10;
  if (/google/i.test(v.name)) score += 30;
  if (/natural|neural|online|premium|enhanced/i.test(v.name)) score += 40;
  if (NATURAL_NAMES.test(v.name)) score += 15;
  return score;
}

const tts = {
  voice: null,

  pickVoice() {
    const en = speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang) && !NOVELTY_VOICES.test(v.name));
    this.voice = en.sort((a, b) => voiceScore(b) - voiceScore(a))[0] || null;
  },

  speak(text) {
    return new Promise(resolve => {
      if (!('speechSynthesis' in window)) return resolve();
      this.stop();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      if (this.voice) u.voice = this.voice;
      let done = false;
      // 음성 엔진이 멈춰서 onend가 안 올 때를 대비한 타임아웃
      const timer = setTimeout(() => finish(), 1200 + text.length * 150);
      function finish() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      }
      u.onend = finish;
      u.onerror = finish;
      speechSynthesis.speak(u);
    });
  },

  // cancel()을 자주 부르면 Chrome 음성 엔진이 멈추는 경우가 있어, 말하는 중일 때만 호출
  stop() {
    if ('speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
  },
};

if ('speechSynthesis' in window) {
  tts.pickVoice();
  speechSynthesis.onvoiceschanged = () => tts.pickVoice();
}

// ---------- 영어 발음: 미리 만든 파일 재생 (tools/make_audio.py로 생성) ----------
const PHRASE_FILES = { "Let's go!": 'lets-go', 'Great job!': 'great-job' };
const WORD_SET = new Set(Object.values(LETTERS).map(d => d.word));

const speech = {
  clips: new Map(), // url → Promise<AudioBuffer | null>
  source: null,
  token: 0,

  urlFor(text) {
    if (/^[A-Z]$/.test(text)) return `audio/letters/${text}.m4a`;
    if (WORD_SET.has(text)) return `audio/words/${text}.m4a`;
    if (PHRASE_FILES[text]) return `audio/phrases/${PHRASE_FILES[text]}.m4a`;
    return null;
  },

  load(url) {
    if (!this.clips.has(url)) {
      this.clips.set(url, (async () => {
        try {
          const a = ac();
          // 발음 파일을 다시 만들었을 때 예전 파일이 캐시에서 나오지 않도록 매번 서버에 확인
          const res = await fetch(url, { cache: 'no-cache' });
          if (!a || !res.ok) return null;
          return await a.decodeAudioData(await res.arrayBuffer());
        } catch (e) {
          return null;
        }
      })());
    }
    return this.clips.get(url);
  },

  // 시작 버튼을 누를 때 미리 불러와서 첫 소리가 늦지 않게 함
  preload() {
    Object.entries(LETTERS).forEach(([letter, d]) => {
      this.load(this.urlFor(letter));
      this.load(this.urlFor(d.word));
    });
    Object.keys(PHRASE_FILES).forEach(text => this.load(this.urlFor(text)));
  },

  stop() {
    this.token++;
    if (this.source) {
      try { this.source.stop(); } catch (e) { /* 이미 끝남 */ }
      this.source = null;
    }
    tts.stop();
  },

  async say(text) {
    this.stop();
    const tok = this.token;
    const url = this.urlFor(text);
    const buffer = url ? await this.load(url) : null;
    if (tok !== this.token) return;
    if (!buffer) return tts.speak(text);

    const a = ac();
    return new Promise(resolve => {
      const src = a.createBufferSource();
      src.buffer = buffer;
      src.connect(a.destination);
      const timer = setTimeout(done, buffer.duration * 1000 + 500);
      function done() {
        clearTimeout(timer);
        resolve();
      }
      src.onended = () => {
        if (this.source === src) this.source = null;
        done();
      };
      this.source = src;
      src.start();
    });
  },
};

// ---------- 효과음 (Web Audio로 직접 합성, 파일 없음) ----------
function tone(freq, dur, { type = 'square', vol = 0.06, at = 0, to } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.4, freq = 1200, at = 0 } = {}) {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const gain = a.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(a.currentTime + at);
}

const sfx = {
  hit()     { noise(0.09, { vol: 0.5 }); tone(140, 0.07); },
  pop()     { [660, 880, 1320].forEach((f, i) => tone(f, 0.09, { vol: 0.05, at: i * 0.06 })); },
  bonk()    { tone(200, 0.18, { vol: 0.07, to: 110 }); },
  click()   { tone(600, 0.04, { vol: 0.04 }); },
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { vol: 0.06, at: i * 0.12 }));
    tone(1047, 0.45, { vol: 0.05, at: 0.5 });
  },
};
