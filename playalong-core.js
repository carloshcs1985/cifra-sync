/* Tempos explícitos de acordes: nenhuma duração é deduzida do tamanho da letra. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CifraPlayCore = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';
  function events(sheet, C) {
    const result = []; let section = '';
    String(sheet || '').split('\n').forEach((line, row) => {
      if (C.classifyLine(line) === 'section') section = line.trim();
      if (C.classifyLine(line) !== 'chords') return;
      for (const token of C.tokenize(line)) {
        const p = C.parseChordToken(token.text);
        if (p) result.push({ event:result.length, line:row, column:token.index, chord:p.root+p.suffix+(p.bass?'/'+p.bass:''), section });
      }
    });
    return result;
  }
  function signature(items) {
    const text = items.map(x => [x.line,x.column,x.chord].join(':')).join('|');
    let hash = 2166136261;
    for (let i=0; i<text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i),16777619);
    return (hash >>> 0).toString(16);
  }
  function normalizeTiming(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.cues)) return null;
    const seen = new Set(), cues = [];
    for (const cue of value.cues.slice(0,10000)) {
      if (!cue || !Number.isInteger(cue.event) || cue.event<0 || !Number.isFinite(cue.t) || cue.t<0 || cue.t>86400000 || seen.has(cue.event)) continue;
      seen.add(cue.event); cues.push({event:cue.event,t:Math.round(cue.t)});
    }
    return {version:1,signature:String(value.signature||'').slice(0,40),trackId:String(value.trackId||'').slice(0,120),duration:Math.max(0,Math.min(86400000,Number(value.duration)||0)),cues:cues.sort((a,b)=>a.t-b.t || a.event-b.event)};
  }
  function timeline(song, track, C) {
    const items = events(song?.sheet,C), candidates=[song?.chordTiming,...(Array.isArray(song?.chordTimingHistory)?song.chordTimingHistory:[])].map(normalizeTiming).filter(Boolean);
    const timing=(track?candidates.find(t=>t.trackId===track.id):null)||candidates[0];
    if (!timing || timing.signature !== signature(items)) return [];
    if (track && timing.trackId && timing.trackId !== track.id) return [];
    if (track?.duration && timing.duration && Math.abs(track.duration-timing.duration)>3000) return [];
    const display = events(C.transposeSheet(song.sheet,song.transpose||0).text,C);
    return timing.cues.filter(c=>items[c.event] && (!timing.duration || c.t<=timing.duration)).map(c=>({...items[c.event],...c,chord:display[c.event]?.chord||items[c.event].chord}));
  }
  function cueIndex(cues, time) {
    let lo=0,hi=cues.length-1,result=-1;
    while(lo<=hi){const mid=(lo+hi)>>1;if(cues[mid].t<=time){result=mid;lo=mid+1;}else hi=mid-1;}
    return result;
  }
  function groupCues(lines, cues) {
    const groups = lines.map(()=>[]), intro=[];
    for(const cue of cues){const i=cueIndex(lines,cue.t);if(i<0)intro.push(cue);else groups[i].push(cue);}
    return {groups,intro};
  }
  function alignLyrics(sheet, lyrics, C) {
    const key=s=>C.fold(s).replace(/[^a-z0-9]+/g,' ').trim();
    const source=String(sheet||'').split('\n'),blocks=[];
    source.forEach((text,i)=>{
      if(C.classifyLine(text)!=='lyric'||!key(text))return;
      const chords=i>0&&C.classifyLine(source[i-1])==='chords'?source[i-1]:'';
      blocks.push({text,chords,key:key(text),line:i});
    });
    let cursor=-1;
    return lyrics.map(lyric=>{
      const matches=blocks.filter(b=>b.key===key(lyric.text));
      let found=matches.find(b=>b.line>cursor);
      // A repeated phrase is reusable only if its imported chord placement agrees.
      if(!found && matches.length && new Set(matches.map(b=>b.chords)).size===1)found=matches[0];
      if(found)cursor=found.line;
      return found||null;
    });
  }
  function chartRows(sheet,C) {
    const source=String(sheet||'').split('\n'),out=[];let section='';
    source.forEach((text,line)=>{
      const type=C.classifyLine(text);
      if(type==='section'&&!/\[tab\b/i.test(text))section=text.trim();
      if(type!=='lyric'||!text.trim()||/^\s*(?:Parte\s+\d+\s+de\s+\d+|Tom\s*:|Afina[çc][aã]o\s*:)/i.test(text))return;
      let before=line-1;while(before>=0&&!source[before].trim())before--;
      const chordLine=before>=0&&C.classifyLine(source[before])==='chords'?before:-1;
      out.push({text,line,chords:chordLine>=0?source[chordLine]:'',chordLine,section});
    });return out;
  }
  function matchChartLyrics(blocks,lyrics,C) {
    const units={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9};
    const tens={twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
    const norm=text=>C.fold(text).replace(/[^a-z0-9]+/g,' ').trim().replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s+(one|two|three|four|five|six|seven|eight|nine))?\b/g,(_,a,b)=>String(tens[a]+(units[b]||0)));
    const result=blocks.map(()=>null),bt=blocks.map(b=>norm(b.text)),lt=lyrics.map(l=>norm(l.text));
    let cursor=0;
    for(let i=0;i<lyrics.length;i++){
      if(!lt[i])continue;let found;
      for(let b=cursor;b<Math.min(blocks.length,cursor+12)&&!found;b++){
        for(let bn=1;bn<=3&&b+bn<=blocks.length&&!found;bn++){
          const left=bt.slice(b,b+bn).join(' ');
          for(let ln=1;ln<=3&&i+ln<=lyrics.length;ln++){
            if(left===lt.slice(i,i+ln).join(' ')){found={b,bn,ln};break;}
          }
        }
      }
      if(found){for(let b=found.b;b<found.b+found.bn;b++)result[b]={start:i,end:i+found.ln-1};cursor=found.b+found.bn;i+=found.ln-1;}
    }return result;
  }
  return {events,signature,normalizeTiming,timeline,cueIndex,groupCues,alignLyrics,chartRows,matchChartLyrics};
});
