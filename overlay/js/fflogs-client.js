(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else Object.assign(root.Axis=root.Axis||{},api);})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const HOSTS=new Set(['fflogs.com','www.fflogs.com','cn.fflogs.com','ja.fflogs.com','fr.fflogs.com','de.fflogs.com','kr.fflogs.com']);
  const JOBS=Object.fromEntries(['Paladin:PLD','Warrior:WAR','DarkKnight:DRK','Gunbreaker:GNB','WhiteMage:WHM','Scholar:SCH','Astrologian:AST','Sage:SGE','Monk:MNK','Dragoon:DRG','Ninja:NIN','Samurai:SAM','Reaper:RPR','Viper:VPR','Bard:BRD','Machinist:MCH','Dancer:DNC','BlackMage:BLM','Summoner:SMN','RedMage:RDM','Pictomancer:PCT','BlueMage:BLU'].map(s=>s.split(':')));
  const REPORT='query AxisReport($code:String!){reportData{report(code:$code){title startTime zone{id name} fights{id name encounterID startTime endTime kill difficulty} masterData(translate:false){abilities{gameID name}}}}}';
  const PLAYERS='query AxisPlayers($code:String!,$fight:Int!){reportData{report(code:$code){fights(fightIDs:[$fight]){id name encounterID startTime endTime combatTime kill difficulty} playerDetails(fightIDs:[$fight],includeCombatantInfo:false)}}}';
  const CASTS='query AxisCasts($code:String!,$fight:Int!,$player:Int!,$start:Float,$end:Float){reportData{report(code:$code){events(fightIDs:[$fight],sourceID:$player,dataType:Casts,startTime:$start,endTime:$end,limit:10000){data nextPageTimestamp}}}}';
  function parseFFLogsURL(value){
    let u;try{u=new URL(String(value).trim());}catch(_){throw Error('报告网址无效');}
    if(u.protocol!=='https:'||!HOSTS.has(u.hostname)||u.username||u.password||u.port&&u.port!=='443')throw Error('请使用 FFLogs 官方 https 报告链接');
    const match=/^\/reports\/([A-Za-z0-9]{8,32})\/?$/.exec(u.pathname);if(!match)throw Error('链接需要指向一份 /reports/ 报告');
    const params=new URLSearchParams(u.search);new URLSearchParams(u.hash.replace(/^#\??/,'')).forEach((v,k)=>params.set(k,v));
    const number=k=>/^[1-9]\d{0,8}$/.test(params.get(k)||'')?Number(params.get(k)):null;
    return{host:u.hostname==='fflogs.com'?'www.fflogs.com':u.hostname,code:match[1],fight:number('fight'),last:params.get('fight')==='last',player:number('source')};
  }
  function flattenFFLogsPlayers(details){
    const found=new Map();function walk(v){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object'){if(Number.isInteger(v.id)&&JOBS[v.type])found.set(v.id,{id:v.id,name:String(v.name||'未知玩家'),job:JOBS[v.type],server:String(v.server||'')});else Object.values(v).forEach(walk);}}
    walk(details&&details.data&&details.data.playerDetails);return [...found.values()].sort((a,b)=>a.job.localeCompare(b.job)||a.name.localeCompare(b.name));
  }
  class FFLogsClient{
    constructor(config={},transport){this.config={...config};this.fetch=transport||((...args)=>fetch(...args));this.token='';this.expires=0;this.cache=new Map();}
    get configured(){return Boolean(this.config.accessToken||this.config.clientId&&this.config.clientSecret);}
    async json(url,body,headers){
      for(let attempt=0;attempt<2;attempt++){
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);let response;
        try{response=await this.fetch(url,{method:'POST',headers,body,signal:controller.signal,credentials:'omit'});}
        catch(e){clearTimeout(timer);if(attempt===0)continue;throw Error('无法连接 FFLogs。请检查网络；若浏览器限制了本地请求，请在 ACT 浮窗内重试。');}
        clearTimeout(timer);
        if([502,503,504].includes(response.status)&&attempt===0)continue;
        if(!response.ok)throw Error(({401:'V2 授权失败或令牌已过期，请核对 API 设置',403:'FFLogs 拒绝访问，请检查报告权限和 API 配置',404:'未找到这份 FFLogs 报告',429:'FFLogs 请求额度已用完，请稍后重试'})[response.status]||'FFLogs 返回 HTTP '+response.status);
        try{return await response.json();}catch(_){throw Error('FFLogs 未返回有效 JSON，请检查网络');}
      }
    }
    async configure(input){
      const previous=this.config,token=String(input.accessToken||'').trim().replace(/^Bearer\s+/i,'');
      const next=token?{accessToken:token}:{clientId:String(input.clientId||previous.clientId||'').trim(),clientSecret:String(input.clientSecret||(!input.clientId||input.clientId===previous.clientId?previous.clientSecret:'')||'').trim()};
      if(!token&&!next.clientId&&!next.clientSecret&&previous.accessToken)next.accessToken=previous.accessToken;
      if(!next.accessToken&&(!next.clientId||!next.clientSecret))throw Error('请填写 V2 Client ID 和 Client Secret，或 V2 Access Token');
      this.config=next;this.token='';this.expires=0;this.cache.clear();
      try{await this.accessToken();}catch(e){this.config=previous;throw e;}return{configured:true};
    }
    async accessToken(){
      if(this.config.accessToken)return this.config.accessToken;
      if(!this.configured)throw Error('请先填写 FFLogs V2 API 配置');
      if(this.token&&Date.now()<this.expires)return this.token;
      const data=await this.json('https://www.fflogs.com/oauth/token','grant_type=client_credentials',{'Content-Type':'application/x-www-form-urlencoded','Authorization':'Basic '+btoa(this.config.clientId+':'+this.config.clientSecret)});
      if(typeof data.access_token!=='string')throw Error('未取得 FFLogs 访问令牌');this.token=data.access_token;this.expires=Date.now()+Math.max(1,Number(data.expires_in||3600)-60)*1000;return this.token;
    }
    async query(host,query,variables){
      if(!HOSTS.has(host))throw Error('不支持的 FFLogs 站点');
      const data=await this.json('https://'+host+'/api/v2/client',JSON.stringify({query,variables}),{'Content-Type':'application/json','Authorization':'Bearer '+await this.accessToken()});
      if(data.errors)throw Error(data.errors.map(e=>e.message).join('；').slice(0,500));
      const report=data.data&&data.data.reportData&&data.data.reportData.report;if(!report)throw Error('报告不存在或无权读取；此入口支持公开报告');return report;
    }
    async reportData(parsed){const key=parsed.host+':'+parsed.code;if(!this.cache.has(key)){const r=await this.query(parsed.host,REPORT,{code:parsed.code});if(this.cache.size>15)this.cache.clear();this.cache.set(key,r);}return this.cache.get(key);}
    async report(url){
      const p=parseFFLogsURL(url),r=await this.reportData(p),fights=(r.fights||[]).filter(f=>Number.isInteger(f.id));if(!fights.length)throw Error('报告里没有可导入战斗');
      const selected=p.fight||(p.last?Math.max(...fights.map(f=>f.id)):fights[0].id);if(!fights.some(f=>f.id===selected))throw Error('报告里找不到链接指定的战斗');
      const details=await this.players(url,selected);
      return{title:r.title,zone:r.zone,fights,selectedFight:selected,players:details.players,selectedPlayer:details.players.some(v=>v.id===p.player)?p.player:null};
    }
    async players(url,fightId){
      if(!Number.isSafeInteger(fightId)||fightId<=0)throw Error('战斗 ID 无效');const p=parseFFLogsURL(url),r=await this.query(p.host,PLAYERS,{code:p.code,fight:fightId}),fight=(r.fights||[]).find(f=>f.id===fightId);
      if(!fight)throw Error('未找到所选战斗');const players=flattenFFLogsPlayers(r.playerDetails);if(!players.length)throw Error('未找到可识别职业的玩家');return{fight,players};
    }
    async casts(url,fightId,playerId){
      const p=parseFFLogsURL(url),metadata=await this.reportData(p),details=await this.players(url,fightId),fight=details.fight,player=details.players.find(v=>v.id===playerId);if(!player)throw Error('所选角色不在这场战斗里');
      let start=null,complete=false;const events=[];
      for(let n=0;n<100;n++){
        const r=await this.query(p.host,CASTS,{code:p.code,fight:fightId,player:playerId,start,end:fight.endTime}),page=r.events||{};if(!Array.isArray(page.data))throw Error('施法事件格式异常');events.push(...page.data);if(events.length>200000)throw Error('施法数量超出限制，未保存不完整数据');
        const next=page.nextPageTimestamp;if(next==null||next>fight.endTime){complete=true;break;}if(typeof next!=='number'||start!==null&&next<=start)throw Error('施法分页未前进，未保存不完整数据');start=next;
      }
      if(!complete)throw Error('施法分页超出限制，未保存不完整数据');
      const names=new Map(((metadata.masterData||{}).abilities||[]).map(a=>[a.gameID,a.name||''])),seen=new Set(),actions=[],combatStart=Number.isFinite(fight.combatTime)&&fight.combatTime>0?fight.endTime-fight.combatTime:fight.startTime;
      events.sort((a,b)=>a.timestamp-b.timestamp).forEach(e=>{
        const id=e.abilityGameID;if(e.type!=='cast'||e.sourceID!==playerId||!Number.isInteger(id)||id===7||id===8)return;
        const key=e.timestamp+':'+id;if(seen.has(key))return;seen.add(key);const name=names.get(id)||'';
        actions.push(/\b(tincture|gemdraught)\b|[力巧智意耐]力之[幻宝灵]药/i.test(name)?{type:'Skill',skillName:'Tincture',atMs:Math.round(e.timestamp-combatStart)}:{type:'Skill',skillId:id,skillName:name||String(id),atMs:Math.round(e.timestamp-combatStart)});
      });
      if(!actions.length)throw Error('该角色没有完成施法事件');const zone=metadata.zone||{},encounter={name:fight.name,id:fight.encounterID,zoneId:zone.id,zoneName:zone.name,playerName:player.name,playerId,fightId,reportCode:p.code,source:'fflogs'};
      return{record:{name:fight.name+' · '+player.job+' · '+player.name,fileType:'Record',config:{job:player.job},durationMs:fight.endTime-combatStart,encounter,actions},castCount:actions.length,player,fight,zone};
    }
  }
  return{FFLogsClient,parseFFLogsURL,flattenFFLogsPlayers};
});
