(function () {
  'use strict';
  const A=window.Axis,$=id=>document.getElementById(id),q=new URLSearchParams(location.search),local=window.AXIS_LOCAL_CONFIG||{};
  const store={read(k,f){try{const v=localStorage.getItem('ffxiv-axis:'+k);return v===null?f:JSON.parse(v);}catch(_){return f;}},write(k,v){localStorage.setItem('ffxiv-axis:'+k,JSON.stringify(v));}};
  const status=(s,error=false)=>{$('status').textContent=s;$('status').classList.toggle('error',error);};
  window.addEventListener('error',e=>status('页面错误：'+e.message,true));
  window.addEventListener('unhandledrejection',e=>status('接口错误：'+(e.reason&&e.reason.message||e.reason),true));
  let custom=store.read('library',local.library||[]);if(!Array.isArray(custom))custom=[];
  custom=custom.flatMap(v=>{try{return[A.normalizeTimeline(v)];}catch(_){return[];}});
  const builtins=window.BUILTIN_AXES.map(A.normalizeTimeline),axes=()=>[...builtins,...custom];
  let job=q.get('job')||store.read('job',local.job||'BLM');if(!A.JOB_CODES.includes(job))job='BLM';
  let engine=null,parser=new A.Parser(q.get('me')||''),mode='waiting',demoTimer=null,demoQueue=[],demoCursor=-1,demoLastGcdAt=0,seq=0,running=true,connected=false,lastLine='',previewResult=null,inCombat=false;
  const renderer=new A.Renderer();let jobPicker=null,axisPicker=null,focusUI=null,sourceAxis=null;
  let displayPrefs=store.read('display',local.display||{});if(!displayPrefs||typeof displayPrefs!=='object'||Array.isArray(displayPrefs))displayPrefs={};
  let selected=store.read('selected',local.selected||{});if(!selected||typeof selected!=='object'||Array.isArray(selected))selected={};
  const baseGcd=()=>{const v=Number($('gcd').value);return v>=1&&v<=4?v*1000:2500;};
  function displayFor(axis){
    const allowed=[...new Set(A.flattenTimeline(axis).filter(v=>typeof v.id==='number').map(v=>v.id))],pref=displayPrefs[axis.id]||axis.display;
    if(!pref)return{mode:'all',skills:allowed};const skills=Array.isArray(pref.skills)?pref.skills.filter(id=>allowed.includes(id)):allowed;
    return{mode:pref.mode==='focus'&&skills.length?'focus':'all',skills};
  }
  function newEngine(axis){sourceAxis=A.normalizeTimeline(axis);const pref=displayFor(sourceAxis),view=pref.mode==='focus'?A.focusTimeline(sourceAxis,pref.skills):sourceAxis;engine=new A.Engine(view,window.ACTIONS,{gcdMs:baseGcd()});renderer.key='';window.axisDebug.engine=engine;window.axisDebug.sourceAxis=sourceAxis;demoQueue=[];demoCursor=-1;demoLastGcdAt=0;}
  function savePreference(){try{store.write('selected',selected);store.write('job',job);}catch(_){status('无法保存偏好：浏览器存储不可用',true);}}
  function refreshSelectors(){
    $('job-select').value=job;$('axis-select').replaceChildren();
    axes().filter(v=>v.job===job).forEach(v=>{const o=document.createElement('option');o.value=v.id;o.textContent=v.name;$('axis-select').append(o);});
    if(engine)$('axis-select').value=engine.axis.id;
    $('axis-select').disabled=$('axis-select').options.length===0;
    if(jobPicker)jobPicker.refresh();if(axisPicker)axisPicker.refresh();
    if(focusUI)focusUI.refresh(sourceAxis,sourceAxis?displayFor(sourceAxis):null);
    $('delete-axis').disabled=!engine||!custom.some(v=>v.id===engine.axis.id);
    const multi=axes().filter(v=>v.job===job).length>1;$('prev').disabled=$('next').disabled=!multi;
  }
  function selectJob(code,forcedId){
    job=code;const list=axes().filter(v=>v.job===job),axis=list.find(v=>v.id===forcedId)||list.find(v=>v.id===selected[job])||list[0];
    if(axis){document.body.classList.remove('axis-empty');newEngine(axis);selected[job]=axis.id;status(mode==='demo'?'模拟演示 · 示例轴仅演示格式':'等待自己的技能日志');}
    else{engine=null;sourceAxis=null;window.axisDebug.engine=null;window.axisDebug.sourceAxis=null;renderer.clear();document.body.classList.add('axis-empty');$('axis-name').textContent=job+' · 尚未导入轴';$('timer').textContent='尚未导入';$('cast').textContent='';$('lane-overflow').textContent='';$('lane-complete').hidden=true;$('progress').textContent='—';status('该职业还没有技能轴，请按 I 导入');}
    refreshSelectors();savePreference();
  }
  function selectAxis(id){const axis=axes().find(v=>v.id===id);if(axis)selectJob(axis.job,id);}
  function cycle(dir){const list=axes().filter(v=>v.job===job);if(list.length)selectAxis(list[(list.findIndex(v=>engine&&v.id===engine.axis.id)+dir+list.length)%list.length].id);}
  function detectJob(id){
    const base={1:19,2:20,3:21,4:22,5:23,6:24,7:25,26:27,29:30};const found=window.JOBS.find(v=>v.id===(base[id]||id));
    if(found&&found.code!==job&&!q.has('timeline')&&!q.has('job')&&!inCombat)selectJob(found.code);
  }
  function enterAct(){
    if(mode==='act')return;mode='act';clearInterval(demoTimer);demoTimer=null;parser=new A.Parser(q.get('me')||'');window.axisDebug.parser=parser;
    if(engine)engine.reset();demoQueue=[];$('demo-controls').hidden=true;$('mode').textContent='ACT';status('ACT 接口就绪 · 等待日志与角色信息');
  }
  function requestPlayerJob(){
    if(!parser.me||typeof window.callOverlayHandler!=='function')return;
    window.callOverlayHandler({call:'getCombatants',ids:[parseInt(parser.me,16)]}).then(r=>{const p=r&&r.combatants&&r.combatants[0];if(p&&p.Job)detectJob(Number(p.Job));}).catch(()=>{});
  }
  function feed(raw,real=true){
    if(real)enterAct();lastLine=Array.isArray(raw.line)?raw.line.slice(0,6).join('|'):String(raw.rawLine||'').slice(0,160);
    if(real&&!connected){connected=true;$('signal').classList.add('live');}
    const e=parser.feed(raw);if(!e)return;
    if(e.type==='player'){status('已识别角色：'+(e.name||e.id));requestPlayerJob();return;}
    if(e.type==='job'){detectJob(e.jobId);return;}
    if(e.type==='zone'){inCombat=false;if(engine)engine.reset();status('已换图 · 等待起手');return;}
    if(e.type==='combat'){if(e.changed&&inCombat&&!e.active&&engine){if(engine.axis.mode==='focus')status('暂时脱战 · 保留选定技能进度');else{engine.reset();status('已脱战 · 进度已重置');}}if(e.changed&&e.active&&engine)engine.startClock(Number.isFinite(e.at)?e.at:Date.now());if(e.changed)inCombat=e.active;return;}
    if(!engine)return;
    if(e.type==='death'){engine.reset();status('角色死亡 · 进度已重置');}
    if(e.type==='cast')engine.cast=engine.axis.mode!=='focus'||engine.axis.gcds.some(v=>v.id===e.id)?e:null;
    if(e.type==='cancel')engine.cast=null;
    if(e.type==='ability'){const result=engine.ability(e.id,e.at);if(real)status(result==='miss'?'未匹配技能：'+((window.ACTIONS[e.id]||{}).name||e.id)+' · 进度保持':result==='out-of-order'?'等待当前提示技能，进度保持':'');}
  }
  function makeLine(id){const l=Array(54).fill('');l[0]='21';l[1]=new Date().toISOString();l[2]='10FF0001';l[3]='演示角色';l[4]=id.toString(16).toUpperCase();l[5]=(window.ACTIONS[id]||{}).name||'';l[44]=(++seq).toString(16);return{line:l};}
  function demoStep(){
    if(!engine)return;
    if(!demoQueue.length){
      let next=A.stepIndex(engine.axis,demoCursor);if(next===null){engine.reset();parser.seen.clear();demoCursor=-1;next=0;}
      if(demoCursor<0)engine.axis.pre.forEach(v=>demoQueue.push({id:v.id,gcd:false}));demoCursor=next;
      const g=engine.axis.gcds[next];demoQueue.push({id:g.id,gcd:true});
      if(!q.has('noweave'))g.weaves.forEach(v=>demoQueue.push({id:v.id,gcd:false}));
    }
    const item=demoQueue.shift();
    if(item.gcd)demoLastGcdAt=Date.now();
    if(item.gcd&&Number(q.get('skip'))===demoCursor&&q.has('skip')&&!window.axisDebug.didSkip){window.axisDebug.didSkip=true;return item;}
    feed(makeLine(item.id),false);return item;
  }
  let nextDemo=0;
  function startDemo(){
    if(mode==='act')return;mode='demo';parser.setPlayer('10FF0001');$('mode').textContent='模拟演示';$('demo-controls').hidden=false;status('模拟演示 · 示例轴仅演示格式');nextDemo=Date.now()+800;
    demoTimer=setInterval(()=>{if(!running||mode!=='demo'||!engine)return;if(Date.now()>=nextDemo){demoStep();const next=demoQueue[0];nextDemo=next&&!next.gcd?Date.now()+700:Math.max(Date.now()+500,demoLastGcdAt+baseGcd());}},100);
  }
  function setPanelFocus(accept){
    const api=window.OverlayPluginApi;
    if(!api||typeof api.setAcceptFocus!=='function')return;
    try{const result=api.setAcceptFocus(accept);if(result&&typeof result.catch==='function')result.catch(()=>{if(accept)status('浮窗暂未接受键盘焦点，请重新打开导入面板',true);});}
    catch(_){if(accept)status('无法开启输入焦点，请重新打开导入面板',true);}
  }
  function openPanel(){setPanelFocus(true);refreshSelectors();if(!$('panel').open){if($('panel').showModal)$('panel').showModal();else $('panel').setAttribute('open','');}}
  function closePanel(){if($('panel').close)$('panel').close();else $('panel').removeAttribute('open');}
  function invalidate(){previewResult=null;$('save-import').disabled=true;$('partial-confirm').hidden=true;$('accept-partial').checked=false;}
  function preview(){
    invalidate();try{
      const text=$('import-text').value;let parsed;try{parsed=JSON.parse(text.replace(/^\uFEFF/,''));}catch(_){}
      const fallbackJob=parsed&&parsed.config&&parsed.config.job?'':job;
      const encounterName=$('import-encounter').value.trim(),encounter=encounterName?{...(parsed&&parsed.encounter||{}),name:encounterName,source:parsed&&parsed.encounter&&parsed.encounter.source||'manual'}:parsed&&parsed.encounter;
      previewResult=A.importTimeline(text,window.ACTIONS,{job:fallbackJob,name:$('import-name').value.trim(),encounter});const{axis,warnings,unknown}=previewResult;
      $('import-result').textContent=`${axis.job} · ${axis.gcds.length} 个 GCD · ${axis.pre.length+axis.gcds.reduce((n,g)=>n+g.weaves.length,0)} 个能力技\n${axis.name}`+(warnings.length?'\n\n'+warnings.join('\n'):'')+(unknown.length?'\n未识别：'+[...new Set(unknown)].join('、'):'');
      $('partial-confirm').hidden=!unknown.length;$('save-import').disabled=unknown.length>0;
      if(axis.encounter)$('import-result').textContent+='\n副本／首领：'+[axis.encounter.zoneName,axis.encounter.name].filter(Boolean).join(' · ');
    }catch(e){$('import-result').textContent=e.message;}
  }
  function saveImport(){
    if(!previewResult||previewResult.unknown.length&&!$('accept-partial').checked)return;const axis=previewResult.axis;
    if(builtins.some(v=>v.id===axis.id))axis.id='user-'+Date.now().toString(36);
    const next=[...custom.filter(v=>v.id!==axis.id),axis];
    try{store.write('library',next);}catch(_){$('import-result').textContent='存储失败，未保存。请导出 JSON 备份后重试。';return;}
    custom=next;selectAxis(axis.id);closePanel();status('已导入：'+axis.name);return true;
  }
  function downloadAxis(){if(!sourceAxis)return;const backup={...sourceAxis,display:displayFor(sourceAxis)},url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=sourceAxis.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function downloadSettings(){const data={version:4,fflogs:A.fflogsClient?A.fflogsClient.config:local.fflogs||{},library:custom,selected,job,display:displayPrefs,scale:Number($('scale').value),gcd:baseGcd()/1000};const url=URL.createObjectURL(new Blob(['window.AXIS_LOCAL_CONFIG = '+JSON.stringify(data,null,2)+';\n'],{type:'application/javascript'})),a=document.createElement('a');a.href=url;a.download='local-settings.js';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function reset(){if(engine)engine.reset();demoQueue=[];demoCursor=-1;demoLastGcdAt=0;window.axisDebug.didSkip=false;status('进度已重置');}
  function readFile(file){if(!file)return;if(file.size>10000000){$('import-result').textContent='文件不能超过 10 MB';return;}const reader=new FileReader();reader.onload=()=>{$('import-name').value='';$('import-encounter').value='';$('import-text').value=String(reader.result);preview();};reader.onerror=()=>{$('import-result').textContent='读取文件失败';};reader.readAsText(file,'utf-8');}
  window.axisDebug={feed,parser,get mode(){return mode;},get job(){return job;},engine,demoStep};
  window.JOBS.forEach(v=>{const o=document.createElement('option');o.value=v.code;o.textContent=v.name+' '+v.code;$('job-select').append(o);});
  jobPicker=new A.Picker($('job-select'),'选择职业');axisPicker=new A.Picker($('axis-select'),'该职业尚未导入技能轴');
  focusUI=new A.FocusUI(pref=>{if(!sourceAxis)throw Error('请先导入或选择一条技能轴');if(pref.mode==='focus')A.focusTimeline(sourceAxis,pref.skills);const next={...displayPrefs,[sourceAxis.id]:pref};store.write('display',next);displayPrefs=next;newEngine(sourceAxis);refreshSelectors();status(pref.mode==='focus'?'已切换到指定技能模式':'已恢复完整技能轴');});
  const scale=Number(q.get('scale')||store.read('scale',local.scale||1));$('scale').value=Number.isFinite(scale)?Math.max(.7,Math.min(1.8,scale)):1;document.documentElement.style.setProperty('--scale',$('scale').value);
  const gcd=Number(q.get('gcd')||store.read('gcd',local.gcd||2.5));$('gcd').value=gcd>=1&&gcd<=4?gcd:2.5;
  if(q.has('notrans'))document.body.classList.add('no-transition');if(q.get('skin')!=='extended')document.body.classList.add('compact');
  const pinned=axes().find(v=>v.id===q.get('timeline'));selectJob(pinned?pinned.job:job,pinned&&pinned.id);
  $('prev').onclick=()=>cycle(-1);$('next').onclick=()=>cycle(1);$('settings').onclick=$('import-open').onclick=openPanel;$('close-panel').onclick=closePanel;
  $('panel').addEventListener('close',()=>setPanelFocus(false));
  $('panel').addEventListener('mousedown',()=>setPanelFocus(true),true);
  window.addEventListener('pagehide',()=>setPanelFocus(false));
  $('job-select').onchange=()=>{invalidate();selectJob($('job-select').value);};$('axis-select').onchange=()=>selectAxis($('axis-select').value);
  $('panel-reset').onclick=$('reset').onclick=reset;$('export-axis').onclick=downloadAxis;$('export-settings').onclick=downloadSettings;
  $('timer').onclick=()=>{if(engine&&engine.axis.mode==='focus')engine.startClock();};
  document.addEventListener('onOverlayStateUpdate',e=>{const locked=e.detail&&e.detail.isLocked===true;document.body.classList.toggle('overlay-locked',locked);$('drag-state').textContent=locked?'位置已锁定 · 移动时先在 ACT 取消锁定和点击穿透':'可拖住主卡片移动 · 编辑时锁定位置';});
  $('delete-axis').onclick=()=>{if(!engine)return;const next=custom.filter(v=>v.id!==engine.axis.id);try{store.write('library',next);}catch(_){status('删除失败：无法写入存储',true);return;}custom=next;selectJob(job);};
  $('import-text').oninput=invalidate;$('preview').onclick=preview;$('save-import').onclick=saveImport;
  $('import-name').oninput=$('import-encounter').oninput=invalidate;
  $('accept-partial').onchange=()=>{$('save-import').disabled=!previewResult||previewResult.unknown.length>0&&!$('accept-partial').checked;};
  $('sample').onclick=()=>{$('import-name').value='';$('import-encounter').value='';$('import-text').value=JSON.stringify({name:'战士 · 导入演示',fileType:'Record',config:{job:'WAR'},actions:['Heavy Swing','Maim','Infuriate',"Storm's Eye",'Upheaval'].map(skillName=>({type:'Skill',skillName}))},null,2);preview();};
  $('file').onchange=()=>readFile($('file').files[0]);$('drop-zone').ondragover=e=>{e.preventDefault();$('drop-zone').classList.add('drag');};$('drop-zone').ondragleave=()=>$('drop-zone').classList.remove('drag');$('drop-zone').ondrop=e=>{e.preventDefault();$('drop-zone').classList.remove('drag');readFile(e.dataTransfer.files[0]);};
  $('scale').oninput=()=>{document.documentElement.style.setProperty('--scale',$('scale').value);try{store.write('scale',Number($('scale').value));}catch(_){}};
  $('gcd').onchange=()=>{if(engine){engine.baseGcd=baseGcd();engine.gcdMs=baseGcd();}try{store.write('gcd',baseGcd()/1000);}catch(_){}};
  $('demo-toggle').onclick=()=>{running=!running;$('demo-toggle').textContent=running?'暂停演示':'继续演示';};$('demo-step').onclick=()=>{running=false;$('demo-toggle').textContent='继续演示';demoStep();};
  document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const k=e.key.toLowerCase();if(k==='i'){e.preventDefault();$('panel').open?closePanel():openPanel();}if(!$('panel').open){if(k==='r')reset();if(k==='t'&&engine&&engine.axis.mode==='focus')engine.startClock();if(k==='[')cycle(-1);if(k===']')cycle(1);}});
  if(typeof window.addOverlayListener==='function'){
    addOverlayListener('LogLine',e=>feed(e));
    addOverlayListener('ChangePrimaryPlayer',e=>{enterAct();parser.setPlayer(e.charID,typeof e.charID==='string'&&/^\d{9,}$/.test(e.charID));status('已识别角色：'+(e.charName||parser.me));requestPlayerJob();});
    addOverlayListener('ChangeZone',()=>{enterAct();inCombat=false;if(engine)engine.reset();});
    addOverlayListener('PartyChanged',e=>{const self=e.party&&e.party.find(p=>A.actorId(p.id)===parser.me);if(self)detectJob(typeof self.job==='number'?self.job:parseInt(self.job,16));});startOverlayEvents();
  }
  if(q.get('mode')==='act'||q.has('OVERLAY_WS')){mode='act';$('mode').textContent='ACT';status(q.has('OVERLAY_WS')?'等待 OverlayPlugin WebSocket 数据…':'等待 OverlayPlugin 接口…');}
  else setTimeout(()=>{if(window.OverlayPluginApi&&window.OverlayPluginApi.ready)enterAct();else if(mode!=='act')startDemo();},1500);
  setInterval(()=>{if(mode!=='act'&&window.OverlayPluginApi&&window.OverlayPluginApi.ready)enterAct();if(mode==='act'&&!parser.me&&parser.lines>0)status('日志已到达，尚未取得角色 ID；可重载浮窗或用 ?me=角色ID 指定',true);},1500);
  $('diagnostics').hidden=!q.has('diag');let lastDiag=0;
  function frame(){if(engine)renderer.paint(engine);const now=Date.now();if(q.has('diag')&&now-lastDiag>500){lastDiag=now;$('diagnostics').textContent=`日志 ${parser.lines} · 自己技能 ${parser.abilities} · 过滤 ${parser.filtered}\n我=${parser.me||'未知'} · 职业=${job} · 模式=${mode}\n${lastLine}\n数据 ${window.DATA_META.count} 条 · ${window.DATA_META.generatedAt.slice(0,10)}`;}requestAnimationFrame(frame);}requestAnimationFrame(frame);
  new A.FFLogsUI(record=>{
    $('import-name').value=record.name||'';$('import-encounter').value=record.encounter&&record.encounter.name||'';$('import-text').value=JSON.stringify(record,null,2);preview();
    if(!previewResult)throw Error('无法将报告转换为技能轴，请查看导入预览');
    if(!previewResult.unknown.length)return{saved:saveImport()===true};
    $('import-result').scrollIntoView({block:'nearest'});return{saved:false};
  });
  if(q.has('report'))$('fflogs-url').value=q.get('report');if(q.has('import'))openPanel();if(q.has('autodemo'))$('sample').click();if(q.has('fflogs')){$('fflogs-section').open=true;}
})();

