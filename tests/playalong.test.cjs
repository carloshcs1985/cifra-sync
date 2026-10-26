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
