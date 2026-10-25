(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./registry.js') : root.Axis);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.Axis = root.Axis || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (A) {
  'use strict';
  const key = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s_’'\-:]/g, '');
  function importTimeline(text, actions, options = {}) {
    if (text.length > 10000000) throw Error('文件过大，请控制在 10 MB 以内');
    let data; try { data = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (_) { throw Error('文件不是有效 JSON；请导出「用于分享和导入」的战斗文件'); }
    if (data.gcds) {
      const axis=A.normalizeTimeline({...data,name:options.name||data.name,encounter:options.encounter||data.encounter});
      const unknown=[...new Set([...axis.pre,...axis.gcds.flatMap(g=>[g,...g.weaves])].filter(v=>!actions[v.id]).map(v=>'ID '+v.id))];
      return {axis,warnings:unknown.length?['轴中存在当前目录没有的技能，请核对后再使用。']:[],unknown};
    }
    if (!Array.isArray(data.actions) || data.actions.length > 50000) throw Error('找不到战斗 actions，或条目数量过大');
    const job = String(options.job || data.config && data.config.job || '').toUpperCase();
    if (!A.JOB_CODES.includes(job)) throw Error('导出文件缺少职业，请在导入面板选择职业');
    const names = new Map();
    Object.values(actions).forEach(a => [a.name, a.en, a.key, ...(a.aliases || [])].filter(Boolean).forEach(s => {
      const k = key(s); if (!names.has(k)) names.set(k, []); if (!names.get(k).includes(a)) names.get(k).push(a);
    }));
    const gcds = [], pre = [], warnings = [], unknown = [];
    let ignored = 0, virtual=0;
    for (const entry of data.actions) {
      if (entry.type !== 'Skill') { ignored++; continue; }
      const candidates = Number.isInteger(entry.skillId) ? [actions[entry.skillId]].filter(Boolean) : names.get(key(entry.skillName)) || [];
      const matching = candidates.filter(a => (a.jobs || []).includes(job));
      const shared = candidates.filter(a => a.job === 'ALL');
      const pool = matching.length ? matching : shared;
      const ids = [...new Set(pool.map(a => a.id))];
      if (ids.length !== 1) { unknown.push(String(entry.skillName || entry.skillId || '空技能名')); continue; }
      const a = actions[ids[0]];
      const time=entry.atMs===undefined?{}:{atMs:entry.atMs};
      if (a.gcd) gcds.push({id: a.id, ...time,weaves: []}); else (gcds.length ? gcds[gcds.length - 1].weaves : pre).push({id: a.id,...time,optional:a.optional===true});
      if(a.virtual)virtual++;
    }
    if (unknown.length) warnings.push(`${unknown.length} 个技能无法唯一识别，尚未导入。请核对后再使用。`);
    if (ignored) warnings.push(`忽略了 ${ignored} 个等待、时间跳转或资源设置；此轴仅追踪技能顺序。`);
    if(virtual)warnings.push(`保留 ${virtual} 次爆发药可选提示；暂不自动确认服药，不计漏插。`);
    gcds.forEach((g, i) => { if (g.weaves.length > 2) warnings.push(`第 ${i + 1} 个 GCD 后有 ${g.weaves.length} 个能力技，全部按原顺序保留。`); });
    if (!gcds.length) throw Error('未识别出 GCD。请检查职业或技能数据；没有保存任何内容。');
    const name=options.name||(data.name&&data.name!=='(anonymous line)'?data.name:`${job} · 排轴器导入`);
    const axis = A.normalizeTimeline({id: 'user-' + Date.now().toString(36), job, name, loop: false, pre, gcds,encounter:options.encounter||data.encounter,durationMs:data.durationMs});
    return {axis, warnings, unknown};
  }
  return {importTimeline};
});
