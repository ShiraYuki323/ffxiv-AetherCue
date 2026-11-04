(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else Object.assign(root.Axis=root.Axis||{},api);})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const COMMON={kaichang:'开场',ting:'停',tingshou:'停手',zhuanchang:'转场',jieduan:'阶段',weimingming:'未命名',zuihou:'最后',benti:'本体',qian:'前',hou:'后',diyijieduan:'第一阶段',dierjieduan:'第二阶段',disanjieduan:'第三阶段',lingjihun:'灵极魂',zhankai:'展开',shengming:'生命',shengminghuishengfa:'生命回生法',jian:'减',jianshang:'减伤',zhiliao:'治疗',zhongwen:'中文',nihao:'你好',jueben:'绝本',jinengzhou:'技能轴',tongyong:'通用',bianji:'编辑',tingshouhou:'停手后'};
  class PinyinModel{
    constructor(dictionary={},actions={}){
      this.dictionary=dictionary;this.words=new Map(Object.entries(COMMON));this.keys=Object.keys(dictionary);const reverse=new Map();
      for(const [pinyin,characters]of Object.entries(dictionary))for(const c of characters)if(!reverse.has(c))reverse.set(c,pinyin);
      for(const a of Object.values(actions)){const word=String(a.name||'');if(!/^[\u3400-\u9fff]{2,12}$/.test(word))continue;const parts=[...word].map(c=>reverse.get(c));if(parts.every(Boolean)&&!this.words.has(parts.join('')))this.words.set(parts.join(''),word);}
    }
    suggest(input){
      const value=String(input||'').toLowerCase();if(!/^[a-z]{1,64}$/.test(value))return[];
      const out=[],seen=new Set(),add=(text,consume)=>{const key=text+':'+consume;if(!seen.has(key)){seen.add(key);out.push({text,consume});}};
      if(this.words.has(value))add(this.words.get(value),value.length);
      let prefix='';for(let n=Math.min(value.length,6);n>0;n--)if(this.dictionary[value.slice(0,n)]){prefix=value.slice(0,n);break;}
      if(prefix)for(const c of this.dictionary[prefix])add(c,prefix.length);
      if(value.length>=3)for(const [pinyin,word]of this.words)if(pinyin.startsWith(value)&&pinyin!==value)add(word,value.length);
      if(!prefix)for(const k of this.keys)if(k.startsWith(value))for(const c of this.dictionary[k])add(c,value.length);
      return out;
    }
  }
  class ChineseInput{
    constructor({enabled=false,onChange=()=>{}}={}){
      this.enabled=enabled;this.onChange=onChange;this.target=null;this.buffer='';this.page=0;this.model=new PinyinModel(window.AXIS_PINYIN||{},window.ACTIONS||{});
      this.button=document.getElementById('chinese-toggle');this.box=document.getElementById('chinese-candidates');this.code=document.getElementById('chinese-code');this.list=document.getElementById('chinese-options');this.prev=document.getElementById('chinese-prev');this.next=document.getElementById('chinese-next');
      this.button.onclick=()=>{if(this.enabled&&this.buffer)this.commitRaw();this.enabled=!this.enabled;this.clear();this.paintToggle();this.onChange(this.enabled);};
      this.prev.onclick=()=>{this.page=Math.max(0,this.page-1);this.paint();};this.next.onclick=()=>{this.page++;this.paint();};
      this.box.addEventListener('mousedown',e=>e.preventDefault());
      document.addEventListener('focusin',e=>{if(e.target?.matches?.('[data-chinese-input]')&&this.target!==e.target){this.clear();this.target=e.target;}});
      document.addEventListener('mousedown',e=>{if(this.buffer&&!this.box.contains(e.target)&&e.target!==this.target&&e.target!==this.button)this.clear();},true);
      document.addEventListener('compositionstart',e=>{if(e.target?.dataset)e.target.dataset.composing='true';this.clear();},true);
      document.addEventListener('compositionend',e=>{if(e.target?.dataset)delete e.target.dataset.composing;},true);
      document.addEventListener('paste',()=>this.clear(),true);
      document.addEventListener('keydown',e=>this.keydown(e),true);
      document.getElementById('panel').addEventListener('close',()=>this.clear());this.paintToggle();
    }
    paintToggle(){this.button.textContent=this.enabled?'中文：内置拼音（开）':'中文：英文／系统输入法';this.button.setAttribute('aria-pressed',String(this.enabled));document.getElementById('chinese-help').textContent=this.enabled?'系统输入法切为英文，在名称、段名或技能搜索框输入拼音；空格／数字 1–5 选字，← → 翻页。支持逐字输入。':'可直接输入英文，或使用宿主支持的系统输入法；中文也可复制粘贴。';}
    clear(){this.buffer='';this.page=0;if(this.box)this.box.hidden=true;}
    insert(text){
      const field=this.target;if(!field)return;const start=Number.isInteger(field.selectionStart)?field.selectionStart:field.value.length,end=Number.isInteger(field.selectionEnd)?field.selectionEnd:start;
      if(typeof field.setRangeText==='function')field.setRangeText(text,start,end,'end');else{field.value=field.value.slice(0,start)+text+field.value.slice(end);if(typeof field.setSelectionRange==='function')field.setSelectionRange(start+text.length,start+text.length);}
      field.dispatchEvent(new Event('input',{bubbles:true}));
    }
    commitRaw(){const value=this.buffer;this.clear();this.insert(value);}
    commit(index){const choices=this.model.suggest(this.buffer),choice=choices[this.page*5+index];if(!choice)return;const remaining=this.buffer.slice(choice.consume);this.insert(choice.text);this.buffer=remaining;this.page=0;if(this.buffer)this.paint();else this.clear();}
    paint(){
      if(!this.target||!this.buffer){this.clear();return;}const choices=this.model.suggest(this.buffer),pages=Math.max(1,Math.ceil(choices.length/5));this.page=Math.min(this.page,pages-1);
      this.target.insertAdjacentElement('afterend',this.box);this.box.hidden=false;this.code.textContent=this.buffer+' · '+(this.page+1)+'/'+pages;this.list.replaceChildren();
      choices.slice(this.page*5,this.page*5+5).forEach((choice,i)=>{const b=document.createElement('button');b.type='button';b.textContent=(i+1)+'. '+choice.text;b.onclick=()=>this.commit(i);this.list.append(b);});
      if(!choices.length){const label=document.createElement('span');label.textContent='暂无候选；回车保留字母，Esc 取消';this.list.append(label);}
      this.prev.disabled=this.page===0;this.next.disabled=this.page+1>=pages;
    }
    keydown(e){
      if(!this.enabled||!e.target?.matches?.('[data-chinese-input]')||e.isComposing||e.keyCode===229||e.target.dataset.composing==='true'||e.ctrlKey||e.metaKey||e.altKey)return;
      if(this.target!==e.target){this.clear();this.target=e.target;}
      const key=e.key||'';
      if(/^[a-z]$/i.test(key)){if(e.shiftKey&&!this.buffer)return;e.preventDefault();e.stopPropagation();if(this.buffer.length<64)this.buffer+=key.toLowerCase();this.page=0;this.paint();return;}
      if(!this.buffer)return;
      if(key===' '||/^[1-5]$/.test(key)){e.preventDefault();e.stopPropagation();this.commit(key===' '?0:Number(key)-1);}
      else if(key==='Backspace'){e.preventDefault();e.stopPropagation();this.buffer=this.buffer.slice(0,-1);this.page=0;this.paint();}
      else if(key==='Escape'){e.preventDefault();e.stopPropagation();this.clear();}
      else if(key==='ArrowRight'||key==='ArrowLeft'||key==='PageDown'||key==='PageUp'){e.preventDefault();e.stopPropagation();this.page=Math.max(0,this.page+(key==='ArrowRight'||key==='PageDown'?1:-1));this.paint();}
      else if(key==='Enter'){e.preventDefault();e.stopPropagation();this.commitRaw();}
      else if(key==='Tab')this.clear();
    }
  }
  return{PinyinModel,ChineseInput};
});
