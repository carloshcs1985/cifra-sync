/* Leitor conjunto e gravação de trocas por acorde. Letras ficam no aparelho. */
(function () {
  'use strict';
  const C=window.CifraCore,H=window.CifraStudyCore,P=window.CifraPlayCore;
  const $=s=>document.querySelector(s),esc=C.esc;
  let ctx,lyrics,status='',cues=[],rows=[],rowLinks=[],cueAt=-2,lineAt=-2,items=[],selected=0,editingSong='',undo=[],plan=null;
  const activeTrack=()=>ctx.viewing()?null:ctx.track();
  const stamp=t=>C.fmtTime(t)+'.'+String(Math.floor(t%1000/10)).padStart(2,'0');
  function cueButton(cue) { return '<button class="timed-chord" data-cue-time="'+cue.t+'" data-event="'+cue.event+'" aria-label="'+esc(cue.chord)+' em '+stamp(cue.t)+'">'+esc(cue.chord)+'<small>'+stamp(cue.t)+'</small></button>'; }
  function alignedHtml(block,events) {
    let out='',at=0;
    for(const token of C.tokenize(block.chords)){
      out+=esc(block.chords.slice(at,token.index));
      const event=events.find(x=>x.line===(block.chordLine??block.line-1) && x.column===token.index);
      out+=event?'<button class="aligned-hit" data-aligned-chord="'+esc(event.chord)+'" data-event="'+event.event+'">'+esc(token.text)+'</button>':esc(token.text);
      at=token.index+token.text.length;
    }
    return out+esc(block.chords.slice(at));
  }
  function render(value,message) {
    if(!ctx)return;
    lyrics=value;status=message||'';
    const song=ctx.song(),track=activeTrack(),view=$('#together-view');
    cues=P.timeline(song,track,C);plan=P.playbackPlan(song,track,lyrics,C);cueAt=-2;lineAt=-2;
    if(editingSong && editingSong!==song?.id)closeSync();
    const count=P.events(song?.sheet,C).length,title=(ctx.viewing()?song?.title:track?.title)||song?.title||'Tocar junto';
    const canSync=!!song && !!track;
    const displayText=song?C.transposeSheet(song.sheet,song.transpose||0).text:'';
    const fullRows=song?.kind!=='catalog'?P.chartRows(displayText,C):[];
    const full=fullRows.some(b=>b.chords);
    const info=cues.length ? cues.length+' de '+count+' trocas com tempo salvo' : full?'Cifra com letra e acordes alinhados':song?'Acordes sem letra alinhada':'Buscando cifra para esta faixa';
    $('#study-status').textContent=status+(song?' · '+(cues.length?cues.length+' trocas marcadas':full?'cifra com letra':'só acordes'):'');
    let html='<div class="together-heading"><span class="eyebrow">LETRA + ACORDES</span><h2>'+esc(title)+'</h2><p>'+esc(info)+'</p>';
    if(song?.sourceUrl&&window.CifraChartSource.sourceUrl(song.sourceUrl))html+='<a class="chart-credit" href="'+esc(song.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Cifra Club · cifra com letra salva neste aparelho</a>';
    if(!full&&track)html+='<button class="pill primary" data-together="lookup">Buscar cifra com letra</button>';
    if(canSync)html+='<button class="pill'+(full?'':' primary')+'" data-together="sync">'+(cues.length?'Ajustar trocas':'Sincronizar trocas')+'</button>';
    html+='</div>';
    if(song&&cues.length)html+='<div class="cue-live" aria-label="Acorde atual e próximo"><button id="cue-current" class="cue-current" disabled><small>ACORDE ATUAL</small><strong>—</strong></button><div class="cue-next"><small>PRÓXIMO</small><strong id="cue-next">'+esc(cues[0]?.chord||'—')+'</strong><span id="cue-clock">Aguardando a primeira marcação</span></div><div id="cue-diagram"></div></div>';
    if(song && !cues.length && !full)html+='<p class="sync-explanation">A biblioteca tem só a sequência de acordes. A consulta acima procura a cifra com letra já alinhada.</p>';
    const lines=full?fullRows:lyrics?.lines?.length?lyrics.lines:(lyrics?.plain||'').split('\n').filter(Boolean).map(text=>({text}));
    rowLinks=full?P.matchChartLyrics(fullRows,lyrics?.lines||[],C):lines.map((_,i)=>({start:i,end:i}));
    if(lines.length){
      const grouped=full?{groups:lines.map(l=>cues.filter(c=>c.line===l.chordLine)),intro:[]}:lyrics.lines?.length?P.groupCues(lines,cues):{groups:lines.map(()=>[]),intro:cues};
      const aligned=full?fullRows:P.alignLyrics(displayText,lines,C);
      const displayEvents=P.events(displayText,C);
      html+='<div class="together-lines">';
      if(grouped.intro.length)html+='<div class="instrumental-cues"><small>INTRO / INSTRUMENTAL</small>'+grouped.intro.map(cueButton).join('')+'</div>';
      html+=lines.map((l,i)=>{const link=rowLinks[i],time=full?(link?lyrics.lines[link.start].t:null):l.t;return '<div class="together-line'+(aligned[i]?.chords?' imported-alignment':'')+'" data-together-line="'+i+'"'+(Number.isFinite(time)?' data-line-time="'+time+'"':'')+'><div class="line-cues">'+grouped.groups[i].filter(c=>!aligned[i]?.chords||c.line!==(aligned[i].chordLine??aligned[i].line-1)).map(cueButton).join('')+'</div>'+(aligned[i]?.chords?'<div class="imported-line"><pre class="aligned-chords">'+alignedHtml(aligned[i],displayEvents)+'</pre><pre class="together-text">'+esc(aligned[i].text)+'</pre></div>':'<div class="together-text">'+esc(l.text||'♪')+'</div>')+'</div>';}).join('');
      html+='</div>';
    }else{
      html+='<p class="lyric-empty">'+esc(status||'Dê play no Spotify ou escolha uma música.')+'</p>';
      if(cues.length)html+='<div class="instrumental-cues">'+cues.map(cueButton).join('')+'</div>';
    }
    if(song)html+='<details class="together-score"'+(!lines.length&&!cues.length?' open':'')+'><summary>Ver sequência de acordes</summary><pre>'+esc(C.transposeSheet(song.sheet,song.transpose||0).text)+'</pre></details>';
    if(!lyrics)html+='<button class="btn" data-together="import">Importar letra com cifra ou LRC</button>';
    view.innerHTML=html;rows=[...view.querySelectorAll('[data-together-line]')];
  }
  function focus(cue) {
    document.querySelectorAll('#together-view .timed-chord,#together-view .aligned-hit').forEach(b=>b.classList.toggle('active',!!cue&&+b.dataset.event===cue.event));
    const button=$('#cue-current');if(!button)return;
    button.disabled=!cue;button.dataset.chord=cue?.chord||'';
    button.querySelector('strong').textContent=cue?.chord||'—';
    const box=$('#cue-diagram');
    box.innerHTML=cue?ctx.svg(cue.chord):'';
    if(cue)ctx.shapes().then(()=>{if(button.dataset.chord===cue.chord)box.innerHTML=ctx.svg(cue.chord);}).catch(()=>{});
  }
  function playback(ms) { return P.playbackAt(plan,ms,C); }
  function frame(ms,holding,state=playback(ms)) {
    if(!ctx)return true;
    const i=state?.current?.event??-1;
    if(i!==cueAt){
      cueAt=i;focus(state?.current);const next=state?.next;
      if($('#cue-next'))$('#cue-next').textContent=next?.chord||'—';
      if($('#cue-clock'))$('#cue-clock').textContent=next?(next.estimated?'Guia estimado · ':'Troca salva · ')+stamp(next.t):'Fim da sequência';
    }
    const full=!!plan?.rows.some(r=>r.chords);
    const active=full?(state?.rows||[]).map(i=>rows[i]).filter(Boolean):rows.filter((_,i)=>rowLinks[i]&&state?.lyric>=rowLinks[i].start&&state?.lyric<=rowLinks[i].end);
    const key=active.map(r=>r.dataset.togetherLine).join(',');
    if(key!==lineAt){rows.forEach(r=>r.classList.remove('active'));lineAt=key;active.forEach(r=>r.classList.add('active'));}
    if(!holding && !ctx.viewing() && active.length){
      const sc=$('#scroller'),live=$('#together-view .cue-live'),padding=(live?.offsetHeight||0)+sc.clientHeight*.15;
      const y=active[0].offsetTop-padding;sc.scrollTop+=(Math.max(0,y)-sc.scrollTop)*.15;
    }
    if(!$('#ov-chord-sync').hidden){$('#sync-clock').textContent=stamp(ctx.time());$('#sync-play').textContent=ctx.isPlaying()?'Pausar':'Reproduzir';}
    return true;
  }
  function timingFor(song,track) {
    const sig=P.signature(items),old=[song.chordTiming,...(song.chordTimingHistory||[])].map(P.normalizeTiming).find(t=>t&&t.signature===sig&&t.trackId===track.id);
    return old && old.signature===sig && old.trackId===track.id ? old : {version:1,signature:sig,trackId:track.id,duration:track.duration,cues:[]};
  }
  function openSync() {
    const song=ctx.song(),track=activeTrack();
    if(!song||!track){ctx.notify('Dê play nesta música no Spotify para sincronizar.');return;}
    items=P.events(song.sheet,C);if(!items.length)return;
    editingSong=song.id;undo=[];
    const saved=timingFor(song,track),have=new Set(saved.cues.map(x=>x.event));
    selected=items.findIndex(x=>!have.has(x.event));if(selected<0)selected=0;
    $('#ov-chord-sync').hidden=false;drawSync();
  }
  function closeSync() { $('#ov-chord-sync').hidden=true;editingSong='';undo=[]; }
  function drawSync() {
    const song=ctx.song(),track=activeTrack();if(!song||!track){closeSync();return;}
    const display=P.events(C.transposeSheet(song.sheet,song.transpose||0).text,C),saved=timingFor(song,track),byEvent=new Map(saved.cues.map(c=>[c.event,c]));
    const next=display[selected];
    $('#sync-mark').disabled=!next;$('#sync-mark').textContent=next?'Marcar '+next.chord+' agora':'Todas as trocas foram marcadas';
    $('#sync-caption').textContent=next?(selected+1)+' / '+items.length+' · '+(items[selected].section||'Sequência da cifra'):'Salvo no aparelho. Você pode selecionar um acorde para ajustar.';
    $('#sync-undo').disabled=!undo.length;
    $('#sync-events').innerHTML=display.map((x,i)=>'<button class="sync-event'+(i===selected?' selected':'')+(byEvent.has(i)?' saved':'')+'" data-sync-event="'+i+'"><small>'+(i+1)+'</small><strong>'+esc(x.chord)+'</strong><span>'+ (byEvent.has(i)?stamp(byEvent.get(i).t):'sem tempo')+'</span></button>').join('');
    const picked=$('#sync-events .selected');if(picked)$('#sync-events').scrollTop=Math.max(0,picked.offsetTop-$('#sync-events').offsetTop-60);
  }
  async function mark() {
    const song=ctx.song(),track=activeTrack();
    if(!song||song.id!==editingSong||!track||!ctx.isPlaying()){ctx.notify('Dê play antes de marcar a troca.');return;}
    const timing=timingFor(song,track),time=Math.round(ctx.time());if(!items[selected]||time>track.duration)return;
    const before=JSON.parse(JSON.stringify({timing:song.chordTiming||null,history:song.chordTimingHistory||[]}));
    const previous=timing.cues.filter(c=>c.event<selected).sort((a,b)=>b.event-a.event)[0],next=timing.cues.filter(c=>c.event>selected).sort((a,b)=>a.event-b.event)[0];
    if((previous&&time<=previous.t)||(next&&time>=next.t)){ctx.notify('O tempo precisa ficar entre as trocas vizinhas. Volte ao trecho para ajustar.');return;}
    undo.push({before,selected});timing.cues=timing.cues.filter(c=>c.event!==selected);timing.cues.push({event:selected,t:time});timing.cues.sort((a,b)=>a.t-b.t);
    if(song.chordTiming && song.chordTiming.trackId!==track.id)song.chordTimingHistory=[song.chordTiming,...(song.chordTimingHistory||[]).filter(t=>t.trackId!==song.chordTiming.trackId)].slice(0,20);
    song.chordTiming=timing;selected++;await ctx.changed();render(lyrics,status);drawSync();
  }
  async function undoMark() {
    const item=undo.pop(),song=ctx.song();if(!item||song?.id!==editingSong)return;
    song.chordTiming=item.before.timing;song.chordTimingHistory=item.before.history;selected=item.selected;await ctx.changed();render(lyrics,status);drawSync();
  }
  function init(context) {
    ctx=context;
    $('#together-view').onclick=e=>{
      if(ctx.recording()){const row=e.target.closest('[data-together-line]');if(row){const source=plan?.rows[+row.dataset.togetherLine];if(source)ctx.alignHere(source.line);else ctx.notify('Use a aba Cifra para marcar este trecho.');}return;}

      const action=e.target.closest('[data-together]')?.dataset.together;
      if(action==='sync')openSync();if(action==='import')$('#import-songs').click();
      if(action==='lookup')ctx.lookupChart();
      const current=e.target.closest('#cue-current');if(current?.dataset.chord)ctx.openChord(current.dataset.chord);
      const hit=e.target.closest('[data-aligned-chord]');if(hit){ctx.openChord(hit.dataset.alignedChord);return;}
      const cue=e.target.closest('[data-cue-time]'),line=e.target.closest('[data-line-time]');
      if(activeTrack()&&(cue||line))ctx.seek(+(cue?cue.dataset.cueTime:line.dataset.lineTime));
    };
    $('#sync-close').onclick=closeSync;$('#sync-mark').onclick=()=>mark().catch(()=>ctx.notify('Não consegui salvar a troca.'));
    $('#sync-undo').onclick=()=>undoMark().catch(()=>ctx.notify('Não consegui desfazer a troca.'));
    $('#sync-play').onclick=()=>ctx.toggle();$('#sync-back').onclick=()=>ctx.seek(Math.max(0,ctx.time()-10000));
    $('#sync-events').onclick=e=>{const b=e.target.closest('[data-sync-event]');if(b){selected=+b.dataset.syncEvent;drawSync();}};
  }
  function clear(){closeSync();plan=null;lyrics=null;cues=[];rows=[];rowLinks=[];cueAt=-2;lineAt=-2;}
  window.CifraTogether={init,render,frame,clear,playback};
})();
