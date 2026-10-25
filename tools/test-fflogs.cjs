const assert=require('node:assert/strict');
const {FFLogsClient,parseFFLogsURL,flattenFFLogsPlayers}=require('../overlay/js/fflogs-client.js');
const url='https://cn.fflogs.com/reports/9j8QGr2cN7PypWvg?fight=1';
const fight={id:1,name:'测试首领',encounterID:101,startTime:1000,endTime:101000,combatTime:100000};
const players={data:{playerDetails:{healers:[{id:2,name:'学者测试',type:'Scholar'},{id:3,name:'占星测试',type:'Astrologian'}]}}};
class Fake extends FFLogsClient{
 constructor(){super({accessToken:'test'});this.pages=[];this.starts=[];}
 async query(host,query,variables){
  if(query.includes('AxisReport'))return{title:'测试报告',zone:{id:73,name:'测试副本'},fights:[fight],masterData:{abilities:[{gameID:34000001,name:'Gemdraught of Mind'}]}};
  if(query.includes('AxisPlayers'))return{fights:[fight],playerDetails:players};
  this.starts.push(variables.start);return{events:this.pages.shift()};
 }
}
(async()=>{
 let count=0;async function check(name,fn){await fn();count++;console.log('PASS '+name);}
 await check('official report link with query and hash parameters',()=>{assert.equal(parseFFLogsURL(url+'&source=2').player,2);assert.equal(parseFFLogsURL(url.replace('?','#')).fight,1);});
 await check('untrusted hosts and malformed report links rejected',()=>{for(const u of ['http://cn.fflogs.com/reports/12345678','https://evil.test/reports/12345678','https://cn.fflogs.com.evil.test/reports/12345678','https://x:y@cn.fflogs.com/reports/12345678'])assert.throws(()=>parseFFLogsURL(u));});
 await check('healer jobs detected, pets excluded',()=>{assert.deepEqual(flattenFFLogsPlayers(players).map(p=>p.job),['AST','SCH']);assert.equal(flattenFFLogsPlayers({data:{playerDetails:{pets:[{id:8,type:'Pet'}]}}}).length,0);});
 await check('report does not silently choose a player',async()=>{assert.equal((await new Fake().report(url)).selectedPlayer,null);assert.equal((await new Fake().report(url+'&source=2')).selectedPlayer,2);});
 await check('paginated casts filtered to actor and completion, deduplicated',async()=>{const c=new Fake();c.pages=[{data:[{type:'cast',sourceID:2,abilityGameID:188,timestamp:11000},{type:'cast',sourceID:2,abilityGameID:188,timestamp:11000,targetID:4},{type:'begincast',sourceID:2,abilityGameID:188,timestamp:12000},{type:'cast',sourceID:3,abilityGameID:188,timestamp:13000}],nextPageTimestamp:50000},{data:[{type:'cast',sourceID:2,abilityGameID:25868,timestamp:51000}],nextPageTimestamp:null}];const r=await c.casts(url,1,2);assert.equal(r.castCount,2);assert.deepEqual(c.starts,[null,50000]);assert.deepEqual(r.record.actions.map(v=>v.atMs),[10000,50000]);assert.equal(r.record.config.job,'SCH');});
 await check('stalled pagination rejects incomplete results',async()=>{const c=new Fake();c.pages=[{data:[],nextPageTimestamp:1000},{data:[],nextPageTimestamp:1000}];await assert.rejects(()=>c.casts(url,1,2));});
 await check('named tinctures retained as timed prompts',async()=>{const c=new Fake();c.pages=[{data:[{type:'cast',sourceID:2,abilityGameID:34000001,timestamp:11000}],nextPageTimestamp:null}];const r=await c.casts(url,1,2);assert.equal(r.record.actions[0].skillName,'Tincture');assert.equal(r.record.actions[0].atMs,10000);});
 await check('network fetch retries once without any local proxy',async()=>{let calls=0;const c=new FFLogsClient({},async u=>{assert.ok(u.startsWith('https://www.fflogs.com/'));if(++calls===1)throw Error('reset');return{ok:true,status:200,json:async()=>({access_token:'test',expires_in:3600})};});await c.configure({clientId:'id',clientSecret:'secret'});assert.equal(calls,2);assert.equal(c.configured,true);});
 console.log(count+' direct FFLogs checks passed.');
})().catch(e=>{console.error(e);process.exit(1);});
