(function(){
  'use strict';
  const A=window.Axis,$=id=>document.getElementById(id);
  class FocusUI{
    constructor(apply){
      this.apply=apply;this.axis=null;this.skills=[];this.selected=new Set();
      $('focus-search').oninput=()=>this.paint();
      $('focus-all').onclick=()=>{this.selected=new Set(this.skills.map(v=>v.id));this.paint();};
      $('focus-none').onclick=()=>{this.selected.clear();this.paint();};
      document.querySelectorAll('input[name=focus-mode]').forEach(el=>el.onchange=()=>this.paint());
      $('focus-save').onclick=()=>{try{const prefs={mode:document.querySelector('input[name=focus-mode]:checked').value,skills:[...this.selected]};this.apply(prefs);$('focus-result').textContent=prefs.mode==='focus'?'已保存：只跟随勾选技能，其他施法忽略。':'已恢复完整技能轴。';}catch(e){$('focus-result').textContent=e.message;}};
    }
    refresh(axis,prefs){
      this.axis=axis;const all=axis?A.flattenTimeline(axis).filter(v=>typeof v.id==='number'):[];this.uses=new Map();all.forEach(v=>this.uses.set(v.id,(this.uses.get(v.id)||0)+1));this.skills=[...new Map(all.map(v=>[v.id,v])).values()];
      this.selected=new Set(prefs&&prefs.skills||this.skills.map(v=>v.id));
      document.querySelector('input[name=focus-mode][value="'+(prefs&&prefs.mode==='focus'?'focus':'all')+'"]').checked=true;
      $('focus-search').value='';$('focus-result').textContent='';this.paint();
    }
    paint(){
      const query=$('focus-search').value.trim().toLowerCase(),list=$('focus-list');list.replaceChildren();
      this.skills.filter(v=>{const a=window.ACTIONS[v.id]||{};return (String(v.id)+' '+(a.name||'')+' '+(a.en||'')).toLowerCase().includes(query);}).forEach(v=>{
        const a=window.ACTIONS[v.id]||{},label=document.createElement('label');label.className='focus-choice';
        const input=document.createElement('input');input.type='checkbox';input.value=v.id;input.checked=this.selected.has(v.id);input.setAttribute('aria-label',a.name||String(v.id));
        input.onchange=()=>{input.checked?this.selected.add(v.id):this.selected.delete(v.id);this.updateCount();};label.append(input);
        if(a.icon){const img=document.createElement('img');img.src='icons/'+a.icon+'.png';img.alt='';img.onerror=()=>img.remove();label.append(img);}
        const span=document.createElement('span');span.textContent=a.name||'技能 '+v.id;const small=document.createElement('small');small.textContent='本轴使用 '+this.uses.get(v.id)+' 次 · '+(a.gcd?'GCD':'能力技');span.append(small);label.append(span);list.append(label);
      });
      if(!this.axis||!list.children.length){const p=document.createElement('p');p.textContent=this.axis?'此轴没有匹配的已使用技能。':'请先导入或选择一条技能轴。';list.append(p);}this.updateCount();
    }
    updateCount(){
      const valid=new Set(this.skills.map(v=>v.id)),count=[...this.selected].filter(id=>valid.has(id)).length;
      $('focus-count').textContent='已选 '+count+' / '+this.skills.length;
      $('focus-save').disabled=!this.axis||document.querySelector('input[name=focus-mode]:checked').value==='focus'&&!count;
    }
  }
  A.FocusUI=FocusUI;
})();
