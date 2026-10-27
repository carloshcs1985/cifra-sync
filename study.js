/* Letras por faixa, LRC local e posições dos acordes. Nenhuma letra vem no código. */
(function () {
  'use strict';
  const C = window.CifraCore, H = window.CifraStudyCore, DB = window.CifraDB;
  const $ = s => document.querySelector(s);
  let ctx, mode = 'together', lyrics = null, lyricEls = [], lyricAt = -1, currentId = '', requestId = 0, controller;
  let shapePromise, shapes, selectedChord = '', selectedPosition = 0, status = '', barTicket = 0, barFocus = null;
  const esc = C.esc;
  function shapeData() {
    if (!shapePromise) shapePromise = fetch('assets/chord-shapes.json').then(r => { if (!r.ok) throw new Error('Diagramas indisponíveis.'); return r.json(); }).then(j => (shapes = j)).catch(e => { shapePromise = null; throw e; });
    return shapePromise;
  }
  function shapeSvg(chord, position = 0) {
    const entry = shapes && H.chordLookup(chord, shapes, C.parseChordToken);
    if (!entry) return '<p class="sub diagram-unavailable">Forma não cadastrada nesta afinação.</p>';
    const p = entry.positions[position % entry.positions.length];
    const top = 32, left = 22, step = 18, height = 23, frets = Math.max(4, ...p.frets.filter(n => n > 0));
    let svg = `<svg viewBox="0 0 144 ${top + frets * height + 25}" role="img" aria-label="${esc(chord)}: posição ${position + 1}, casa inicial ${p.baseFret}">`;
    for (let s = 0; s < 6; s++) svg += `<path d="M${left+s*step} ${top}V${top+frets*height}" stroke="currentColor" stroke-width=".7" fill="none"/>`;
    for (let f = 0; f <= frets; f++) svg += `<path d="M${left} ${top+f*height}H${left+5*step}" stroke="currentColor" stroke-width="${f===0 && p.baseFret===1 ? 3 : .7}" fill="none"/>`;
    if (p.baseFret > 1) svg += `<text x="3" y="${top+17}" class="fret-label">${p.baseFret}</text>`;
    for (const barre of p.barres || []) {
      const strings = p.frets.map((f, i) => f === barre ? i : -1).filter(i => i >= 0);
      if (strings.length > 1) svg += `<path d="M${left+strings[0]*step} ${top+(barre-.5)*height}H${left+strings.at(-1)*step}" stroke="currentColor" stroke-linecap="round" stroke-width="13" fill="none"/>`;
    }
    p.frets.forEach((f, i) => {
      const x = left+i*step;
      if (f <= 0) svg += `<text x="${x}" y="20" text-anchor="middle" class="open-string">${f<0?'×':'○'}</text>`;
      else {
        const y = top+(f-.5)*height;
        svg += `<circle cx="${x}" cy="${y}" r="7"/><text x="${x}" y="${y+3}" text-anchor="middle" class="finger-number">${p.fingers[i]||''}</text>`;
      }
      svg += `<text x="${x}" y="${top+frets*height+18}" text-anchor="middle" class="string-label">${['E','A','D','G','B','e'][i]}</text>`;
    });
    return svg + '</svg>';
  }
  function chords() {
    const song = ctx.song(); if (!song) return [];
    const text = C.transposeSheet(song.sheet, song.transpose || 0).text;
    const found = new Set();
    for (const line of text.split('\n')) if (C.classifyLine(line) === 'chords') for (const t of C.tokenize(line)) {
      const p = C.parseChordToken(t.text); if (p) found.add(p.root+p.suffix+(p.bass?'/'+p.bass:''));
    }
    return [...found];
  }
  async function diagrams() {
    const items = chords();
    $('#chords-view').innerHTML = '<p class="sub">Carregando posições…</p>';
    try {
      await shapeData();
      $('#chords-view').innerHTML = `<div class="reader-heading"><span class="eyebrow">POSIÇÕES PARA ESTUDAR</span><h2>Acordes da música</h2><p>Afinação padrão E A D G B e · toque para ver outras posições.<br>1 indicador · 2 médio · 3 anelar · 4 mínimo · × não tocar · ○ corda solta</p></div>` +
        (items.length ? '<div class="chord-grid">' + items.map(ch => `<button class="chord-card" data-chord="${esc(ch)}"><strong>${esc(ch)}</strong>${shapeSvg(ch)}</button>`).join('') + '</div>' : '<p>Importe uma cifra para visualizar os acordes.</p>');
    } catch (e) { $('#chords-view').textContent = e.message; }
  }
  async function renderChordbar() {
    if(!ctx)return;
    const ticket=++barTicket,bar=$('#chordbar');
    const items=chords();
    if(ctx.settings().diagrams===false || !['sheet','together'].includes(mode) || !items.length){bar.hidden=true;return;}
    try{
      await shapeData();if(ticket!==barTicket)return;
      bar.innerHTML='<div class="chordbar-now"><small>ACORDE</small><strong id="chordbar-current">—</strong><span id="chordbar-timing">Dê play para acompanhar</span></div><div class="chordbar-cards">'+items.map(ch=>`<button class="study-chord-mini" data-chord="${esc(ch)}" aria-label="Ver posições de ${esc(ch)}"><strong>${esc(ch)}</strong>${shapeSvg(ch)}</button>`).join('')+'</div>';bar.hidden=false;barFocus=null;
      focusChords(window.CifraTogether.playback(ctx.viewing()?0:ctx.time()));
      ctx.sheetReady?.();
    }catch{bar.hidden=true;}
  }
  function focusChords(state) {
    const bar=$('#chordbar');if(bar.hidden)return;
    const cue=ctx.viewing()?null:state?.current,name=cue?.chord||'';
    const label=cue?(cue.source==='saved'?'Marcação salva':cue.source==='phrase'?'Estimado pela frase':'Estimado pela estrutura'):'Dê play para acompanhar';
    if($('#chordbar-current').textContent!== (name||'—'))$('#chordbar-current').textContent=name||'—';
    if($('#chordbar-timing').textContent!==label)$('#chordbar-timing').textContent=label;
    const list=bar.querySelector('.chordbar-cards');let active;
    for(const card of list.children){
      const on=card.dataset.chord===name;card.classList.toggle('active',on);
      if(on){card.setAttribute('aria-current','true');active=card;}else card.removeAttribute('aria-current');
    }
    const changed=barFocus!==name;barFocus=name;
    if(changed && active && (active.offsetLeft<list.scrollLeft || active.offsetLeft+active.clientWidth>list.scrollLeft+list.clientWidth))list.scrollTo({left:Math.max(0,active.offsetLeft-list.clientWidth/2+active.clientWidth/2),behavior:'smooth'});
  }
  async function openChord(chord) {
    selectedChord = chord; selectedPosition = 0;
    $('#chord-modal').hidden = false;
    $('#chord-shape').textContent = 'Carregando…';
    try { await shapeData(); drawChord(); } catch (e) { $('#chord-shape').textContent = e.message; }
  }
  function drawChord() {
    const entry = H.chordLookup(selectedChord, shapes, C.parseChordToken);
    $('#chord-title').textContent = selectedChord;
    $('#chord-shape').innerHTML = shapeSvg(selectedChord, selectedPosition);
    $('#chord-position').textContent = entry ? `Posição ${selectedPosition+1} de ${entry.positions.length}` : 'Sem posição cadastrada';
    $('#chord-prev').disabled = $('#chord-next').disabled = !entry || entry.positions.length < 2;
  }
  function setMode(next) {
    mode = next;
    document.body.dataset.study = mode;
    document.querySelectorAll('[data-study-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.studyMode === mode)));
    $('#sheet').hidden = mode !== 'sheet' || !ctx.song();
    $('#empty').hidden = mode !== 'sheet' || !!ctx.song();
    $('#lyrics-view').hidden = mode !== 'lyrics'; $('#chords-view').hidden = mode !== 'chords';
    $('#together-view').hidden = mode !== 'together';
    $('#scroller').scrollTop = 0; ctx.resetScroll();
    if (mode === 'chords') diagrams();
    if (mode === 'lyrics') renderLyrics();
    renderChordbar();
    ctx.sheetReady?.();
    updateStrip(ctx.viewing()?0:ctx.time());
    ctx.controls?.();
  }
  function setStatus(text) { status = text; $('#study-status').textContent = text; }
  function renderLyrics() {
    window.CifraTogether.render(lyrics,status);
    const song = ctx.song();
    const title = (ctx.viewing?.() ? song?.title : ctx.track()?.title) || song?.title || 'Letra da música';
    const heading = `<div class="reader-heading"><span class="eyebrow">LETRA</span><h2>${esc(title)}</h2><p>${esc(status)}</p></div>`;
    if (!lyrics) {
      $('#lyrics-view').innerHTML = heading + '<div class="lyric-empty"><p>A letra aparece aqui quando houver uma versão disponível ou um arquivo seu importado.</p><button class="btn" id="lyrics-import-shortcut">Importar LRC ou TXT com cifra</button></div>';
      $('#lyrics-import-shortcut').onclick = () => $('#import-songs').click(); lyricEls = []; return;
    }
    const lines = lyrics.lines.length ? lyrics.lines : lyrics.plain.split('\n').map(text => ({text}));
    $('#lyrics-view').innerHTML = heading + '<div class="lyric-lines">' + lines.map((l,i) => `<div class="lyric-line" data-lyric-index="${i}">${esc(l.text)||'♪'}</div>`).join('') + '</div>';
    lyricEls = [...$('#lyrics-view').querySelectorAll('.lyric-line')]; lyricAt = -1;
  }
  async function loadLyrics(track, song) {
    const ticket = ++requestId; controller?.abort(); lyrics = null; lyricAt = -1;
    const id = track?.id || (song ? 'key:' + song.key : '');
    currentId = id;
    if (!id) { setStatus('Escolha uma música para estudar'); renderLyrics(); return; }
    const ownLines = song && song.kind !== 'catalog' ? song.sheet.split('\n').filter(l => C.classifyLine(l) === 'lyric' && l.trim()) : [];
    setStatus('Procurando letra salva…');
    renderLyrics();
    try {
      const cached = await DB.lyrics(id) || (song?.key ? await DB.lyrics('key:' + song.key) : null);
      if (ticket !== requestId) return;
      if (ownLines?.length) {
        lyrics = { plain: ownLines.join('\n'), lines: [], source:'Arquivo importado' };
        setStatus('Letra da sua cifra · sem tempos de voz'); renderLyrics();
      }
      if (cached && !cached.missing) {
        lyrics = cached; setStatus(cached.lines.length ? 'Letra com tempos · '+cached.source : 'Letra sem tempos · '+cached.source); renderLyrics(); return;
      }
      if (!track || ctx.demo() || ctx.settings().autoLyrics === false) { setStatus(ownLines.length?'Letra da sua cifra · sem tempos de voz':'Importe um LRC ou ative a consulta de letra no menu'); renderLyrics(); return; }
      if (cached?.missing && Date.now()-cached.at < 24*3600000) { setStatus(ownLines.length?'Cifra com letra salva · tempos da voz indisponíveis':'Sem letra correspondente no serviço · você pode importar um LRC'); renderLyrics(); return; }
      setStatus('Consultando letra no LRCLIB…'); renderLyrics();
      controller = new AbortController(); const ownController = controller, signal = ownController.signal;
      const timer = setTimeout(() => ownController.abort(), 10000);
      try {
        const params = new URLSearchParams({ track_name: track.title, artist_name: track.artist.split(',')[0], duration:String(Math.round(track.duration/1000)) });
        if (track.album) params.set('album_name', track.album);
        let response = await fetch('https://lrclib.net/api/get?' + params, { signal });
        if(response.status===404 && (track.album || H.lyricTitle(track.title)!==track.title)){
          params.delete('album_name');params.set('track_name',H.lyricTitle(track.title));
          response=await fetch('https://lrclib.net/api/get?' + params, { signal });
        }
        if (ticket !== requestId) return;
        if (response.status === 404) { await DB.lyrics(id, { missing:true, at:Date.now() }); setStatus(ownLines.length?'Cifra com letra salva · tempos da voz indisponíveis':'Sem letra correspondente no serviço · importe um LRC'); renderLyrics(); return; }
        if (!response.ok) throw new Error('Serviço de letras indisponível.');
        const result = await response.json();
        if (ticket !== requestId) return;
        if (!H.matchLyrics(track, result)) { setStatus('A versão da letra não corresponde à gravação · importe um LRC'); renderLyrics(); return; }
        const synced = String(result.syncedLyrics || '').slice(0, 200000), plain = String(result.plainLyrics || '').slice(0, 200000);
        if (!synced && !plain) { setStatus(result.instrumental ? 'Faixa instrumental' : 'Letra indisponível'); renderLyrics(); return; }
        lyrics = { plain:plain || H.parseLrc(synced).map(l=>l.text).join('\n'), lines:H.parseLrc(synced), source:'LRCLIB', providerId:result.id, at:Date.now() };
        await DB.lyrics(id, lyrics);
        if (ticket !== requestId) return;
        setStatus(lyrics.lines.length ? 'Letra com tempos · LRCLIB' : 'Letra sem tempos · LRCLIB'); renderLyrics();
      } finally { clearTimeout(timer); }
    } catch (e) {
      if (ticket !== requestId) return;
      setStatus(ownLines.length?'Cifra com letra salva · não consegui consultar os tempos da voz':e.name==='AbortError' ? 'Consulta de letra interrompida · tente novamente no menu' : 'Letra não carregada · confira a conexão ou importe um LRC'); renderLyrics();
    }
  }
  function updateStrip(ms) {
    const strip = $('#lyric-strip');
    const show = mode === 'sheet' && !!lyrics?.lines?.length && ctx.settings().showLyricStrip !== false;
    strip.hidden = !show; if (!show) return;
    const i = H.lyricIndex(lyrics.lines, ms);
    const current = i >= 0 ? lyrics.lines[i].text || '♪' : '♪', next = lyrics.lines[i+1]?.text || '';
    if ($('#lyric-current').textContent !== current) $('#lyric-current').textContent = current;
    if ($('#lyric-next').textContent !== next) $('#lyric-next').textContent = next;
  }
  function frame(ms, holding) {
    updateStrip(ms);
    const state=window.CifraTogether.playback(ms);
    if(['sheet','together'].includes(mode))focusChords(state);
    if (mode === 'together') return window.CifraTogether.frame(ms,holding,state);
    if (mode !== 'lyrics') return false;
    if (!lyrics || !lyricEls.length) return true;
    const timed = !!lyrics.lines.length;
    const index = timed ? H.lyricIndex(lyrics.lines, ms) : Math.min(lyricEls.length-1, Math.floor(ms / Math.max(1,ctx.track()?.duration || 1) * lyricEls.length));
    if (lyricAt !== index) {
      lyricEls[lyricAt]?.classList.remove('active'); lyricAt=index; lyricEls[index]?.classList.add('active');
    }
    if (!holding && ctx.isPlaying() && index >= 0) {
      const sc = $('#scroller'), y=lyricEls[index].offsetTop-sc.clientHeight*.3;
      sc.scrollTop += (Math.max(0,y)-sc.scrollTop)*.15;
    }
    return true;
  }
  async function importLrc(file) {
    const text=await file.text(), lines=H.parseLrc(text); if (!lines.length) throw new Error('O LRC não contém marcações válidas.');
    const parsed=C.parseImportFile(file.name.replace(/\.lrc$/i,'.txt'),text)[0];
    const title=/\[ti:([^\]]+)\]/i.exec(text)?.[1]?.trim() || parsed?.title;
    const artist=/\[ar:([^\]]+)\]/i.exec(text)?.[1]?.trim() || parsed?.artist;
    if (!title || !artist) throw new Error('Use os campos [ti:] e [ar:] ou o nome Artista - Música.lrc.');
    const key=C.normKey(artist,title), track=ctx.track();
    const value={plain:lines.map(l=>l.text).join('\n'),lines,source:'LRC importado',at:Date.now()};
    await DB.lyrics('key:'+key,value);
    if (track && C.normKey(track.artist,track.title)===key) await DB.lyrics(track.id,value);
    await loadLyrics(track,ctx.song());
  }
  function init(context) {
    ctx=context;
    window.CifraTogether.init({...ctx,shapes:shapeData,svg:shapeSvg,openChord});
    document.querySelectorAll('[data-study-mode]').forEach(b => b.onclick=()=>setMode(b.dataset.studyMode));
    $('#chords-view').onclick=e=>{const b=e.target.closest('[data-chord]');if(b)openChord(b.dataset.chord);};
    $('#chordbar').onclick=e=>{const b=e.target.closest('[data-chord]');if(b)openChord(b.dataset.chord);};
    $('#m-diagrams').checked=ctx.settings().diagrams!==false;
    $('#m-diagrams').onchange=e=>{ctx.settings().diagrams=e.target.checked;ctx.save();renderChordbar();};
    $('#sheet').addEventListener('click',e=>{const b=e.target.closest('[data-chord]');if(b&&!ctx.recording()){e.preventDefault();e.stopImmediatePropagation();openChord(b.dataset.chord);}},true);
    $('#chord-close').onclick=()=>{$('#chord-modal').hidden=true;};
    for(const delta of [-1,1]) $(delta<0?'#chord-prev':'#chord-next').onclick=()=>{const e=H.chordLookup(selectedChord,shapes,C.parseChordToken);if(e){selectedPosition=(selectedPosition+delta+e.positions.length)%e.positions.length;drawChord();}};
    $('#m-auto-lyrics').checked=ctx.settings().autoLyrics!==false;
    $('#m-auto-lyrics').onchange=e=>{ctx.settings().autoLyrics=e.target.checked;ctx.save();loadLyrics(ctx.track(),ctx.song());};
    $('#m-lyric-strip').checked=ctx.settings().showLyricStrip!==false;
    $('#m-lyric-strip').onchange=e=>{ctx.settings().showLyricStrip=e.target.checked;ctx.save();updateStrip(0);};
    $('#m-retry-lyrics').onclick=async()=>{if(currentId)await DB.lyrics(currentId,{missing:true,at:0});await loadLyrics(ctx.track(),ctx.song());};
    $('#lyrics-view').onclick=e=>{const ln=e.target.closest('[data-lyric-index]');if(ln&&lyrics?.lines.length)ctx.seek(lyrics.lines[+ln.dataset.lyricIndex].t);};
    setMode('together');
  }
  function clear() { ++requestId;controller?.abort();lyrics=null;lyricAt=-1;window.CifraTogether.clear();setStatus('Carregando a música…');renderLyrics();updateStrip(0); }
  function refresh() { if(!ctx)return;document.documentElement.style.setProperty('--study-scale',ctx.settings().fontScale||1);window.CifraTogether.render(lyrics,status);renderChordbar();if(mode==='chords')diagrams(); if(mode!=='sheet'){$('#sheet').hidden=true;$('#empty').hidden=true;} }
  window.CifraStudy={init,frame,refresh,clear,loadLyrics,importLrc,focusChords,mode:()=>mode,setMode,playback:ms=>window.CifraTogether.playback(ms)};
})();
