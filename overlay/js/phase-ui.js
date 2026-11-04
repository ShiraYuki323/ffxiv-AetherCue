(function(){
  'use strict';const A=window.Axis,$=id=>document.getElementById(id),make=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
  const time=ms=>{if(!Number.isFinite(ms))return'无时间点';const sign=ms<0?'-':'';ms=Math.abs(ms);return sign+String(Math.floor(ms/60000)).padStart(2,'0')+':'+(ms%60000/1000).toFixed(1).padStart(4,'0');};
  class PhaseUI{
    constructor({getEngine,saveAxis,switchPhase}){
      Object.assign(this,{getEngine,saveAxis,switchPhase});this.axis=null;this.original=null;this.edit=0;this.selected=0;this.page=0;this.dirty=false;this.runtimeKey='';
      const run=fn=>()=>{try{if(this.axis)fn();}catch(e){$('phase-result').textContent=e.message;}};
      $('phase-suggest').onclick=run(()=>this.change(A.suggestPhases(this.axis,Number($('phase-gap').value)*1000),'已重新建议分段，请核对后保存。'));
      $('phase-earlier').onclick=run(()=>this.change(A.movePhase(this.axis,this.edit,this.axis.phases[this.edit].start-1)));
      $('phase-later').onclick=run(()=>this.change(A.movePhase(this.axis,this.edit,this.axis.phases[this.edit].start+1)));
      $('phase-set-start').onclick=run(()=>this.change(A.movePhase(this.axis,this.edit,this.selected)));
      $('phase-split').onclick=run(()=>{const phases=A.splitPhase(this.axis,this.selected);this.edit=phases.findIndex(p=>p.start===this.selected);this.change(phases,'已新增阶段，后续 P 编号已更新。');});
      $('phase-merge').onclick=run(()=>{const phases=A.mergePhase(this.axis,this.edit);this.edit=Math.max(0,this.edit-1);this.change(phases,'已合并阶段，GCD 和能力技均保留。');});
      const editText=e=>{if(!this.axis||e?.isComposing||e?.target?.dataset.composing==='true')return;this.axis.phases[this.edit].name=$('phase-name').value||'未命名阶段';const label=$('phase-label').value.trim();if(label)this.axis.phases[this.edit].label=label;else delete this.axis.phases[this.edit].label;this.dirty=true;$('phase-result').textContent='编号／段名已修改；同一个 P 可有多个片段，请保存。';$('phase-detail-title').textContent=A.phaseLabel(this.axis,this.edit)+' · '+this.axis.phases[this.edit].name;this.paintList();$('phase-go').disabled=true;};
      $('phase-name').oninput=editText;$('phase-label').oninput=editText;$('phase-name').addEventListener('compositionend',editText);$('phase-label').addEventListener('compositionend',editText);
      $('phase-save').onclick=run(()=>{this.axis.phaseConfirmed=true;this.axis=A.normalizeTimeline(this.axis);this.saveAxis(this.axis);this.dirty=false;this.paint();$('phase-result').textContent='分 P 已保存，当前轴进度已重置。';});
      $('phase-go').onclick=run(()=>{if(this.dirty)throw Error('请先保存分 P 设置');this.switchPhase(this.edit);});
      $('phase-page-prev').onclick=run(()=>{this.page--;this.paintSkills();});$('phase-page-next').onclick=run(()=>{this.page++;this.paintSkills();});
    }
    refresh(axis){
      if(axis===this.original)return;this.original=axis;this.axis=axis?A.normalizeTimeline(axis):null;this.dirty=false;this.runtimeKey='';
      if(this.axis){this.axis.phases=A.phaseList(this.axis).map(p=>({...p}));this.edit=0;this.selected=0;this.page=0;}
      this.paint();
    }
    change(phases,message='已调整阶段边界；GCD 及其能力技一起移动。'){
      this.axis.phases=A.normalizePhases(phases,this.axis.gcds.length);this.edit=Math.min(this.edit,phases.length-1);this.selected=this.axis.phases[this.edit].start;this.page=0;this.dirty=true;this.paint();$('phase-result').textContent=message;
    }
    paintList(){
      const list=$('phase-list');list.replaceChildren();if(!this.axis)return;const runtime=this.getEngine();
      this.axis.phases.forEach((p,i)=>{const end=A.phaseEnd(this.axis,i),rows=this.axis.gcds.slice(p.start,end),b=make('button','',`${A.phaseLabel(this.axis,i)} · ${p.name}`);b.type='button';b.setAttribute('aria-pressed',String(i===this.edit));b.append(make('small','',time(rows[0].atMs)+' — '+time(rows[rows.length-1].atMs)),make('small','',`${rows.length} GCD · ${rows.reduce((n,g)=>n+g.weaves.length,0)} 能力技`));if(runtime&&runtime.activePhase===i)b.append(make('small','phase-live','实战当前'));
        b.onclick=()=>{this.edit=i;this.selected=p.start;this.page=0;this.paint();};list.append(b);});
    }
    picture(action,sizeClass=''){
      const meta=window.ACTIONS[action.id]||{},wrap=make('span',sizeClass);if(meta.icon){const img=make('img');img.src='icons/'+meta.icon+'.png';img.alt=meta.name||String(action.id);img.onerror=()=>img.remove();wrap.append(img);}return wrap;
    }
    weave(action){const meta=window.ACTIONS[action.id]||{},wrap=this.picture(action,'phase-weave');wrap.append(make('span','',meta.name||String(action.id)));if(Number.isFinite(action.atMs))wrap.append(make('small','',time(action.atMs)));return wrap;}
    paintSkills(){
      const grid=$('phase-skills'),pre=$('phase-pre');grid.replaceChildren();pre.replaceChildren();if(!this.axis)return;
      const start=this.axis.phases[this.edit].start,end=A.phaseEnd(this.axis,this.edit),pages=Math.ceil((end-start)/48);this.page=Math.max(0,Math.min(this.page,pages-1));
      if(this.edit===0&&this.axis.pre.length){pre.append(make('span','','起手前能力技：'));this.axis.pre.forEach(w=>pre.append(this.weave(w)));}
      for(let i=start+this.page*48;i<Math.min(end,start+(this.page+1)*48);i++){
        const g=this.axis.gcds[i],meta=window.ACTIONS[g.id]||{},b=make('button','phase-skill-group');b.type='button';b.setAttribute('aria-pressed',String(i===this.selected));b.dataset.gcdIndex=i;
        b.append(make('span','phase-skill-time',`#${i-start+1}${i===start?' · 起手':''} · ${time(g.atMs)}`));const main=this.picture(g,'phase-skill-main'),label=make('span','',meta.name||String(g.id));label.append(make('small','',A.isPreparation(this.axis,g.id)?'GCD · 灵极魂／弹性准备':'GCD'));main.append(label);b.append(main);
        const ws=make('span','phase-weaves');if(g.weaves.length)g.weaves.forEach(w=>ws.append(this.weave(w)));else ws.append(make('span','none','无能力技'));b.append(ws);b.onclick=()=>{this.selected=i;this.paintSkills();this.paintSelection();};grid.append(b);
      }
      $('phase-page').textContent=`第 ${this.page+1}/${pages} 页 · 本 P 共 ${end-start} GCD · 每页 48 组`;$('phase-page-prev').disabled=this.page===0;$('phase-page-next').disabled=this.page+1>=pages;
    }
    paintSelection(){if(!this.axis)return;const start=this.axis.phases[this.edit].start,g=this.axis.gcds[this.selected],meta=window.ACTIONS[g.id]||{};$('phase-selected').textContent=`已选 #${this.selected-start+1} · ${time(g.atMs)} · ${meta.name||g.id}`;$('phase-set-start').disabled=this.edit===0||this.selected===start;$('phase-split').disabled=this.axis.phases.some(p=>p.start===this.selected)||A.isPreparation(this.axis,g.id);}
    paint(){
      const enabled=Boolean(this.axis);['phase-label','phase-name','phase-suggest','phase-save','phase-go','phase-earlier','phase-later','phase-set-start','phase-split','phase-merge'].forEach(id=>$(id).disabled=!enabled);
      if(!enabled){$('phase-summary').textContent='请先导入或选择技能轴';$('phase-list').replaceChildren();$('phase-skills').replaceChildren();$('phase-pre').replaceChildren();$('phase-quick').replaceChildren();$('phase-anchor').textContent='';$('phase-selected').textContent='';$('phase-page').textContent='';$('phase-name').value='';$('phase-result').textContent='';return;}
      const start=this.axis.phases[this.edit].start,end=A.phaseEnd(this.axis,this.edit);if(this.selected<start||this.selected>=end)this.selected=start;
      const first=this.axis.gcds[start];$('phase-summary').textContent=`共 ${this.axis.phases.length} 个片段 · ${this.axis.phaseConfirmed&&!this.dirty?'已确认':'建议分段／待确认'}`;$('phase-detail-title').textContent=`${A.phaseLabel(this.axis,this.edit)} · ${this.axis.phases[this.edit].name}`;$('phase-label').value=A.phaseLabel(this.axis,this.edit);$('phase-name').value=this.axis.phases[this.edit].name;$('phase-anchor').textContent=`起点：${time(first.atMs)} · ${(window.ACTIONS[first.id]||{}).name||first.id}`;
      $('phase-go').disabled=this.dirty;$('phase-earlier').disabled=this.edit===0||start<=this.axis.phases[this.edit-1].start+1;$('phase-later').disabled=this.edit===0||start>=end-1;$('phase-merge').disabled=this.axis.phases.length<2;$('phase-merge').textContent=this.edit===0?'与下一 P 合并':'与上一 P 合并';
      this.paintList();this.paintSkills();this.paintSelection();this.runtimeKey='';const engine=this.getEngine();if(engine)this.updateRuntime(engine.snapshot());
    }
    updateRuntime(s){
      const key=[s.phase,s.phaseCount,s.phaseLabel,s.waitingStart,s.stopped,this.dirty,this.axis?.id].join(':');if(key===this.runtimeKey)return;this.runtimeKey=key;$('phase-runtime-label').textContent=`实战 ${s.phaseLabel||'P'+(s.phase+1)} · ${s.phaseName}${s.stopped?' · 停手中':s.waitingStart?' · 等待起手':''}`;
      const quick=$('phase-quick');quick.replaceChildren();const engine=this.getEngine();if(!engine)return;engine.phases.forEach((p,i)=>{const b=make('button','',`${p.label||'P'+(i+1)} · ${p.name}`);b.type='button';b.disabled=this.dirty;b.setAttribute('aria-pressed',String(i===s.phase));b.onclick=()=>this.switchPhase(i);quick.append(b);});this.paintList();
    }
  }
  A.PhaseUI=PhaseUI;
})();
