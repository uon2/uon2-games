const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('많이 만든 아이도 처음 만난 낱말에는 한 칸부터 배운다',()=>{
  const save={craft:{total:100,made:{cat:30},practice:{cat:{ok:8,helped:0}}}};
  const context=vm.createContext({save,$:()=>({addEventListener(){}})});
  vm.runInContext(fs.readFileSync(path.join(root,'english/js/craft.js'),'utf8'),context);
  assert.equal(vm.runInContext("craft.order={word:'cat'};craftLevel()",context),4);
  assert.equal(vm.runInContext("craft.order={word:'bee'};craftLevel()",context),1);
  save.craft.practice.bee={ok:1,helped:4};
  assert.equal(vm.runInContext('craftLevel()',context),2);
  assert.equal(save.craft.total,100);
});
