(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./registry.js'):root.Axis);if(typeof module==='object'&&module.exports)module.exports=api;else Object.assign(root.Axis,api);})(typeof globalThis!=='undefined'?globalThis:this,function(A){
  'use strict';
  function cleanAxisName(axis){
    const e=axis.encounter||{},name=String(axis.name||''),boss=String(e.name||'');if(e.source!=='fflogs'||!boss)return name;
    const plain=boss+' · '+axis.job,old=plain+' · '+String(e.playerName||'');
    if(name!==plain&&(!e.playerName||name!==old))return name;
    return (/^Futures Rewritten(?:\s*\(Ultimate\))?$/i.test(boss)?'绝伊甸':boss)+' · '+axis.job;
  }
  function shareTimeline(input,display){
    const axis=A.normalizeTimeline(input);axis.name=cleanAxisName(axis);if(display)axis.display=A.normalizeTimeline({...axis,display}).display;
    if(axis.encounter){const e=axis.encounter;axis.encounter={};['name','zoneName','source','id','zoneId'].forEach(k=>{if(e[k]!==undefined)axis.encounter[k]=e[k];});}
    return axis;
  }
  function shareFilename(axis){const name=String(axis.name||'技能轴').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/,'').slice(0,90)||'技能轴';return name+(name.includes(axis.job)?'':'-'+axis.job)+'-技能轴.json';}
  return{cleanAxisName,shareTimeline,shareFilename};
});
