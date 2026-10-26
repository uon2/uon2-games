"""Build the 300-character game catalog from official HWP + XLS snapshots.
Read-only parsers: python -m pip install xlrd==2.0.2 olefile==0.47
Example temporary install: --target /tmp/hanja-import-libs, then PYTHONPATH=...
Does not access the network or execute HWP scripts.
"""
from pathlib import Path
import argparse, csv, hashlib, json, re, struct, unicodedata, zlib
from datetime import date
import xlrd
import olefile

ROOT=Path(__file__).resolve().parents[1]
DEFAULT_SNAPSHOT='2026-10-26'
OUT=ROOT/'hanja/data'
GRADE=[('80','8','grade8','8급','마을 개울','grade-8.hwp',50,0),('72','7II','grade7_2','7-2급','맑은 호수','grade-7-2.hwp',100,0),('70','7','grade7_1','7-1급','큰 강','grade-7-1.hwp',150,0),('62','6II','grade6_2','6-2급','바닷가','grade-6-2.hwp',225,50),('60','6','grade6_1','6-1급','깊은 바다','grade-6-1.hwp',300,150)]
INTRO=list('一二三四五六七八九十日月火水木金土山人大')
OFFICIAL='https://www.hanja.re.kr/kccpt/exam/levelConfirm.do'

