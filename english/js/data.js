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
  { word: 'ant', emoji: '🐜', ko: '개미', group: '동물', tier: 1, spell: 'cat' },
  { word: 'bat', emoji: '🦇', ko: '박쥐', group: '동물', tier: 2, spell: 'cat' },
  { word: 'bee', emoji: '🐝', ko: '벌', group: '동물', tier: 2, spell: 'cat' },
  { word: 'owl', emoji: '🦉', ko: '부엉이', group: '동물', tier: 2, spell: 'cat' },
  { word: 'rat', emoji: '🐀', ko: '쥐', group: '동물', tier: 2, spell: 'cat' },
  { word: 'bug', emoji: '🐛', ko: '벌레', group: '동물', tier: 1, spell: 'cat' },
  { word: 'ram', emoji: '🐏', ko: '숫양', group: '동물', tier: 2, spell: 'cat' },
  { word: 'sun', emoji: '☀️', ko: '해', group: '자연', tier: 1, spell: 'dog' },
  { word: 'log', emoji: '🪵', ko: '통나무', group: '자연', tier: 2, spell: 'dog' },
  { word: 'net', emoji: '🥅', ko: '그물', group: '물건', tier: 2, spell: 'dog' },
  { word: 'pen', emoji: '🖊️', ko: '펜', group: '물건', tier: 1, spell: 'dog' },
  { word: 'key', emoji: '🔑', ko: '열쇠', group: '물건', tier: 2, spell: 'dog' },
  { word: 'car', emoji: '🚗', ko: '자동차', group: '물건', tier: 1, spell: 'dog' },
  { word: 'jam', emoji: '🫙', ko: '잼', group: '음식', tier: 1, spell: 'bed' },
  { word: 'map', emoji: '🗺️', ko: '지도', group: '물건', tier: 1, spell: 'dog' },
  { word: 'pot', emoji: '🍲', ko: '냄비', group: '물건', tier: 2, spell: 'bed' },
  { word: 'toy', emoji: '🧸', ko: '장난감', group: '물건', tier: 1, spell: 'dog' },
  { word: 'egg', emoji: '🥚', ko: '달걀', group: '음식', tier: 1, spell: 'bed' },
];

// 광산 단계: 블록 종류(kinds)는 무작위로 섞여 나옴
const STAGES = [
  { id: 1, name: '풀밭 광산',   letters: ['A', 'B', 'C', 'D', 'E'],      icon: 'grass',             kinds: ['grass', 'grass', 'grass', 'dirt'] },
  { id: 2, name: '흙 동굴',     letters: ['F', 'G', 'H', 'I', 'J'],      icon: 'dirt',              kinds: ['dirt', 'dirt', 'stone', 'sand'] },
  { id: 3, name: '돌 동굴',     letters: ['K', 'L', 'M', 'N', 'O'],      icon: 'ore:gold',          kinds: ['stone', 'stone', 'stone', 'ore:gold', 'ore:emerald'] },
  { id: 4, name: '깊은 동굴',   letters: ['P', 'Q', 'R', 'S', 'T'],      icon: 'ore:redstone:deep', kinds: ['deep', 'deep', 'ore:redstone:deep', 'ore:lapis:deep'] },
  { id: 5, name: '다이아 광산', letters: ['U', 'V', 'W', 'X', 'Y', 'Z'], icon: 'ore:diamond:deep',  kinds: ['deep', 'ore:diamond:deep', 'ore:diamond:deep', 'ore:emerald:deep'] },
];

// 액션 탐험: 마지막 구역은 보스. 앞선 구역을 마칠 때 보물 마법을 배움.
// 기존 id/clear 기록을 유지하며, 뒤의 두 구역은 시험용 잠금 상태.
const BATTLE_STAGES = [
  { id: 1, name: '풀숲의 보물', letters: ['A','B','C','D','E'], waves: 3, perWave: 4, free: true },
  { id: 2, name: '안개 숲 탐험', letters: ['F','G','H','I','J'], waves: 3, perWave: 5, free: true },
  { id: 3, name: '수호 동물의 숲', letters: ['K','L','M','N','O'], waves: 3, perWave: 6, free: true },
  { id: 4, name: '잊힌 유적', letters: ['P','Q','R','S','T'], waves: 3, perWave: 6, free: false },
  { id: 5, name: '안개 왕의 성', letters: ['U','V','W','X','Y','Z'], waves: 4, perWave: 7, free: false },
];

// 직접 만든 블록 몬스터. 이름/크기/역할은 소개 화면과 전투에서 함께 사용.
const MONSTER_TYPES = {
  moss: { name: '이끼콩', role: '근접형', size: 48 },
  archer: { name: '나무활', role: '원거리형', size: 48 },
  charger: { name: '돌쿵', role: '돌진형', size: 62 },
  boss: { name: '안개왕', role: '보스형', size: 78 },
};

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
