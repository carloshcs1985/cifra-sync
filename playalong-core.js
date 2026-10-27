/* Marcações salvas e guia estimado, sempre identificados separadamente. */
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
  function playbackPlan(song, track, lyrics, C) {
    const text=String(song?.sheet||''),source=text.split('\n'),units=C.computeUnits(source.map(C.classifyLine));
    const rows=song?.kind==='catalog'?[]:chartRows(text,C),lines=lyrics?.lines||[],links=matchChartLyrics(rows,lines,C);
    const duration=track?.duration||0,automatic=[],groups=[];
    links.forEach((link,i)=>{
      if(!link)return;
      let group=groups.at(-1);
      if(!group||group.start!==link.start||group.end!==link.end){group={...link,rows:[]};groups.push(group);}
      group.rows.push(i);
    });
    for(const group of groups){
      const row=rows[group.rows[0]],t=lines[group.start].t;
      automatic.push({line:row.chordLine>=0?row.chordLine:row.line,t});
    }
    // Personal line anchors replace automatic anchors at the same source position.
    const personal=song?.anchors||[],anchored=new Set(personal.map(a=>a.line));
    const reading=C.buildTimeline(personal.length?personal:[...automatic.filter(a=>!anchored.has(a.line)),...personal],units.cum,units.total,duration);
    const original=events(text,C),display=events(C.transposeSheet(text,song?.transpose||0).text,C);
    const guide=original.map((event,i)=>{
      const next=source[event.line+1]||'',paired=C.classifyLine(next)==='lyric';
      const line=paired?event.line+1:event.line;
      const length=Math.max(1,source[event.line].length,paired?next.length:0);
      const fraction=Math.min(.98,event.column/length);
      const w=units.cum[line]+(units.w[line]||0)*fraction;
      return {...event,chord:display[i]?.chord||event.chord,t:C.timeAt(w,reading)||0,source:'structure',estimated:true};
    });
    for(const group of personal.length?[]:groups){
      const start=lines[group.start].t,end=lines[group.end+1]?.t??duration;
      if(!(end>start))continue;
      const total=group.rows.reduce((n,i)=>n+Math.max(1,rows[i].text.trim().length),0);let offset=0;
      for(const index of group.rows){
        const row=rows[index],length=Math.max(1,row.text.trim().length),indent=row.text.length-row.text.trimStart().length;
        for(const event of guide)if(event.line===row.chordLine){
          event.t=start+(end-start)*(offset+Math.max(0,Math.min(length-.01,event.column-indent)))/total;
          event.source='phrase';
        }
        offset+=length;
      }
    }
    let previous=0;for(const event of guide){event.t=Math.max(previous,Math.min(duration,event.t));previous=event.t;}
    const saved=timeline(song,track,C).filter((cue,i,all)=>!i||cue.event>all[i-1].event);
    if(saved.length){
      const base=guide.map(e=>e.t),controls=[...saved];
      if(controls[0].event>0)controls.unshift({event:0,t:0});
      controls.push({event:guide.length,t:duration});
      for(let i=0;i<controls.length-1;i++){
        const a=controls[i],b=controls[i+1],span=(base[b.event]??duration)-base[a.event];
        for(let n=a.event;n<b.event;n++){
          const fraction=span>0?(base[n]-base[a.event])/span:(n-a.event)/(b.event-a.event);
          guide[n].t=a.t+(b.t-a.t)*Math.max(0,Math.min(1,fraction));
        }
      }
      for(const cue of saved)Object.assign(guide[cue.event],{t:cue.t,source:'saved',estimated:false});
    }
    return {events:duration?guide:[],rows,links,lyrics:lines,units,reading,duration,manual:personal.length>0};
  }
  function playbackAt(plan, ms, C) {
    if(!plan)return null;
    const index=cueIndex(plan.events,ms),current=plan.events[index]||null,next=plan.events[index+1]||null;
    const lyric=cueIndex(plan.lyrics,ms),matched=[];
    plan.links.forEach((link,i)=>{if(!plan.manual&&link&&lyric>=link.start&&lyric<=link.end)matched.push(i);});
    const w=C.positionAt(ms,plan.reading),line=C.unitAt(w,plan.units);
    if(!matched.length){
      let row=-1;plan.rows.forEach((r,i)=>{if((r.chordLine>=0?r.chordLine:r.line)<=line)row=i;});
      if(row>=0)matched.push(row);
    }
    return {current,next,lyric,rows:matched,w,line};
  }
  return {events,signature,normalizeTiming,timeline,cueIndex,groupCues,alignLyrics,chartRows,matchChartLyrics,playbackPlan,playbackAt};
});
