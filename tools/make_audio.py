"""macOS: 새 낱말만 자연스러운 미국 영어 Samantha 음성으로 생성합니다.
기존 발음 파일은 덮어쓰지 않습니다. 실행: python3 tools/make_audio.py
"""
import pathlib
import re
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[1]
words = set(re.findall(r"word: '([^']+)'", (root / 'english/js/data.js').read_text()))
for word in sorted(words):
    output = root / 'english/audio/words' / (word + '.m4a')
    if output.exists() and output.stat().st_size > 1024:
        continue
    with tempfile.TemporaryDirectory() as directory:
        raw = pathlib.Path(directory) / 'voice.aiff'
        subprocess.run(['say', '-v', 'Samantha', '-r', '145', '-o', str(raw), word], check=True)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(raw), '-c:a', 'aac', '-b:a', '96k', str(output)], check=True)
    probe = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(output)], text=True).strip()
    if probe == 'N/A' or float(probe) < 0.1:
        raise RuntimeError(f'{word}: 음성 생성 실패. macOS 음성 서비스 접근 권한을 확인하세요.')
    print(word, probe)
