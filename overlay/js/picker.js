(function () {
  'use strict';
  const instances=[];
  // Native select popups are separate browser widgets in CEF offscreen mode.
  // Keep all visible controls inside the page/dialog instead of using that path.
  class Picker {
    constructor(select,placeholder) {
      this.select=select;this.placeholder=placeholder;this.opened=false;
      this.host=document.createElement('div');this.host.className='picker';
      this.trigger=document.createElement('button');this.trigger.type='button';this.trigger.id=select.id+'-trigger';this.trigger.className='picker-trigger';
      this.trigger.setAttribute('role','combobox');this.trigger.setAttribute('aria-haspopup','listbox');this.trigger.setAttribute('aria-expanded','false');
      this.caption=document.createElement('span');this.caption.id=select.id+'-caption';
      const label=select.getAttribute('aria-labelledby');if(label)this.trigger.setAttribute('aria-labelledby',label+' '+this.caption.id);
      const arrow=document.createElement('span');arrow.className='picker-arrow';arrow.textContent='▾';arrow.setAttribute('aria-hidden','true');
      this.trigger.append(this.caption,arrow);
      this.menu=document.createElement('div');this.menu.id=select.id+'-menu';this.menu.className='picker-menu';this.menu.hidden=true;this.menu.setAttribute('role','listbox');
      if(label)this.menu.setAttribute('aria-labelledby',label);
      this.trigger.setAttribute('aria-controls',this.menu.id);this.host.append(this.trigger,this.menu);
      select.hidden=true;select.tabIndex=-1;select.parentNode.insertBefore(this.host,select);
      this.trigger.addEventListener('click',()=>this.opened?this.close():this.open());
      this.host.addEventListener('keydown',e=>this.keydown(e));
      document.addEventListener('mousedown',e=>{if(this.opened&&!this.host.contains(e.target))this.close();});
      document.addEventListener('scroll',e=>{if(this.opened&&e.target!==this.menu&&!this.menu.contains(e.target))this.position();},true);
      window.addEventListener('resize',()=>this.close());
      const panel=select.closest('dialog');if(panel)panel.addEventListener('close',()=>this.close());
      select.addEventListener('change',()=>this.refresh());instances.push(this);this.refresh();
    }
    refresh() {
      this.close();this.menu.replaceChildren();
      const selected=this.select.options[this.select.selectedIndex];
      this.caption.textContent=selected?selected.textContent:this.placeholder;
      this.trigger.title=this.caption.textContent;this.trigger.disabled=this.select.disabled||this.select.options.length===0;
      Array.from(this.select.options).forEach(option=>{
        const item=document.createElement('button');item.type='button';item.className='picker-option';item.tabIndex=-1;
        item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));item.dataset.value=option.value;
        const text=document.createElement('span');text.textContent=option.textContent;
        const check=document.createElement('span');check.className='picker-check';check.textContent=option.selected?'✓':'';check.setAttribute('aria-hidden','true');
        item.append(text,check);item.addEventListener('click',()=>this.choose(option.value));this.menu.append(item);
      });
    }
    open(edge) {
      if(this.trigger.disabled)return;
      instances.forEach(p=>{if(p!==this)p.close();});
      if(!this.position())return;
      this.opened=true;this.menu.hidden=false;this.trigger.setAttribute('aria-expanded','true');
      const items=Array.from(this.menu.children);const item=edge==='first'?items[0]:edge==='last'?items[items.length-1]:items[this.select.selectedIndex]||items[0];
      if(item){item.focus({preventScroll:true});this.ensureVisible(item);}
    }
    position(){
      const rect=this.trigger.getBoundingClientRect(),panel=this.trigger.closest('dialog'),bounds=panel?panel.getBoundingClientRect():{top:0,bottom:innerHeight};
      if(rect.bottom<Math.max(0,bounds.top)||rect.top>Math.min(innerHeight,bounds.bottom)){this.close();return false;}
      const below=Math.min(innerHeight,bounds.bottom-6)-rect.bottom-6,above=rect.top-Math.max(0,bounds.top+6)-6;
      const upwards=below<180&&above>below;
      this.menu.classList.toggle('above',upwards);this.menu.style.maxHeight=Math.max(25,Math.min(230,upwards?above:below))+'px';
      return true;
    }
    close(restoreFocus=false) {
      if(!this.opened)return;this.opened=false;this.menu.hidden=true;this.trigger.setAttribute('aria-expanded','false');
      if(restoreFocus)this.trigger.focus({preventScroll:true});
    }
    ensureVisible(item) {
      if(item.offsetTop<this.menu.scrollTop)this.menu.scrollTop=item.offsetTop;
      if(item.offsetTop+item.offsetHeight>this.menu.scrollTop+this.menu.clientHeight)this.menu.scrollTop=item.offsetTop+item.offsetHeight-this.menu.clientHeight;
    }
    choose(value) {
      this.select.value=value;this.close(true);this.select.dispatchEvent(new Event('change',{bubbles:true}));
    }
    keydown(e) {
      if(e.key==='Escape'&&this.opened){e.preventDefault();e.stopPropagation();this.close(true);return;}
      if(e.key==='Tab'){this.close();return;}
      if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
        e.preventDefault();e.stopPropagation();
        if(!this.opened){this.open(e.key==='Home'?'first':e.key==='End'?'last':undefined);return;}
        const items=Array.from(this.menu.children),current=items.indexOf(document.activeElement);
        const index=e.key==='Home'?0:e.key==='End'?items.length-1:e.key==='ArrowDown'?Math.min(items.length-1,current+1):Math.max(0,current-1);
        const item=items[index];if(item){item.focus({preventScroll:true});this.ensureVisible(item);}return;
      }
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault();e.stopPropagation();
        if(!this.opened)this.open();else if(document.activeElement.classList.contains('picker-option'))this.choose(document.activeElement.dataset.value);else this.close(true);
      }
    }
  }
  window.Axis.Picker=Picker;
})();
