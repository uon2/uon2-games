'use strict';

// 16x16 픽셀 블록 텍스처를 캔버스로 직접 생성 (외부 이미지 없음)
const PAL = {
  stone:    ['#7f7f7f', '#8c8c8c', '#747474', '#969696', '#6a6a6a'],
  dirt:     ['#79553a', '#866043', '#6c4a31', '#94694a', '#5f412b'],
  grassTop: ['#5fa83b', '#6cbf45', '#54953a', '#77c94f'],
  deep:     ['#4b4b57', '#40404b', '#565663', '#393943', '#5e5e6b'],
  sand:     ['#dbd3a0', '#e5dcab', '#cfc690', '#d6cd98'],
  plank:    ['#a9773f', '#b8834a', '#96682f', '#c08d52'],
};

const ORES = {
  gold:     ['#f8d74a', '#e0b72f', '#fff3a0'],
  diamond:  ['#5fe3e0', '#3fc4c8', '#c9fffd'],
  emerald:  ['#41d66c', '#2aa352', '#a8f5bf'],
  redstone: ['#e33b3b', '#b02222', '#ff8a8a'],
  lapis:    ['#3659d9', '#233fa8', '#8aa2ff'],
};

function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function makeTexture(type, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const r = rng(seed);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const fill = pal => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, pick(pal)); };

  const [kind, ore, base] = type.split(':');
  if (kind === 'grass') {
    fill(PAL.dirt);
    for (let x = 0; x < 16; x++) {
      const depth = 3 + (r() < 0.45 ? 1 : 0) + (r() < 0.2 ? 1 : 0);
      for (let y = 0; y < depth; y++) px(x, y, pick(PAL.grassTop));
    }
  } else if (kind === 'plank') {
    fill(PAL.plank);
    for (const y of [3, 11]) for (let x = 0; x < 16; x++) px(x, y, '#6f4a22');
    for (let y = 4; y <= 10; y++) px(9, y, '#6f4a22');
    for (let y = 12; y <= 15; y++) px(4, y, '#6f4a22');
    for (let y = 0; y <= 2; y++) px(4, y, '#6f4a22');
  } else if (kind === 'ore') {
    fill(PAL[base || 'stone']);
    const clusters = 3 + Math.floor(r() * 2);
    for (let k = 0; k < clusters; k++) {
      let x = 1 + Math.floor(r() * 13);
      let y = 1 + Math.floor(r() * 13);
      const size = 2 + Math.floor(r() * 3);
      for (let j = 0; j < size; j++) {
        px(x, y, pick(ORES[ore]));
        x = Math.max(0, Math.min(15, x + Math.round(r() * 2 - 1)));
        y = Math.max(0, Math.min(15, y + Math.round(r() * 2 - 1)));
      }
    }
  } else {
    fill(PAL[kind]);
  }
  return c.toDataURL();
}

function makeCrack() {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const r = rng(4242);
  g.fillStyle = 'rgba(0,0,0,0.7)';
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([dx, dy]) => {
    let x = 8, y = 8;
    for (let i = 0; i < 8; i++) {
      g.fillRect(x, y, 1, 1);
      if (r() < 0.5) x += dx; else y += dy;
    }
  });
  return c.toDataURL();
}

const textureCache = {};
const VARIANTS = 4;

function textureURL(type) {
  if (!textureCache[type]) {
    textureCache[type] = Array.from({ length: VARIANTS }, (_, i) => makeTexture(type, 97 * (i + 1) + type.length * 31 + type.charCodeAt(0)));
  }
  const list = textureCache[type];
  return list[Math.floor(Math.random() * list.length)];
}

function colorsFor(type) {
  const [kind, ore, base] = type.split(':');
  if (kind === 'grass') return PAL.grassTop.concat(PAL.dirt);
  if (kind === 'ore') return PAL[base || 'stone'].concat(ORES[ore], ORES[ore]);
  return PAL[kind];
}
