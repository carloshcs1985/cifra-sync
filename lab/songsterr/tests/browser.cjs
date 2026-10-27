const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const root=path.resolve(__dirname,'..'),cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'};
const notes={voices:[{beats:[{notes:[{fret:0,string:0},{fret:12,string:3}],duration:[1,4]},{rest:true,notes:[{rest:true}],duration:[1,4]}]}]};
(async()=>{const server=http.createServer((q,s)=>{try{const f=path.join(root,new URL(q.url,'http://x').pathname==='/'?'index.html':new URL(q.url,'http://x').pathname);s.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'text/html');s.end(fs.readFileSync(f));}catch{s.statusCode=404;s.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--single-process','--no-zygote','--disable-gpu','--disable-software-rasterizer'],proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1,localhost'}:undefined});
const ctx=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:true}),p=await ctx.newPage(),errors=[],headers=[];let releaseSlow=null;p.on('pageerror',e=>errors.push(e.message));const state={time:1000,playing:true,artist:'Autor Original',title:'Estudo Original'};
await ctx.addInitScript(({base})=>{localStorage.setItem('cifrasync.v1','KEEP');localStorage.setItem('cifrasync.token','KEEP');sessionStorage.setItem('cifrasync.songsterr-lab.pkce',JSON.stringify({client:'a'.repeat(32),verifier:'fake',state:'test',redirect:base}));},{base});
await p.route('https://accounts.spotify.com/api/token',r=>r.fulfill({headers:cors,json:{access_token:'test-only',expires_in:3600}}));
await p.route('https://api.spotify.com/**',r=>r.fulfill({headers:cors,json:{item:{id:state.id||'fixture',name:state.title,artists:[{name:state.artist}],duration_ms:60000},progress_ms:state.time,is_playing:state.playing}}));
await p.route('https://r.jina.ai/**',async r=>{headers.push(r.request().headers());const u=r.request().url();let value;if(u.includes('/api/songs?'))value=[{songId:1,title:'Estudo Original',artist:'Autor Original'},{songId:2,title:'Outro estudo',artist:'Outro autor'}];else{const id=+u.split('/').at(-1);value={songId:id,revisionId:42,image:'fixture',title:id===1?'Estudo Original':'Outro estudo',artist:id===1?'Autor Original':'Outro autor',defaultTrack:2,popularTrackGuitar:2,tracks:[{partId:0,name:'Lead Guitar',instrument:'Guitar',isGuitar:true,instrumentId:27,tuning:[64,59,55,50,45,40]},{partId:1,name:'Baixo',instrument:'Bass',tuning:[43,38,33,28]},{partId:2,name:'Background Guitar',instrument:'Guitar',isGuitar:true,views:999999,instrumentId:29,tuning:[64,59,55,50,45,40]}]};}if(u.includes('/api/songs?')){const q=decodeURIComponent(u).toLowerCase();if(q.includes('ambiguo'))value=[{songId:10,title:'Ambiguo',artist:'Autor Original'},{songId:11,title:'Ambiguo',artist:'Autor Original'}];if(q.includes('atrasado'))value=[{songId:3,title:'Atrasado',artist:'Autor Original'}];if(q.includes('ausente'))value=[];}else if(u.endsWith('/10')||u.endsWith('/11')){value.title='Ambiguo';value.artist='Autor Original';}else if(u.endsWith('/3')){value.title='Atrasado';value.artist='Autor Original';await new Promise(resolve=>{releaseSlow=resolve;});}
return r.fulfill({headers:cors,body:'<html><body><pre>'+JSON.stringify(value)+'</pre></body></html>',contentType:'text/html'}).catch(()=>{});});
await p.route('https://dqsljvtekg760.cloudfront.net/**',r=>{headers.push(r.request().headers());const u=r.request().url().split('/'),id=+u.at(-4),part=+u.at(-1).replace('.json','');return r.fulfill({headers:cors,json:{songId:id,partId:part,revisionId:42,strings:part===1?4:6,measures:Array.from({length:4},(_,i)=>id===10||(part===1&&i<2)?{voices:[{beats:[{notes:[{rest:true}],rest:true,duration:[1,1]}]}]}:notes)}});});
await p.goto(base+'?code=fake&state=test');await p.locator('#track').filter({hasText:'Autor Original'}).waitFor();await p.locator('#search-spotify').click();await p.locator('#results button').first().waitFor();assert.equal(await p.locator('#results button').count(),2);await p.locator('#results button').first().click();await p.waitForFunction(()=>document.querySelectorAll('.measure').length===4);assert((await p.locator('#song-title').textContent()).includes('Estudo Original'));assert.equal(await p.locator('#parts').inputValue(),'0');await p.locator('.measure button').first().click();await p.waitForFunction(()=>document.querySelector('.measure.active'));
state.time=5000;await p.waitForTimeout(3300);await p.locator('.measure button').nth(2).click();await p.waitForFunction(()=>document.querySelectorAll('.measure')[2].classList.contains('active'));
state.playing=false;state.time=8000;await p.waitForTimeout(3300);const txt=await p.locator('.measure.active').textContent();await p.waitForTimeout(500);assert.equal(await p.locator('.measure.active').textContent(),txt);
await p.locator('#parts').selectOption('1');await p.waitForFunction(()=>document.querySelector('.measure pre')?.textContent.split('\n').length===5);assert.equal(await p.locator('.measure.active').count(),0);assert.equal(await p.locator('#entry-preview').isVisible(),true);assert((await p.locator('#entry-label').textContent()).includes('compasso 3'));
await p.locator('#query').fill('https://www.songsterr.com/a/wsa/other-tab-s2');await p.locator('#search').click();await p.waitForFunction(()=>document.querySelector('#song-title').textContent.includes('Outro estudo'));await p.waitForFunction(()=>document.querySelectorAll('.measure').length===4);assert.equal(await p.locator('.measure.active').count(),0);
await p.locator('#query').fill('https://evil.example/a-s1');await p.locator('#search').click();assert((await p.locator('#search-status').textContent()).includes('domínio'));
assert(headers.every(h=>!h.authorization&&!h.cookie));assert.deepEqual(errors,[]);assert.equal(await p.evaluate(()=>localStorage.getItem('cifrasync.v1')),'KEEP');assert.equal(await p.evaluate(()=>localStorage.getItem('cifrasync.token')),'KEEP');assert.equal((await p.evaluate(()=>indexedDB.databases())).length,0);await p.screenshot({path:process.env.LAB_SCREENSHOT||'/tmp/lab-expanded.png'});console.log('PASS search, Spotify query, link, guitar/bass selection, reset on track change, anchors/pause, unsafe URL, isolation, credential separation, no JS errors');

