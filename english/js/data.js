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

// 작업대 레시피: 글자 블록을 조합해 만드는 3글자 단어
// tier 1이 쉬운 단계, tier 2가 다음 단계
const RECIPES = [
  { word: 'cat', emoji: '🐱', ko: '고양이', group: '동물', tier: 1 },
  { word: 'dog', emoji: '🐶', ko: '강아지', group: '동물', tier: 1 },
  { word: 'pig', emoji: '🐷', ko: '돼지',   group: '동물', tier: 1 },
  { word: 'bed', emoji: '🛏️', ko: '침대',   group: '물건', tier: 1 },
  { word: 'cup', emoji: '🥤', ko: '컵',     group: '물건', tier: 1 },
  { word: 'box', emoji: '📦', ko: '상자',   group: '물건', tier: 1 },
  { word: 'fox', emoji: '🦊', ko: '여우',   group: '동물', tier: 2 },
  { word: 'cow', emoji: '🐮', ko: '소',     group: '동물', tier: 2 },
  { word: 'hen', emoji: '🐔', ko: '암탉',   group: '동물', tier: 2 },
  { word: 'hat', emoji: '🎩', ko: '모자',   group: '물건', tier: 2 },
  { word: 'bag', emoji: '🎒', ko: '가방',   group: '물건', tier: 2 },
  { word: 'bus', emoji: '🚌', ko: '버스',   group: '물건', tier: 2 },
];

// 광산 단계: 블록 종류(kinds)는 무작위로 섞여 나옴
const STAGES = [
  { id: 1, name: '풀밭 광산',   letters: ['A', 'B', 'C', 'D', 'E'],      icon: 'grass',             kinds: ['grass', 'grass', 'grass', 'dirt'] },
  { id: 2, name: '흙 동굴',     letters: ['F', 'G', 'H', 'I', 'J'],      icon: 'dirt',              kinds: ['dirt', 'dirt', 'stone', 'sand'] },
  { id: 3, name: '돌 동굴',     letters: ['K', 'L', 'M', 'N', 'O'],      icon: 'ore:gold',          kinds: ['stone', 'stone', 'stone', 'ore:gold', 'ore:emerald'] },
  { id: 4, name: '깊은 동굴',   letters: ['P', 'Q', 'R', 'S', 'T'],      icon: 'ore:redstone:deep', kinds: ['deep', 'deep', 'ore:redstone:deep', 'ore:lapis:deep'] },
  { id: 5, name: '다이아 광산', letters: ['U', 'V', 'W', 'X', 'Y', 'Z'], icon: 'ore:diamond:deep',  kinds: ['deep', 'ore:diamond:deep', 'ore:diamond:deep', 'ore:emerald:deep'] },
];

// 밤의 방어전: free가 false면 잠긴 밤 (나중에 결제로 열림)
// mode - letter: 글자 소리 듣고 글자 몬스터 때리기
//        initial: 글자 소리 듣고 그 소리로 시작하는 그림 몬스터 때리기
//        word: 낱말 소리 듣고 낱말 몬스터 때리기
const BATTLE_STAGES = [
  { id: 1, name: '첫 번째 밤', mode: 'letter',  letters: ['A', 'B', 'C', 'D', 'E'], waves: 3, perWave: 4, speed: 6.5, gap: 2.2, free: true },
  { id: 2, name: '두 번째 밤', mode: 'letter',  letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'], waves: 3, perWave: 5, speed: 7.5, gap: 2.0, free: true },
  { id: 3, name: '첫소리의 밤', mode: 'initial', letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], waves: 3, perWave: 4, speed: 7.0, gap: 2.2, free: true },
  { id: 4, name: '낱말의 밤', mode: 'word', tier: 1, waves: 3, perWave: 4, speed: 7.5, gap: 2.3, free: false },
  { id: 5, name: '깊은 밤',   mode: 'word', tier: 2, waves: 4, perWave: 5, speed: 8.5, gap: 2.0, free: false },
];

// 몬스터 생김새 (직접 고른 조합, 마인크래프트 캐릭터 아님)
const MONSTERS = ['👾', '🦇', '👻', '🕷️', '🧟'];

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