def canonical(text):return unicodedata.normalize('NFC',text)
def dump(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def check(condition,message):
    if not condition:raise ValueError(message)

def hwp_text(path):
    paragraphs=[]
    with olefile.OleFileIO(path) as doc:
        header=doc.openstream('FileHeader').read()
        check(header.startswith(b'HWP Document File'),'Not an HWP 5 file')
        flags=struct.unpack_from('<I',header,36)[0]
        check(not flags&2,'Encrypted HWP is unsupported')
        sections=sorted(p for p in doc.listdir() if p[0]=='BodyText' and p[-1].startswith('Section'))
        for section in sections:
            data=doc.openstream(section).read()
            if flags&1:data=zlib.decompress(data,-15)
            pos=0
            while pos<len(data):
                head=struct.unpack_from('<I',data,pos)[0];pos+=4
                size=head>>20
                if size==4095:size=struct.unpack_from('<I',data,pos)[0];pos+=4
                block=data[pos:pos+size];pos+=size
                if head&1023!=67:continue # HWPTAG_PARA_TEXT
                units=struct.unpack('<'+'H'*(len(block)//2),block)
                chars=[];i=0
                while i<len(units):
                    code=units[i]
                    if code in (0,10,13):chars.append('\n' if code else '');i+=1
                    elif code in (1,2,3,4,5,6,7,8,9,11,12,14,15,16,17,18,19,20,21,22,23):
                        chars.append('\t' if code==9 else '');i+=8
                    elif code<32:i+=1
                    else:chars.append(chr(code));i+=1
                paragraphs.append(''.join(chars).strip())
    return '\n'.join(paragraphs)+'\n'

def extract_sets(text):
    reading=[];writing=[];in_writing=False
    for line in text.splitlines():
        if '쓰기配定漢字' in line:in_writing=True
        if re.match(r'^[ㄱ-ㅎ]\s',line):
            values=[canonical(x) for x in line.split()[1:]]
            check(all(len(x)==1 and ('\u3400'<=x<='\u9fff' or '\uf900'<=x<='\ufaff') for x in values),'Unexpected HWP list token')
            (writing if in_writing else reading).extend(values)
    return reading,writing

def parse_readings(text):
    result=[]
    for part in text.split('|'):
        hun,raw_eum=part.strip().rsplit(' ',1)
        match=re.fullmatch(r'([가-힣]+)(.*)',raw_eum)
        check(match is not None,f'Cannot parse reading {part}')
        result.append({'hun':hun,'eum':match[1],'sourceEum':raw_eum,'notation':match[2]})
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot',default=DEFAULT_SNAPSHOT,help='Source snapshot date YYYY-MM-DD')
    snapshot=date.fromisoformat(parser.parse_args().snapshot).isoformat()
    SOURCE=ROOT/'docs/sources/hanja-official'/snapshot
    OUT.mkdir(parents=True,exist_ok=True);(OUT/'stages').mkdir(exist_ok=True)
    manifest=json.loads((SOURCE/'manifest.json').read_text())
    for source in manifest['files']:
        check(hashlib.sha256((SOURCE/source['localFile']).read_bytes()).hexdigest()==source['sha256'],'Source hash mismatch')
    book=xlrd.open_workbook(SOURCE/'all-grades.xls');sheet=book.sheet_by_name('배정한자')
    check(sheet.row_values(0)==['대표음','급수','한자','대표훈음','부수','획수','총획','음표'],'Unexpected official workbook schema')
    grade_by_code={x[0]:x for x in GRADE};characters=[];raw_rows=[]
    for i in range(1,sheet.nrows):
        row=sheet.row_values(i);code=str(row[1]).strip()
        if code not in grade_by_code:continue
        _,grade,stage,*_=grade_by_code[code];ch=canonical(row[2].strip());readings=parse_readings(row[3])
        check(len(ch)==1,'Invalid character')
        character={'id':f'hanja-{ord(ch):04X}','ch':ch,'sourceCh':row[2],'officialGrade':grade,'officialGradeCode':code,'firstGameStage':('intro9' if ch in INTRO else stage),'hun':readings[0]['hun'],'eum':readings[0]['eum'],'readings':readings,'sourceHunEum':row[3],'representativeEum':row[0],'radical':canonical(row[4]),'sourceRadical':row[4],'radicalExtraStrokes':int(row[5]),'totalStrokes':int(row[6]),'pronunciationMark':row[7],'source':{'file':'all-grades.xls','sheet':'배정한자','row':i+1}}
        characters.append(character);raw_rows.append({'row':i+1,'values':row})
    by_ch={x['ch']:x for x in characters}
    check(len(characters)==len(by_ch)==300,'Catalog must have exactly 300 distinct normalized characters')
    check(len(INTRO)==len(set(INTRO))==20,'Invalid intro')
    all_ids=lambda values:[by_ch[ch]['id'] for ch in values]
    stages=[{'id':'intro9','label':'9급 · 입문','officialGrade':None,'region':'마당 연못','readingCharacterIds':all_ids(INTRO),'newCharacterIds':all_ids(INTRO),'officialNewCharacterIds':[],'writingCharacterIds':[],'scopeStatus':'official-source-sets-verified','playableInCurrentPrototype':True,'playableCharacterIds':all_ids(INTRO),'playCapabilities':{'readingFishing':True,'writing':False}}]
    checks=[];previous=set();order={x[0]:i for i,x in enumerate(GRADE)}
    for index,(code,grade,stage,label,region,filename,expected,write_count) in enumerate(GRADE):
        text=hwp_text(SOURCE/filename);(SOURCE/(filename+'.txt')).write_text(text,encoding='utf-8')
        reading,writing=extract_sets(text)
        check(len(reading)==len(set(reading))==expected,f'{filename}: cumulative count mismatch')
        check(len(writing)==len(set(writing))==write_count,f'{filename}: writing count mismatch')
        expected_set={x['ch'] for x in characters if order[x['officialGradeCode']]<=index}
        check(set(reading)==expected_set,f'{filename}: HWP/XLS membership mismatch {set(reading)^expected_set}')
        check(previous<=set(reading),'Cumulative grades must contain lower grades')
        expected_writing=set() if not write_count else set(stages[1 if write_count==50 else 3]['readingCharacterIds'])
        check(set(all_ids(writing))==expected_writing,'Official writing scope mismatch')
        official_new=[x for x in reading if x not in previous]
        progression_new=[x for x in official_new if not(index==0 and x in INTRO)]
        stages.append({'id':stage,'label':label,'officialGrade':grade,'region':region,'readingCharacterIds':all_ids(reading),'newCharacterIds':all_ids(progression_new),'officialNewCharacterIds':all_ids(official_new),'writingCharacterIds':all_ids(writing),'scopeStatus':'official-source-sets-verified','sourceHwp':filename,'playableInCurrentPrototype':True,'playableCharacterIds':all_ids(reading),'playCapabilities':{'readingFishing':True,'writing':bool(writing)}})
        checks.append({'stage':stage,'hwpReadingCount':len(reading),'xlsCumulativeCount':len(expected_set),'membershipExactMatch':True,'newInOfficialGrade':len(official_new),'newInGameProgression':len(progression_new),'writingCount':len(writing)})
        previous=set(reading)
    check([len(x['newCharacterIds']) for x in stages]==[20,30,50,50,75,75],'New character partitions wrong')
    check(len(set(sum((x['newCharacterIds'] for x in stages),[])))==300,'Game stages do not partition 300 characters')
    catalog={'schemaVersion':1,'publisher':'사단법인 한국어문회','sourceDate':snapshot,'sourcePage':OFFICIAL,'unicodeNormalization':'NFC; original character and radical are retained in sourceCh/sourceRadical','verification':{'gradeMembership':'Five official HWP full-body lists exactly match cumulative grades of the official XLS','hunEum':'Imported from official workbook, all pipe-separated readings retained; not independently dictionary-reviewed','strokeOrder':'not-collected','fontGlyphs':'not-reviewed','audio':'not-generated','usagePermission':'No reuse license confirmed; source retrieval is not a license grant'},'characters':characters,'stages':stages}
    dump(OUT/'catalog.json',catalog)
    for stage in stages:dump(OUT/'stages'/(stage['id']+'.json'),stage)
    dump(SOURCE/'selected-workbook-rows.json',{'sheet':'배정한자','columns':sheet.row_values(0),'rows':raw_rows})
    variants=[{'sourceCh':x['sourceCh'],'ch':x['ch'],'id':x['id']} for x in characters if x['ch']!=x['sourceCh']]
    dump(OUT/'validation-report.json',{'status':'pass','sourceFilesHashVerified':len(manifest['files']),'uniqueCharacters':300,'stages':checks,'introCount':20,'compatibilityNormalization':variants,'notes':['6급II writing scope exactly matches 8급 reading 50','6급 writing scope exactly matches 7급 reading 150','훈음 六 is 여섯 륙; the watercolor game uses the official reading','Dataset readiness does not imply playable stages or verified font/stroke-order/audio assets']})
    with (OUT/'characters.csv').open('w',encoding='utf-8-sig',newline='') as f:
        fields=['id','ch','sourceCh','officialGrade','firstGameStage','hun','eum','sourceHunEum','radical','radicalExtraStrokes','totalStrokes','pronunciationMark']
        writer=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');writer.writeheader();writer.writerows(characters)
    print(json.dumps({'uniqueCharacters':len(characters),'stageNewCounts':[len(x['newCharacterIds']) for x in stages],'gradeCumulativeCounts':[len(x['readingCharacterIds']) for x in stages],'writingCounts':[len(x['writingCharacterIds']) for x in stages],'sourceVariants':variants},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
