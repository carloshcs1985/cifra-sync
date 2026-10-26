/* Funções puras para LRC, identidade da gravação e diagramas. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CifraStudyCore = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';
  const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function parseLrc(text) {
    const out = []; let offset = 0;
    for (const line of String(text || '').split(/\r?\n/)) {
      const off = /\[offset:([+-]?\d+)\]/i.exec(line); if (off) offset = Number(off[1]);
    }
    for (const line of String(text || '').split(/\r?\n/)) {
      const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
      const content = line.replace(/\[[^\]]*\]/g, '').trim();
      for (const m of stamps) {
        if (+m[2] >= 60) continue;
        const fraction = m[3] ? Number('0.' + m[3]) : 0;
        out.push({ t: Math.max(0, Math.round((+m[1] * 60 + +m[2] + fraction) * 1000 + offset)), text: content });
      }
    }
    return out.sort((a, b) => a.t - b.t);
  }
  function lyricIndex(lines, ms) {
    let lo = 0, hi = lines.length - 1, result = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (lines[mid].t <= ms) { result = mid; lo = mid + 1; } else hi = mid - 1; }
    return result;
  }
  const lyricTitle = s => String(s || '').replace(/\s*\((?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?\)/gi,'').replace(/\s*[-–]\s*(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?/gi,'').trim();
  const identity = s => fold(lyricTitle(s)).replace(/[^a-z0-9]+/g, ' ').trim();
  function variant(s) { return ['live', 'ao vivo', 'acoustic', 'acustic', 'remix', 'instrumental'].filter(w => fold(s).includes(w)).join('|'); }
  function matchLyrics(track, result) {
    if (!result || identity(result.artistName) !== identity(String(track.artist || '').split(',')[0])) return false;
    if (identity(result.trackName) !== identity(track.title) || variant(result.trackName) !== variant(track.title)) return false;
    return !track.duration || (Number.isFinite(+result.duration) && Math.abs(track.duration / 1000 - +result.duration) <= 3);
  }
  function chordLookup(token, db, parse) {
    const p = parse(token); if (!p) return null;
    const enharmonic = { Db:'C#', 'D#':'Eb', Gb:'F#', 'G#':'Ab', 'A#':'Bb', Cb:'B', 'B#':'C', Fb:'E', 'E#':'F' };
    const root = enharmonic[p.root] || p.root;
    const alias = { '':'major', m:'minor', min:'minor', '7M':'maj7', M7:'maj7', 'M':'major', '7M(9)':'maj9', '7M(5-)':'maj7b5',
      'm7(5-)':'m7b5', 'm7(b5)':'m7b5', 'm(maj7)':'mmaj7', 'm7M':'mmaj7', '7(9)':'9', '7/9':'9', '7(b9)':'7b9', '7(9-)':'7b9',
      '7(#9)':'7#9', '7(9+)':'7#9', '4':'sus4', '2':'sus2', 'º':'dim', '°':'dim', 'º7':'dim7', '°7':'dim7', '+':'aug' };
    let suffix = Object.hasOwn(alias, p.suffix) ? alias[p.suffix] : p.suffix;
    if (p.bass) suffix = (suffix === 'major' ? '' : suffix === 'minor' ? 'm' : suffix) + '/' + (enharmonic[p.bass] || p.bass);
    for (const entries of Object.values(db.chords || {})) {
      const chord = entries.find(e => (enharmonic[e.key] || e.key) === root && e.suffix === suffix);
      if (chord) return { ...chord, positions: [...chord.positions].sort((a,b) => a.baseFret-b.baseFret || a.barres.length-b.barres.length) };
    }
    return null;
  }
  return { parseLrc, lyricIndex, lyricTitle, identity, variant, matchLyrics, chordLookup };
});
