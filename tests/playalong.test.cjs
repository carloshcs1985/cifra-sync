const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../core.js'),P=require('../playalong-core.js');
const sheet='[Verso]\nC  G  C\nFrase original para o estudo\n[Refrão]\nAm  F';
function song(){const list=P.events(sheet,C);return {sheet,transpose:0,chordTiming:{version:1,signature:P.signature(list),trackId:'recording1',duration:20000,cues:[{event:0,t:1000},{event:1,t:4200},{event:2,t:6000},{event:3,t:10000}]}};}
test('chord occurrences retain repeated chords, sections and source positions',()=>{
 const events=P.events(sheet,C);assert.equal(events.length,5);assert.deepEqual(events.map(x=>x.chord),['C','G','C','Am','F']);assert.equal(events[2].event,2);assert.equal(events[3].section,'[Refrão]');
});
test('explicit chord timing changes exactly at its timestamp, including seeking backwards',()=>{
 const cues=P.timeline(song(),{id:'recording1',duration:20000},C);
 assert.equal(P.cueIndex(cues,999),-1);assert.equal(cues[P.cueIndex(cues,4199)].chord,'C');assert.equal(cues[P.cueIndex(cues,4200)].chord,'G');assert.equal(cues[P.cueIndex(cues,6000)].event,2);assert.equal(cues[P.cueIndex(cues,2000)].event,0);
});
test('changing source chords or playback recording invalidates timings, transposition preserves times',()=>{
 const source=song();assert.equal(P.timeline(source,{id:'other',duration:20000},C).length,0);assert.equal(P.timeline(source,{id:'recording1',duration:30000},C).length,0);assert.equal(P.timeline({...source,sheet:sheet.replace('C  G','D  A')},null,C).length,0);
 const transposed=P.timeline({...source,transpose:2},{id:'recording1',duration:20000},C);assert.deepEqual(transposed.map(c=>c.t),[1000,4200,6000,10000]);assert.equal(transposed[0].chord,'D');
 const archived={...source,chordTiming:{...source.chordTiming,trackId:'other',cues:[{event:0,t:3000}]},chordTimingHistory:[source.chordTiming]};assert.equal(P.timeline(archived,{id:'recording1',duration:20000},C)[0].t,1000);
});
test('lyric grouping preserves an instrumental intro and multiple changes inside one lyric line',()=>{
 const cues=P.timeline(song(),null,C),g=P.groupCues([{t:2000},{t:8000}],cues);
 assert.deepEqual(g.intro.map(c=>c.event),[0]);assert.deepEqual(g.groups[0].map(c=>c.event),[1,2]);assert.deepEqual(g.groups[1].map(c=>c.event),[3]);
});
test('unmarked catalogue never invents timestamps and malformed cues are bounded',()=>{
 assert.deepEqual(P.timeline({sheet},null,C),[]);
 const n=P.normalizeTiming({version:1,cues:[{event:0,t:1000},{event:0,t:2000},{event:-1,t:3000},{event:1,t:NaN},{event:2,t:-5},{event:3,t:4000}]});assert.deepEqual(n.cues,[{event:0,t:1000},{event:3,t:4000}]);
});
test('imported chord placement is retained only for matching lyric text',()=>{
 const chart='C            G\nFrase de estudo!\nAm        F\nOutra frase original';
 const aligned=P.alignLyrics(chart,[{text:'Frase de estudo'},{text:'Não corresponde'},{text:'Outra frase original'},{text:'Frase de estudo'}],C);
 assert.equal(aligned[0].chords,'C            G');assert.equal(aligned[1],null);assert.equal(aligned[2].chords,'Am        F');assert.equal(aligned[3].text,'Frase de estudo!');
});
test('complete chart keeps its own lyric lines and chord columns across blank source lines',()=>{
 const blocks=P.chartRows('[Verso]\nC       G\n\nFrase original\nAm    F\nOutra frase\nParte 1 de 2\nE|---0---1---|',C);
 assert.equal(blocks.length,2);assert.equal(blocks[0].chords,'C       G');assert.equal(blocks[0].chordLine,1);assert.equal(blocks[1].section,'[Verso]');
});
test('LRC can join or split source phrases without inventing per-word or per-chord times',()=>{
 const blocks=[{text:'Frase original'},{text:'para estudar'},{text:'Outro trecho completo'},{text:'Tenho vinte e três anos'},{text:'Unmatched content'}];
 const lyrics=[{text:'Frase original para estudar',t:1000},{text:'Outro trecho',t:5000},{text:'completo',t:6500},{text:'Tenho vinte e três anos',t:9000}];
 const links=P.matchChartLyrics(blocks,lyrics,C);assert.deepEqual(links,[{start:0,end:0},{start:0,end:0},{start:1,end:2},{start:3,end:3},null]);
 const numeric=P.matchChartLyrics([{text:'An original phrase at twenty-three'}],[{text:'An original phrase at 23'}],C);assert.deepEqual(numeric,[{start:0,end:0}]);
});
test('shared guide follows LRC phrases and explicitly labels inferred chord changes',()=>{
 const source={sheet:'[Intro]\nE\n\nC       G\nFrase original para estudo\nAm     F\nOutra frase original',kind:'personal'};
 const lyrics={lines:[{t:10000,text:'Frase original para estudo'},{t:20000,text:'Outra frase original'}]};
 const plan=P.playbackPlan(source,{id:'one',duration:30000},lyrics,C);
 assert.deepEqual(plan.events.map(e=>e.source),['structure','phrase','phrase','phrase','phrase']);
 assert(plan.events.every(e=>e.estimated));assert.equal(plan.events[1].t,10000);assert.equal(plan.events[3].t,20000);
 assert.equal(P.playbackAt(plan,10000,C).current.chord,'C');assert.deepEqual(P.playbackAt(plan,21000,C).rows,[1]);
 assert.deepEqual(P.playbackAt(plan,11000,C).rows,[0]);
 assert.equal(C.timeAt(plan.units.cum[3],plan.reading),10000);
 const transposed=P.playbackPlan({...source,transpose:2},{id:'one',duration:30000},lyrics,C);
 assert.deepEqual(transposed.events.map(e=>e.t),plan.events.map(e=>e.t));assert.equal(transposed.events[1].chord,'D');
});
test('saved occurrences override estimates without freezing all remaining unmarked chords',()=>{
 const source=song(),track={id:'recording1',duration:20000};
 const plan=P.playbackPlan(source,track,null,C);
 assert.deepEqual(plan.events.slice(0,4).map(e=>[e.t,e.estimated]),[[1000,false],[4200,false],[6000,false],[10000,false]]);
 assert.equal(plan.events[4].estimated,true);assert(plan.events[4].t>10000);assert(plan.events[4].t<20000);
 assert.equal(P.playbackAt(plan,999,C).current,null);assert.equal(P.playbackAt(plan,4200,C).current.chord,'G');assert.equal(P.playbackAt(plan,2000,C).current.chord,'C');
 const other=P.playbackPlan(source,{id:'different',duration:20000},null,C);assert(other.events.every(e=>e.estimated));
 const changed=P.playbackPlan({...source,sheet:source.sheet.replace('C  G','D  A')},track,null,C);assert(changed.events.every(e=>e.estimated));
 assert.equal(P.playbackPlan(source,null,null,C).events.length,0);
});
test('split source rows share a phrase interval and keep chord occurrence order',()=>{
 const source={sheet:'C     G\nUma frase\nAm   F\noriginal para estudo\nD\nSegunda frase original',kind:'personal'};
 const plan=P.playbackPlan(source,{duration:30000},{lines:[{t:5000,text:'Uma frase original para estudo'},{t:20000,text:'Segunda frase original'}]},C);
 assert.deepEqual(P.playbackAt(plan,10000,C).rows,[0,1]);
 assert(plan.events[2].t>plan.events[1].t);assert.equal(plan.events[4].t,20000);
 assert(plan.events.every((e,i)=>!i||e.t>=plan.events[i-1].t));
});
