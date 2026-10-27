const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../core.js'),H=require('../study-core.js');
const shapes=require('../assets/chord-shapes.json');
test('LRC preserves multiple timestamps, fractions, blank pauses and offset',()=>{
 assert.deepEqual(H.parseLrc('[offset:150]\n[00:01.50][00:03.000]Linha de estudo\n[00:05.00]'),[{t:1650,text:'Linha de estudo'},{t:3150,text:'Linha de estudo'},{t:5150,text:''}]);
 assert.deepEqual(H.parseLrc('[00:99]tempo inválido'),[]);
 assert.equal(H.lyricIndex([{t:1000},{t:5000}],500),-1);assert.equal(H.lyricIndex([{t:1000},{t:5000}],5000),1);
});
test('lyric matching rejects wrong artist, wrong recording type and duration',()=>{
 const track={title:'My Sacrifice',artist:'Creed',duration:294600};
 const row={trackName:'My Sacrifice',artistName:'Creed',duration:295};
 assert(H.matchLyrics(track,row));assert(!H.matchLyrics(track,{...row,artistName:'Outro artista'}));
 assert(!H.matchLyrics(track,{...row,duration:320}));assert(!H.matchLyrics({...track,title:'My Sacrifice - Live'},row));
 assert(H.matchLyrics({...track,title:'My Sacrifice (Remastered 2025)'},row));
});
test('common Brazilian chord aliases preserve distinct harmony and bass',()=>{
 const major7=H.chordLookup('C7M',shapes,C.parseChordToken);assert.equal(major7.suffix,'maj7');
 assert(major7.positions[0].midi.some(n=>n%12===11));assert(!major7.positions[0].midi.some(n=>n%12===10));
 const minor7=H.chordLookup('Bm7',shapes,C.parseChordToken);assert.equal(minor7.suffix,'m7');
 assert(minor7.positions[0].midi.some(n=>n%12===2));
 const slash=H.chordLookup('D/F#',shapes,C.parseChordToken);assert.equal(slash.positions[0].midi[0]%12,6);
 for(const ch of ['Am7','Bm','G5','F#m'])assert(H.chordLookup(ch,shapes,C.parseChordToken));
 assert.equal(H.chordLookup('Cunknown',shapes,C.parseChordToken),null);
});
test('ChordPro retains imported lyric alignment and multiple songs',()=>{
 const songs=C.parseImportFile('exercicios.cho','{title: Estudo Um}\n{artist: Autor do Teste}\n[C]Frase [Am]original\n{new_song}\n{title: Estudo Dois}\n{artist: Autor do Teste}\n[D]Outra frase [G]original');
 assert.equal(songs.length,2);assert(songs.every(s=>s.hasChords));assert(songs[0].sheet.includes('Frase'));
});
test('Cifra Club paths omit apostrophes rather than adding incorrect hyphens',()=>{
 assert.equal(C.cifraClubUrl('No Doubt',"Don't Speak"),'https://www.cifraclub.com.br/no-doubt/dont-speak/');
 assert.equal(C.cifraClubUrl('blink-182',"What's My Age Again?"),'https://www.cifraclub.com.br/blink-182/whats-my-age-again/');
});
