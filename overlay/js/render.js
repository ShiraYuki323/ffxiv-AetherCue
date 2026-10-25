(function(){
  'use strict';const A=window.Axis,$=id=>document.getElementById(id);
  function icon(action){
    const el=document.createElement('div');el.className='icon timeline-icon';el.dataset.action=action.id;
    const meta=window.ACTIONS[action.id];el.title=(meta?meta.name:'未知技能')+' · '+action.id+(action.note?' · '+action.note:'')+(action.optional?'（可选）':'');
    const fallback=()=>{el.replaceChildren();const span=document.createElement('span');span.className='fallback';span.textContent=meta?meta.name.slice(0,2):action.id;el.append(span);};
    if(meta&&meta.icon){const img=document.createElement('img');img.src='icons/'+meta.icon+'.png';img.alt=meta.name;img.draggable=false;img.onerror=fallback;el.append(img);}else fallback();return el;
  }
  const transform=item=>`translate3d(${item.x-29}px,${item.y-29}px,0) scale(${item.size/58})`;
  class Renderer{
    constructor(){this.key='';this.engine=null;this.epoch=0;this.nodes=new Map();this.timers=[];this.lane=$('lane');this.pending=$('pending');}
    clear(){this.timers.forEach(clearTimeout);this.timers=[];this.nodes.forEach(n=>n.remove());this.nodes.clear();this.lane.querySelectorAll('.timeline-exit').forEach(n=>n.remove());}
    layout(s){
      const items=[],g=(row,role,x,size,opacity)=>items.push({key:'g:'+row.uid,action:row,role,x,y:48,size,opacity});
      const history=s.history.slice(-2);history.forEach((row,i)=>g(row,'past-old',i===history.length-1?8:-17,i===history.length-1?20:16,i===history.length-1?.35:.15));
      if(s.current)g({...s.current,uid:s.cursor},'current',47,46,1);
      s.future.forEach((row,i)=>{
        const x=[159,224,269,309][i];g(row,i===0?'next-gcd'+(s.carry.length?' dirty':''):'future-'+(i+1),x,[58,38,31,27][i],[1,.85,.58,.4][i]);
        const size=[26,22,18,14][i],center=i===3?302:x,list=row.weaves||[];
        list.slice(0,2).forEach((v,slot)=>items.push({key:'w:'+row.uid+':'+slot,action:v,role:'weave upcoming'+(v.optional?' optional':''),x:center+(list.length===1?0:(slot===0?-1:1)*(size/2+2)),y:[94,89,85,83][i],size,opacity:[.95,.8,.65,.5][i],extra:slot===1?Math.max(0,list.length-2):0}));
      });
      s.pending.slice(0,2).forEach((v,i)=>items.push({key:'w:'+v.owner+':'+v.slot,action:v,role:'weave required-now'+(v.optional?' optional':''),x:98,y:s.pending.length===1?48:i===0?27:69,size:36,opacity:1}));
      s.carry.slice(0,3).forEach((v,i)=>items.push({key:'w:'+v.owner+':'+v.slot,action:v,role:'weave stale',x:20+i*28,y:98,size:24,opacity:.65}));return items;
    }
    paint(engine){
      const s=engine.snapshot(),fresh=this.engine!==engine||this.epoch!==s.epoch;
      if(fresh){this.clear();this.engine=engine;this.epoch=s.epoch;this.key='';}
      const key=engine.axis.id+':'+s.revision;
      if(key!==this.key){
        this.key=key;const noMotion=fresh||document.body.classList.contains('no-transition'),items=this.layout(s),keep=new Set(items.map(v=>v.key));
        for(const [id,node]of this.nodes){if(keep.has(id))continue;this.nodes.delete(id);node.classList.add('timeline-exit');node.style.opacity='0';node.style.transform=node.style.transform.replace(/scale\([^)]*\)/,'scale(.12)');if(noMotion)node.remove();else this.timers.push(setTimeout(()=>node.remove(),300));}
        items.forEach(item=>{
          let node=this.nodes.get(item.key),enter=!node;
          if(!node){node=icon(item.action);node.dataset.key=item.key;this.nodes.set(item.key,node);(item.role.includes('weave')?this.pending:this.lane).append(node);}
          node.className='icon timeline-icon '+item.role;node.dataset.role=item.role.split(' ')[0];node.style.zIndex=item.role.includes('next-gcd')?'4':item.role.includes('weave')?'5':'2';node.style.transition=noMotion?'none':'';
          let badge=node.querySelector('.weave-extra');if(item.extra){if(!badge){badge=document.createElement('span');badge.className='weave-extra';node.append(badge);}badge.textContent='+'+item.extra;badge.title='这格另有 '+item.extra+' 个能力技，轮到时依次显示';}else if(badge)badge.remove();
          if(item.role.includes('stale'))node.title='上一格漏插 · '+node.title.replace(/^上一格漏插 · /,'');
          if(enter&&!noMotion){node.style.transform=transform({...item,x:item.x+18,size:item.size*.82});node.style.opacity='0';node.getBoundingClientRect();}
          node.style.transform=transform(item);node.style.opacity=String(item.opacity);
        });
        $('axis-name').textContent=engine.axis.name;$('progress').textContent=`${s.index+1}/${engine.axis.gcds.length}${s.drift?' · 偏离 '+s.drift:''}${s.miss?' · 未匹配 '+s.miss:''}${s.missedWeaves?' · 漏插 '+s.missedWeaves:''}`;
        $('lane-overflow').textContent=s.pending.length>2?'待插 +'+(s.pending.length-2):s.carry.length>3?'漏插 +'+(s.carry.length-3):'';$('lane-complete').hidden=s.future.length>0;
      }
      const current=this.lane.querySelector('.current:not(.timeline-exit)');if(current){current.style.setProperty('--arc',(engine.axis.mode==='focus'?0:s.ratio*360)+'deg');current.classList.toggle('urgent',s.urgent&&s.pending.some(v=>!v.optional));}
      this.pending.querySelectorAll('.weave.required-now:not(.optional):not(.timeline-exit)').forEach(el=>el.classList.toggle('urgent',s.urgent));
      $('current-caption').textContent=engine.axis.mode==='focus'?'刚用过':'当前 / 插入';document.querySelector('.caption b').textContent=engine.axis.mode==='focus'?'指定技能':'GCD';
      let text=s.current?(s.left>0?'≈ '+(s.left/1000).toFixed(1)+' s':'等待施法'):'等待起手';
      if(engine.axis.mode==='focus')text=s.next===null?'本条轴已完成':!s.focusTimed?'未附时间点':s.focusLeft===null?'等待开战 · 点此计时':s.focusLeft>0?(s.focusLeft/1000).toFixed(1)+' s':'已到时 · 等待释放';
      $('timer').textContent=text;$('timer').classList.toggle('skill-due',engine.axis.mode==='focus'&&s.focusLeft===0);$('timer').title=engine.axis.mode==='focus'?'到零不会跳过；提前或延后释放都从实际释放时刻重新计算下一技能。首次可点此或按 T 开始计时。':'GCD 估算倒计时';
      const cast=s.cast,left=cast?Math.max(0,cast.duration-(Date.now()-cast.at)):0;$('cast').textContent=left>0?((window.ACTIONS[cast.id]||{}).name||'读条')+' '+(left/1000).toFixed(1)+'s':'';
    }
  }
  A.Renderer=Renderer;
})();