// Automatic transitions: no click required, no new search on each poll, opt-out works.
await p.locator('#auto-track').uncheck();
state.id='auto-one';state.title='Estudo Original';state.artist='Autor Original';state.playing=true;state.time=2000;await p.waitForTimeout(3300);
await p.waitForFunction(()=>document.querySelector('#track').textContent.startsWith('Estudo Original'));
await p.locator('#auto-track').check();
await p.waitForFunction(()=>document.querySelector('#song-title').textContent.includes('Estudo Original')&&document.querySelectorAll('.measure').length===4);
await p.locator('.measure button').first().click();await p.waitForFunction(()=>document.querySelector('.measure.active'));
state.id='auto-two';state.title='Outro estudo';state.artist='Outro autor';state.time=1000;
await p.waitForFunction(()=>document.querySelector('#song-title').textContent.includes('Outro estudo')&&document.querySelectorAll('.measure').length===4);
assert.equal(await p.locator('.measure.active').count(),0);
const calls=headers.length;await p.waitForTimeout(3500);assert.equal(headers.length,calls);
await p.locator('#auto-track').uncheck();state.id='auto-three';state.title='Estudo Original';state.artist='Autor Original';
await p.waitForFunction(()=>document.querySelector('#track').textContent.startsWith('Estudo Original'));
assert((await p.locator('#song-title').textContent()).includes('Outro estudo'));
await p.locator('#auto-track').check();await p.waitForFunction(()=>document.querySelector('#song-title').textContent.includes('Estudo Original')&&document.querySelectorAll('.measure').length===4);
console.log('PASS automatic track transition, anchor reset, no repeated source queries, opt-out and re-enable');
state.id='ambiguous';state.title='Ambiguo';state.artist='Autor Original';
await p.waitForFunction(()=>document.querySelector('#credit').getAttribute('href').endsWith('-s11')&&document.querySelector('#search-status').textContent.includes('Versão recomendada'));
assert.equal(await p.locator('#results button').count(),2);assert.equal(await p.locator('.measure').count(),4);assert((await p.locator('#credit').getAttribute('href')).endsWith('-s11'));
state.id='late';state.title='Atrasado';
for(let i=0;i<200&&!releaseSlow;i++)await p.waitForTimeout(50);assert(releaseSlow);
state.id='newer';state.title='Outro estudo';state.artist='Outro autor';
await p.waitForFunction(()=>document.querySelector('#song-title').textContent.includes('Outro estudo')&&document.querySelectorAll('.measure').length===4);
releaseSlow();await p.waitForTimeout(500);assert((await p.locator('#song-title').textContent()).includes('Outro estudo'));
state.id='absent';state.title='Ausente';
await p.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('Nenhuma música compatível'));
assert.equal(await p.locator('.measure').count(),0);
state.id='fallback-version';state.title='Estudo Original - Ao Vivo';state.artist='Autor Original';
await p.waitForFunction(()=>document.querySelectorAll('.measure').length===4&&!document.querySelector('#version-note').hidden);
assert((await p.locator('#song-title').textContent()).includes('Estudo Original'));assert.deepEqual(errors,[]);
console.log('PASS duplicate versions choose usable notes, empty first version skipped, missing song, live fallback and delayed metadata cannot replace newer track');

