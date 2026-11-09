const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(process.argv[2],'utf8');
let tests=0;
function test(name,fn){fn(); tests++;console.log('PASS '+name)}
function setup(){
 let timers=new Map(),iid=0,sent=[],alerts=[],logs=[],qty=100,home=true,vis=false;
 const chain={length:0,remove(){return this},find(){return this},off(){return this},on(){return this},one(){return this},each(){return this},hide(){return this},attr(){return undefined},data(){return undefined},is(){return vis},hasClass(){return false},prop(){return this},modal(){return this}};
 const $=()=>chain; $.isArray=Array.isArray;$.extend=Object.assign;
 const res={HasPlayerResource:(name,n)=>n<=qty,GetResources_Vector:()=>[{name_string:'Gunpowder',amount:7}]};
 const econ={GetResourcesDefaultDefinition:(name)=>['Fish','Coin','Gunpowder'].includes(name)?{}:null};
 function VO(){}
 const gi={mCurrentViewedZoneID:9,mHomePlayer:{mAvailableBuffs_vector:[]},mCurrentPlayer:{mAvailableBuffs_vector:[]},mCurrentPlayerZone:{GetResources:()=>res},isOnHomzone:()=>home,mClientMessages:{SendMessagetoServer:(id,z,vo)=>sent.push({id,z,vo})}};
 const c={window:null,game:{gi,def:()=>VO,getResources:()=>res,showAlert:m=>alerts.push(m)},swmmo:{getDefinitionByName:()=>econ},loca:{GetText:(g,id)=>id},settings:{settings:{},read:()=>null,store:()=>{}},addToolsMenuItem:()=>{},debug:m=>logs.push(m),console,$,document:{},setTimeout:(fn,ms)=>{timers.set(++iid,{fn,ms,interval:false});return iid},clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>{timers.set(++iid,{fn,ms,interval:true});return iid},clearInterval:id=>timers.delete(id),utils:{getImage:bd=>bd.tag},assets:{GetResourceIcon:()=>({width:24,height:24,tag:'RESOURCE'}),GetBuffIcon:()=>({width:24,height:24,tag:'ADVENTURE'})}};
 c.window=c;
 let instrument=source.replace('        init:                 init,',`        _test: { timers: function(){return [_timeouts.length,_intervals.length];}, later:setTimeout, repeat:setInterval,
            service:TradeService, validator:TradeValidator, stocks:GameDataSource.getPlayerStockMap,
            star:getStarBuffs, icon:getItemIconTag, cachedIcon:getCachedIconTag,
            configure:function(x){ SlotCapacity=x.slots; UserTradesReader=x.reader; TradeOfferFactory=x.factory; TradeResources=x.resources; TradeValidator=x.validator || TradeValidator; if(x.renderer) UIRenderer=x.renderer; },
            resources:TradeResources, settings:SettingsService, actions:ActionsService, retire:retireModal },\n        init:                 init,`);
 instrument=instrument.replace('return { init: init };','return { init: init, _sort: handleSortTrades };');
 vm.createContext(c);vm.runInContext(instrument,c);sent.length=0;
 const st=c.ShortcutTrader._test;
 function defaults(extra={}){
  const x={slots:{getRemainingMarketCapacity:()=>10,getBusyMarketSlotKeys:()=>({}),resolveSlot:()=>({slotType:0,slotPos:0}),getMaxCoinsSlots:()=>10},reader:{getBusyMarketSlotKeys:()=>({}),notePlaced:()=>{},getCountActiveTrades:()=>0},factory:{create:t=>({amount:t.offerResAmount}),applyMarketRecipient:()=>{},applyFriendRecipient:()=>{}},resources:{getResourceDef:()=>({}),hasBuffAmount:()=>true}};
  Object.assign(x,extra);st.configure(x);
 }
 defaults();
 const trade=(n=10)=>({offerResName:'Fish',costResName:'Coin',offerResAmount:n,costResAmount:1,userId:0,UserName:1});
 function tick(){const [id,t]=[...timers].find(([,t])=>!t.interval)||[]; assert(id,'no scheduled timeout');timers.delete(id);t.fn();return t.ms;}
 return {c,st,trade,sent,alerts,logs,timers,tick,defaults,setQty:n=>qty=n,setHome:b=>home=b};
}
test('no synthetic trade injection or shared TimedQueue',()=>{assert(!source.includes('LocalTradeInjector'));assert(!source.includes('new TimedQueue'));});
test('no Gunpowder recursion regression; resource and adventure icon caches separate',()=>{const x=setup();assert.equal(x.st.icon('Gunpowder','resource','34px'),'RESOURCE');assert.equal(x.st.icon('Adventure_Gunpowder','adventure','34px'),'ADVENTURE');assert.equal(x.st.cachedIcon('Gunpowder','buff','34px'),'');assert.equal(x.st.cachedIcon('Gunpowder','resource','34px'),'RESOURCE');});
test('empty star inventory remains authoritative',()=>{const x=setup();x.c.game.gi.mHomePlayer.mAvailableBuffs_vector=[{amount:50}];assert.equal(x.st.star().length,0)});
test('Gunpowder stock does not merge adventure with warehouse',()=>{const x=setup();x.c.game.gi.mCurrentPlayer.mAvailableBuffs_vector=[{GetType:()=> 'Adventure',GetResourceName_string:()=> 'Gunpowder',GetAmount:()=>3}];const m=x.st.stocks(true);assert.equal(m.Gunpowder,7);assert.equal(m.Adventure_Gunpowder,3)});
test('queue sends first immediately and next after 3000ms; rejects overlap',()=>{const x=setup();x.st.service.send([x.trade(),x.trade()]);assert.equal(x.sent.length,1);assert(x.c.ShortcutTrader.isSending());x.st.service.send([x.trade()]);assert.equal(x.sent.length,1);assert.equal(x.tick(),3000);assert.equal(x.sent.length,2);x.tick();assert(!x.c.ShortcutTrader.isSending());assert.deepEqual(x.sent.map(r=>r.id),[1049,1049,1062,1061]);assert.equal(x.timers.size,0)});
test('Stop cancels unsent trades',()=>{const x=setup();x.st.service.send([x.trade(),x.trade()]);x.c.ShortcutTrader.stop();assert.equal(x.timers.size,0);assert.equal(x.sent.length,1);assert(!x.c.ShortcutTrader.isSending())});
test('zone change stops queue before second send',()=>{const x=setup();x.st.service.send([x.trade(),x.trade()]);x.c.game.gi.mCurrentViewedZoneID=12;x.tick();assert.equal(x.sent.length,1);assert(!x.c.ShortcutTrader.isSending())});
test('leaving home stops queue',()=>{const x=setup();x.st.service.send([x.trade(),x.trade()]);x.setHome(false);x.tick();assert.equal(x.sent.length,1);assert(!x.c.ShortcutTrader.isSending())});
test('aggregate warehouse reservation rejects overcommit',()=>{const x=setup();x.setQty(15);x.st.service.send([x.trade(),x.trade()]);assert.equal(x.sent.length,1);x.tick();assert(!x.c.ShortcutTrader.isSending());assert.equal(x.sent.filter(t=>t.id===1049).length,1)});
test('buff reservation includes lots and preceding offers',()=>{const x=setup();let required=[];x.defaults({resources:{getResourceDef:()=>null,hasBuffAmount:(n,a)=>{required.push(a);return a<=15}}});const t=x.trade();t.UserName=2;x.st.service.send([t,x.trade()]);assert.deepEqual(required,[20,10]);assert.equal(x.sent.length,1)});
test('batch snapshots trade data',()=>{const x=setup();const a=x.trade(),b=x.trade(11);x.st.service.send([a,b]);b.offerResAmount=999;x.tick();assert.equal(x.sent[1].vo.amount,11)});
test('send exception stops without retry',()=>{const x=setup();x.c.game.gi.mClientMessages.SendMessagetoServer=()=>{throw Error('mock failure')};x.st.service.send([x.trade(),x.trade()]);assert(!x.c.ShortcutTrader.isSending());assert.equal(x.timers.size,0);assert.equal(x.logs.length,1)});
test('invalid integers, amounts, recipients and lots rejected',()=>{const x=setup();for(const patch of [{offerResAmount:0},{offerResAmount:-1},{offerResAmount:NaN},{offerResAmount:1.5},{costResAmount:Infinity},{userId:NaN},{userId:-1},{UserName:5}]){assert.equal(x.st.validator.isTradeAllowed(Object.assign(x.trade(),patch)),false)}assert(x.st.validator.isTradeAllowed(x.trade()))});
test('dispose clears owned timers and invalidates callbacks',()=>{const x=setup();let calls=0;x.st.later(()=>calls++,25);x.st.repeat(()=>calls++,50);x.st.service.send([x.trade(),x.trade()]);const late=[...x.timers.values()].map(t=>t.fn);x.c.ShortcutTrader.dispose();assert.equal(x.timers.size,0);late.forEach(f=>f());assert.equal(calls,0);assert.equal(x.sent.length,1);x.c.ShortcutTrader.dispose();assert.equal(x.timers.size,0)});
test('reload disposes previous module, re-registers menu without sending trade',()=>{const x=setup();x.st.service.send([x.trade(),x.trade()]);vm.runInContext(source,x.c);assert.equal(x.timers.size,0);assert.equal(x.sent.filter(r=>r.id===1049).length,1)});
test('closed window does not start a slot watcher',()=>{const x=setup();x.st.service.watchSlots();assert.equal(x.timers.size,0)});
test('actual drag handler preserves next target identity',()=>{const x=setup();x.defaults({renderer:{renderBody:()=>{}}});const a=[{id:'a'},{id:'b'},{id:'c'},{id:'d'}];x.st.settings.getState().tradesData.marketTrades=a;const next={length:1,data:()=>2};const ui={item:{find:()=>({data:()=>0}),nextAll:()=>({find:()=>({first:()=>next})})}};x.st.actions._sort(null,ui);assert.deepEqual(a.map(t=>t.id),['b','a','c','d']);});
function modalRoot(shown,inClass){
 const handlers={},attrs={};
 const r={length:1,removed:false,hides:0,modalState:{isShown:shown},find:()=>({prop:()=>{}}),attr:function(k,v){if(v===undefined)return attrs[k];attrs[k]=v;return this},data:()=>r.modalState,is:()=>true,hasClass:()=>inClass,one:function(e,f){handlers[e.split('.')[0]]=f;return this},remove:function(){this.removed=true;return this},modal:function(){this.hides++;this.modalState.isShown=false;return this},fire:function(e){if(handlers[e])handlers[e]()}};
 return r;
}
test('retire visible modal preserves it until hidden and hides only once',()=>{const x=setup(),r=modalRoot(true,true);x.st.retire(r);x.st.retire(r);assert.equal(r.hides,1);assert(!r.removed);r.fire('hidden');assert(r.removed)});
test('retire already hiding modal does not invoke duplicate stage hide',()=>{const x=setup(),r=modalRoot(false,true);x.st.retire(r);assert.equal(r.hides,0);assert(!r.removed);r.fire('hidden');assert(r.removed)});
test('retire during show transition waits for shown before hiding',()=>{const x=setup(),r=modalRoot(true,false);x.st.retire(r);assert.equal(r.hides,0);r.fire('shown');assert.equal(r.hides,1);r.fire('hidden');assert(r.removed)});
console.log('TOTAL '+tests+' tests passed; mocks only, no AIR/server access');
