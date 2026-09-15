const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');

// 버전은 data.js · index.html · sw.js 세 곳에 나온다.
// 하나만 올리면 아이들 패드가 옛 파일을 계속 쓰게 되므로 셋이 같은지 검사한다.
const build = () => {
  const m = source('english/js/data.js').match(/const BUILD = (\d+);/);
  assert.ok(m, 'data.js 에 BUILD 가 있어야 해요');
  return Number(m[1]);
};

test('설정에 보여 줄 버전은 v0.<번호> 형태다', () => {
  const data = source('english/js/data.js');
  assert.match(data, /const APP_VERSION = 'v0\.' \+ BUILD;/);
  // 실제로 계산해 본다
  const value = 'v0.' + build();
  assert.match(value, /^v0\.\d+$/);
  assert.equal(value, 'v0.' + build());
});

test('index.html 의 자산 번호가 BUILD 와 같다', () => {
  const html = source('english/index.html');
  const tags = [...html.matchAll(/(?:src|href)="[^"]+\?v=v(\d+)"/g)].map(m => Number(m[1]));
  assert.ok(tags.length > 0, '자산에 ?v=v<번호> 가 붙어 있어야 해요');
  const wrong = tags.filter(v => v !== build());
  assert.deepEqual(wrong, [], `index.html 의 자산 번호가 BUILD(${build()}) 와 달라요`);
});

test('서비스 워커 캐시 이름이 BUILD 와 같다', () => {
  const sw = source('sw.js');
  const m = sw.match(/const CACHE = 'uon2-games-v(\d+)[^']*';/);
  assert.ok(m, "sw.js 의 CACHE 이름은 'uon2-games-v<번호>-…' 형태여야 해요");
  assert.equal(Number(m[1]), build(), `sw.js 캐시 번호가 BUILD(${build()}) 와 달라요`);
});

test('설정 화면에 버전 표시와 새로 받기 단추가 있다', () => {
  const html = source('english/index.html');
  assert.ok(html.includes('id="app-version"'), '버전을 보여 줄 자리가 있어요');
  assert.ok(html.includes('id="version-refresh"'), '다시 받기 단추가 있어요');
  const app = source('english/js/app.js');
  assert.ok(app.includes("$('#app-version').textContent = APP_VERSION"), '버전을 실제로 채워 넣어요');
});

// 브라우저는 <script> 를 적힌 순서대로 실행한다.
// 파일 맨 아래에서 바로 부르는 초기화 함수(init() 등)가 타고 들어가는 함수 중에
// "더 나중에 불러오는 파일"의 함수가 있으면 ReferenceError 로 초기화가 끊긴다.
// (실제로 app.js 의 init() 이 shop.js 의 initShop() 을 불러 설정 화면의 버전 표시가 멈췄다.)
// 클릭했을 때 부르는 것은 문제가 없으므로, 로드 중에 실제로 지나가는 길만 따라간다.
test('로드 중에 실행되는 함수가 나중 파일의 함수를 부르지 않는다', () => {
  const html = source('english/index.html');
  const files = [...html.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g)].map(m => 'english/' + m[1]);
  const text = Object.fromEntries(files.map(f => [f, source(f)]));

  // 파일마다 최상위 function 정의를 이름 → {파일, 본문} 으로 모은다
  const defs = {};
  files.forEach(file => {
    const src = text[file];
    const re = /^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
    const marks = [...src.matchAll(re)].map(m => ({ name: m[1], at: m.index }));
    marks.forEach((mark, i) => {
      const end = i + 1 < marks.length ? marks[i + 1].at : src.length;
      defs[mark.name] ??= { file, body: src.slice(mark.at, end) };
    });
  });

  // 클릭 같은 콜백 안의 호출은 로드 중에 실행되지 않는다. 그 몸통을 먼저 지운다.
  function stripCallbacks(body) {
    let out = body, changed = true;
    while (changed) {
      changed = false;
      const at = out.search(/=>\s*\{|function\s*\([^)]*\)\s*\{/);
      if (at < 0) break;
      const open = out.indexOf('{', at);
      let depth = 0, end = -1;
      for (let i = open; i < out.length; i++) {
        if (out[i] === '{') depth++;
        else if (out[i] === '}') { depth--; if (!depth) { end = i; break; } }
      }
      if (end < 0) break;
      out = out.slice(0, at) + out.slice(end + 1);
      changed = true;
    }
    // 몸통이 중괄호가 아닌 화살표 함수( () => goMap() )는 그 줄을 지운다
    return out.split('\n').filter(line => !line.includes('=>')).join('\n');
  }

  const calledIn = body => [...stripCallbacks(body).matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]);
  const problems = [];

  files.forEach((file, index) => {
    // 파일 맨 아래에서 바로 부르는 초기화 호출
    const seeds = [...text[file].matchAll(/^([A-Za-z_$][\w$]*)\(\s*\)\s*;\s*$/gm)].map(m => m[1]);
    const seen = new Set();
    const queue = [...seeds];
    while (queue.length) {
      const name = queue.shift();
      if (seen.has(name)) continue;
      seen.add(name);
      const def = defs[name];
      if (!def) continue;                       // 내장 함수거나 이 파일들 밖의 것
      if (files.indexOf(def.file) > index) {
        problems.push(`${file} 이 로드 중에 ${def.file} 의 ${name}() 를 불러요`);
        continue;
      }
      calledIn(def.body).forEach(next => { if (defs[next] && !seen.has(next)) queue.push(next); });
    }
  });

  assert.equal(problems.join('\n'), '');
});
