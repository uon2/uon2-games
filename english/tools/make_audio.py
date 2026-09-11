#!/usr/bin/env python3
"""영어 발음 파일 생성 (macOS 전용: say + afconvert 사용)

js/data.js의 알파벳과 예시 단어를 읽어서 audio/ 폴더에 m4a 파일을 만든다.

사용법:
    python3 tools/make_audio.py                     # 기본 목소리(Samantha)
    python3 tools/make_audio.py "Ava (Premium)"     # 다른 목소리

설치된 영어 목소리 확인:  say -v '?' | grep en_
"""
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOICE = sys.argv[1] if len(sys.argv) > 1 else 'Samantha'

# 대문자 한 글자("A")는 "capital A"로 읽으므로 기본은 소문자로 넣는다.
# 그래도 이상하게 읽는 글자는 여기서 읽을 텍스트를 바꾼다. 예: {'A': 'ay'}
LETTER_TEXT = {}

# 파일 이름 → 읽을 문장 (js/audio.js의 PHRASE_FILES와 맞춰야 함)
PHRASES = {
    'lets-go': "Let's go!",
    'great-job': 'Great job!',
}


def data_src():
    return (ROOT / 'js' / 'data.js').read_text(encoding='utf-8')


def letters_and_words():
    return re.findall(r"^\s*([A-Z]): \{ word: '([^']+)'", data_src(), re.M)


def all_words():
    """알파벳 예시 단어 + 작업대 레시피 단어"""
    return sorted(set(re.findall(r"word: '([^']+)'", data_src())))


def record(text, out):
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        aiff = Path(tmp) / 'clip.aiff'
        subprocess.run(['say', '-v', VOICE, '-o', str(aiff), text], check=True)
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', str(aiff), str(out)], check=True)
    print(f'{out.relative_to(ROOT)}  ←  "{text}"')


def main():
    pairs = letters_and_words()
    if len(pairs) != 26:
        sys.exit(f'data.js에서 알파벳 26개를 찾지 못했습니다 ({len(pairs)}개)')

    audio = ROOT / 'audio'
    for letter, _ in pairs:
        record(LETTER_TEXT.get(letter, letter.lower()), audio / 'letters' / f'{letter}.m4a')
    for word in all_words():
        record(word, audio / 'words' / f'{word}.m4a')
    for name, text in PHRASES.items():
        record(text, audio / 'phrases' / f'{name}.m4a')
    print(f'완료: 목소리 "{VOICE}"')


if __name__ == '__main__':
    main()
