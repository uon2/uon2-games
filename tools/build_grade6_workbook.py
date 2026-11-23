"""Rebuild the local 6급 workbook; no network or third-party packages required.

Original HWP/text stays outside Git. Only lexical elements, references, hashes,
new instructions and newly written glosses are included in the workbook.
"""
import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'hanja/practice/data'
HANJA = re.compile(r'[\u3400-\u9fff\uf900-\ufaff]+')
CIRCLES = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫'
TYPES = {'word_reading': 'sound', 'character_meaning_reading': 'name',
         'expression_completion': 'complete', 'word_meaning': 'meaning',
         'hanja_writing': 'writing', 'stroke_order': 'stroke'}
COUNTS = dict(sound=33, name=22, antonym=3, synonym=2, homophone=2,
              complete=3, meaning=2, writing=20, stroke=3)


def nfc(text):
    return unicodedata.normalize('NFC', text)


def read(path):
    return json.loads(path.read_text())


def dump(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'


def audit(source_dir, chars, writing, words, expressions):
    rows, elements, sources = [], [], []
    for round_no in (112, 113, 114):
        path = source_dir / f'{round_no}_6급_문항.json'
        raw = read(path)
        items = raw['items']
        assert len(items) == 90 and sorted(q['number'] for q in items) == list(range(1, 91))
        assert Counter(TYPES.get(q['type'], q['type']) for q in items) == Counter(COUNTS)
        groups = {g['id']: g for g in raw['groups']}
        original = source_dir.parent / '원본' / f'{round_no}_60_문답.hwp'
        digest = hashlib.sha256(original.read_bytes()).hexdigest()
        assert all(q['source']['sha256'] == digest for q in items), 'Original hash differs'
        sources.append({'round': round_no, 'sha256': digest, 'date': raw['report']['examDate']})
        for q in items:
            typ = TYPES.get(q['type'], q['type'])
            prompt, answer = nfc(q['promptRaw']), nfc(q['answerNfc'])
            ref = f'{round_no}-{q["number"]}'
            row = {'id': ref, 'type': typ, 'originalLayoutReviewed': False,
                   'originalPlayable': False, 'status': 'hold', 'reasons': []}
            element = None
            if typ == 'sound':
                spans = HANJA.findall(prompt)
                if len(spans) == 1 and spans[0] in words and words[spans[0]][0] == answer:
                    element = {'type': typ, 'target': spans[0], 'answer': answer}
                else:
                    row['reasons'].append('독음 또는 대상 낱말 대조 필요')
            elif typ == 'name':
                c = chars.get(prompt)
                pairs = [r['hun'] + ' ' + r['eum'] for r in c['readings']] if c else []
                if answer in pairs:
                    element = {'type': typ, 'target': prompt, 'answer': answer}
                else:
                    row['reasons'].append('원문 훈음과 공식 배정표의 표기 차이; 원문을 자동 수정하지 않음')
            elif typ in ('antonym', 'synonym', 'homophone', 'complete', 'meaning'):
                text = prompt if typ in ('antonym', 'synonym', 'homophone') else ' '.join(groups[q['groupId']]['sharedContextRaw'])
                choices = dict(re.findall(r'([①-⑫])\s*([\u3400-\u9fff]+)', text))
                key = answer[:1]
                resolved = choices.get(key)
                if resolved and all(ch in chars for ch in resolved):
                    target = HANJA.findall(prompt)[0] if typ in ('antonym', 'synonym', 'homophone') else ''
                    if typ == 'complete':
                        target = re.sub(r'\(\s*\)', resolved, prompt.split(':')[0]).strip()
                        if target not in expressions:
                            row['reasons'].append('성어 표제 대조 필요')
                    if typ == 'meaning':
                        target = resolved
                        if target not in words:
                            row['reasons'].append('뜻풀이 낱말 대조 필요')
                    if not row['reasons']:
                        element = {'type': typ, 'target': target, 'answer': resolved}
                        if typ in ('antonym', 'synonym', 'homophone'):
                            element['options'] = list(choices.values())
                else:
                    row['reasons'].append('보기 번호와 정답 연결 확인 필요')
            elif typ == 'writing':
                if '/' in answer:
                    row['reasons'].append('복수 원문 답안; 문맥/밑줄 시각 검수 필요')
                elif answer in words and all(ch in writing for ch in answer):
                    element = {'type': typ, 'target': answer, 'answer': answer}
                    row['reasons'].append('원문 밑줄 미확인; 새 독립 지시문에만 활용')
                else:
                    row['reasons'].append('쓰기 배정/낱말 독음 검수 필요')
            else:
                row['reasons'].append('원본 그림·강조 획의 문항 대응 미검수; 원문 출제 보류')
            if element:
                assert all(ch in chars for ch in element['target'])
                row['status'] = 'adapted_element_checked'
                element['source'] = ref
                elements.append(element)
            rows.append(row)
    return {'schemaVersion': 1, 'reviewedAt': '2026-11-24', 'sources': sources,
            'questionCount': len(rows), 'originalPlayableCount': 0,
            'adaptedElementCount': len(elements),
            'heldCount': sum(r['status'] == 'hold' for r in rows),
            'note': '구조·원본 해시·학습 요소를 대조한 결과입니다. 원문의 시각 교정 완료를 뜻하지 않습니다.',
            'items': rows}, elements


def build(catalog, existing, curated, elements):
    chars = {c['ch']: c for c in catalog['characters']}
    stage = next(s for s in catalog['stages'] if s['id'] == 'grade6_1')
    write = {c['ch'] for c in catalog['characters'] if c['id'] in stage['writingCharacterIds']}
    words = {w['word']: (w['reading'], w['meaning']) for w in existing['words']}
    words.update({w: (r, m) for w, r, m in curated['words']})
    expressions = {e['word']: (e['reading'], e['meaning']) for e in existing['completions']}
    expressions.update({w: (r, m) for w, r, m in curated['expressions']})
    refs = {}
    for e in elements:
        refs.setdefault(e['target'], set()).add(e['source'])
    questions = []

    def add(typ, target, display, answer, prompt, explanation, *, variant=0, **extra):
        skill = f'{typ}:{target}'
        questions.append({'id': f'{skill}:{variant}', 'skillKey': skill,
                          'familyKey': target, 'type': typ, 'display': display,
                          'answer': answer, 'prompt': prompt, 'explanation': explanation,
                          'sourceType': 'authored-exercise', 'review': 'scope-and-answer-checked',
                          'references': sorted(refs.get(target, refs.get(target.split('-')[0], []))), **extra})

    def glyphs(word):
        return ' · '.join(ch + ' ' + chars[ch]['hun'] + ' ' + chars[ch]['eum'] for ch in word)

    for ch, c in sorted(chars.items()):
        pairs = [{'hun': r['hun'].split('/'), 'eum': r['eum']} for r in c['readings']]
        add('name', ch, ch, c['hun'] + ' ' + c['eum'], '뜻과 음을 쓰세요.', glyphs(ch), pairs=pairs, kind='name')
    for word, (reading, meaning) in sorted(words.items()):
        assert all(ch in chars for ch in word), f'Outside reading scope: {word}'
        explain = f'{word} · {reading} — {meaning}\n{glyphs(word)}'
        for variant in range(2):
            add('sound', word, word, reading, '한자어의 독음을 한글로 쓰세요.', explain,
                variant=variant, kind='text', accepted=[reading], context=meaning if variant else '')
        # Fixed, explicit vocabulary choices; no random ambiguous definition grading.
        others = [w for w in sorted(words) if w != word and words[w][1] != meaning]
        distractors = sorted(others, key=lambda w: hashlib.sha256((word + w).encode()).hexdigest())[:3]
        add('meaning', word, meaning, word, '이 뜻에 맞는 한자어를 고르세요.', explain,
            kind='choice', options=[word, *distractors])
        if all(ch in write for ch in word) and len(word) == 2:
            add('writing', word, reading, word, '뜻에 맞는 두 글자를 한자로 쓰세요.', explain,
                kind='writing', context=meaning)
    relations = {t: set() for t in ('antonym', 'synonym', 'homophone')}
    for a, b in existing['antonyms']:
        relations['antonym'].add((a, b))
    for a, b in existing['synonyms']:
        relations['synonym'].add((a, b))
    for e in elements:
        if e['type'] in relations:
            relations[e['type']].add((e['target'], e['answer']))
    prompts = {'antonym': '뜻이 반대이거나 상대가 되는 한자를 고르세요.',
               'synonym': '뜻이 같거나 비슷한 한자를 고르세요.',
               'homophone': '음이 같고 뜻이 다른 한자를 고르세요.'}
    # Keep source-attested choices. Invented distractors could be equally valid.
    for typ, pairs in relations.items():
        for a, b in sorted(pairs):
            source = next((e for e in elements if e['type'] == typ and e['target'] == a and e['answer'] == b), None)
            options = source['options'] if source else [b, '雨', '魚', '花'] if typ == 'antonym' else [b, '日', '木', '水']
            add(typ, a + '-' + b, a, b, prompts[typ], glyphs(a + b),
                kind='choice', options=options, familyKeyOverride=a)
    for word, (reading, meaning) in sorted(expressions.items()):
        for i, ch in enumerate(word):
            add('complete', word + '-' + str(i), word[:i] + '□' + word[i+1:], ch,
                '빈칸에 들어갈 한자를 고르세요.', f'{word} · {reading} — {meaning}',
                kind='choice', context=meaning, options=[ch, *sorted(c for c in set(word) if c != ch)][:4],
                expression=word)
    # These three base models already exist in the repository. No original exam image is substituted silently.
    for model in existing['strokeModels']:
        for i in range(len(model['paths'])):
            add('stroke', model['ch'] + '-' + str(i), model['ch'], str(i+1),
                '진하게 표시한 획은 몇 번째로 쓰나요?', f'{model["ch"]}의 표시한 획은 {i+1}번째입니다.',
                kind='stroke', paths=model['paths'], highlight=i,
                options=[str(n+1) for n in range(len(model['paths']))])
    for q in questions:
        if 'familyKeyOverride' in q:
            q['familyKey'] = q.pop('familyKeyOverride')
        if q['type'] == 'complete':
            q['familyKey'] = q['expression']
        if q['kind'] == 'choice':
            q['options'] = sorted(set(q['options']), key=lambda v: hashlib.sha256((q['id'] + v).encode()).hexdigest())
            assert len(q['options']) >= 2 and q['options'].count(q['answer']) == 1
        assert q['answer'] and q['explanation']
    assert len({q['id'] for q in questions}) == len(questions)
    counts = dict(Counter(q['type'] for q in questions))
    for typ, count in COUNTS.items():
        assert len({q['skillKey'] for q in questions if q['type'] == typ}) >= count
    return {'version': '2026-11-24.1', 'grade': '6', 'authorship': curated['note'],
            'exam': {'minutes': 50, 'passScore': 63, 'counts': COUNTS,
                     'basis': '확보된 112~114회 자료와 2026-10-26 저장 기준. 공식 시험과의 동등성을 보장하지 않습니다.'},
            'counts': counts,
            'limitations': ['기출 원문의 시각 교정은 완료하지 않았습니다.', '필순은 二·三·十의 기초 모델 7문항입니다.'],
            'questions': questions}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=ROOT.parent / '한자-기출자료/6급/기출_112-114회/검수용')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    catalog = read(ROOT / 'hanja/data/catalog.json')
    existing = read(ROOT / 'hanja/data/study-content.json')
    curated = read(ROOT / 'tools/grade6-curation.json')
    chars = {c['ch']: c for c in catalog['characters']}
    stage = next(s for s in catalog['stages'] if s['id'] == 'grade6_1')
    writing = {c['ch'] for c in catalog['characters'] if c['id'] in stage['writingCharacterIds']}
    words = {w['word']: (w['reading'], w['meaning']) for w in existing['words']}
    words.update({w: (r, m) for w, r, m in curated['words']})
    expressions = {w: (r, m) for w, r, m in curated['expressions']}
    outputs = {}
    if args.source_dir.exists():
        report, elements = audit(args.source_dir, chars, writing, words, expressions)
        outputs[ROOT / 'docs/grade6-source-review.json'] = report
        outputs[ROOT / 'tools/grade6-source-elements.json'] = elements
    else:
        elements = read(ROOT / 'tools/grade6-source-elements.json')
    bank = build(catalog, existing, curated, elements)
    outputs[DATA / 'bank.json'] = bank
    for path, data in outputs.items():
        if args.check:
            assert path.read_text() == dump(data), f'Regeneration differs: {path}'
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(dump(data))
    print(json.dumps({'questions': len(bank['questions']), 'types': bank['counts'],
                      'sourceAudit': 'checked' if args.source_dir.exists() else 'using committed lexical snapshot'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
