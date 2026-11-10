"""Local English-game preview with isolated progress.

The learning scene retains practice in sessionStorage in the same tab.
Other QA scenes start with disposable in-memory fixtures.

Run: python3 tests/preview-server.py
Open /english/ for the normal game, or /__preview/menu, forest, lava,
sentence, sentence-meaning, sentence-build, forge, upgrades, shop for disposable QA scenes. Listens on loopback only.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCENES = {"menu", "forest", "lava", "sentence", "sentence-meaning", "sentence-build", "forge", "upgrades", "shop", "learning", "route-recall", "route-meaning", "route-reading", "route-spelling", "route-final", "route-combat", "test-mode"}


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        scene = self.path.removeprefix("/__preview/")
        if self.path.startswith("/__preview/") and scene in SCENES:
            html = (ROOT / "english/index.html").read_text()
            html = html.replace("<head>", '<head><base href="/english/">')
            fixture = """<script>
            persist=()=>{};
            save={...newSave(),profile:{name:'미리보기',avatar:1},unlocked:5,
              clears:{1:1},craft:{total:4,made:{cat:1,dog:1,bed:1,bag:1}},
              battle:{stars:180,cleared:{1:true,2:true,3:true,4:true,5:true}},
              gear:{blade:1,fire:true,bomb:true,equipped:true,startingWeapon:'seed'},
              blocks:{A:8,B:8,C:8,D:8,E:8,T:8},wallet:{stars:180,spent:0}};
            const previewScene='SCENE';
            if(previewScene==='test-mode') {
              const previewStorage={
                getItem:key=>sessionStorage.getItem('uon2-test-preview:'+key),
                setItem:(key,value)=>sessionStorage.setItem('uon2-test-preview:'+key,value)
              };
              playSession=new PlaySession(previewStorage,previewStorage,
                ()=>({...newSave(),profile:{name:'테스트연습',avatar:1}}),'preview-save-v1');
              save=playSession.current;persist=()=>playSession.persist(save);goMap();
            }
            else if(previewScene==='learning'||previewScene.startsWith('route-')) {
              save={...newSave(),profile:{name:'미리보기',avatar:1}};
              if(previewScene==='learning') {
                const previewKey='uon2-english-learning-preview-v1';
                try {
                  const previous=JSON.parse(sessionStorage.getItem(previewKey));
                  if(previous?.profile) save={...newSave(),...previous};
                } catch(_) {}
                persist=()=>{try{sessionStorage.setItem(previewKey,JSON.stringify(save));}catch(_) {}};
              }
              if(['route-reading','route-spelling'].includes(previewScene)) {
                save.learning={session:5,words:Object.fromEntries(RECIPES.map(r=>[r.word,{
                  introduced:true,taughtIn:1,tasks:{listen:{solo:3,helped:0},reading:{solo:previewScene==='route-spelling'?1:0,helped:0}}
                }]))};
              }
              startBattle(BATTLE_STAGES[0]);
              if(previewScene!=='learning') {
                continueLearningCamp();continueLearningCamp();
                if(previewScene==='route-combat') {
                  battle.engine.waveTime=11.99;
                  battle.engine.specialCharge=100;
                } else {
                  const g=battle.engine;
                  g.wave=['route-meaning','route-reading'].includes(previewScene)?2:['route-final','route-spelling'].includes(previewScene)?3:1;
                  g.phase='chest';g.bossDown=g.wave===3;g._clearCombat();
                  g.player.x=450;g.player.y=260;
                  if(g.bossDown) adventureEvent({type:'chest',boss:true});
                  openForge();
                }
              }
            }
            else if(previewScene==='menu') goMap();
            else if(previewScene==='shop') {
              save.gear={weaponVoucher:1,firstClearGift:true};goShop();
            }
            else {
              startBattle(previewScene==='lava'||previewScene.startsWith('sentence')?LAVA_STAGES[0]:BATTLE_STAGES[2]);
              if(previewScene.startsWith('sentence')||previewScene==='forge') {
                battle.engine.phase='chest';
                battle.engine.enemies=[];battle.engine.spawnWarnings=[];
                battle.engine.projectiles=[];
                battle.engine.player.x=450;battle.engine.player.y=260;
                if(previewScene.startsWith('sentence')) {
                  const key=battle.runId+':lava-'+battle.engine.stage.id+'-'+battle.engine.wave;
                  save.sentences={tasks:{[key]:'itis-dog'},seen:{}};
                  if(previewScene!=='sentence') {
                    save.sentences.seen=Object.fromEntries(SENTENCES.map(s=>[s.id,1]));
                    if(previewScene==='sentence-build') {
                      save.sentences.progress={'itis-dog':{lastKind:'meaning'}};
                      save.sentences.steps={'itis-dog':{noun:2,tail:0,full:0}};
                    }
                  }
                }
                openForge();
              }
              if(previewScene==='upgrades') {
                for(let i=0;i<4;i++) battle.engine.drops.push({kind:'gem',
                  x:battle.engine.player.x,y:battle.engine.player.y});
                battle.engine.update(.01);
                battle.engine.events.splice(0).forEach(adventureEvent);
              }
            }
            </script>""".replace("SCENE", scene)
            body = html.replace("</body>", fixture + "</body>").encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()


if __name__ == "__main__":
    print("English QA preview: http://127.0.0.1:8097/__preview/menu", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8097), PreviewHandler).serve_forever()
