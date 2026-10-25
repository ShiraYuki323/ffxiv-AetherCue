(function(){
  'use strict';
  const A=window.Axis,$=id=>document.getElementById(id);
  class FFLogsUI{
    constructor(receive){
      this.receive=receive;this.ready=false;this.serial=0;this.players=[];this.fights=[];this.zone=null;this.loadedURL='';
      let config=(window.AXIS_LOCAL_CONFIG||{}).fflogs||{};try{config=JSON.parse(localStorage.getItem('ffxiv-axis:fflogs-api'))||config;}catch(_){}
      this.client=new A.FFLogsClient(config);A.fflogsClient=this.client;
      this.fightPicker=new A.Picker($('fflogs-fight'),'先读取战斗');this.playerPicker=new A.Picker($('fflogs-player'),'请选择角色');
      $('fflogs-section').addEventListener('toggle',()=>{if($('fflogs-section').open)this.connect();});
      $('fflogs-configure').onclick=()=>this.configure();$('fflogs-load').onclick=()=>this.load();$('fflogs-import').onclick=()=>this.import();
      $('fflogs-fight').onchange=()=>this.loadPlayers();$('fflogs-player').onchange=()=>{this.updateMetadata();$('fflogs-import').disabled=!$('fflogs-player').value;};
      $('fflogs-url').addEventListener('input',()=>{this.serial++;this.loadedURL='';this.players=[];this.fill('fflogs-fight',[]);this.fill('fflogs-player',[]);$('fflogs-import').disabled=true;$('fflogs-metadata').textContent='';});
      $('panel').addEventListener('close',()=>{this.serial++;$('fflogs-import').disabled=!this.loadedURL||!$('fflogs-player').value;$('fflogs-load').disabled=!this.ready;});
    }
    message(text){$('fflogs-result').textContent=text;}
    async connect(){
      this.ready=this.client.configured;$('fflogs-help').textContent='浮窗直接连接 FFLogs，自动识别副本、首领和职业；不启动本机服务。';$('fflogs-controls').hidden=false;$('fflogs-auth').open=!this.ready;$('fflogs-load').disabled=!this.ready;
      $('fflogs-client-id').value=this.client.config.clientId||'';if(this.ready)$('fflogs-client-secret').placeholder='已读取本地配置，留空沿用';
      this.message(this.ready?'已读取本地 V2 配置，请读取报告。':'请填写 V2 客户端或访问令牌。');
    }
    async request(route,data){
      if(route==='config'){const r=await this.client.configure(data);if(data.remember)localStorage.setItem('ffxiv-axis:fflogs-api',JSON.stringify(this.client.config));else localStorage.removeItem('ffxiv-axis:fflogs-api');return r;}
      if(route==='report')return this.client.report(data.url);
      if(route==='players')return this.client.players(data.url,data.fightId);
      if(route==='casts')return this.client.casts(data.url,data.fightId,data.playerId);
      throw Error('不支持的导入操作');
    }
    fill(id,options,value){
      const select=$(id);select.replaceChildren();options.forEach(v=>{const o=document.createElement('option');o.value=String(v.id);o.textContent=v.label;select.append(o);});
      if(value!==undefined&&value!==null)select.value=String(value);select.disabled=!options.length;
      (id==='fflogs-fight'?this.fightPicker:this.playerPicker).refresh();
    }
    playerOptions(){return [{id:'',label:'请选择一名玩家'},...this.players.map(p=>({id:p.id,label:`${p.name} · ${p.job}${p.server?' @ '+p.server:''}`}))];}
    updateMetadata(){const fight=this.fights.find(f=>String(f.id)===$('fflogs-fight').value),player=this.players.find(p=>String(p.id)===$('fflogs-player').value);$('fflogs-metadata').textContent=[this.zone&&this.zone.name,fight&&fight.name,player&&('职业：'+((window.JOBS.find(j=>j.code===player.job)||{}).name||player.job))].filter(Boolean).join(' · ');}
    async configure(){
      $('fflogs-configure').disabled=true;this.message('正在验证 FFLogs API…');
      try{await this.request('config',{clientId:$('fflogs-client-id').value,clientSecret:$('fflogs-client-secret').value,accessToken:$('fflogs-access-token').value,remember:$('fflogs-remember').checked});this.ready=true;$('fflogs-client-secret').value='';$('fflogs-access-token').value='';$('fflogs-load').disabled=false;$('fflogs-auth').open=false;this.message('V2 API 配置已接受，请读取报告验证访问权限。');}
      catch(e){this.message(e.message);}finally{$('fflogs-configure').disabled=false;}
    }
    async load(){
      const url=$('fflogs-url').value.trim();if(!url){this.message('请粘贴 FFLogs 报告链接');return;}const serial=++this.serial;
      $('fflogs-load').disabled=true;$('fflogs-import').disabled=true;this.message('正在识别报告、战斗和职业…');
      try{const data=await this.request('report',{url});if(serial!==this.serial)return;
        this.loadedURL=url;this.fights=data.fights;this.players=data.players;this.zone=data.zone;
        this.fill('fflogs-fight',this.fights.map(f=>({id:f.id,label:`第 ${f.id} 场 · ${f.name} · ${f.kill?'击杀':'未击杀'}`})),data.selectedFight);
        this.fill('fflogs-player',this.playerOptions(),data.selectedPlayer||'');$('fflogs-import').disabled=!data.selectedPlayer;this.updateMetadata();this.message(data.selectedPlayer?'角色已由链接选中，可以直接导入。':'战斗已识别，请选择一名玩家；不会将全队技能混在一起。');
      }catch(e){if(serial===this.serial)this.message(e.message);}finally{$('fflogs-load').disabled=!this.ready;}
    }
    async loadPlayers(){
      if(!this.loadedURL)return;const serial=++this.serial,fightId=Number($('fflogs-fight').value);$('fflogs-import').disabled=true;this.fill('fflogs-player',[]);this.message('正在读取这场战斗的角色…');
      try{const data=await this.request('players',{url:this.loadedURL,fightId});if(serial!==this.serial)return;this.players=data.players;this.fill('fflogs-player',this.playerOptions(),'');this.updateMetadata();this.message('请选择要导入的玩家，职业会自动识别。');}
      catch(e){if(serial===this.serial)this.message(e.message);}
    }
    async import(){
      if(!this.loadedURL||!$('fflogs-player').value)return;const serial=++this.serial;$('fflogs-import').disabled=true;this.message('正在读取全部施法分页并生成技能轴…');
      try{const data=await this.request('casts',{url:this.loadedURL,fightId:Number($('fflogs-fight').value),playerId:Number($('fflogs-player').value)});if(serial!==this.serial)return;
        const result=this.receive(data.record);this.message(result.saved?'已导入所选角色。':'已生成预览；存在未识别技能，请在文件导入区核对后保存。');
      }catch(e){if(serial===this.serial)this.message(e.message);}finally{if(serial===this.serial)$('fflogs-import').disabled=!$('fflogs-player').value;}
    }
  }
  A.FFLogsUI=FFLogsUI;
})();
