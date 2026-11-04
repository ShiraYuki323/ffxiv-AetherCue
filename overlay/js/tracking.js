(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./engine.js'):{Engine:root.Axis.Engine},node?{...require('./registry.js'),...require('./phases.js')}:root.Axis);if(node)module.exports=api;else Object.assign(root.Axis,api);})(typeof globalThis!=='undefined'?globalThis:this,function(Legacy,A){
  'use strict';
  class Engine extends Legacy.Engine{
    constructor(axis,actions={},options={}){
      super(axis,actions,options);
      this.source=A.normalizeTimeline(options.sourceAxis||axis);this.phases=A.phaseList(this.source);
      this.display=options.display||this.source.display||{mode:'all',skills:[]};this.generic=this.display.mode==='generic';this.selectedSkills=new Set(this.display.skills||[]);
      this.advanced=this.generic||this.phases.length>1||this.axis.job==='BLM'&&this.axis.mode!=='focus';
      if(this.axis.mode==='focus'&&this.phases.length>1)this.sourceTracker=new Engine(this.source,actions,{gcdMs:this.baseGcd,clock:this.clock,display:{mode:'all',skills:[]}});
    }
    reset(){
      super.reset();this.loopRound=0;this.activePhase=0;this.manualPaused=false;this.pauseAt=null;this.autoStopped=false;this.stopAt=null;this.prepCount=0;this.waitingStart=false;this.phaseStartAt=null;this.timeOffset=null;this.currentVisible=true;this.alignBuffer=[];this.alignCandidates=[];this.marks=new Map();
      if(this.sourceTracker)this.sourceTracker.reset();
    }
    expire(now){if(!this.manualPaused)super.expire(now);}
    phaseRange(p=this.activePhase){
      if(this.axis.mode!=='focus')return{start:this.phases[p].start,end:A.phaseEnd(this.source,p)};
      const first=this.phases[p].start,last=A.phaseEnd(this.source,p);let start=this.axis.gcds.findIndex((g,i)=>(g.sourceIndex===undefined?i:g.sourceIndex)>=first||p===0&&g.sourceIndex===-1);
      if(start<0)start=this.axis.gcds.length;let end=start;while(end<this.axis.gcds.length&&(this.axis.gcds[end].sourceIndex===undefined?end:this.axis.gcds[end].sourceIndex)<last)end++;
      return{start,end};
    }
    sourceIndex(i){const g=this.axis.gcds[i];return g&&g.sourceIndex!==undefined?g.sourceIndex:i;}
    sourceAnchor(p=this.activePhase){const start=this.phases[p].start,end=A.phaseEnd(this.source,p);for(let i=start;i<end;i++)if(!A.isPreparation(this.source,this.source.gcds[i].id))return this.source.gcds[i];return this.source.gcds[start];}
    preparation(id){return this.axis.mode!=='focus'&&A.isPreparation(this.axis,id);}
    nextFrom(index){
      for(let n=0;n<this.axis.gcds.length;n++){index=A.stepIndex(this.axis,index);if(index===null)return null;if(!this.preparation(this.axis.gcds[index].id))return index;}return null;
    }
    nextIndex(){if(this.axis.mode==='focus'&&this.phases.length>1&&this.phaseRange().start===this.phaseRange().end)return null;return this.nextFrom(this.index);}
    switchPhase(p,at=this.clock(),propagate=true){
      if(!Number.isInteger(p)||p<0||p>=this.phases.length)throw Error('阶段不存在');
      const range=this.phaseRange(p);this.activePhase=p;this.index=range.start-1;this.cursor=this.index;this.done.clear();this.preDone.clear();this.history=[];this.carry=[];this.cast=null;this.lastAt=null;this.currentVisible=false;
      this.manualPaused=false;this.pauseAt=null;this.autoStopped=false;this.stopAt=null;this.prepCount=0;this.waitingStart=true;this.phaseStartAt=null;this.alignBuffer=[];this.alignCandidates=[];this.epoch++;this.revision++;this.message='已定位 P'+(p+1)+'，等待实际起手';
      if(propagate&&this.sourceTracker)this.sourceTracker.switchPhase(p,at);
    }
    pause(at=this.clock()){if(this.manualPaused)return;this.expire(at);this.manualPaused=true;this.pauseAt=at;this.revision++;this.message='手动停手';if(this.sourceTracker)this.sourceTracker.pause(at);}
    resume(at=this.clock()){
      if(!this.manualPaused)return;const duration=Math.max(0,at-this.pauseAt);
      if(this.lastAt!==null&&this.lastAt<=this.pauseAt)this.lastAt+=duration;
      if(this.combatStartAt!==null)this.combatStartAt+=duration;
      this.carry.forEach(v=>v.until+=duration);
      this.manualPaused=false;this.pauseAt=null;this.waitingStart=true;this.alignBuffer=[];this.alignCandidates=[];this.revision++;this.message='等待实际输出重新对齐';if(this.sourceTracker)this.sourceTracker.resume(at);
    }
    startClock(at=this.clock()){if(this.manualPaused)return;super.startClock(at);if(this.activePhase>0&&this.phaseStartAt===null)this.phaseStartAt=at;if(this.sourceTracker)this.sourceTracker.startClock(at);}
    markKey(kind,index,slot,round=this.loopRound){return round+':'+kind+':'+index+(slot===undefined?'':':'+slot);}
    pendingDetails(){
      if(!this.currentVisible&&this.index>=0)return[];
      const base=super.pendingDetails(),list=this.index<0?this.axis.pre:this.axis.gcds[this.index].weaves,slots=new Set(base.map(v=>v.slot));
      list.forEach((v,slot)=>{const mark=this.marks&&this.marks.get(this.markKey('w',this.index,slot));if(mark&&mark.early&&!slots.has(slot))base.push({...v,slot,owner:this.cursor});});
      return base.map(v=>({...v,early:Boolean(this.marks&&this.marks.get(this.markKey('w',this.index,v.slot))?.early)})).sort((a,b)=>Number(a.early)-Number(b.early)||a.slot-b.slot);
    }
    markSelected(id,at){
      if(!this.generic||!this.selectedSkills.has(id))return null;
      const expected=this.nextIndex(),rows=[];
      if(this.currentVisible){const list=this.index<0?this.axis.pre:this.axis.gcds[this.index].weaves;list.forEach((v,slot)=>rows.push({v,index:this.index,slot,round:this.loopRound,key:this.markKey('w',this.index,slot)}));}
      const limit=this.phases.length>1?A.phaseEnd(this.source,Math.min(this.activePhase+1,this.phases.length-1)):this.axis.gcds.length;
      let futureRound=this.loopRound+(expected!==null&&expected<=this.index?1:0),i=expected;
      for(let n=0;n<this.axis.gcds.length&&i!==null&&i<limit;n++){
        const g=this.axis.gcds[i];rows.push({v:g,index:i,round:futureRound,key:this.markKey('g',i,undefined,futureRound)});g.weaves.forEach((v,slot)=>rows.push({v,index:i,slot,round:futureRound,key:this.markKey('w',i,slot,futureRound)}));
        const next=this.nextFrom(i);if(next!==null&&next<=i)futureRound++;i=next;
      }
      const item=rows.find(r=>r.v.id===id&&!this.marks.has(r.key));if(!item)return null;
      const scheduled=Number.isFinite(item.v.atMs)&&this.timeOffset!==null?item.v.atMs+this.timeOffset:null;
      const early=this.manualPaused||item.slot!==undefined&&(item.index>this.index||item.round>this.loopRound)||item.slot===undefined&&(item.index!==expected||item.round>this.loopRound+(expected<=this.index?1:0))||scheduled!==null&&at<scheduled-300;
      this.marks.set(item.key,{at,early});this.revision++;return{...item,early};
    }
    decorate(row,index,round=this.loopRound){
      return {...row,index,generic:this.generic&&!this.selectedSkills.has(row.id),early:Boolean(this.marks.get(this.markKey('g',index,undefined,round))?.early),weaves:(row.weaves||[]).map((w,slot)=>({...w,early:Boolean(this.marks.get(this.markKey('w',index,slot,round))?.early)}))};
    }
    atTail(){return this.currentVisible&&this.phases&&this.activePhase<this.phases.length-1&&this.index>=A.outputEnd(this.source,this.activePhase);}
    advance(found,at){
      let hops=0,i=this.index;while(hops<this.axis.gcds.length){i=this.nextFrom(i);if(i===null)break;hops++;if(i===found)break;}
      if(this.index>=0&&this.currentVisible){this.pendingDetails().filter(v=>!v.optional&&!v.early).forEach(v=>this.carry.push({...v,until:at+1600}));this.history.push({...this.decorate(this.axis.gcds[this.index],this.index),uid:this.cursor});if(this.history.length>3)this.history.shift();}
      if(this.lastAt!==null&&hops===1&&!this.autoStopped){const delta=at-this.lastAt;if(delta>=1000&&delta<=4000){this.intervals.push(delta);if(this.intervals.length>7)this.intervals.shift();const sorted=[...this.intervals].sort((a,b)=>a-b);this.gcdMs=sorted[Math.floor(sorted.length/2)];}}
      if(found<=this.index&&this.axis.loop){this.loopRound++;for(const key of this.marks.keys())if(Number(key.split(':')[0])<this.loopRound-1)this.marks.delete(key);}
      this.index=found;this.cursor+=Math.max(1,hops);this.done.clear();this.axis.gcds[found].weaves.forEach((_,slot)=>{if(this.marks.has(this.markKey('w',found,slot)))this.done.add(slot);});this.lastAt=at;this.currentVisible=true;
      if(this.phaseStartAt===null)this.phaseStartAt=at;
      if(Number.isFinite(this.axis.gcds[found].atMs))this.timeOffset=at-this.axis.gcds[found].atMs;
      this.waitingStart=false;this.autoStopped=false;this.stopAt=null;this.alignBuffer=[];this.alignCandidates=[];
      if(this.axis.mode!=='focus')this.activePhase=A.phaseAt(this.source,found);
      if(hops>1&&!this.generic)this.drift++;
      this.message='跟随中';this.revision++;return hops>1&&!this.generic?'drift':'gcd';
    }
    align(id,at){
      const first=this.nextIndex();if(first===null)return'ignored';const range=this.phaseRange();
      if(!this.alignBuffer.length&&this.axis.gcds[first].id===id)return this.advance(first,at);
      if(!this.alignBuffer.length){let i=first;for(let n=0;n<6&&i!==null&&i<range.end;n++,i=this.nextFrom(i))if(this.axis.gcds[i].id===id)this.alignCandidates.push({start:i,next:i});}
      else this.alignCandidates=this.alignCandidates.filter(c=>c.next!==null&&c.next<range.end&&this.axis.gcds[c.next].id===id);
      if(!this.alignCandidates.length){this.alignBuffer=[];this.message='等待本 P 起手；可手动切 P 校正';this.revision++;return'align-wait';}
      this.alignBuffer.push({id,at});this.alignCandidates.forEach(c=>{c.next=this.nextFrom(c.next);});
      let chosen=this.alignCandidates.length===1?this.alignCandidates[0]:null;
      if(!chosen&&this.alignBuffer.length>=3&&this.timeOffset!==null){
        const ranked=this.alignCandidates.map(c=>({...c,error:Number.isFinite(this.axis.gcds[c.start].atMs)?Math.abs(this.alignBuffer[0].at-(this.axis.gcds[c.start].atMs+this.timeOffset)):Infinity})).sort((a,b)=>a.error-b.error);
        if(ranked[0].error<=15000&&ranked[1].error-ranked[0].error>=this.gcdMs*2)chosen=ranked[0];
      }
      if(!chosen){this.message='正在对齐 · '+this.alignCandidates.length+' 个候选';this.revision++;return'align-wait';}
      const buffer=this.alignBuffer.slice();let i=chosen.start;for(const event of buffer){this.advance(i,event.at);i=this.nextFrom(i);}return'aligned';
    }
    ability(id,at=this.clock()){
      if(!Number.isFinite(at))return'ignored';
      if(this.sourceTracker){
        this.sourceTracker.ability(id,at);
        if(this.sourceTracker.activePhase!==this.activePhase){const p=this.sourceTracker.activePhase;this.switchPhase(p,at,false);}
        if(!this.sourceTracker.waitingStart&&this.waitingStart){this.phaseStartAt=this.sourceTracker.phaseStartAt;this.waitingStart=false;this.revision++;}
      }
      if(this.preparation(id)){this.prepCount++;this.revision++;return'preparation';}
      const mark=this.markSelected(id,at),gcd=Boolean(this.actions[id]?.gcd||this.axis.gcds.some(g=>g.id===id));
      if(this.manualPaused&&this.axis.mode!=='focus'){if(!gcd&&this.currentVisible){const result=super.ability(id,at);return mark?.early?'early':result;}return mark?'early':'paused';}
      if(mark&&mark.slot!==undefined&&mark.index>this.index)return'early';
      if(this.axis.mode==='focus'){
        if(this.waitingStart&&id===this.sourceAnchor()?.id){this.phaseStartAt=at;this.waitingStart=false;this.revision++;}
        const next=this.nextIndex();if(next===null||this.sourceTracker&&this.sourceIndex(next)>=A.phaseEnd(this.source,this.activePhase))return'ignored';
        if(id!==this.axis.gcds[next].id)return this.axis.gcds.some(g=>g.id===id)?'out-of-order':'ignored';
        return this.advanced?this.advance(next,at):super.ability(id,at);
      }
      if(!this.advanced&&!this.waitingStart)return super.ability(id,at);
      if(!gcd)return super.ability(id,at);
      if(this.atTail()){const p=this.activePhase+1;this.switchPhase(p,at);}
      if(this.waitingStart)return this.align(id,at);
      const next=this.nextIndex();if(next===null)return'ignored';
      if(this.generic)return this.advance(next,at);
      let i=next;for(let n=0;n<6&&i!==null;n++,i=this.nextFrom(i)){
        if(this.phases.length>1&&A.phaseAt(this.source,i)!==this.activePhase)break;
        if(this.axis.gcds[i].id===id)return this.advance(i,at);
      }
      this.miss++;this.message='未匹配，保留当前位置';this.revision++;return'miss';
    }
    snapshot(now=this.clock()){
      const sourceState=this.sourceTracker?.snapshot(now);
      if(!sourceState&&!this.manualPaused&&this.atTail()&&this.lastAt!==null&&now>=this.lastAt+this.gcdMs&&!this.autoStopped){this.autoStopped=true;this.stopAt=this.lastAt+this.gcdMs;this.revision++;}
      const effective=this.manualPaused?this.pauseAt:now,s=super.snapshot(effective);
      if(this.advanced||this.waitingStart){
        const next=this.nextIndex();s.next=next;s.future=[];let i=next,round=this.loopRound+(next!==null&&next<=this.index?1:0);
        for(let n=1;n<=4&&i!==null;n++){s.future.push({...this.decorate(this.axis.gcds[i],i,round),uid:this.cursor+n});const following=this.nextFrom(i);if(following!==null&&following<=i)round++;i=following;}
      }else s.future=s.future.map(g=>this.decorate(g,g.index));
      s.current=this.currentVisible&&this.index>=0?this.decorate(this.axis.gcds[this.index],this.index):null;
      s.pending=this.pendingDetails();s.history=this.history;
      if(this.axis.mode==='focus'&&this.phases.length>1&&s.next!==null){
        const g=this.axis.gcds[s.next],first=this.sourceAnchor();
        if(!s.current){s.focusDueAt=this.phaseStartAt!==null&&Number.isFinite(g.atMs)&&Number.isFinite(first?.atMs)?this.phaseStartAt+Math.max(0,g.atMs-first.atMs):null;s.focusLeft=s.focusDueAt===null?null:Math.max(0,s.focusDueAt-effective);}
      }
      const stopped=this.manualPaused||Boolean(sourceState?.autoStopped??this.autoStopped),stopAt=this.manualPaused?this.pauseAt:sourceState?.stopAt??this.stopAt;
      let stopLeft=null;
      if(stopped&&!this.manualPaused&&this.activePhase<this.phases.length-1){const last=this.source.gcds[A.outputEnd(this.source,this.activePhase)],next=this.source.gcds[this.phases[this.activePhase+1].start];if(Number.isFinite(last.atMs)&&Number.isFinite(next.atMs))stopLeft=Math.max(0,next.atMs-last.atMs-this.gcdMs-Math.max(0,now-stopAt));else if(next.breakBeforeMs)stopLeft=Math.max(0,next.breakBeforeMs-Math.max(0,now-stopAt));}
      return {...s,generic:this.generic,selectedSkills:[...this.selectedSkills],phase:this.activePhase,phaseLabel:this.phases[this.activePhase].label||'P'+(this.activePhase+1),phaseName:this.phases[this.activePhase].name,phaseCount:this.phases.length,phaseConfirmed:this.source.phaseConfirmed===true,manualPaused:this.manualPaused,autoStopped:Boolean(sourceState?.autoStopped??this.autoStopped),stopped,stopAt,stopLeft,stopElapsed:stopAt===null?0:Math.max(0,now-stopAt),waitingStart:this.waitingStart,alignCandidates:this.alignCandidates.length,preparations:sourceState?.preparations??this.prepCount,phaseStartAt:this.phaseStartAt,phaseEmpty:this.phaseRange().start===this.phaseRange().end};
    }
  }
  return{Engine};
});
