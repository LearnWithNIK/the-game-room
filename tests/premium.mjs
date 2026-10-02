import assert from 'node:assert/strict';
import {chooseBotCard} from '../lib/bot.ts';
import {freshRoom,applyAction,botCard,botTrump,setTrump,playCard,tick,publicView,matchSettings} from '../lib/game.ts';
import {tableAudioEvents} from '../lib/audio-events.ts';
import {sanitizeSound,TableAudio} from '../lib/audio.ts';
import {previewMove} from '../lib/client-state.ts';
const c=(suit,rank)=>({suit,rank,id:suit+rank});
const lead={seat:0,hand:[c('S',13),c('S',2),c('H',4)],trick:[],history:[],trump:'D'};
assert.notEqual(chooseBotCard(lead).id,'S13','Do not lead an exposed king with an unseen ace');
assert.equal(chooseBotCard({...lead,history:[[{seat:1,card:c('S',14)}]]}).id,'S13','Cash king after ace is accounted for');
assert.equal(chooseBotCard({seat:3,hand:[c('H',13),c('H',2)],trump:'S',history:[],trick:[{seat:1,card:c('H',14)},{seat:2,card:c('H',4)}]}).id,'H2','Keep high cards while partner wins');
assert.equal(chooseBotCard({seat:3,hand:[c('H',13),c('H',4)],trump:'S',history:[],trick:[{seat:0,card:c('H',10)},{seat:1,card:c('H',2)},{seat:2,card:c('H',12)}]}).id,'H13','A last-seat king wins even if ace is unseen');
assert.equal(chooseBotCard({seat:2,hand:[c('S',7),c('S',11),c('D',2)],trump:'S',history:[],trick:[{seat:0,card:c('H',14)},{seat:1,card:c('S',9)}]}).id,'S11','Use an adequate overtrump');
const human={id:'h',name:'Human',seen:0};
for(const bestOf of [1,3,5,7,9])for(const target of [1,3,5,7]){
 const r=freshRoom('ABCDEF',human);applyAction(r,'h','seat',0,0);
 assert.throws(()=>applyAction(r,'stranger','settings',{tricksToWin:target,bestOf},0));
 applyAction(r,'h','settings',{tricksToWin:target,bestOf},0);applyAction(r,'h','start',null,100);
 assert.throws(()=>applyAction(r,'h','settings',{tricksToWin:7,bestOf:5},100));
 let t=100,steps=0;
 while(r.phase!=='match'&&steps++<3000){
  if(r.phase==='trump')setTrump(r,botTrump(r),t);
  else if(r.phase==='play')playCard(r,r.turn,botCard(r).id,t);
  else {t=r.due;tick(r,t);}
  if(r.phase==='round'||r.phase==='match')assert.equal(r.tricks[r.winner],target);
  t+=10;
 }
 assert.equal(r.phase,'match');assert.equal(r.wins[r.matchWinner],Math.ceil(bestOf/2));assert.ok(r.round<=bestOf);
}
const legacy=freshRoom('ABCDEF',human);delete legacy.settings;assert.deepEqual(matchSettings(legacy),{tricksToWin:7,bestOf:5});
const bad=freshRoom('ABCDEF',human);for(const settings of [{tricksToWin:8,bestOf:5},{tricksToWin:0,bestOf:3},{tricksToWin:7,bestOf:2},{tricksToWin:7,bestOf:11}])assert.throws(()=>applyAction(bad,'h','settings',settings,0));
const r=freshRoom('ABCDEF',human);applyAction(r,'h','seat',0,0);const lobby=structuredClone(publicView(r,'h',0));applyAction(r,'h','start',null,10);const five=structuredClone(publicView(r,'h',10));
const deal=tableAudioEvents(lobby,five).filter(e=>e.sound==='deal');assert.equal(deal.length,5);assert.deepEqual(deal.map(e=>e.delay),[0,100,200,300,400]);
assert.deepEqual(tableAudioEvents(five,five),[],'Polling must not replay sound');assert.deepEqual(tableAudioEvents(null,five),[],'Reconnect must not replay old sound');
setTrump(r,'S',20);r.turn=0;const full=structuredClone(publicView(r,'h',20));const extra=tableAudioEvents(five,full);assert.equal(extra.filter(e=>e.sound==='deal').length,8);assert.equal(extra.filter(e=>e.sound==='draw').length,1);
const id=full.legal[0];const preview=previewMove(full,id,30);const first=tableAudioEvents(full,preview);assert.equal(first.filter(e=>e.sound==='play').length,1);
playCard(r,0,id,30);const confirmed=structuredClone(publicView(r,'h',30));assert.equal(tableAudioEvents(preview,confirmed).filter(e=>e.sound==='play').length,0,'Server confirmation must not duplicate optimistic sound');
const victory={...confirmed,phase:'match',matchWinner:0};assert.equal(tableAudioEvents(confirmed,victory).filter(e=>e.sound==='win').length,1);
assert.equal(tableAudioEvents(confirmed,{...victory,matchWinner:1}).filter(e=>e.sound==='lose').length,1);
assert.deepEqual(sanitizeSound({enabled:false,volume:170}),{enabled:false,volume:100});assert.deepEqual(sanitizeSound({volume:-10}),{enabled:true,volume:0});
// Audio engine should create no context or sound before a trusted gesture.
let created=0;globalThis.window={AudioContext:class {constructor(){created++;}}};const audio=new TableAudio();audio.play('deal');assert.equal(created,0);delete globalThis.window;
console.log('PASS: safer king leads, known-ace tracking, partner protection, legal overtrumping, 20 custom formats, defaults, settings authorization, staggered sounds, deduplication, reconnect silence, win/loss feedback and gesture gating.');

