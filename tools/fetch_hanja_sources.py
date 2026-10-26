"""Fetch public official Hanja assignment documents with the site's normal form session.
No credentials are required, stored, or printed. Reject HTML/error bodies as documents.
"""
from pathlib import Path
from datetime import date, datetime, timezone
import argparse, hashlib, html, json, re, subprocess, tempfile
from urllib.parse import urlencode

ROOT=Path(__file__).resolve().parents[1]
SOURCE_ROOT=ROOT/'docs/sources/hanja-official'
BASE='https://www.hanja.re.kr'
PAGE=BASE+'/kccpt/exam/levelConfirm.do'
FILES=[('8','grade-8.hwp'),('7II','grade-7-2.hwp'),('7','grade-7-1.hwp'),('6II','grade-6-2.hwp'),('6','grade-6-1.hwp'),(None,'all-grades.xls')]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot',default=date.today().isoformat(),help='New snapshot date YYYY-MM-DD; existing snapshots are never overwritten')
    snapshot=date.fromisoformat(parser.parse_args().snapshot).isoformat()
    destination=SOURCE_ROOT/snapshot
    if destination.exists():raise SystemExit(f'Snapshot already exists; refusing to overwrite: {snapshot}')
    SOURCE_ROOT.mkdir(parents=True,exist_ok=True)
    temporary=tempfile.TemporaryDirectory(prefix='.hanja-download-',dir=SOURCE_ROOT)
    OUT=Path(temporary.name)/'documents'
    OUT.mkdir()
    cookie=str(Path(temporary.name)/'session.cookies')
    def request(url,payload=None):
        args=['curl','-L','--fail','--max-time','45','-sS','-b',cookie,'-c',cookie,'-e',PAGE]
        if payload is not None:args+=['-H','Content-Type: application/x-www-form-urlencoded','--data-binary','@-']
        result=subprocess.run(args+[url],input=payload,capture_output=True,check=True)
        return result.stdout
    raw=request(PAGE).decode('utf-8')
    def meta(name):
        m=re.search(r'<meta\s+name=[\"\']'+re.escape(name)+r'[\"\']\s+content=[\"\']([^\"\']+)',raw)
        if not m: raise ValueError('Missing public download form token')
        return html.unescape(m.group(1))
    parameter,token=meta('_csrf_parameter'),meta('_csrf')
    sanitized=re.sub(r'(<meta\s+name=[\"\']_csrf[\"\']\s+content=[\"\'])[^\"\']+',r'\1[session-token-removed]',raw)
    (OUT/'level-confirm.html').write_text(sanitized,encoding='utf-8')
    manifest={'publisher':'사단법인 한국어문회','pageUrl':PAGE,'retrievedAt':datetime.now(timezone.utc).isoformat(),'snapshotNote':'Public CSRF session value removed from HTML snapshot. Binary documents are unmodified.','files':[]}
    for grade,local in FILES:
        original=('배정한자'+grade.replace('II','급II')+'.hwp' if grade and 'II' in grade else '배정한자'+grade+'급.hwp') if grade else '배정한자 전체 대표훈음 부수 음표 명기본(xls).xls'
        payload=urlencode({'folder_name':'levelConfirm','file_name':original,parameter:token}).encode()
        data=request(BASE+'/file/downloadDoc.do',payload)
        if not data.startswith(bytes.fromhex('d0cf11e0a1b11ae1')):
            raise ValueError(f'{local}: not an OLE/HWP/XLS document ({len(data)} bytes); refusing to save')
        (OUT/local).write_bytes(data)
        manifest['files'].append({'id':local.rsplit('.',1)[0],'localFile':local,'originalFilename':original,'downloadUrl':BASE+'/file/downloadDoc.do','requestMethod':'POST','form':{'folder_name':'levelConfirm','file_name':original},'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'fileFormat':'OLE Compound File (signature verified)'})
        print(f'{local}: {len(data)} bytes, OLE signature verified')
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    OUT.rename(destination)
    temporary.cleanup()
    print(f'Snapshot saved: {destination}')

if __name__=='__main__':main()
