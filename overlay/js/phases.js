(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./registry.js'):root.Axis);if(typeof module==='object'&&module.exports)module.exports=api;else Object.assign(root.Axis,api);})(typeof globalThis!=='undefined'?globalThis:this,function(A){
  'use strict';
  const UMBRAL_SOUL=16506;
  const isPreparation=(axis,id)=>axis.job==='BLM'&&id===UMBRAL_SOUL;
  function phaseList(axis){return axis.phases||[{name:'完整技能轴',start:0}];}
  function phaseLabel(axis,p){return phaseList(axis)[p].label||'P'+(p+1);}
  function phaseAt(axis,index){let phase=0;phaseList(axis).forEach((p,i)=>{if(index>=p.start)phase=i;});return phase;}
  function phaseEnd(axis,p){const list=phaseList(axis);return p+1<list.length?list[p+1].start:axis.gcds.length;}
  function outputEnd(axis,p){for(let i=phaseEnd(axis,p)-1;i>=phaseList(axis)[p].start;i--)if(!isPreparation(axis,axis.gcds[i].id))return i;return phaseList(axis)[p].start;}
  function suggestPhases(axis,thresholdMs=12000){
    if(!Number.isFinite(thresholdMs)||thresholdMs<5000||thresholdMs>300000)throw Error('停手识别间隔应为 5～300 秒');
    const out=[{name:'开场',start:0}];let last=null,wait=0;
    axis.gcds.forEach((g,i)=>{
      wait+=g.breakBeforeMs||0;
      if(isPreparation(axis,g.id))return;
      const gap=last&&Number.isFinite(g.atMs)&&Number.isFinite(last.atMs)?g.atMs-last.atMs:0;
      if(last&&(gap>=thresholdMs||wait>=thresholdMs)&&out.length<200)out.push({name:'阶段 '+(out.length+1),start:i});
      last=g;wait=0;
    });return out;
  }
  function splitPhase(axis,at){
    const list=phaseList(axis).map(p=>({...p}));if(!Number.isInteger(at)||at<=0||at>=axis.gcds.length||list.some(p=>p.start===at))throw Error('请选择尚未作为起点的 GCD');
    if(isPreparation(axis,axis.gcds[at].id))throw Error('灵极魂属于转场准备，请选择下一段的输出 GCD 作为起点');
    list.push({name:'新增阶段',start:at});list.sort((a,b)=>a.start-b.start);return A.normalizePhases(list,axis.gcds.length);
  }
  function movePhase(axis,p,at){
    const list=phaseList(axis).map(v=>({...v}));if(!Number.isInteger(p)||p<=0||p>=list.length)throw Error('第一 P 固定从轴起点开始');
    if(!Number.isInteger(at)||at<=list[p-1].start||at>=phaseEnd(axis,p))throw Error('起点不能跨过相邻阶段或让阶段为空');
    if(isPreparation(axis,axis.gcds[at].id))throw Error('请选择输出 GCD，而非灵极魂，作为阶段起点');
    list[p].start=at;return A.normalizePhases(list,axis.gcds.length);
  }
  function mergePhase(axis,p){const list=phaseList(axis).map(v=>({...v}));if(list.length<2)throw Error('仅剩一个阶段，无法合并');if(!Number.isInteger(p)||p<0||p>=list.length)throw Error('阶段不存在');list.splice(p===0?1:p,1);return list;}
  return {UMBRAL_SOUL,isPreparation,phaseList,phaseLabel,phaseAt,phaseEnd,outputEnd,suggestPhases,splitPhase,movePhase,mergePhase};
});
