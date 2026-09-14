'use strict';

// ---------- 용암 모험: 문장 학습 데이터 ----------
// 받침이 있으면 '이에요/가', 없으면 '예요/가' 처럼 조사를 맞춰 준다.
function hasFinal(word) {
  const last = word.charCodeAt(word.length - 1) - 0xac00;
  return last >= 0 && last <= 11171 && last % 28 !== 0;
}
const 이에요 = (ko) => ko + (hasFinal(ko) ? '이에요' : '예요');
const 가 = (ko) => ko + (hasFinal(ko) ? '이' : '가');
// 문장틀 3개 × 낱말 4개 = 12문장. 임의 조합을 만들지 않고 검수한 목록만 둔다.
// tokens: 아이가 놓는 조각. fixed 는 시스템이 미리 채워 주는 기능어.
const SENTENCE_FRAMES = [
  {
    id: 'itis',
    lead: ['It', 'is', 'a'],
    ko: (ko) => `${이에요(ko)}.`,
    teach: 'is 는 "~예요" 하고 알려 주는 말이에요.',
    nouns: ['cat', 'dog', 'pig', 'fox'],
  },
  {
    id: 'isee',
    lead: ['I', 'see', 'a'],
    ko: (ko) => `${가(ko)} 보여요.`,
    teach: 'see 는 "보여요" 라는 말이에요.',
    nouns: ['cat', 'dog', 'cow', 'fox'],
  },
  {
    id: 'thisismy',
    lead: ['This', 'is', 'my'],
    ko: (ko) => `이것은 내 ${이에요(ko)}.`,
    teach: 'my 는 "내" 라는 말이에요.',
    nouns: ['bed', 'cup', 'bag', 'hat'],
  },
];

// 문장별 한국어 뜻은 낱말 뜻을 그대로 쓰지 않고 자연스럽게 다듬는다.
const SENTENCE_KO = {
  cat: '고양이', dog: '강아지', pig: '돼지', fox: '여우', cow: '소',
  bed: '침대', cup: '컵', bag: '가방', hat: '모자',
};

function sentenceList() {
  const out = [];
  SENTENCE_FRAMES.forEach(frame => {
    frame.nouns.forEach(noun => {
      const recipe = RECIPES.find(r => r.word === noun);
      out.push({
        id: `${frame.id}-${noun}`,
        frame: frame.id,
        text: `${frame.lead.join(' ')} ${noun}.`,
        lead: frame.lead,
        noun,
        emoji: recipe ? recipe.emoji : '❓',
        ko: frame.ko(SENTENCE_KO[noun] || noun),
        teach: frame.teach,
      });
    });
  });
  return out;
}

const SENTENCES = typeof RECIPES === 'undefined' ? [] : sentenceList();
