(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.Axis = root.Axis || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const JOB_CODES = 'PLD WAR DRK GNB WHM SCH AST SGE MNK DRG NIN SAM RPR VPR BRD MCH DNC BLM SMN RDM PCT BLU'.split(' ');
  function action(value) {
    const v = typeof value === 'number' || value==='TINCTURE' ? {id: value} : value;
    const item=v&&v.id==='TINCTURE';
    if (!v || !item&&(!Number.isSafeInteger(v.id) || v.id < 1 || v.id > 1000000)) throw Error('技能 ID 必须是正整数；爆发药使用 TINCTURE 提示键');
    const result={id: v.id, optional: item || v.optional === true, note: String(v.note || (item?'爆发药可选提示，不自动确认服药':'')).slice(0, 200)};
    if(v.atMs!==undefined){if(!Number.isFinite(v.atMs)||Math.abs(v.atMs)>86400000)throw Error('技能时间点无效');result.atMs=v.atMs;}return result;
  }
  function normalizeTimeline(input) {
    if (!input || typeof input !== 'object') throw Error('轴必须是 JSON 对象');
    const job = String(input.job || '').toUpperCase();
    if (!JOB_CODES.includes(job)) throw Error('请指定有效职业，例如 WAR、BLM、PCT');
    const focused=input.mode==='focus',sequence=focused?input.steps:input.gcds;
    if (!Array.isArray(sequence) || !sequence.length || sequence.length > 10000) throw Error('轴需要 1～10000 个技能步骤');
    const gcds = sequence.map(v => ({...action(v), weaves: focused||typeof v === 'number' ? [] : (v.weaves || []).map(action)}));
    if(gcds.some(v=>v.id==='TINCTURE'))throw Error('爆发药应放入 pre 或 weaves，不能作为独立追踪步骤');
    if (gcds.some(v => v.weaves.length > 100)) throw Error('单个 GCD 的能力技数量异常');
    const loopFrom = input.loopFrom === undefined ? 0 : input.loopFrom;
    if (!Number.isInteger(loopFrom) || loopFrom < 0 || loopFrom >= gcds.length) throw Error('循环起点超出轴的范围');
    const id = String(input.id || ('user-' + Date.now())).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100);
    const result={id, job, name: String(input.name || '未命名技能轴').slice(0, 100), loop: input.loop === true, loopFrom,
      pre: (input.pre || []).map(action), gcds};
    if(input.encounter&&typeof input.encounter==='object'){
      const e=input.encounter;result.encounter={};
      ['name','zoneName','playerName','reportCode','source'].forEach(k=>{if(e[k])result.encounter[k]=String(e[k]).slice(0,200);});
      ['id','zoneId','fightId','playerId'].forEach(k=>{if(Number.isSafeInteger(e[k])&&e[k]>0)result.encounter[k]=e[k];});
    }
    if(focused){result.mode='focus';result.steps=gcds.map(v=>action(v));}
    if(Number.isFinite(input.durationMs)&&input.durationMs>0&&input.durationMs<=86400000)result.durationMs=input.durationMs;
    if(input.display&&typeof input.display==='object')result.display={mode:input.display.mode==='focus'?'focus':'all',skills:Array.isArray(input.display.skills)?[...new Set(input.display.skills.filter(v=>Number.isSafeInteger(v)&&v>0&&v<=1000000))]:[]};
    return result;
  }
  function flattenTimeline(input){
    const axis=normalizeTimeline(input),out=axis.pre.map(v=>({...v,gcdIndex:-1}));
    axis.gcds.forEach((g,i)=>{out.push({...action(g),gcdIndex:i});g.weaves.forEach(v=>out.push({...v,gcdIndex:i}));});return out;
  }
  function focusTimeline(input,ids){
    const axis=normalizeTimeline(input),selected=new Set(ids),steps=flattenTimeline(axis).filter(v=>typeof v.id==='number'&&selected.has(v.id));
    if(!steps.length)throw Error('请至少勾选一个这条轴中实际存在的技能');
    const loopFrom=steps.findIndex(v=>v.gcdIndex>=axis.loopFrom);
    return normalizeTimeline({id:axis.id,job:axis.job,name:axis.name+' · 指定技能',mode:'focus',steps,pre:[],loop:axis.loop&&loopFrom>=0,loopFrom:Math.max(0,loopFrom),encounter:axis.encounter,durationMs:axis.durationMs});
  }
  function stepIndex(axis, index, steps = 1) {
    let next = index;
    for (let n = 0; n < steps; n++) {
      next++;
      if (next >= axis.gcds.length) { if (!axis.loop) return null; next = axis.loopFrom; }
    }
    return next;
  }
  return {JOB_CODES, normalizeTimeline, stepIndex,flattenTimeline,focusTimeline};
});
