(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.Axis = root.Axis || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function actorId(v, decimal = false) {
    if (typeof v === 'number') return v > 0 ? Math.trunc(v).toString(16).toUpperCase().padStart(8, '0') : '';
    const s = String(v || '').trim();
    if (!s) return '';
    if (decimal && /^\d+$/.test(s)) return actorId(Number(s));
    return s.replace(/^0x/i, '').toUpperCase().padStart(8, '0');
  }
  function parseTs(v) {
    // Normalize ACT's seven fractional digits for older Chromium builds.
    return Date.parse(String(v).replace(/(\.\d{3})\d+(?=Z|[+-]\d{2}:?\d{2}$)/, '$1'));
  }
  class Parser {
    constructor(me = '') { this.me = actorId(me); this.seen = new Map(); this.lines = 0; this.abilities = 0; this.filtered = 0; }
    setPlayer(v, decimal = false) { const id = actorId(v, decimal); if (id !== this.me) this.seen.clear(); this.me = id; }
    feed(event) {
      const line = Array.isArray(event) ? event : Array.isArray(event.line) ? event.line : String(event.rawLine || event || '').trim().split('|');
      this.lines++;
      if (line.length < 2) return null;
      const type = String(line[0]);
      const at = parseTs(line[1]);
      if (type === '02') { this.setPlayer(line[2]); return {type: 'player', id: this.me, name: line[3] || ''}; }
      if (type === '01') { this.seen.clear(); return {type: 'zone', id: line[2], name: line[3] || ''}; }
      if (type === '260') return {type: 'combat', active: line[3] === '1', changed: line[5] === '1',at};
      if (type === '12') return {type: 'job', jobId: parseInt(line[2], 16)};
      if (type === '25') return this.me && actorId(line[2]) === this.me ? {type: 'death'} : null;
      if (!['20', '21', '22', '23'].includes(type)) return null;
      if (!this.me || actorId(line[2]) !== this.me) { this.filtered++; return null; }
      const id = parseInt(line[4], 16);
      if (!Number.isFinite(id) || id === 7 || id === 8) return null;
      if (type === '20') return {type: 'cast', id, at, duration: Number(line[8]) * 1000};
      if (type === '23') return {type: 'cancel', id};
      if (!Number.isFinite(at)) return null;
      const seq = line[44];
      const key = seq && seq !== '0' && !/^0+$/.test(seq) ? `${this.me}:${id}:${seq}` : `${this.me}:${id}:${line[1]}`;
      // Sequence is shared by all targets of one action. Keep a bounded cache.
      if (this.seen.has(key)) return null;
      this.seen.set(key, at);
      if (this.seen.size > 512) this.seen.delete(this.seen.keys().next().value);
      this.abilities++;
      return {type: 'ability', id, name: line[5], at, sequence: seq || ''};
    }
  }
  return {Parser, actorId, parseTs};
});
