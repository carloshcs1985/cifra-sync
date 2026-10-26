/* Cifra Sync — diagramas de acordes para violão/guitarra (afinação padrão E A D G B E).
   Monta a posição a partir da teoria do acorde (notas que o compõem) e usa um pequeno
   dicionário com as posições abertas clássicas. Código puro: roda no navegador e no Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CifraChords = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const PC = { C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11 };
  const OPEN = [4, 9, 2, 7, 11, 4]; // cordas soltas, da 6ª (mais grave) para a 1ª
  const RE = /^([A-G])([#b]?)(.*?)(?:\/([A-G])([#b]?))?$/;

  /* ---------- teoria: quais notas o acorde tem ---------- */
  function parseQuality(suffix) {
    let s = String(suffix || '').replace(/\s+/g, '');
    const q = { third: 4, fifth: 7, fifthAltered: false, seventh: null, sixth: false, ext: [], power: false, sus: null };
    s = s.replace(/maj7|7M|M7|7\+|Maj7|Δ/g, 'Δ');
    s = s.replace(/sus4/g, '4').replace(/sus2/g, '2').replace(/sus/g, '4').replace(/add/g, '+add');
    if (/^ø/.test(s)) { q.third = 3; q.fifth = 6; q.fifthAltered = true; q.seventh = 10; s = s.slice(1); }
    else if (/^(º|°|dim|o(?![a-z]))/.test(s)) {
      q.third = 3; q.fifth = 6; q.fifthAltered = true;
      s = s.replace(/^(º|°|dim|o)/, '');
      // No Brasil, "Cº" costuma significar diminuto com sétima diminuta.
      q.seventh = /^7?$/.test(s.replace(/[()]/g, '')) || /^7/.test(s) ? 9 : null;
      s = s.replace(/^7/, '');
    } else if (/^(m|min)(?!aj)/.test(s)) { q.third = 3; s = s.replace(/^(min|m)/, ''); }
    else if (/^M(?!aj)/.test(s)) s = s.slice(1);
    if (/^(\+|aug)(?!add)/.test(s)) { q.fifth = 8; q.fifthAltered = true; s = s.replace(/^(\+|aug)/, ''); }
    if (/^5$/.test(s.replace(/[()]/g, ''))) { q.power = true; q.third = null; return q; }
    if (s.includes('Δ')) q.seventh = 11;
    const isAdd = (i) => s.slice(Math.max(0, i - 4), i).includes('add');
    const re = /([b#+-]?)(\d{1,2})([b#+-]?)/g;
    let m;
    while ((m = re.exec(s))) {
      const n = +m[2];
      const acc = m[1] || m[3];
      const sh = acc === 'b' || acc === '-' ? -1 : acc === '#' || acc === '+' ? 1 : 0;
      if (n === 7) { if (q.seventh == null) q.seventh = 10; }
      else if (n === 6) q.sixth = true;
      else if (n === 5) { if (sh) { q.fifth = 7 + sh; q.fifthAltered = true; } }
      else if (n === 2) { if (isAdd(m.index)) q.ext.push(2); else q.sus = 2; }
      else if (n === 4) { if (isAdd(m.index)) q.ext.push(5); else q.sus = 5; }
      else if (n === 9) q.ext.push(2 + sh);
      else if (n === 11) q.ext.push(5 + sh);
      else if (n === 13) q.ext.push(9 + sh);
    }
    if (q.sus != null) q.third = q.sus;
    return q;
  }

  function parseChord(name) {
    const m = RE.exec(String(name || '').trim().replace(/^\(|\)$/g, ''));
    if (!m) return null;
    const root = PC[m[1] + m[2]];
    if (root === undefined) return null;
    const q = parseQuality(m[3]);
    const bass = m[4] ? PC[m[4] + (m[5] || '')] : root;
    const req = new Set([0]);
    const opt = new Set();
    if (q.power) req.add(7);
    else {
      req.add(q.third);
      if (q.fifthAltered) req.add(q.fifth); else opt.add(7);
      if (q.seventh != null) req.add(q.seventh);
      if (q.sixth) req.add(9);
    }
    const ext = q.ext.filter((x) => !req.has(x));
    const pcs = (set) => [...set].map((i) => (root + i) % 12);
    return {
      name: String(name), root, bass: bass === undefined ? root : bass,
      required: pcs(req), optional: pcs(opt), ext: ext.map((i) => (root + i) % 12),
      power: q.power,
    };
  }

  /* ---------- dedos e pestana ---------- */
  function fingering(frets) {
    const fr = frets.map((f, i) => ({ f, i })).filter((x) => x.f > 0);
    const fingers = frets.map(() => 0);
    if (!fr.length) return { fingers, barre: null, count: 0 };
    const minF = Math.min(...fr.map((x) => x.f));
    const atMin = fr.filter((x) => x.f === minF);
    let barre = null;
    if (fr.length > 4 && atMin.length >= 2) {
      const from = atMin[0].i, to = atMin[atMin.length - 1].i;
      let ok = true;
      for (let s = from; s <= to; s++) if (frets[s] < minF) ok = false; // solta ou abafada no meio da pestana
      if (ok) barre = { fret: minF, from, to };
    }
    let rest = fr;
    let n = 1;
    if (barre) {
      for (let s = barre.from; s <= barre.to; s++) if (frets[s] === minF) fingers[s] = 1;
      rest = fr.filter((x) => !(x.f === minF && x.i >= barre.from && x.i <= barre.to));
      n = 2;
    }
    const count = (barre ? 1 : 0) + rest.length;
    // o dedo acompanha a distância em casas (uma casa acima da pestana = dedo 2, duas = dedo 3...)
    rest.sort((a, b) => a.f - b.f || a.i - b.i).forEach((x) => {
      const f = Math.min(4, Math.max(n, x.f - minF + 1));
      fingers[x.i] = f;
      n = f + 1;
    });
    return { fingers, barre, count };
  }

  /* ---------- busca da melhor posição ---------- */
  function search(ch, opts) {
    const tones = new Set([...ch.required, ...ch.optional, ...ch.ext]);
    const need = opts.requireExt ? [...ch.required, ...ch.ext] : ch.required;
    const bass = opts.useBass ? ch.bass : ch.root;
    tones.add(bass);
    const minSounding = ch.power ? 2 : 4;
    let best = null;
    const cur = new Array(6);
    for (let w = 0; w <= 10; w++) {
      const lo = Math.max(1, w), hi = w === 0 ? 4 : w + 3;
      const choices = OPEN.map((open) => {
        const c = [-1];
        if (tones.has(open)) c.push(0);
        for (let f = lo; f <= hi; f++) if (tones.has((open + f) % 12)) c.push(f);
        return c;
      });
      const rec = (s, started, ended) => {
        if (s === 6) { evaluate(w); return; }
        for (const f of choices[s]) {
          if (f === -1) {
            if (started && !(s === 5)) continue; // só abafa cordas graves no começo ou a 1ª corda
            cur[s] = -1; rec(s + 1, started, started);
          } else {
            if (ended) continue;
            cur[s] = f; rec(s + 1, true, false);
          }
        }
      };
      const evaluate = (win) => {
        const snd = [];
        for (let s = 0; s < 6; s++) if (cur[s] >= 0) snd.push(s);
        if (snd.length < minSounding) return;
        const low = snd[0];
        if ((OPEN[low] + cur[low]) % 12 !== bass) return;
        const have = new Set(snd.map((s) => (OPEN[s] + cur[s]) % 12));
        for (const t of need) if (!have.has(t)) return;
        const fretted = snd.filter((s) => cur[s] > 0).map((s) => cur[s]);
        if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > 3) return;
        const fg = fingering(cur);
        if (fg.count > 4) return;
        const opens = snd.filter((s) => cur[s] === 0).length;
        let score = win * 1.2 + low * 1.1 + (cur[5] === -1 ? 2.5 : 0) + fg.count * 0.35;
        if (snd.length === 4 && !ch.power) score += 0.8;
        if (win > 4) score += opens * 1.2;
        else score -= opens * 0.3;
        for (const t of ch.optional) if (!have.has(t)) score += 1;
        for (const t of ch.ext) if (!have.has(t)) score += 1.2;
        if (fg.barre) score += win <= 1 ? 0.8 : 0.4;
        if (fretted.length) score += (Math.max(...fretted) - Math.min(...fretted)) * 0.4;
        if (ch.power && snd.length > 3) score += 1;
        if (!best || score < best.score) best = { frets: cur.slice(), score };
      };
      rec(0, false, false);
    }
    return best && best.frets;
  }

  /* posições abertas clássicas (a busca cobre o resto) */
  const DICT = {
    C: 'x32010', C7: 'x32310', C7M: 'x32000', C9: 'x32030', 'C/E': '032010', 'C/G': '332010', 'C/B': 'x20010',
    D: 'xx0232', Dm: 'xx0231', D7: 'xx0212', Dm7: 'xx0211', D7M: 'xx0222', D4: 'xx0233', D2: 'xx0230', 'D/F#': '2x0232',
    'E/G#': '4x2100', 'A7(9)': 'x02423', 'F#m7(b5)': '2x221x', 'Bm7(b5)': 'x2323x', 'Em7(9)': '022032', 'Am7(9)': 'x05557',
    E: '022100', Em: '022000', E7: '020100', Em7: '022030', E4: '022200', E7M: '021100',
    F: '133211', Fm: '133111', F7: '131211', F7M: 'xx3210', 'F/A': 'x03211',
    G: '320003', G7: '320001', 'G/B': 'x20003', G6: '320000',
    A: 'x02220', Am: 'x02210', A7: 'x02020', Am7: 'x02010', A7M: 'x02120', A4: 'x02230', A2: 'x02200', 'Am/G': '3x2210', A9: 'x02420',
    B7: 'x21202', Bm: 'x24432', Bm7: 'x20202', B: 'x24442', Bb: 'x13331', 'F#m': '244222', 'C#m': 'x46654', 'G#m': '466444',
    Cm: 'x35543', Gm: '355333', 'F#': '244322', 'F#m7': '242222', 'C#m7': 'x46454', 'G#': '466544', Eb: 'x68886',
  };

  /* Formas móveis de pestana: raiz na 6ª corda (forma de E) e na 5ª corda (forma de A).
     Números relativos à casa da raiz; null = corda abafada. */
  const SHAPES = {
    E: [[0, 2, 2, 1, 0, 0], [0, 2, 2, 0, 0, 0], [0, 2, 0, 1, 0, 0], [0, 2, 0, 0, 0, 0], [0, 2, 2, 2, 0, 0], [0, null, 1, 1, 0, null], [0, 2, 1, 1, 0, 0]],
    A: [[null, 0, 2, 2, 2, 0], [null, 0, 2, 2, 1, 0], [null, 0, 2, 0, 2, 0], [null, 0, 2, 0, 1, 0], [null, 0, 2, 1, 2, 0], [null, 0, 2, 2, 3, 0],
      [null, 0, 1, 0, 1, null], [null, 0, 1, 2, 1, 2], [null, 0, 2, 2, 0, 0], [null, 0, -1, 0, 0, null]],
  };
  function fromShapes(ch) {
    if (ch.bass !== ch.root) return null;
    const allowed = new Set([...ch.required, ...ch.optional, ...ch.ext]);
    const need = [...ch.required, ...ch.ext];
    let best = null;
    for (const [form, list] of Object.entries(SHAPES)) {
      const r = (ch.root - (form === 'E' ? 4 : 9) + 12) % 12;
      for (const sh of list) {
        const frets = sh.map((d) => (d === null ? -1 : d + r));
        if (frets.some((f) => f < -1 || (f === -1 && false))) continue;
        if (sh.some((d) => d !== null && d + r < 0)) continue;
        const have = new Set();
        let ok = true;
        frets.forEach((f, s) => { if (f >= 0) { const pc = (OPEN[s] + f) % 12; have.add(pc); if (!allowed.has(pc)) ok = false; } });
        if (!ok || need.some((t) => !have.has(t))) continue;
        const top = Math.max(...frets);
        if (!best || top < best.top) best = { frets, top };
      }
    }
    return best && best.top <= 12 ? best.frets : null;
  }
  const sigOf = (ch) => [ch.root, ch.bass, [...ch.required].sort().join('.'), [...ch.ext].sort().join('.'), ch.power ? 'p' : ''].join('|');
  const DICT_BY_SIG = new Map();
  for (const [name, shape] of Object.entries(DICT)) {
    const ch = parseChord(name);
    if (ch) DICT_BY_SIG.set(sigOf(ch), shape.split('').map((c) => (c === 'x' ? -1 : parseInt(c, 10))));
  }

  const cache = new Map();
  /** Devolve { name, frets[6], fingers[6], barre, base, simplified } ou null. */
  function voicing(name) {
    if (cache.has(name)) return cache.get(name);
    const ch = parseChord(name);
    let res = null;
    if (ch) {
      let frets = DICT_BY_SIG.get(sigOf(ch)) || null;
      let simplified = false;
      if (!frets) frets = fromShapes(ch);
      if (!frets) frets = search(ch, { requireExt: true, useBass: true });
      if (!frets) { frets = search(ch, { requireExt: false, useBass: true }); simplified = !!frets; }
      if (!frets && ch.bass !== ch.root) { frets = search(ch, { requireExt: true, useBass: false }) || search(ch, { requireExt: false, useBass: false }); simplified = !!frets; }
      if (frets) {
        const fg = fingering(frets);
        const fretted = frets.filter((f) => f > 0);
        const maxF = fretted.length ? Math.max(...fretted) : 0;
        const base = maxF <= 4 ? 1 : Math.min(...fretted);
        res = { name, frets, fingers: fg.fingers, barre: fg.barre, base, simplified };
      }
    }
    cache.set(name, res);
    return res;
  }

  /* ---------- desenho (SVG) ---------- */
  function svg(v) {
    const X = (s) => 11 + s * 9.6, Y = (r) => 8 + r * 14;
    const out = [];
    out.push('<svg class="cd" viewBox="0 0 70 92" aria-hidden="true">');
    for (let r = 0; r <= 5; r++) out.push(`<line class="cd-f" x1="${X(0)}" y1="${Y(r)}" x2="${X(5)}" y2="${Y(r)}"/>`);
    for (let s = 0; s < 6; s++) out.push(`<line class="cd-s" x1="${X(s)}" y1="${Y(0)}" x2="${X(s)}" y2="${Y(5)}"/>`);
    if (v.base === 1) out.push(`<rect class="cd-nut" x="${X(0) - 0.6}" y="${Y(0) - 2.6}" width="${X(5) - X(0) + 1.2}" height="3"/>`);
    else out.push(`<text class="cd-n" x="${X(0) - 4}" y="${Y(0.5) + 2.5}" text-anchor="end">${v.base}</text>`);
    if (v.barre) {
      const y = Y(v.barre.fret - v.base + 0.5);
      out.push(`<rect class="cd-b" x="${X(v.barre.from) - 4.5}" y="${y - 4.5}" width="${X(v.barre.to) - X(v.barre.from) + 9}" height="9" rx="4.5"/>`);
    }
    for (let s = 0; s < 6; s++) {
      const f = v.frets[s];
      if (f > 0) {
        const y = Y(f - v.base + 0.5);
        const inBarre = v.barre && f === v.barre.fret && s >= v.barre.from && s <= v.barre.to;
        if (!inBarre || s === v.barre.from) {
          if (!inBarre) out.push(`<circle class="cd-d" cx="${X(s)}" cy="${y}" r="4.6"/>`);
          if (v.fingers[s]) out.push(`<text class="cd-t" x="${inBarre ? (X(v.barre.from) + X(v.barre.to)) / 2 : X(s)}" y="${y + 2.4}" text-anchor="middle">${v.fingers[s]}</text>`);
        }
      }
      const my = Y(5) + 8;
      if (f === -1) out.push(`<text class="cd-m" x="${X(s)}" y="${my}" text-anchor="middle">×</text>`);
      else if (f === 0) out.push(`<circle class="cd-o" cx="${X(s)}" cy="${my - 2.6}" r="2.4"/>`);
    }
    out.push('</svg>');
    return out.join('');
  }

  return { parseChord, parseQuality, voicing, fingering, svg, DICT };
});
