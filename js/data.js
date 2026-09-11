'use strict';

// 알파벳별 예시 단어 (첫소리 위주, 그림은 이모지)
const LETTERS = {
  A: { word: 'apple',    emoji: '🍎' },
  B: { word: 'bear',     emoji: '🐻' },
  C: { word: 'cat',      emoji: '🐱' },
  D: { word: 'dog',      emoji: '🐶' },
  E: { word: 'egg',      emoji: '🥚' },
  F: { word: 'fish',     emoji: '🐟' },
  G: { word: 'grapes',   emoji: '🍇' },
  H: { word: 'hat',      emoji: '🎩' },
  I: { word: 'insect',   emoji: '🐛' },
  J: { word: 'juice',    emoji: '🧃' },
  K: { word: 'kite',     emoji: '🪁' },
  L: { word: 'lion',     emoji: '🦁' },
  M: { word: 'moon',     emoji: '🌙' },
  N: { word: 'nose',     emoji: '👃' },
  O: { word: 'octopus',  emoji: '🐙' },
  P: { word: 'pig',      emoji: '🐷' },
  Q: { word: 'queen',    emoji: '👸' },
  R: { word: 'rabbit',   emoji: '🐰' },
  S: { word: 'sun',      emoji: '☀️' },
  T: { word: 'tiger',    emoji: '🐯' },
  U: { word: 'umbrella', emoji: '☂️' },
  V: { word: 'violin',   emoji: '🎻' },
  W: { word: 'whale',    emoji: '🐳' },
  X: { word: 'fox',      emoji: '🦊' },
  Y: { word: 'yo-yo',    emoji: '🪀' },
  Z: { word: 'zebra',    emoji: '🦓' },
};

// 광산 단계: 블록 종류(kinds)는 무작위로 섞여 나옴
const STAGES = [
  { id: 1, name: '풀밭 광산',   letters: ['A', 'B', 'C', 'D', 'E'],      icon: 'grass',             kinds: ['grass', 'grass', 'grass', 'dirt'] },
  { id: 2, name: '흙 동굴',     letters: ['F', 'G', 'H', 'I', 'J'],      icon: 'dirt',              kinds: ['dirt', 'dirt', 'stone', 'sand'] },
  { id: 3, name: '돌 동굴',     letters: ['K', 'L', 'M', 'N', 'O'],      icon: 'ore:gold',          kinds: ['stone', 'stone', 'stone', 'ore:gold', 'ore:emerald'] },
  { id: 4, name: '깊은 동굴',   letters: ['P', 'Q', 'R', 'S', 'T'],      icon: 'ore:redstone:deep', kinds: ['deep', 'deep', 'ore:redstone:deep', 'ore:lapis:deep'] },
  { id: 5, name: '다이아 광산', letters: ['U', 'V', 'W', 'X', 'Y', 'Z'], icon: 'ore:diamond:deep',  kinds: ['deep', 'ore:diamond:deep', 'ore:diamond:deep', 'ore:emerald:deep'] },
];

// 8x8 픽셀 얼굴: h 머리, s 피부, w 눈 흰자, p 눈동자, m 입
const AVATAR_PATTERN = [
  'hhhhhhhh',
  'hhhhhhhh',
  'hssssssh',
  'ssssssss',
  'swpsspws',
  'ssssssss',
  'ssmmmmss',
  'ssssssss',
];

const AVATARS = [
  { h: '#5a3825', s: '#e0a67c', w: '#ffffff', p: '#3b5bdb', m: '#9c5a3c' },
  { h: '#e6c14a', s: '#f2c7a0', w: '#ffffff', p: '#2f9e44', m: '#b0704a' },
  { h: '#222222', s: '#c68b5f', w: '#ffffff', p: '#5c3a1e', m: '#7a4a2a' },
  { h: '#c2410c', s: '#f5cfb0', w: '#ffffff', p: '#7048e8', m: '#c47b58' },
  { h: '#4e9a2f', s: '#7ed957', w: '#2b5e1a', p: '#12300a', m: '#3f7f25' },
  { h: '#868e96', s: '#ced4da', w: '#212529', p: '#ff6b6b', m: '#495057' },
];

const PRAISE = ['좋아요! ⛏️', '대단해요! ✨', '정답이에요! 💎', '멋져요! 🎉', '최고예요! 👍'];
