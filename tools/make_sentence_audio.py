"""macOS: 용암 모험 문장 발음을 문장 단위로 생성합니다.
낱말 파일을 이어 붙이지 않고 문장 전체를 한 번에 읽습니다.
실행: python3 tools/make_sentence_audio.py
"""
import pathlib
import re
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[1]
source = (root / 'english/js/data.js').read_text() + '\n' + (root / 'english/js/sentences.js').read_text()

frames = re.findall(r"id: '([a-z]+)',\s*lead: \[([^\]]+)\],", source)
nouns = re.findall(r"nouns: \[([^\]]+)\]", source)
out_dir = root / 'english/audio/sentences'
out_dir.mkdir(parents=True, exist_ok=True)

made = 0
for (frame_id, lead_raw), noun_raw in zip(frames, nouns):
    lead = ' '.join(re.findall(r"'([^']+)'", lead_raw))
    for noun in re.findall(r"'([^']+)'", noun_raw):
        text = f'{lead} {noun}.'
        output = out_dir / f'{frame_id}-{noun}.m4a'
        if output.exists() and output.stat().st_size > 1024:
            continue
        with tempfile.TemporaryDirectory() as directory:
            raw = pathlib.Path(directory) / 'voice.aiff'
            subprocess.run(['say', '-v', 'Samantha', '-r', '145', '-o', str(raw), text], check=True)
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(raw), '-c:a', 'aac', '-b:a', '96k', str(output)], check=True)
        probe = subprocess.check_output(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(output)],
            text=True).strip()
        if probe == 'N/A' or float(probe) < 0.4:
            raise RuntimeError(f'{text}: 문장 음성 생성 실패 또는 너무 짧음')
        print(f'{output.name:22} {float(probe):.2f}초  {text}')
        made += 1
print(f'새로 만든 문장 음성 {made}개')