if(process.env.LAB_LIVE==='1'){const live=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}}),q=await live.newPage();await q.goto(base);
for(const query of (process.env.LAB_LIVE_RECOMMEND_ONLY==='1'?[]:['Nirvana Smells Like Teen Spirit','Metallica Nothing Else Matters','Red Hot Chili Peppers Californication','Eagles Hotel California','AC/DC Thunderstruck','Evanescence Bring Me To Life','Eminem Without Me'])){await q.locator('#query').fill(query);await q.locator('#search').click();await q.waitForFunction(()=>!document.querySelector('#search-status').textContent.startsWith('Buscando'),{},{timeout:30000});assert(await q.locator('#results button').count()>0,await q.locator('#search-status').textContent());await q.locator('#results button').first().click();await q.waitForFunction(()=>document.querySelectorAll('.measure').length>0||document.querySelector('#status').textContent.includes('HTTP'),{},{timeout:40000});assert(await q.locator('.measure').count()>0,await q.locator('#status').textContent());console.log(JSON.stringify({query,title:await q.locator('#song-title').textContent(),parts:await q.locator('#parts option').count(),selected:await q.locator('#parts').inputValue(),entry:await q.locator('#entry-preview').isVisible()?await q.locator('#entry-label').textContent():null,bars:await q.locator('.measure').count()}));}
// Real source with a synthetic Spotify identity: no account/session is used.
await live.addInitScript(({base})=>sessionStorage.setItem('cifrasync.songsterr-lab.pkce',JSON.stringify({client:'a'.repeat(32),verifier:'fake',state:'live-selection',redirect:base})),{base});
await q.route('https://accounts.spotify.com/api/token',r=>r.fulfill({headers:cors,json:{access_token:'test-only',expires_in:3600}}));
await q.route('https://api.spotify.com/**',r=>r.fulfill({headers:cors,json:{item:{id:'live-source-fixture',name:'Without Me',artists:[{name:'Eminem'}],duration_ms:290000},progress_ms:1000,is_playing:true}}));
await q.goto(base+'?code=fake&state=live-selection');
await q.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('Versão recomendada'),{},{timeout:90000});
const selection=await q.evaluate(()=>({title:document.querySelector('#song-title').textContent,source:document.querySelector('#credit').href,status:document.querySelector('#status').textContent,part:document.querySelector('#parts').selectedOptions[0].textContent}));
assert(!selection.source.endsWith('-s23118'),'The sparse original must yield to a usable matching version');
assert.equal(await q.locator('#alternatives').getAttribute('open'),null);
console.log('PASS real duplicate recommendation',JSON.stringify(selection));
await q.screenshot({path:'/tmp/lab-recommended.png',fullPage:false});
}
await browser.close().catch(()=>{});await new Promise(r=>server.close(r));})().catch(e=>{console.error(e);process.exit(1)});
