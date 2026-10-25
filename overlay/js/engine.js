(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./registry.js') : root.Axis);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.Axis = root.Axis || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (A) {
  'use strict';
  class Engine {
    constructor(axis, actions = {}, options = {}) {
      this.axis = A.normalizeTimeline(axis); this.actions = actions;
      this.baseGcd = options.gcdMs || 2500; this.clock = options.clock || Date.now;
      this.reset();
    }
    reset() {
      this.index = -1; this.done = new Set(); this.preDone = new Set(); this.carry = [];
      this.cursor=-1;this.epoch=(this.epoch||0)+1;this.combatStartAt=null;
      this.history = []; this.drift = 0; this.miss = 0; this.missedWeaves = 0;
      this.lastAt = null; this.intervals = []; this.gcdMs = this.baseGcd; this.cast = null;
      this.message = '等待起手'; this.revision = (this.revision || 0) + 1;
    }
    expire(now) {
      const expired = this.carry.filter(v => v.until <= now);
      if (expired.length) { this.missedWeaves += expired.length; this.carry = this.carry.filter(v => v.until > now); this.revision++; }
    }
    pending() { return this.index < 0 ? this.axis.pre.filter((_, n) => !this.preDone.has(n)) : this.axis.gcds[this.index].weaves.filter((_, n) => !this.done.has(n)); }
    pendingDetails(){const list=this.index<0?this.axis.pre:this.axis.gcds[this.index].weaves,done=this.index<0?this.preDone:this.done;return list.map((v,slot)=>({...v,slot,owner:this.cursor})).filter((_,slot)=>!done.has(slot));}
    startClock(at=this.clock()){if(this.combatStartAt===null&&Number.isFinite(at)){this.combatStartAt=at;this.revision++;}}
    ability(id, at = this.clock()) {
      this.expire(at); this.cast = null;
      if(this.axis.mode==='focus'&&!this.axis.gcds.some(v=>v.id===id))return 'ignored';
      const expected = A.stepIndex(this.axis, this.index);
      if(this.axis.mode==='focus'&&(expected===null||this.axis.gcds[expected].id!==id))return 'out-of-order';
      const belongsToGcd = this.axis.gcds.some(v => v.id === id);
      if (!belongsToGcd) {
        const list = this.index < 0 ? this.axis.pre : this.axis.gcds[this.index].weaves;
        const completed = this.index < 0 ? this.preDone : this.done;
        const match = list.findIndex((v, n) => v.id === id && !completed.has(n));
        if (match >= 0) { completed.add(match); this.message = '已插入'; this.revision++; return 'weave'; }
        const stale = this.carry.findIndex(v => v.id === id);
        if (stale >= 0) { this.carry.splice(stale, 1); this.message = '已补插'; this.revision++; return 'carry'; }
        if (this.actions[id] && this.actions[id].gcd) { this.miss++; this.message = '未匹配，保留当前位置'; this.revision++; return 'miss'; }
        return 'ignored';
      }
      let found = null, skipped = 0;
      for (let n = 1; n <= (this.axis.mode==='focus'?1:6); n++) {
        const idx = A.stepIndex(this.axis, this.index, n);
        if (idx === null) break;
        if (this.axis.gcds[idx].id === id) { found = idx; skipped = n - 1; break; }
      }
      if (this.axis.mode!=='focus'&&found === null && id === this.axis.gcds[0].id && this.index > 2) { this.reset(); found = 0; }
      if (found === null) { this.miss++; this.message = expected === null ? '轴已完成' : '未匹配，保留当前位置'; this.revision++; return 'miss'; }
      if (this.index >= 0) {
        this.pendingDetails().filter(v => !v.optional).forEach(v => this.carry.push({...v, until: at + 1600}));
        this.history.push({...this.axis.gcds[this.index],uid:this.cursor}); if (this.history.length > 3) this.history.shift();
      }
      if (this.axis.mode!=='focus'&&this.lastAt !== null && !skipped) {
        const delta = at - this.lastAt;
        if (delta >= 1000 && delta <= 4000) {
          this.intervals.push(delta); if (this.intervals.length > 7) this.intervals.shift();
          const sorted = [...this.intervals].sort((a, b) => a - b); this.gcdMs = sorted[Math.floor(sorted.length / 2)];
        }
      }
      this.index = found;this.cursor+=skipped+1; this.done.clear(); this.lastAt = at;
      if (skipped) this.drift++;
      this.message = skipped ? `追回 ${skipped} 个 GCD` : '跟随中'; this.revision++;
      return skipped ? 'drift' : 'gcd';
    }
    snapshot(now = this.clock()) {
      this.expire(now);
      const next = A.stepIndex(this.axis, this.index);
      const future = [];
      for (let n = 1; n <= 4; n++) { const i = A.stepIndex(this.axis, this.index, n); if (i === null) break; future.push({index: i,uid:this.cursor+n, ...this.axis.gcds[i]}); }
      const left = this.lastAt === null ? 0 : Math.max(0, this.gcdMs - (now - this.lastAt));
      const step=next===null?null:this.axis.gcds[next],current=this.index<0?null:this.axis.gcds[this.index];let focusDueAt=null;
      const focusTimed=this.axis.mode==='focus'&&step&&Number.isFinite(step.atMs);
      if(focusTimed){
        if(current&&Number.isFinite(current.atMs)&&this.lastAt!==null){let gap=step.atMs-current.atMs;if(gap<0&&this.axis.loop&&this.axis.durationMs)gap+=this.axis.durationMs;if(gap>=0)focusDueAt=this.lastAt+gap;}
        else if(!current&&this.combatStartAt!==null)focusDueAt=this.combatStartAt+Math.max(0,step.atMs);
      }
      return {index: this.index,cursor:this.cursor,epoch:this.epoch, next, future, history: this.history, current,
        focusTimed:Boolean(focusTimed),focusDueAt,focusLeft:focusDueAt===null?null:Math.max(0,focusDueAt-now),
        pending: this.pendingDetails(), carry: this.carry, left, ratio: left / this.gcdMs, urgent: left > 0 && left < 600,
        drift: this.drift, miss: this.miss, missedWeaves: this.missedWeaves, message: this.message, cast: this.cast, revision: this.revision};
    }
  }
  return {Engine};
});
