/* Tablatura textual: não deduz notas do áudio. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CifraTabsCore=api;})(typeof self!=='undefined'?self:globalThis,function(){
'use strict';
const instruments={guitarra:{name:'Guitarra',strings:6,tuning:'E A D G B e'},violao:{name:'Violão',strings:6,tuning:'E A D G B e'},cavaquinho:{name:'Cavaquinho',strings:4,tuning:'D G B D'}};
const row=/^\s*([A-Ga-g][#b]?)\s*\|([\s\d\-–|:~hHpPbBrR/\\xX().<>^v=+*]+)$/;
function signature(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(16);}
function extract(text){const lines=String(text||'').replace(/\r/g,'').split('\n'),out=[];let section='Tablatura';
 for(let i=0;i<lines.length;i++){
  if(/^\s*\[[^\]]+\]\s*$/.test(lines[i])&&!/\[\/?tab/i.test(lines[i]))section=lines[i].trim().replace(/^\[|\]$/g,'');
  if(!row.test(lines[i]))continue;const start=i,found=[];while(i<lines.length&&row.test(lines[i]))found.push(lines[i++]);i--;
  const cavaq=found.length%4===0&&found.every((l,n)=>row.exec(l)[1].toUpperCase()===['D','B','G','D'][n%4]);
  const count=cavaq?4:found.length%6===0?6:found.length===4?4:0;if(!count)continue;
  for(let n=0;n<found.length;n+=count){const part=found.slice(n,n+count);if(!part.some(l=>/\d/.test(row.exec(l)[2])))continue;out.push({index:out.length,line:start+n,section,strings:count,labels:part.map(l=>row.exec(l)[1]),text:part.join('\n')});}
 }return out;
}
function compatible(b,instrument){return instruments[instrument]?.strings===b.strings&&(instrument!=='cavaquinho'||b.labels.map(s=>s.toUpperCase()).join(' ')==='D B G D');}
function normalize(v){if(!v||typeof(v.body??v.sheet)!=='string')return null;const body=String(v.body??v.sheet).slice(0,200000),instrument=instruments[v.instrument]?v.instrument:'guitarra',blocks=extract(body);if(!blocks.some(b=>compatible(b,instrument)))return null;
 return {id:String(v.id||'tab:'+signature(instrument+'|'+body)).replace(/[^\w:-]/g,'').slice(0,100),body,instrument,title:String(v.title||'Tablatura importada').slice(0,200),artist:String(v.artist||'').slice(0,200),genre:String(v.genre||'').slice(0,80),source:String(v.source||'Arquivo pessoal').slice(0,100),sourceUrl:String(v.sourceUrl||'').slice(0,500),origin:v.origin==='exercise'?'exercise':'personal',trackIds:(Array.isArray(v.trackIds)?v.trackIds:[]).filter(x=>typeof x==='string').slice(0,20),sourceSongId:String(v.sourceSongId||'').slice(0,100),sheetSignature:String(v.sheetSignature||''),timings:(Array.isArray(v.timings)?v.timings:[]).filter(t=>Number.isFinite(t?.t)&&t.t>=0&&t.t<86400000&&blocks.some(b=>b.index===t.block&&compatible(b,instrument))).map(t=>({block:t.block,t:Math.round(t.t)})),timingTrackId:String(v.timingTrackId||''),timingSignature:String(v.timingSignature||''),timingDuration:Number(v.timingDuration)||0,updatedAt:Number(v.updatedAt)||Date.now()};
}
function activeBlock(entry,track,ms,line){if(!entry||!track||!entry.trackIds.includes(track.id))return null;const blocks=extract(entry.body).filter(b=>compatible(b,entry.instrument));if(!blocks.length)return null;
 const saved=entry.timingTrackId===track.id&&entry.timingSignature===signature(entry.body)&&Math.abs(entry.timingDuration-track.duration)<=3000?entry.timings:[];
 if(saved.length){let cue;for(const c of saved.slice().sort((a,b)=>a.t-b.t))if(c.t<=ms)cue=c;return cue?{index:cue.block,saved:true}:null;}
 let index=blocks[0].index;if(Number.isInteger(line)){for(const b of blocks)if(b.line<=line)index=b.index;}else index=blocks[Math.min(blocks.length-1,Math.floor(ms/Math.max(1,track.duration)*blocks.length))].index;return {index,saved:false};
}
const notes={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
const formulas={'':[0,4,7],m:[0,3,7],'7':[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11],'7M':[0,4,7,11],'6':[0,4,7,9],m6:[0,3,7,9],dim:[0,3,6],dim7:[0,3,6,9],m7b5:[0,3,6,10],sus4:[0,5,7],sus2:[0,2,7],aug:[0,4,8]};
function cavaquinho(chord,parse){const p=parse(chord),formula=p&&formulas[p.suffix];if(!formula||notes[p.root]===undefined)return null;const wanted=formula.map(n=>(n+notes[p.root])%12),tuning=[50,55,59,62],out=[];
 function visit(frets){if(frets.length<4){for(let f=0;f<=9;f++)if(wanted.includes((tuning[frets.length]+f)%12))visit([...frets,f]);return;}const positive=frets.filter(n=>n>0);if(positive.length&&Math.max(...positive)-Math.min(...positive)>3)return;
 const midi=frets.map((f,i)=>tuning[i]+f);if(!wanted.every(n=>midi.some(m=>m%12===n))||p.bass&&Math.min(...midi)%12!==notes[p.bass])return;const baseFret=Math.max(1,Math.max(...frets)-3);out.push({frets:frets.map(f=>f>0?f-baseFret+1:0),midi,baseFret,fingers:[0,0,0,0],barres:[],cost:Math.max(...frets)*3+frets.reduce((a,b)=>a+b,0)});
 }visit([]);out.sort((a,b)=>a.cost-b.cost);return out.length?{strings:4,labels:['D','G','B','D'],positions:out.slice(0,12)}:null;
}
return {instruments,signature,extract,compatible,normalize,activeBlock,cavaquinho};
});
