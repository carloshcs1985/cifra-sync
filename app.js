/* Cifra Sync — interface, conexão com o Spotify e rolagem sincronizada. */
(() => {
  'use strict';
  const C = window.CifraCore;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const APP_VERSION = '3';
  const STORE_KEY = 'cifrasync.v1';
  const TOKEN_KEY = 'cifrasync.token';
  const PKCE_KEY = 'cifrasync.pkce';
  const SCOPES = 'user-read-currently-playing user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative';
  const REDIRECT_URI = location.origin + location.pathname.replace(/index\.html$/, '');
  const API = 'https://api.spotify.com/v1';
  const DEMO_TRACK = { id: 'demo:exemplo', title: 'Canção de Exemplo', artist: 'Cifra Sync · demonstração', duration: 100000, art: '' };

  const DEMO_SHEET = [
    '[Intro] G  D  Em  C',
    '',
    '[Riff]',
    'E|-----------------3--|',
    'B|-----0----1-----3---|',
    'G|---0----0----0------|',
    '',
    '[Primeira Parte]',
    '',
    'G                 D',
    '  Acordo cedo e a cidade ainda dorme',
    'Em                C',
    '  O violão me espera ao pé da cama',
    'G                 D',
    '  Cinco acordes e um café sem pressa',
    'Em               C         D',
    '  E a canção vai achando o seu lugar',
    '',
    '[Refrão]',
    '',
    'C          G',
    '  Rola a cifra, segue o som',
    'D            Em',
    '  Não precisa parar a mão',
    'C           G',
    '  Cada verso no seu tom',
    'D                 G',
    '  Toca junto e vai, que é bom',
    '',
    '[Solo] Em  C  G  D  (2x)',
    '',
    '[Segunda Parte]',
    '',
    'G                 D',
    '  Troquei o papel por uma tela',
    'Em                C',
    '  E o dedo só procura a corda certa',
    'G                 D',
    '  Se eu errar o tempo, marco a linha',
    'Em               C         D',
    '  E na próxima ela já me acerta',
    '',
    '[Refrão]',
    '',
    'C          G',
    '  Rola a cifra, segue o som',
    'D            Em',
    '  Não precisa parar a mão',
    'C           G',
    '  Cada verso no seu tom',
    'D                 G',
    '  Toca junto e vai, que é bom',
    '',
    '[Final] C  D  G',
  ].join('\n');

  /* ---------- armazenamento local ---------- */
  function readJSON(k, fb) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch { return fb; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }

  const store = readJSON(STORE_KEY, null) || {};
  store.songs = store.songs && typeof store.songs === 'object' ? store.songs : {};
  store.queue = Array.isArray(store.queue) ? store.queue : [];
  store.settings = Object.assign(
    { clientId: '', fontScale: 1, fit: true, theme: 'dark', scrollMode: 'spotify', speed: 30, demo: false },
    store.settings || {}
  );
  const save = () => { if (!writeJSON(STORE_KEY, store)) toast('Não consegui salvar (armazenamento cheio?)'); };

  /* ---------- estado ---------- */
  const S = {
    track: null, trackSong: null, viewingId: null,
    isPlaying: false, progress: 0, progressAt: 0,
    demo: false, connMsg: '',
    recording: false, undo: [], holdUntil: 0, scrollF: 0, curUnit: -1, resumeShown: false,
    lines: [], types: [], units: null, pts: null, els: [], timeline: null, keyName: null,
    fixedRunning: false, editing: null, lastTap: { i: -1, at: 0 },
  };

  const el = {
    art: $('#art'), artPh: $('#art-ph'), title: $('#title'), artist: $('#artist'), conn: $('#conn'),
    banner: $('#banner'), scroller: $('#scroller'), sheet: $('#sheet'), empty: $('#empty'),
    resume: $('#resume'), fixedPill: $('#fixed-pill'), fixedToggle: $('#fixed-toggle'), fixedSpeed: $('#fixed-speed'),
    recBar: $('#rec-bar'), time: $('#time'), dur: $('#dur'), fill: $('#progress-fill'), progress: $('#progress'),
    play: $('#play'), key: $('#key'), btnRec: $('#btn-rec'), toast: $('#toast'),
  };

  /* ---------- utilidades ---------- */
  let toastTimer;
  function toast(msg, ms = 2800) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }
  const esc = C.esc;
  const sign = (n) => (n > 0 ? '+' : '') + n;
  const newId = () => 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const openUrl = (u) => window.open(u, '_blank', 'noopener');
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const normTranspose = (t) => ((((t + 5) % 12) + 12) % 12) - 5; // -5..+6

  function est() {
    if (!S.track) return 0;
    const p = S.progress + (S.isPlaying ? performance.now() - S.progressAt : 0);
    return Math.max(0, S.track.duration ? Math.min(S.track.duration, p) : p);
  }
  const currentSong = () => (S.viewingId ? store.songs[S.viewingId] || null : S.trackSong);
  const syncing = () => store.settings.scrollMode === 'spotify' && !S.viewingId && !!S.track && !!S.trackSong;

  /* ---------- músicas ---------- */
  function newSong(title, artist, sheet, trackId) {
    const s = {
      id: newId(), title: title || 'Sem título', artist: artist || '', sheet, transpose: 0, anchors: [],
      trackIds: trackId ? [trackId] : [], key: C.normKey(artist, title), createdAt: Date.now(), updatedAt: Date.now(),
    };
    store.songs[s.id] = s;
    return s;
  }
  function findSongForTrack(track) {
    const all = Object.values(store.songs);
    let s = all.find((x) => x.trackIds && x.trackIds.includes(track.id));
    if (s) return s;
    const k = C.normKey(track.artist, track.title);
    s = all.find((x) => x.key === k);
    if (s) { s.trackIds.push(track.id); save(); }
    return s || null;
  }
  function hasSongFor(trackId, key) {
    return Object.values(store.songs).some((x) => (x.trackIds && x.trackIds.includes(trackId)) || x.key === key);
  }
  /** Tira da fila de pendentes tudo que já ganhou cifra. */
  function pruneQueue() {
    const before = store.queue.length;
    store.queue = store.queue.filter((q) => !hasSongFor(q.trackId, q.key));
    if (store.queue.length !== before) save();
  }
  function resolveTrackSong() { S.trackSong = S.track ? findSongForTrack(S.track) : null; }

  /* ---------- Spotify: login PKCE (sem servidor, sem segredo) ---------- */
  let token = readJSON(TOKEN_KEY, null);
  function saveToken(j) {
    token = {
      access: j.access_token,
      refresh: j.refresh_token || (token && token.refresh),
      expiresAt: Date.now() + (j.expires_in || 3600) * 1000,
      scope: j.scope || (token && token.scope) || '',
    };
    writeJSON(TOKEN_KEY, token);
  }
  function clearToken() { token = null; localStorage.removeItem(TOKEN_KEY); }
  function authError(msg) { const e = new Error(msg || 'auth'); e.auth = true; return e; }

  function randomString(n) {
    const cs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return [...a].map((x) => cs[x % cs.length]).join('');
  }
  async function pkceChallenge(v) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
    return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function login() {
    const cid = (store.settings.clientId || '').trim();
    if (!cid) { openMenu(); toast('Cole primeiro o Client ID do seu app no Spotify.'); $('#m-client').focus(); return; }
    if (!window.isSecureContext || !crypto.subtle) { toast('O login precisa de HTTPS (ou 127.0.0.1).'); return; }
    if (S.demo) stopDemo(false);
    const verifier = randomString(64);
    const state = randomString(16);
    writeJSON(PKCE_KEY, { verifier, state, at: Date.now() });
    const p = new URLSearchParams({
      response_type: 'code', client_id: cid, scope: SCOPES, redirect_uri: REDIRECT_URI, state,
      code_challenge_method: 'S256', code_challenge: await pkceChallenge(verifier),
    });
    location.assign('https://accounts.spotify.com/authorize?' + p);
  }

  async function handleRedirect() {
    const q = new URLSearchParams(location.search);
    if (!q.has('code') && !q.has('error')) return;
    history.replaceState(null, '', REDIRECT_URI);
    const pk = readJSON(PKCE_KEY, null);
    localStorage.removeItem(PKCE_KEY);
    if (q.get('error')) { toast('O Spotify não autorizou: ' + q.get('error'), 5000); return; }
    if (!pk || pk.state !== q.get('state')) { toast('O login expirou. Tente conectar de novo.', 5000); return; }
    const body = new URLSearchParams({
      grant_type: 'authorization_code', code: q.get('code'), redirect_uri: REDIRECT_URI,
      client_id: store.settings.clientId, code_verifier: pk.verifier,
    });
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast('Erro no login: ' + (j.error_description || j.error || r.status), 6000); return; }
    saveToken(j);
    toast('Spotify conectado');
  }

  let refreshing = null;
  function refreshToken() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      if (!token || !token.refresh) { clearToken(); throw authError(); }
      const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refresh, client_id: store.settings.clientId });
      const r = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 400 || r.status === 401) clearToken();
        throw authError(j.error_description || j.error);
      }
      saveToken(j);
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  async function accessToken() {
    if (!token) throw authError();
    if (Date.now() > token.expiresAt - 60000) await refreshToken();
    return token.access;
  }

  let backoffUntil = 0;
  async function api(method, path, retry = true) {
    const tok = await accessToken();
    const t0 = performance.now();
    const res = await fetch(API + path, { method, headers: { Authorization: 'Bearer ' + tok } });
    const rtt = performance.now() - t0;
    if (res.status === 401 && retry) { await refreshToken(); return api(method, path, false); }
    if (res.status === 429) {
      const ra = parseInt(res.headers.get('Retry-After'), 10);
      backoffUntil = Date.now() + (Number.isFinite(ra) ? ra : 10) * 1000;
    }
    let body = null;
    if (res.status !== 204) { const txt = await res.text(); if (txt) { try { body = JSON.parse(txt); } catch { /* sem JSON */ } } }
    if (!res.ok) {
      const er = body && body.error;
      const e = new Error((er && (er.message || er)) || res.statusText || 'HTTP ' + res.status);
      e.status = res.status;
      e.reason = er && er.reason;
      throw e;
    }
    return { status: res.status, body, rtt };
  }

  function friendlyError(e) {
    const m = String((e && e.message) || '');
    if (e && e.status === 403 && /regist/i.test(m)) return 'Sua conta não está liberada no app do Spotify. No painel do Spotify, em User Management, adicione o seu e-mail.';
    if (e && e.status === 403 && /premium/i.test(m)) return 'O Spotify exige Premium para isso.';
    if (e && e.status === 403) return 'O Spotify recusou o acesso (' + m + ').';
    if (e && e.status === 429) return 'Muitas consultas ao Spotify. Aguardando um pouco…';
    if (e instanceof TypeError) return 'Sem conexão com o Spotify.';
    return 'Erro do Spotify: ' + m;
  }

  function pickArt(imgs) {
    if (!Array.isArray(imgs) || !imgs.length) return '';
    const sorted = imgs.filter((i) => i && i.url).sort((a, b) => (a.width || 0) - (b.width || 0));
    const good = sorted.find((i) => (i.width || 0) >= 64);
    return (good || sorted[sorted.length - 1] || {}).url || '';
  }

  /* ---------- leitura da música atual ---------- */
  let pollTimer = null;
  async function poll() {
    clearTimeout(pollTimer);
    if (S.demo || !token || document.visibilityState !== 'visible') return;
    const wait = backoffUntil - Date.now();
    if (wait > 0) { pollTimer = setTimeout(poll, wait); return; }
    try {
      const r = await api('GET', '/me/player/currently-playing?additional_types=track,episode');
      S.connMsg = '';
      setConn('on');
      const it = r.body && r.body.item;
      if (!it) {
        S.isPlaying = false;
        setTrack(null);
      } else {
        const artists = it.artists || (it.show ? [{ name: it.show.name }] : []);
        const track = {
          id: it.id || it.uri || 'local:' + it.name,
          title: it.name || '—',
          artist: artists.map((a) => a.name).join(', '),
          duration: it.duration_ms || 0,
          art: pickArt((it.album && it.album.images) || it.images),
        };
        const same = S.track && S.track.id === track.id;
        const playing = !!r.body.is_playing;
        const newProg = (r.body.progress_ms || 0) + (playing ? r.rtt / 2 : 0);
        // pequenas diferenças são ignoradas para a rolagem não "tremer"
        if (!(same && playing && S.isPlaying && Math.abs(newProg - est()) < 350)) {
          S.progress = newProg;
          S.progressAt = performance.now();
        }
        S.isPlaying = playing;
        setTrack(track);
      }
    } catch (e) {
      if (e.auth) {
        setConn('off');
        S.connMsg = 'A sessão do Spotify expirou. Conecte de novo.';
        S.isPlaying = false;
        setTrack(null);
        render();
        return;
      }
      setConn('err');
      S.connMsg = friendlyError(e);
    }
    updateChrome();
    updateWakeLock();
    pollTimer = setTimeout(poll, S.isPlaying ? 2500 : 5000);
  }

  function setConn(state) {
    el.conn.className = 'dot ' + state;
    el.conn.title = { on: 'Spotify conectado', off: 'Spotify desconectado', err: 'Problema com o Spotify', demo: 'Demonstração' }[state] || '';
  }

  function setTrack(track) {
    const changed = (track && track.id) !== (S.track && S.track.id);
    S.track = track;
    if (changed) {
      S.recording = false;
      resolveTrackSong();
      S.curUnit = -1;
      S.scrollF = 0;
      el.scroller.scrollTop = 0;
      render();
    }
  }

  /* ---------- controles do player ---------- */
  async function ctl(action) {
    if (!S.track && action !== 'toggle') return;
    const now = performance.now();
    if (S.demo) {
      if (!S.track) return;
      if (action === 'toggle') { S.progress = est(); S.progressAt = now; S.isPlaying = !S.isPlaying; }
      else if (action === 'back10') { S.progress = Math.max(0, est() - 10000); S.progressAt = now; }
      else { S.progress = 0; S.progressAt = now; }
      updateChrome();
      updateWakeLock();
      return;
    }
    if (!token) { toast('Conecte o Spotify primeiro.'); return; }
    try {
      if (action === 'toggle') {
        const wasPlaying = S.isPlaying;
        S.progress = est(); S.progressAt = now; S.isPlaying = !wasPlaying; updateChrome();
        await api('PUT', wasPlaying ? '/me/player/pause' : '/me/player/play');
      } else if (action === 'next') await api('POST', '/me/player/next');
      else if (action === 'prev') await api('POST', '/me/player/previous');
      else if (action === 'back10') await seek(Math.max(0, est() - 10000));
    } catch (e) {
      if (e.status === 404) toast('Abra o Spotify em algum aparelho e dê play primeiro.', 4000);
      else toast(friendlyError(e), 4000);
    }
    setTimeout(poll, 400);
  }

  async function seek(ms) {
    ms = Math.max(0, Math.round(ms));
    S.progress = ms;
    S.progressAt = performance.now();
    if (S.demo) return;
    try { await api('PUT', '/me/player/seek?position_ms=' + ms); }
    catch (e) { toast(friendlyError(e), 4000); }
    setTimeout(poll, 400);
  }

  /* ---------- desenho da cifra ---------- */
  let charRatio = 0.6;
  function measureCharRatio() {
    const s = document.createElement('span');
    s.className = 'measure';
    s.textContent = 'M'.repeat(50);
    el.sheet.appendChild(s);
    const w = s.getBoundingClientRect().width;
    s.remove();
    if (w > 0) charRatio = w / 50 / 100;
  }

  function render() {
    renderHeader();
    renderSheet();
    updateChrome();
  }

  function renderHeader() {
    const song = currentSong();
    if (S.viewingId && song) {
      el.title.textContent = song.title;
      el.artist.textContent = song.artist || '—';
    } else if (S.track) {
      el.title.textContent = S.track.title;
      el.artist.textContent = S.track.artist;
    } else {
      el.title.textContent = 'Cifra Sync';
      el.artist.textContent = token || S.demo ? 'Aguardando música no Spotify' : 'Cifras que rolam junto com o Spotify';
    }
    const art = !S.viewingId && S.track && S.track.art;
    if (art) { if (el.art.getAttribute('src') !== art) el.art.src = art; el.art.hidden = false; el.artPh.hidden = true; }
    else { el.art.hidden = true; el.artPh.hidden = false; }
  }

  function renderSheet() {
    const song = currentSong();
    if (!song) {
      S.lines = []; S.types = []; S.els = []; S.units = null; S.pts = null; S.timeline = null; S.keyName = null;
      el.sheet.replaceChildren();
      el.sheet.hidden = true;
      renderEmpty();
      return;
    }
    el.empty.hidden = true;
    el.sheet.hidden = false;
    const tr = C.transposeSheet(song.sheet, song.transpose || 0);
    S.keyName = tr.key;
    S.lines = tr.text.split('\n');
    S.types = S.lines.map((l) => C.classifyLine(l));
    S.units = C.computeUnits(S.types);
    const frag = document.createDocumentFragment();
    S.lines.forEach((ln, i) => {
      const d = document.createElement('div');
      d.className = 'ln t-' + S.types[i];
      d.dataset.i = i;
      d.innerHTML = C.lineToHtml(ln, S.types[i]);
      frag.appendChild(d);
    });
    el.sheet.replaceChildren(frag);
    S.els = [...el.sheet.children];
    S.curUnit = -1;
    markAnchors();
    applyFont();
    rebuildTimeline();
  }

  function renderEmpty() {
    let html;
    if (!S.demo && !token) {
      html = `<h2>Conecte o Spotify</h2>
        <p>O Cifra Sync vê a música que está tocando e rola a cifra junto com ela.</p>
        ${S.connMsg ? `<p class="warn">${esc(S.connMsg)}</p>` : ''}
        ${store.settings.clientId ? '' : '<p>Antes, cole o <strong>Client ID</strong> do seu app do Spotify em Configurar.</p>'}
        <div class="btns">
          <button class="btn primary" data-a="connect">Conectar ao Spotify</button>
          <button class="btn" data-a="settings">Configurar</button>
          <button class="btn" data-a="demo">Ver demonstração</button>
        </div>`;
    } else if (!S.track) {
      html = `<h2>Nada tocando</h2>
        <p>Dê play numa música no Spotify, neste aparelho ou em qualquer outro. Ela aparece aqui sozinha.</p>
        ${S.connMsg ? `<p class="warn">${esc(S.connMsg)}</p>` : ''}
        <div class="btns"><button class="btn" data-a="library">Abrir biblioteca</button></div>`;
    } else {
      html = `<h2>Sem cifra para esta música</h2>
        <p><strong>${esc(S.track.title)}</strong><br>${esc(S.track.artist)}</p>
        <ol class="steps"><li>Abra no Cifra Club e copie a cifra.</li><li>Volte aqui e toque em “Colar cifra copiada”.</li></ol>
        <div class="btns">
          <button class="btn primary" data-a="cc">Abrir no Cifra Club</button>
          <button class="btn primary" data-a="quickpaste">Colar cifra copiada</button>
          <button class="btn" data-a="google">Não achou? Buscar no Google</button>
          <button class="btn" data-a="manual">Colar ou digitar no editor</button>
          <button class="btn" data-a="library">Usar uma cifra da biblioteca</button>
        </div>`;
    }
    el.empty.innerHTML = html;
    el.empty.hidden = false;
  }

  function markAnchors() {
    const song = currentSong();
    S.els.forEach((e) => e.removeAttribute('data-t'));
    if (!song) return;
    for (const a of song.anchors || []) if (S.els[a.line]) S.els[a.line].dataset.t = C.fmtTime(a.t);
  }

  function applyFont() {
    if (!S.els.length) return;
    const sc = el.scroller;
    const ratio = sc.scrollHeight > 0 ? sc.scrollTop / sc.scrollHeight : 0;
    const avail = sc.clientWidth - 36;
    const lens = S.lines.filter((l, i) => S.types[i] !== 'tab').map((l) => l.replace(/\s+$/, '').length).sort((a, b) => a - b);
    const maxLen = lens.length ? lens[Math.floor((lens.length - 1) * 0.97)] : 40;
    let size = 17;
    if (store.settings.fit) size = Math.max(11, Math.min(24, avail / (Math.max(maxLen, 26) * charRatio)));
    size *= store.settings.fontScale;
    el.sheet.style.fontSize = size.toFixed(2) + 'px';
    measure();
    if (!syncing()) { sc.scrollTop = ratio * sc.scrollHeight; S.scrollF = sc.scrollTop; }
  }

  // Pontos (posição W → altura em pixels) para converter tempo em rolagem.
  function measure() {
    const u = S.units;
    if (!u || !S.els.length) { S.pts = null; return; }
    const xs = [], ys = [];
    for (let i = 0; i < S.els.length; i++) {
      if (u.w[i] > 0) {
        const start = i > 0 && u.w[i - 1] === 0 && S.types[i - 1] === 'chords' ? S.els[i - 1] : S.els[i];
        xs.push(u.cum[i]);
        ys.push(start.offsetTop);
      }
    }
    const last = S.els[S.els.length - 1];
    xs.push(u.total);
    ys.push(last.offsetTop + last.offsetHeight);
    S.pts = { xs, ys };
  }

  function rebuildTimeline() {
    const song = currentSong();
    S.timeline = S.units && S.track && song ? C.buildTimeline(song.anchors, S.units.cum, S.units.total, S.track.duration) : null;
  }

  function highlight(w) {
    const i = C.unitAt(w, S.units);
    if (i === S.curUnit) return;
    $$('.ln.cur', el.sheet).forEach((e) => e.classList.remove('cur'));
    S.curUnit = i;
    if (i < 0 || !S.els[i]) return;
    S.els[i].classList.add('cur');
    if (i > 0 && S.units.w[i - 1] === 0) S.els[i - 1].classList.add('cur');
  }

  /* ---------- laço de rolagem (60 vezes por segundo) ---------- */
  let lastNow = performance.now(), lastSec = -1;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;
    if (S.demo && S.isPlaying && S.track && est() >= S.track.duration) { S.progress = 0; S.progressAt = now; }

    const d = S.track ? S.track.duration : 0;
    const p = est();
    el.fill.style.transform = `scaleX(${d ? Math.min(1, p / d) : 0})`;
    const sec = Math.floor(p / 1000);
    if (sec !== lastSec) { lastSec = sec; el.time.textContent = C.fmtTime(p); }

    const sc = el.scroller;
    if (Math.abs(sc.scrollTop - S.scrollF) > 3) S.scrollF = sc.scrollTop; // a pessoa rolou
    const holding = now < S.holdUntil;
    const maxScroll = Math.max(0, sc.scrollHeight - sc.clientHeight);

    if (store.settings.scrollMode === 'fixed') {
      setResume(false);
      if (S.fixedRunning && !holding && S.els.length) {
        S.scrollF = Math.min(S.scrollF + store.settings.speed * dt, maxScroll);
        sc.scrollTop = S.scrollF;
      }
      return;
    }
    if (!syncing() || !S.timeline || !S.pts) { setResume(false); return; }
    const w = C.positionAt(p, S.timeline);
    highlight(w);
    setResume(holding);
    if (holding) return;
    const y = C.interp(w, S.pts.xs, S.pts.ys);
    const target = Math.max(0, Math.min(y - sc.clientHeight * 0.3, maxScroll));
    const diff = target - S.scrollF;
    if (Math.abs(diff) < 0.3) return;
    if (Math.abs(diff) > sc.clientHeight * 1.2) S.scrollF = target; // pulo grande (troca de trecho)
    else S.scrollF += diff * Math.min(1, dt * 3.5);
    sc.scrollTop = S.scrollF;
  }
  function setResume(v) {
    if (v === S.resumeShown) return;
    S.resumeShown = v;
    el.resume.hidden = !v;
  }
  function hold(ms = 3500) { S.holdUntil = performance.now() + ms; }

  /* ---------- marcações de tempo ---------- */
  function addAnchor(i) {
    const song = currentSong();
    if (!syncing() || !song) { toast('Dê play nesta música no Spotify para marcar.'); return; }
    const t = Math.round(est());
    // remove marcações que ficariam fora de ordem com a nova
    song.anchors = (song.anchors || []).filter((a) => !((a.line >= i && a.t <= t) || (a.line <= i && a.t >= t)));
    const a = { line: i, t };
    song.anchors.push(a);
    song.anchors.sort((x, y) => x.t - y.t);
    S.undo.push(a);
    song.updatedAt = Date.now();
    save();
    rebuildTimeline();
    markAnchors();
    const e = S.els[i];
    if (e) { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); }
  }
  function undoAnchor() {
    const song = currentSong();
    const a = S.undo.pop();
    if (!song || !a) { toast('Nada para desfazer.'); return; }
    song.anchors = song.anchors.filter((x) => !(x.line === a.line && x.t === a.t));
    save();
    rebuildTimeline();
    markAnchors();
  }
  function jumpToLine(i) {
    if (!syncing() || !S.timeline || !S.units) return;
    const t = C.timeAt(S.units.cum[i], S.timeline);
    if (t == null) return;
    const target = Math.max(0, t - 1500);
    S.holdUntil = 0;
    seek(target);
    toast('Voltando para ' + C.fmtTime(target));
  }

  /* ---------- barra de controles ---------- */
  function updateChrome() {
    const song = currentSong();
    const mode = store.settings.scrollMode;
    el.play.classList.toggle('playing', S.isPlaying);
    el.dur.textContent = S.track ? C.fmtTime(S.track.duration) : '0:00';
    const canPlay = S.demo || !!token;
    $$('#dock .transport button').forEach((b) => { b.disabled = !canPlay; });

    if (song) {
      const tp = song.transpose || 0;
      el.key.textContent = S.keyName ? S.keyName + (tp ? ` (${sign(tp)})` : '') : tp ? sign(tp) : 'Tom';
    } else el.key.textContent = 'Tom';
    $('#key-down').disabled = $('#key-up').disabled = !song;
    $('#font-down').disabled = $('#font-up').disabled = !song;

    el.btnRec.hidden = mode !== 'spotify';
    el.btnRec.disabled = !syncing();
    el.btnRec.classList.toggle('on', S.recording);
    el.btnRec.textContent = S.recording ? '● Gravando' : '● Marcar';
    el.recBar.hidden = !S.recording;
    document.body.classList.toggle('recording', S.recording);

    el.fixedPill.hidden = !(mode === 'fixed' && song);
    el.fixedPill.classList.toggle('running', S.fixedRunning);
    el.fixedSpeed.textContent = store.settings.speed;

    if (S.viewingId && song) {
      el.banner.className = '';
      el.banner.innerHTML = `<span>Biblioteca: ${esc(song.title)}</span><button class="pill" data-a="back">${S.track ? 'Voltar à música atual' : 'Fechar'}</button>`;
      el.banner.hidden = false;
    } else if (S.connMsg && S.track) {
      el.banner.className = 'warn';
      el.banner.innerHTML = `<span>${esc(S.connMsg)}</span>`;
      el.banner.hidden = false;
    } else el.banner.hidden = true;
  }

  /* ---------- tela ligada enquanto toca ---------- */
  let wakeLock = null;
  async function updateWakeLock() {
    if (!('wakeLock' in navigator)) return;
    const want = document.visibilityState === 'visible' && (S.isPlaying || S.fixedRunning);
    try {
      if (want && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch { wakeLock = null; }
  }

  /* ---------- editor ---------- */
  function show(sel) { $(sel).hidden = false; }
  function hide(sel) { $(sel).hidden = true; }

  function openEditor(id, opts = {}) {
    const song = id ? store.songs[id] : null;
    const t = opts.link || S.track;
    const link = !song && !opts.noLink && t && (opts.link || !S.viewingId) ? t.id : null;
    S.editing = { id: song ? song.id : null, linkTrackId: link };
    $('#ed-heading').textContent = song ? 'Editar cifra' : 'Nova cifra';
    $('#ed-title').value = song ? song.title : link ? C.baseTitle(t.title) : '';
    $('#ed-artist').value = song ? song.artist : link ? t.artist.split(',')[0].trim() : '';
    $('#ed-text').value = song ? song.sheet : opts.text || '';
    $('#ed-delete').hidden = !song;
    $('#ed-link').textContent = link ? `Vai abrir sozinha quando tocar “${t.title}”` : song && song.trackIds.length ? 'Vinculada a música(s) do Spotify' : '';
    show('#ov-editor');
  }

  function saveEditor() {
    const text = C.cleanPasted($('#ed-text').value);
    if (!text.trim()) { toast('A cifra está vazia.'); return; }
    const title = $('#ed-title').value.trim() || 'Sem título';
    const artist = $('#ed-artist').value.trim();
    let song = S.editing && S.editing.id ? store.songs[S.editing.id] : null;
    if (song) {
      const changedLines = song.sheet.split('\n').length !== text.split('\n').length;
      Object.assign(song, { sheet: text, title, artist, key: C.normKey(artist, title), updatedAt: Date.now() });
      if (changedLines && song.anchors && song.anchors.length) toast('As linhas mudaram: confira as marcações de tempo.', 4000);
    } else {
      song = newSong(title, artist, text, S.editing && S.editing.linkTrackId);
    }
    save();
    pruneQueue();
    hide('#ov-editor');
    resolveTrackSong();
    render();
    if (!$('#ov-queue').hidden) renderQueue();
  }

  function deleteSong() {
    const id = S.editing && S.editing.id;
    if (!id || !store.songs[id]) return;
    if (!confirm('Excluir esta cifra?')) return;
    delete store.songs[id];
    if (S.viewingId === id) S.viewingId = null;
    save();
    hide('#ov-editor');
    resolveTrackSong();
    render();
  }

  async function readClipboard() {
    try { return await navigator.clipboard.readText(); } catch { return ''; }
  }

  /** Lê a área de transferência e salva como cifra da música indicada. Devolve true se salvou direto. */
  async function pasteFor(track) {
    const txt = C.cleanPasted(await readClipboard());
    const hasChords = txt.split('\n').some((l) => C.classifyLine(l) === 'chords');
    if (!hasChords || txt.split('\n').filter((l) => l.trim()).length < 3) {
      openEditor(null, { text: txt, link: track });
      toast(txt ? 'Não parece uma cifra. Confira e toque em Salvar.' : 'Não achei texto copiado. Cole no campo abaixo.', 4000);
      return false;
    }
    newSong(C.baseTitle(track.title), String(track.artist || '').split(',')[0].trim(), txt, track.id);
    save();
    pruneQueue();
    resolveTrackSong();
    render();
    return true;
  }

  async function quickPaste() {
    if (!S.track) return;
    if (await pasteFor(S.track)) toast('Cifra salva. Toque no lápis para revisar.');
  }

  /* ---------- fila de pendentes (a partir de playlists) ---------- */
  const hasPlaylistScope = () => !!(token && /playlist-read-private/.test(token.scope || ''));
  let meId = null;

  async function apiAll(path, max = 2000) {
    const out = [];
    let next = path;
    while (next && out.length < max) {
      const r = await api('GET', next);
      const b = r.body || {};
      out.push(...(b.items || []));
      next = b.next ? b.next.replace(API, '') : null;
    }
    return out;
  }

  async function openPlaylists() {
    hide('#ov-menu');
    hide('#ov-lib');
    if (S.demo) { toast('Desligue o modo demonstração e conecte o Spotify.'); return; }
    if (!token) { toast('Conecte o Spotify primeiro.'); openMenu(); return; }
    show('#ov-pl');
    const list = $('#pl-list');
    if (!hasPlaylistScope()) {
      list.innerHTML = `<div class="item col"><span>Para ler suas playlists, o Spotify precisa de uma nova autorização (uma vez só).</span>
        <button class="btn primary" data-a="reauth">Autorizar playlists</button></div>`;
      return;
    }
    list.innerHTML = '<div class="item sub">Carregando playlists…</div>';
    try {
      if (!meId) { const me = await api('GET', '/me'); meId = me.body && me.body.id; }
      const pls = (await apiAll('/me/playlists?limit=50')).filter(Boolean);
      if (!pls.length) { list.innerHTML = '<div class="item sub">Nenhuma playlist encontrada.</div>'; return; }
      const own = (p) => !!((p.owner && p.owner.id === meId) || p.collaborative);
      pls.sort((a, b) => own(b) - own(a));
      list.innerHTML = pls.map((p) => {
        const total = (p.items && p.items.total) ?? (p.tracks && p.tracks.total) ?? '';
        const mine = own(p);
        const who = mine ? (p.collaborative && p.owner.id !== meId ? 'colaborativa' : 'sua') : 'de ' + ((p.owner && p.owner.display_name) || 'outra pessoa');
        return `<button class="item${mine ? '' : ' off'}" data-pl="${esc(p.id)}" data-own="${mine ? 1 : 0}" data-name="${esc(p.name || '')}">
          <span><span class="li-t">${esc(p.name || 'Sem nome')}</span><br><span class="sub">${total !== '' ? total + ' músicas · ' : ''}${esc(who)}</span></span>
          <span class="sub">${mine ? '›' : 'bloqueada'}</span></button>`;
      }).join('');
    } catch (e) {
      list.innerHTML = `<div class="item sub warn">${esc(e.auth ? 'Sessão expirada. Conecte o Spotify de novo.' : friendlyError(e))}</div>`;
    }
  }

  async function importPlaylist(id, name) {
    const list = $('#pl-list');
    list.innerHTML = `<div class="item sub">Lendo “${esc(name)}”…</div>`;
    try {
      const entries = await apiAll(`/playlists/${encodeURIComponent(id)}/items?limit=50&additional_types=track`);
      let added = 0, had = 0, dup = 0;
      const queued = new Set(store.queue.map((q) => q.trackId));
      for (const e of entries) {
        const t = e && (e.item || e.track);
        if (!t || !t.id || t.is_local || (t.type && t.type !== 'track')) continue;
        const artist = (t.artists || []).map((a) => a.name).join(', ');
        const key = C.normKey(artist, t.name);
        if (hasSongFor(t.id, key)) { had++; continue; }
        if (queued.has(t.id) || store.queue.some((q) => q.key === key)) { dup++; continue; }
        store.queue.push({ trackId: t.id, title: t.name, artist, key, playlist: name, addedAt: Date.now() });
        queued.add(t.id);
        added++;
      }
      save();
      hide('#ov-pl');
      openQueue();
      const parts = [`${added} adicionada(s) à fila`];
      if (had) parts.push(`${had} já tinham cifra`);
      if (dup) parts.push(`${dup} já estavam na fila`);
      toast(parts.join(' · '), 4500);
    } catch (e) {
      if (e.status === 403 || e.status === 404) list.innerHTML = `<div class="item col warn">O Spotify não liberou as músicas desta playlist. Em apps pessoais ele só libera playlists criadas por você.</div>`;
      else list.innerHTML = `<div class="item sub warn">${esc(friendlyError(e))}</div>`;
    }
  }

  let queueActive = null; // música aberta no Cifra Club por último
  function openQueue() { hide('#ov-menu'); hide('#ov-lib'); pruneQueue(); renderQueue(); show('#ov-queue'); }
  function renderQueue() {
    const n = store.queue.length;
    $('#q-heading').textContent = n ? `Pendentes (${n})` : 'Pendentes';
    $('#q-clear').hidden = !n;
    const list = $('#q-list');
    if (!n) {
      list.innerHTML = `<div class="item col"><span class="sub">Nenhuma música pendente. Monte uma fila a partir de uma playlist sua do Spotify.</span>
        <button class="btn primary" data-a="from-pl">Escolher playlist</button></div>`;
      return;
    }
    list.innerHTML = store.queue.map((q) => `
      <div class="item qrow${q.trackId === queueActive ? ' active' : ''}" data-q="${esc(q.trackId)}">
        <span class="qinfo"><span class="li-t">${esc(C.baseTitle(q.title) || q.title)}</span><br><span class="sub">${esc(q.artist)}</span>
          <button class="lnk" data-qa="google">Google</button></span>
        <span class="qbtns">
          <button class="pill" data-qa="cc">Cifra Club</button>
          <button class="pill${q.trackId === queueActive ? ' primary' : ''}" data-qa="paste">Colar</button>
          <button class="pill x" data-qa="remove" aria-label="Remover da fila">×</button>
        </span>
      </div>`).join('');
    const act = list.querySelector('.qrow.active');
    if (act) act.scrollIntoView({ block: 'nearest' });
  }
  async function queueAction(trackId, action) {
    const i = store.queue.findIndex((q) => q.trackId === trackId);
    if (i < 0) return;
    const q = store.queue[i];
    if (action === 'cc' || action === 'google') {
      queueActive = trackId;
      renderQueue();
      openUrl(action === 'cc' ? C.cifraClubUrl(q.artist, q.title) : C.googleUrl(q.artist, q.title));
    } else if (action === 'remove') {
      store.queue.splice(i, 1);
      save();
      renderQueue();
    } else if (action === 'paste') {
      const ok = await pasteFor({ id: q.trackId, title: q.title, artist: q.artist });
      if (!ok) return;
      const next = store.queue[Math.min(i, store.queue.length - 1)];
      queueActive = next ? next.trackId : null;
      renderQueue();
      toast(next ? `Salva! Próxima: ${next.title}` : 'Salva! Fila concluída.', 3000);
    }
  }

  /* ---------- importação de vários arquivos ---------- */
  async function decodeFile(file) {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch { return new TextDecoder('windows-1252').decode(buf); } // arquivos antigos do Windows
  }
  async function importFiles(files) {
    let added = 0, exists = 0, skipped = [];
    for (const f of files) {
      if (f.size > 1024 * 1024) { skipped.push(f.name); continue; }
      let parsed;
      try { parsed = C.parseImportFile(f.name, await decodeFile(f)); } catch { skipped.push(f.name); continue; }
      for (const s of parsed) {
        if (!s.hasChords) { skipped.push(f.name); continue; }
        const key = C.normKey(s.artist, s.title);
        if (Object.values(store.songs).some((x) => x.key === key)) { exists++; continue; }
        newSong(s.title, s.artist, s.sheet, null);
        added++;
      }
    }
    save();
    pruneQueue();
    resolveTrackSong();
    render();
    if (!$('#ov-lib').hidden) renderLib();
    const parts = [`${added} cifra(s) importada(s)`];
    if (exists) parts.push(`${exists} já existiam`);
    if (skipped.length) parts.push(`${skipped.length} sem acordes: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}`);
    toast(parts.join(' · '), 6000);
  }

  /* ---------- biblioteca ---------- */
  function openLib() {
    $('#lib-search').value = '';
    pruneQueue();
    $('#lib-queue').textContent = store.queue.length ? `Pendentes (${store.queue.length})` : 'Pendentes';
    renderLib();
    show('#ov-lib');
  }
  function renderLib() {
    const q = C.fold($('#lib-search').value).trim();
    const songs = Object.values(store.songs)
      .filter((s) => !q || C.fold(s.title + ' ' + s.artist).includes(q))
      .sort((a, b) => (a.artist || '').localeCompare(b.artist || '', 'pt') || a.title.localeCompare(b.title, 'pt'));
    const list = $('#lib-list');
    if (!songs.length) {
      list.innerHTML = `<div class="item sub">${q ? 'Nada encontrado.' : 'Nenhuma cifra salva ainda.'}</div>`;
      return;
    }
    list.innerHTML = songs.map((s) => {
      const tags = [s.anchors && s.anchors.length ? '⏱ sincronizada' : '', s.transpose ? 'tom ' + sign(s.transpose) : ''].filter(Boolean).join(' · ');
      return `<button class="item" data-id="${esc(s.id)}"><span><span class="li-t">${esc(s.title)}</span><br><span class="sub">${esc(s.artist || '—')}</span></span><span class="sub">${tags}</span></button>`;
    }).join('');
  }
  function pickSong(id) {
    const s = store.songs[id];
    if (!s) return;
    hide('#ov-lib');
    if (S.track && s.trackIds.includes(S.track.id)) S.viewingId = null;
    else if (S.track && !S.trackSong && !S.demo && confirm(`Usar esta cifra sempre que tocar “${S.track.title}”?`)) {
      s.trackIds.push(S.track.id);
      save();
      pruneQueue();
      resolveTrackSong();
      S.viewingId = null;
    } else S.viewingId = id;
    S.recording = false;
    S.scrollF = 0;
    el.scroller.scrollTop = 0;
    render();
  }

  /* ---------- backup ---------- */
  async function exportBackup() {
    const json = JSON.stringify({ app: 'cifra-sync', version: 1, exportedAt: new Date().toISOString(), songs: store.songs, queue: store.queue }, null, 2);
    const name = `cifra-sync-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Backup Cifra Sync' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function sanitizeSong(s) {
    if (!s || typeof s.sheet !== 'string') return null;
    const id = String(s.id || '').replace(/[^\w:-]/g, '').slice(0, 64) || newId();
    return {
      id, title: String(s.title || 'Sem título').slice(0, 200), artist: String(s.artist || '').slice(0, 200),
      sheet: s.sheet.slice(0, 200000), transpose: normTranspose(s.transpose | 0),
      anchors: Array.isArray(s.anchors) ? s.anchors.filter((a) => a && Number.isInteger(a.line) && Number.isFinite(a.t)).map((a) => ({ line: a.line, t: Math.round(a.t) })).slice(0, 500) : [],
      trackIds: Array.isArray(s.trackIds) ? s.trackIds.filter((x) => typeof x === 'string').map((x) => x.slice(0, 120)).slice(0, 20) : [],
      key: C.normKey(s.artist, s.title), createdAt: +s.createdAt || Date.now(), updatedAt: +s.updatedAt || Date.now(),
    };
  }
  async function importBackup(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || !data.songs || typeof data.songs !== 'object') throw new Error('formato');
      let n = 0;
      for (const raw of Object.values(data.songs)) {
        const s = sanitizeSong(raw);
        if (!s) continue;
        const cur = store.songs[s.id];
        if (!cur || s.updatedAt > (cur.updatedAt || 0)) { store.songs[s.id] = s; n++; }
      }
      if (Array.isArray(data.queue)) {
        const have = new Set(store.queue.map((q) => q.trackId));
        for (const q of data.queue.slice(0, 5000)) {
          if (!q || typeof q.trackId !== 'string' || have.has(q.trackId)) continue;
          const title = String(q.title || '').slice(0, 200), artist = String(q.artist || '').slice(0, 300);
          store.queue.push({ trackId: q.trackId.slice(0, 120), title, artist, key: C.normKey(artist, title), playlist: String(q.playlist || '').slice(0, 200), addedAt: +q.addedAt || Date.now() });
          have.add(q.trackId);
        }
      }
      save();
      pruneQueue();
      resolveTrackSong();
      render();
      toast(`${n} cifra(s) importada(s).`);
    } catch { toast('Arquivo de backup inválido.'); }
  }

  /* ---------- demonstração ---------- */
  function ensureDemoSong() {
    let s = Object.values(store.songs).find((x) => x.trackIds.includes(DEMO_TRACK.id));
    if (s) return;
    s = newSong(DEMO_TRACK.title, DEMO_TRACK.artist, DEMO_SHEET, DEMO_TRACK.id);
    const lines = DEMO_SHEET.split('\n');
    const at = (label, nth = 1) => { let c = 0; return lines.findIndex((l) => l.startsWith(label) && ++c === nth); };
    s.anchors = [
      [at('[Riff]'), 6000], [at('[Primeira Parte]'), 13000], [at('[Refrão]'), 35000], [at('[Solo]'), 53000],
      [at('[Segunda Parte]'), 60000], [at('[Refrão]', 2), 80000], [at('[Final]'), 95000],
    ].filter(([line]) => line >= 0).map(([line, t]) => ({ line, t }));
    save();
  }
  function startDemo() {
    clearTimeout(pollTimer);
    store.settings.demo = true;
    save();
    ensureDemoSong();
    S.demo = true;
    S.connMsg = '';
    S.viewingId = null;
    S.isPlaying = false;
    S.progress = 0;
    S.progressAt = performance.now();
    setConn('demo');
    S.track = null;
    setTrack({ ...DEMO_TRACK });
    updateChrome();
  }
  function stopDemo(resume = true) {
    store.settings.demo = false;
    save();
    S.demo = false;
    S.isPlaying = false;
    setTrack(null);
    setConn(token ? 'on' : 'off');
    render();
    if (resume) poll();
  }

  /* ---------- menu ---------- */
  function openMenu() { syncMenu(); show('#ov-menu'); }
  function syncMenu() {
    const st = store.settings;
    $$('.opt').forEach((b) => b.classList.toggle('on', b.dataset.mode === st.scrollMode));
    $('#m-speed').value = st.speed;
    $('#m-speed-val').textContent = st.speed + ' px/s';
    $('#m-speed-row').hidden = st.scrollMode !== 'fixed';
    $('#m-clear-anchors').hidden = !(currentSong() && (currentSong().anchors || []).length);
    $('#m-fit').checked = !!st.fit;
    $('#m-light').checked = st.theme === 'light';
    $('#m-client').value = st.clientId;
    $('#m-redirect').textContent = REDIRECT_URI;
    $('#m-connect-label').textContent = token ? 'Desconectar do Spotify' : 'Conectar ao Spotify';
    $('#m-demo').checked = S.demo;
    $('#m-lib-count').textContent = Object.keys(store.songs).length + ' salvas';
    $('#m-queue-count').textContent = store.queue.length ? store.queue.length + ' músicas' : '';
    $('#m-version').textContent = 'Cifra Sync · versão ' + APP_VERSION;
  }
  function applyTheme() {
    document.documentElement.dataset.theme = store.settings.theme;
    $('meta[name="theme-color"]').setAttribute('content', store.settings.theme === 'light' ? '#f8f5ef' : '#0e0d0b');
  }

  /* ---------- eventos ---------- */
  function bind() {
    $('#btn-menu').addEventListener('click', openMenu);
    $('#btn-edit').addEventListener('click', () => {
      const song = currentSong();
      if (song) openEditor(song.id);
      else if (S.track) openEditor(null);
      else openEditor(null, { noLink: true });
    });

    $$('#dock [data-c]').forEach((b) => b.addEventListener('click', () => ctl(b.dataset.c)));
    el.progress.addEventListener('click', (e) => {
      if (!S.track || !S.track.duration) return;
      const r = el.progress.getBoundingClientRect();
      S.holdUntil = 0;
      seek(((e.clientX - r.left) / r.width) * S.track.duration);
    });

    const transpose = (d) => {
      const song = currentSong();
      if (!song) return;
      song.transpose = normTranspose((song.transpose || 0) + d);
      song.updatedAt = Date.now();
      save();
      renderSheet();
      updateChrome();
    };
    $('#key-down').addEventListener('click', () => transpose(-1));
    $('#key-up').addEventListener('click', () => transpose(1));
    const font = (f) => {
      store.settings.fontScale = Math.max(0.6, Math.min(2.2, +(store.settings.fontScale * f).toFixed(3)));
      save();
      applyFont();
    };
    $('#font-down').addEventListener('click', () => font(1 / 1.1));
    $('#font-up').addEventListener('click', () => font(1.1));

    el.btnRec.addEventListener('click', () => {
      if (!syncing()) { toast('Dê play nesta música no Spotify para marcar.'); return; }
      S.recording = !S.recording;
      S.undo = [];
      if (S.recording) { markAnchors(); if (!S.isPlaying) toast('Dê play e toque em cada linha quando ela começar.', 4000); }
      updateChrome();
    });
    $('#rec-done').addEventListener('click', () => {
      S.recording = false;
      const n = (currentSong() && currentSong().anchors.length) || 0;
      toast(n ? `${n} marcação(ões) salva(s).` : 'Nenhuma marcação.');
      updateChrome();
    });
    $('#rec-undo').addEventListener('click', undoAnchor);

    el.sheet.addEventListener('click', (e) => {
      const ln = e.target.closest('.ln');
      if (!ln) return;
      const i = +ln.dataset.i;
      if (S.recording) { addAnchor(i); return; }
      const now = performance.now();
      if (S.lastTap.i === i && now - S.lastTap.at < 400) { S.lastTap = { i: -1, at: 0 }; jumpToLine(i); }
      else S.lastTap = { i, at: now };
    });

    const sc = el.scroller;
    sc.addEventListener('touchmove', () => hold(), { passive: true });
    sc.addEventListener('touchend', () => { if (S.holdUntil > performance.now()) hold(2500); }, { passive: true });
    sc.addEventListener('wheel', () => hold(), { passive: true });
    el.resume.addEventListener('click', () => { S.holdUntil = 0; });

    el.fixedToggle.addEventListener('click', () => {
      S.fixedRunning = !S.fixedRunning;
      S.holdUntil = 0;
      updateChrome();
      updateWakeLock();
    });
    $$('#fixed-pill [data-f]').forEach((b) => b.addEventListener('click', () => {
      const st = store.settings;
      st.speed = Math.max(5, Math.min(150, st.speed + (b.dataset.f === 'faster' ? 5 : -5)));
      save();
      updateChrome();
    }));

    el.empty.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      const t = S.track;
      ({
        connect: login,
        settings: () => { openMenu(); $('#m-client').focus(); },
        demo: startDemo,
        library: openLib,
        cc: () => t && openUrl(C.cifraClubUrl(t.artist, t.title)),
        google: () => t && openUrl(C.googleUrl(t.artist, t.title)),
        quickpaste: quickPaste,
        manual: () => openEditor(null),
      }[a.dataset.a] || (() => {}))();
    });
    el.banner.addEventListener('click', (e) => {
      if (!e.target.closest('[data-a="back"]')) return;
      S.viewingId = null;
      S.scrollF = 0;
      el.scroller.scrollTop = 0;
      render();
    });

    // editor
    $('#ed-cancel').addEventListener('click', () => hide('#ov-editor'));
    $('#ed-save').addEventListener('click', saveEditor);
    $('#ed-delete').addEventListener('click', deleteSong);
    $('#ed-paste').addEventListener('click', async () => {
      const txt = await readClipboard();
      if (!txt) { toast('Não consegui ler a área de transferência. Toque e segure no campo para colar.', 4000); return; }
      $('#ed-text').value = C.cleanPasted(txt);
    });
    $('#ed-cc').addEventListener('click', () => openUrl(C.cifraClubUrl($('#ed-artist').value, $('#ed-title').value)));
    $('#ed-google').addEventListener('click', () => openUrl(C.googleUrl($('#ed-artist').value, $('#ed-title').value)));

    // biblioteca
    $('#lib-close').addEventListener('click', () => hide('#ov-lib'));
    $('#lib-new').addEventListener('click', () => { hide('#ov-lib'); openEditor(null, { noLink: true }); });
    $('#lib-search').addEventListener('input', renderLib);
    $('#lib-list').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) pickSong(b.dataset.id); });
    $('#lib-import').addEventListener('click', () => $('#import-songs').click());
    $('#lib-pl').addEventListener('click', openPlaylists);
    $('#lib-queue').addEventListener('click', openQueue);

    // lote: arquivos, playlists e pendentes
    $('#import-songs').addEventListener('change', (e) => {
      const fs = [...(e.target.files || [])];
      e.target.value = '';
      if (fs.length) importFiles(fs);
    });
    $('#m-queue').addEventListener('click', openQueue);
    $('#m-pl').addEventListener('click', openPlaylists);
    $('#m-import-songs').addEventListener('click', () => { hide('#ov-menu'); $('#import-songs').click(); });
    $('#pl-close').addEventListener('click', () => hide('#ov-pl'));
    $('#pl-list').addEventListener('click', (e) => {
      if (e.target.closest('[data-a="reauth"]')) { login(); return; }
      const b = e.target.closest('[data-pl]');
      if (!b) return;
      if (b.dataset.own !== '1') {
        toast('O Spotify só libera playlists criadas por você. No Spotify: ⋯ na playlist → Adicionar a outra playlist → Nova playlist.', 7000);
        return;
      }
      importPlaylist(b.dataset.pl, b.dataset.name);
    });
    $('#q-close').addEventListener('click', () => hide('#ov-queue'));
    $('#q-clear').addEventListener('click', () => {
      if (!confirm('Limpar toda a fila de pendentes?')) return;
      store.queue = [];
      queueActive = null;
      save();
      renderQueue();
    });
    $('#q-list').addEventListener('click', (e) => {
      if (e.target.closest('[data-a="from-pl"]')) { hide('#ov-queue'); openPlaylists(); return; }
      const b = e.target.closest('[data-qa]');
      const row = e.target.closest('[data-q]');
      if (b && row) queueAction(row.dataset.q, b.dataset.qa);
    });

    // menu
    $('#ov-menu').addEventListener('click', (e) => { if (e.target.id === 'ov-menu') hide('#ov-menu'); });
    $('#m-close').addEventListener('click', () => hide('#ov-menu'));
    $('#m-lib').addEventListener('click', () => { hide('#ov-menu'); openLib(); });
    $$('.opt').forEach((b) => b.addEventListener('click', () => {
      store.settings.scrollMode = b.dataset.mode;
      S.fixedRunning = false;
      S.recording = false;
      save();
      syncMenu();
      updateChrome();
      updateWakeLock();
    }));
    $('#m-speed').addEventListener('input', (e) => { store.settings.speed = +e.target.value; save(); syncMenu(); updateChrome(); });
    $('#m-clear-anchors').addEventListener('click', () => {
      const song = currentSong();
      if (!song || !confirm('Apagar as marcações de tempo desta música?')) return;
      song.anchors = [];
      save();
      rebuildTimeline();
      markAnchors();
      syncMenu();
      toast('Marcações apagadas.');
    });
    $('#m-fit').addEventListener('change', (e) => { store.settings.fit = e.target.checked; save(); applyFont(); });
    $('#m-light').addEventListener('change', (e) => { store.settings.theme = e.target.checked ? 'light' : 'dark'; save(); applyTheme(); });
    $('#m-client').addEventListener('change', (e) => {
      const v = e.target.value.trim();
      if (v === store.settings.clientId) return;
      store.settings.clientId = v;
      if (token) clearToken();
      save();
      syncMenu();
      render();
      toast(v ? 'Client ID salvo.' : 'Client ID removido.');
    });
    $('#m-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(REDIRECT_URI); toast('Endereço copiado.'); } catch { toast('Copie manualmente: ' + REDIRECT_URI, 5000); }
    });
    $('#m-connect').addEventListener('click', () => {
      if (token) {
        clearToken();
        clearTimeout(pollTimer);
        S.isPlaying = false;
        setTrack(null);
        setConn('off');
        hide('#ov-menu');
        render();
        toast('Desconectado do Spotify.');
      } else {
        store.settings.clientId = $('#m-client').value.trim();
        save();
        login();
      }
    });
    $('#m-export').addEventListener('click', exportBackup);
    $('#m-import').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) importBackup(f);
    });
    $('#m-demo').addEventListener('change', (e) => {
      hide('#ov-menu');
      if (e.target.checked) startDemo();
      else stopDemo();
    });

    // pedal Bluetooth / teclado
    document.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      if ($$('.ov').some((o) => !o.hidden)) return;
      const page = el.scroller.clientHeight * 0.6;
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); hold(6000); el.scroller.scrollBy({ top: page, behavior: 'smooth' }); }
      else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); hold(6000); el.scroller.scrollBy({ top: -page, behavior: 'smooth' }); }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { if (!S.demo) poll(); }
      else clearTimeout(pollTimer);
      updateWakeLock();
    });
    window.addEventListener('resize', debounce(applyFont, 150));
    el.art.addEventListener('error', () => { el.art.hidden = true; el.artPh.hidden = false; });
  }

  /* ---------- início ---------- */
  // Se a página e o código vierem de versões diferentes (cache velho), recarrega uma vez.
  function versionMismatch() {
    const meta = document.querySelector('meta[name="app-version"]');
    const pageV = meta && meta.content;
    if (pageV === APP_VERSION) { try { sessionStorage.removeItem('cifrasync.reloaded'); } catch {} return false; }
    let tried = false;
    try { tried = sessionStorage.getItem('cifrasync.reloaded') === '1'; sessionStorage.setItem('cifrasync.reloaded', '1'); } catch {}
    if (tried) return false;
    location.reload();
    return true;
  }

  async function boot() {
    if (versionMismatch()) return;
    applyTheme();
    measureCharRatio();
    bind();
    try { await handleRedirect(); } catch (e) { toast('Erro no login: ' + e.message, 5000); }
    if (store.settings.demo) startDemo();
    else { setConn(token ? 'on' : 'off'); render(); if (token) poll(); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measureCharRatio(); applyFont(); });
    requestAnimationFrame(frame);
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  boot();
})();
