'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dataDir=path.join(__dirname,'../hanja/data'),sourceDir=path.join(__dirname,'../docs/sources/hanja-official/2026-10-26');
const catalog=JSON.parse(fs.readFileSync(path.join(dataDir,'catalog.json'),'utf8'));
const byCh=new Map(catalog.characters.map(x=>[x.ch,x])),byId=new Map(catalog.characters.map(x=>[x.id,x]));
test('catalog contains 300 distinct NFC characters with official provenance and total stroke counts',()=>{
 assert.equal(catalog.characters.length,300);assert.equal(byCh.size,300);assert.equal(byId.size,300);
 for(const c of catalog.characters){assert.match(c.ch,/^[\u3400-\u9fff]$/u);assert.equal(c.ch,c.ch.normalize('NFC'));assert.equal(c.sourceCh.normalize('NFC'),c.ch);assert.equal(c.id,'hanja-'+c.ch.codePointAt(0).toString(16).toUpperCase());assert.ok(c.hun&&c.eum&&c.readings.length);assert.ok(Number.isInteger(c.totalStrokes)&&c.totalStrokes>0);assert.ok(c.radicalExtraStrokes>=0&&c.radicalExtraStrokes<c.totalStrokes);assert.equal(c.source.sheet,'배정한자');assert.ok(c.source.row>1);}
});
test('six game stages partition new characters and preserve cumulative reading scopes',()=>{
 assert.deepEqual(catalog.stages.map(s=>s.id),['intro9','grade8','grade7_2','grade7_1','grade6_2','grade6_1']);
 assert.deepEqual(catalog.stages.map(s=>s.readingCharacterIds.length),[20,50,100,150,225,300]);
 assert.deepEqual(catalog.stages.map(s=>s.newCharacterIds.length),[20,30,50,50,75,75]);
 const newIds=catalog.stages.flatMap(s=>s.newCharacterIds);assert.equal(newIds.length,300);assert.equal(new Set(newIds).size,300);
 let previous=[];for(const s of catalog.stages){assert.ok(previous.every(id=>s.readingCharacterIds.includes(id)));assert.equal(new Set(s.readingCharacterIds).size,s.readingCharacterIds.length);assert.ok(s.readingCharacterIds.every(id=>byId.has(id)));assert.ok(s.newCharacterIds.every(id=>s.readingCharacterIds.includes(id)));assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir,'stages',s.id+'.json'),'utf8')),s);previous=s.readingCharacterIds;}
});
test('intro is a subset of grade 8 and upper-grade direct entry includes lower-grade characters',()=>{
 const [intro,g8,g72,g71,g62,g61]=catalog.stages;assert.equal(intro.officialGrade,null);assert.deepEqual(intro.readingCharacterIds.map(id=>byId.get(id).ch),Array.from('一二三四五六七八九十日月火水木金土山人大'));
 for(const s of [g8,g72,g71,g62,g61])assert.ok(intro.readingCharacterIds.every(id=>s.readingCharacterIds.includes(id)));
 assert.deepEqual([g8,g72,g71,g62,g61].map(s=>s.officialNewCharacterIds.length),[50,50,50,75,75]);
});
test('writing lists match the actual lower-grade official reading scopes',()=>{
 const s=catalog.stages;assert.deepEqual(s.map(x=>x.writingCharacterIds.length),[0,0,0,0,50,150]);assert.deepEqual(new Set(s[4].writingCharacterIds),new Set(s[1].readingCharacterIds));assert.deepEqual(new Set(s[5].writingCharacterIds),new Set(s[3].readingCharacterIds));
});
test('polyphonic readings, long-vowel notation and original compatibility ideographs survive import',()=>{
 assert.deepEqual(byCh.get('車').readings.map(x=>x.eum),['거','차']);assert.deepEqual(byCh.get('樂').readings.map(x=>x.eum),['락','악','요']);assert.deepEqual(byCh.get('北').readings.map(x=>x.eum),['북','배']);assert.equal(byCh.get('六').eum,'륙');assert.equal(byCh.get('二').readings[0].sourceEum,'이:');assert.equal(byCh.get('金').sourceCh,'金');assert.equal(byCh.get('車').totalStrokes,7);assert.equal(byCh.get('車').radicalExtraStrokes,0);
});
test('source snapshots match saved checksums and contain binary documents rather than error HTML',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(sourceDir,'manifest.json'),'utf8'));assert.equal(manifest.files.length,6);for(const f of manifest.files){const buffer=fs.readFileSync(path.join(sourceDir,f.localFile));assert.equal(buffer.subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1');assert.equal(buffer.length,f.bytes);assert.equal(crypto.createHash('sha256').update(buffer).digest('hex'),f.sha256);}
 const report=JSON.parse(fs.readFileSync(path.join(dataDir,'validation-report.json'),'utf8'));assert.equal(report.status,'pass');assert.ok(report.stages.every(x=>x.membershipExactMatch));
});
test('six stages expose reading fishing and manual writing only in the two writing stages',()=>{
 for(const s of catalog.stages){assert.equal(s.playableInCurrentPrototype,true);assert.deepEqual(s.playableCharacterIds,s.readingCharacterIds);assert.deepEqual(s.playCapabilities,{readingFishing:true,writing:s.writingCharacterIds.length>0});}
});
