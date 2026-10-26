/* Cifra Sync — núcleo: leitura da cifra, transposição e sincronia com o tempo da música.
   Código puro (sem DOM): roda no navegador e no Node (para testes). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CifraCore = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const NOTE_INDEX = {
    C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5,
    'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
  };
  // Tons maiores que se escrevem com bemóis: F, Bb, Eb, Ab, Db
  const FLAT_MAJOR = new Set([5, 10, 3, 8, 1]);

  // Acorde no padrão brasileiro: C, Am7, G/B, F#m7(b5), Bb7M(9), D4, A7/9, C#º, E7(9-)...
  const CHORD_RE = /^([A-G])([#b]?)((?:maj|min|dim|aug|sus|add|m|M|º|°|ø|\+|-)?(?:[0-9]+|maj|sus|add|M|º|°|ø|\+|-|#|b|\/[0-9]+|\([^()\s]*\))*)(?:\/([A-G])([#b]?))?$/;
  // Marcas que aparecem em linhas de acorde e não são acordes: barras, (2x), N.C., %...
  const NEUTRAL_RE = /^(?:\|{1,2}:?|:?\|{1,2}|[-–—]+|%|\/|\.{2,}|…|N\.?C\.?|\(?\d+\s*[xX]\)?|\(?[xX]\s*\d+\)?|→|>|\*+|\(|\))$/;
  const LABEL_BRACKET = /^\[[^\]]*\]$/;
  const LABEL_COLON = /^[A-Za-zÀ-ÿ0-9ºª.]+:$/;
  const WEIGHT = { blank: 0.25, section: 0.5, chords: 1, lyric: 1, tab: 1 };

  function tokenize(line) {
    const out = [];
    const re = /\[[^\]]*\]|\S+/g;
    let m;
    while ((m = re.exec(line))) out.push({ text: m[0], index: m.index });
    return out;
  }

  function parseChordToken(tok) {
    let pre = '', post = '', core = String(tok);
    if (core.length > 1 && core[0] === '(') { pre = '('; core = core.slice(1); }
    const open = (core.match(/\(/g) || []).length;
    const close = (core.match(/\)/g) || []).length;
    if (close > open && core.endsWith(')')) { post = ')'; core = core.slice(0, -1); }
    const m = CHORD_RE.exec(core);
    if (!m) return null;
    return { pre, post, root: m[1] + m[2], suffix: m[3] || '', bass: m[4] ? m[4] + (m[5] || '') : '' };
  }

  function isLabel(text, first) {
    return LABEL_BRACKET.test(text) || (first && LABEL_COLON.test(text));
  }

  function isTabLine(t) {
    return (/^[A-Ga-g][#b]?\s*[|:]/.test(t) || /^[|\-–0-9hpbr\/\\~x()\s.]{8,}$/.test(t)) && /[-–]{3,}/.test(t);
  }

  /** Classifica a linha: 'blank' | 'tab' | 'chords' | 'section' | 'lyric' */
  function classifyLine(line) {
    const t = String(line).trim();
    if (!t) return 'blank';
    if (isTabLine(t)) return 'tab';
    const toks = tokenize(line);
    let chords = 0, labels = 0;
    for (let k = 0; k < toks.length; k++) {
      const x = toks[k].text;
      if (isLabel(x, k === 0)) { labels++; continue; }
      if (parseChordToken(x)) { chords++; continue; }
      if (NEUTRAL_RE.test(x)) continue;
      return 'lyric';
    }
    if (chords) return 'chords';
    if (labels) return 'section';
    return 'lyric';
  }

  function transposeNote(note, semis, flats) {
    const idx = NOTE_INDEX[note];
    if (idx === undefined) return note;
    return (flats ? FLAT : SHARP)[(((idx + semis) % 12) + 12) % 12];
  }

  function transposeLine(line, semis, flats) {
    let out = '';
    for (const tk of tokenize(line)) {
      const p = parseChordToken(tk.text);
      const text = p
        ? p.pre + transposeNote(p.root, semis, flats) + p.suffix + (p.bass ? '/' + transposeNote(p.bass, semis, flats) : '') + p.post
        : tk.text;
      let col = tk.index;
      if (out.length && out.length >= col) col = out.length + 1; // acorde cresceu: mantém pelo menos um espaço
      out += ' '.repeat(col - out.length) + text;
    }
    return out;
  }

  /** Tom provável: o primeiro acorde da cifra. */
  function detectKey(text) {
    for (const line of String(text).split('\n')) {
      if (classifyLine(line) !== 'chords') continue;
      for (const tk of tokenize(line)) {
        const p = parseChordToken(tk.text);
        if (p) return { root: p.root, minor: /^m(?!aj)/.test(p.suffix) };
      }
    }
    return null;
  }
  const keyName = (k) => (k ? k.root + (k.minor ? 'm' : '') : null);

  function transposeSheet(text, semis) {
    const key = detectKey(text);
    const s = (((semis | 0) % 12) + 12) % 12;
    if (!s) return { text, key: keyName(key) };
    let flats = false;
    if (key && NOTE_INDEX[key.root] !== undefined) {
      const ni = (NOTE_INDEX[key.root] + s) % 12;
      flats = FLAT_MAJOR.has(key.minor ? (ni + 3) % 12 : ni);
    }
    const lines = String(text).split('\n').map((l) => (classifyLine(l) === 'chords' ? transposeLine(l, s, flats) : l));
    const newKey = key ? { root: transposeNote(key.root, s, flats), minor: key.minor } : null;
    return { text: lines.join('\n'), key: keyName(newKey) };
  }

  /* ---------- sincronia ----------
     Cada linha tem um "peso" de tempo. Acorde logo acima da letra pesa 0 (anda junto com ela),
     linha em branco pesa pouco. A posição na música vira uma posição W nesse eixo de pesos. */
  function computeUnits(types) {
    const n = types.length, w = new Array(n), cum = new Array(n + 1);
    for (let i = 0; i < n; i++) {
      let x = WEIGHT[types[i]] !== undefined ? WEIGHT[types[i]] : 1;
      if (types[i] === 'chords' && types[i + 1] === 'lyric') x = 0;
      w[i] = x;
    }
    cum[0] = 0;
    for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + w[i];
    return { w, cum, total: cum[n] };
  }

  /** Converte marcações {line, t(ms)} numa linha do tempo [{t, w}] crescente. */
  function buildTimeline(anchors, cum, total, duration) {
    const maxLine = cum.length - 2;
    const pts = (anchors || [])
      .filter((a) => a && Number.isFinite(a.t) && Number.isInteger(a.line) && a.line >= 0 && a.line <= maxLine)
      .map((a) => ({ t: a.t, w: cum[a.line] }))
      .sort((a, b) => a.t - b.t);
    const mono = [];
    for (const p of pts) {
      const last = mono[mono.length - 1];
      if (!last || (p.w >= last.w && p.t > last.t)) mono.push(p);
    }
    const res = [];
    if (!mono.length || mono[0].t > 0) res.push({ t: 0, w: 0 });
    res.push(...mono);
    const last = res[res.length - 1];
    if (duration > last.t) res.push({ t: duration, w: Math.max(total, last.w) });
    return res;
  }

  function positionAt(t, tl) {
    if (!tl || !tl.length) return 0;
    if (t <= tl[0].t) return tl[0].w;
    for (let i = 1; i < tl.length; i++) {
      if (t < tl[i].t) {
        const a = tl[i - 1], b = tl[i], span = b.t - a.t;
        return span > 0 ? a.w + ((b.w - a.w) * (t - a.t)) / span : b.w;
      }
    }
    return tl[tl.length - 1].w;
  }

  /** Inverso: em que momento da música a posição W é alcançada (para pular até uma linha). */
  function timeAt(w, tl) {
    if (!tl || !tl.length) return null;
    if (w <= tl[0].w) return tl[0].t;
    for (let i = 1; i < tl.length; i++) {
      const a = tl[i - 1], b = tl[i];
      if (w <= b.w && b.w > a.w) return a.t + ((w - a.w) / (b.w - a.w)) * (b.t - a.t);
    }
    return tl[tl.length - 1].t;
  }

  function interp(x, xs, ys) {
    const n = xs.length;
    if (!n) return 0;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
    const span = xs[hi] - xs[lo];
    return span > 0 ? ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / span : ys[hi];
  }

  /** Índice da linha "atual" para a posição W (ignora linhas de peso 0). */
  function unitAt(w, units) {
    if (!units) return -1;
    let found = -1;
    for (let i = 0; i < units.w.length; i++) {
      if (units.w[i] > 0) { if (units.cum[i] <= w + 1e-9) found = i; else break; }
    }
    return found;
  }

  /* ---------- texto ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function lineToHtml(line, type) {
    if (type === 'blank') return '';
    if (type === 'section') return '<i class="lb">' + esc(line) + '</i>';
    if (type !== 'chords') return esc(line);
    let out = '', pos = 0, k = 0;
    for (const tk of tokenize(line)) {
      out += esc(line.slice(pos, tk.index));
      if (isLabel(tk.text, k === 0)) out += '<i class="lb">' + esc(tk.text) + '</i>';
      else if (parseChordToken(tk.text)) out += '<b class="c">' + esc(tk.text) + '</b>';
      else out += esc(tk.text);
      pos = tk.index + tk.text.length;
      k++;
    }
    return out + esc(line.slice(pos));
  }

  function expandTabs(l) {
    let out = '';
    for (const ch of l) out += ch === '\t' ? ' '.repeat(4 - (out.length % 4)) : ch;
    return out;
  }

  function cleanPasted(text) {
    let s = String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[   ]/g, ' ')
      .replace(/[​-‍﻿]/g, '');
    s = s.split('\n').map((l) => expandTabs(l).replace(/\s+$/, '')).join('\n');
    return s.replace(/\n{4,}/g, '\n\n\n').replace(/^\n+|\n+$/g, '');
  }

  const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function baseTitle(title) {
    return String(title || '')
      .replace(/\s+-\s+.*$/, '') // "Música - Remastered 2011" / "- Ao Vivo"
      .replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ') // "(Ao Vivo)", "[Live]", "(feat. X)"
      .replace(/\s+/g, ' ')
      .trim();
  }
  const firstArtist = (a) => String(a || '').split(',')[0].trim();

  function normKey(artist, title) {
    const a = fold(firstArtist(artist)).replace(/[^a-z0-9]+/g, ' ').trim();
    const t = fold(baseTitle(title)).replace(/[^a-z0-9]+/g, ' ').trim();
    return a + '|' + t;
  }

  const slug = (s) => fold(s).replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  function cifraClubUrl(artist, title) {
    const a = slug(firstArtist(artist)), t = slug(baseTitle(title));
    return a && t ? `https://www.cifraclub.com.br/${a}/${t}/` : 'https://www.cifraclub.com.br/';
  }
  function googleUrl(artist, title) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(`cifra club ${firstArtist(artist)} ${baseTitle(title)}`.trim());
  }

  function fmtTime(ms) {
    const s = Math.max(0, Math.floor((ms || 0) / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  return {
    tokenize, parseChordToken, classifyLine, isTabLine, transposeNote, transposeLine, transposeSheet,
    detectKey, computeUnits, buildTimeline, positionAt, timeAt, interp, unitAt,
    lineToHtml, cleanPasted, normKey, baseTitle, fold, slug, cifraClubUrl, googleUrl, fmtTime, esc,
  };
});
