import assert from 'node:assert/strict';
import {freshRoom,applyAction,botCard,botTrump,legalCards,trickWinner,tick,publicView,startRound,playCard,setTrump} from '../lib/game.ts';
const card=(suit,rank)=>({id:suit+rank,suit,rank});
const trick=(...cards)=>cards.map((card,seat)=>({seat,card}));
assert.equal(trickWinner(trick(card('H',14),card('S',2),card('D',14),card('S',3)),'S'),3);
assert.equal(trickWinner(trick(card('H',3),card('D',14),card('H',11),card('C',14)),'S'),2);
const room=freshRoom('ABCDEF',{id:'host',name:'Host',seen:1000});
assert.throws(()=>applyAction(room,'host','start',null,1000));
applyAction(room,'host','seat',0,1000);
room.players.push({id:'guest',name:'Guest',seen:1000});applyAction(room,'guest','seat',2,1000);
assert.throws(()=>applyAction(room,'guest','seat',0,1000));
applyAction(room,'host','start',null,1000);
assert.deepEqual(room.hands.map(h=>h.length),[5,5,5,5]);
assert.deepEqual(room.reserve.map(h=>h.length),[8,8,8,8]);
assert.equal(new Set([...room.hands.flat(),...room.reserve.flat()].map(c=>c.id)).size,52);
assert.deepEqual(room.seats.map(s=>s.bot),[false,true,false,true]);
const view=publicView(room,'host',1000);
assert.equal(view.hand.length,5);assert.ok(!('hands' in view));assert.ok(!('reserve' in view));assert.ok(!('players' in view));
assert.equal(publicView(room,'waiting',1000).hand.length,0);
assert.throws(()=>applyAction(room,'guest','seat',3,1000));
const chooser=room.chooser;setTrump(room,'S',1000);assert.equal(room.turn,chooser);
assert.deepEqual(room.hands.map(h=>h.length),[13,13,13,13]);
room.turn=1;room.trick=[{seat:0,card:card('H',14)}];room.hands[1]=[card('H',2),card('S',14),card('D',2)];
assert.deepEqual(legalCards(room,1).map(c=>c.id),['H2']);
assert.throws(()=>playCard(room,1,'S14',1100));
room.hands[1]=[card('S',14),card('D',2)];assert.equal(legalCards(room,1).length,2);
playCard(room,1,'D2',1100);assert.equal(room.turn,2);
room.turn=0;room.trick=[];room.hands[0]=[card('S',2),card('H',14)];room.deadline=30000;room.due=2000;room.players[0].seen=1000;
assert.equal(tick(room,1999),false);assert.equal(tick(room,10000),true); // disconnect cover
room.phase='play';room.turn=0;room.trick=[];room.hands[0]=[card('S',2)];room.players[0].seen=30000;room.deadline=30000;
assert.equal(tick(room,30000),true); // connected player's timeout
let finished=0;
for(let match=0;match<100;match++){
 const r=freshRoom('ABCDEF',{id:'h',name:'Human',seen:0});r.seats[0].player='h';applyAction(r,'h','start',null,1000);
 let t=1000;let steps=0;
 while(r.phase!=='match'&&steps++<2000){
  if(r.phase==='trump'){assert.deepEqual(r.hands.map(h=>h.length),[5,5,5,5]);const s=botTrump(r);setTrump(r,s,t);assert.deepEqual(r.hands.map(h=>h.length),[13,13,13,13]);}
  else if(r.phase==='play'){const c=botCard(r);assert.ok(legalCards(r,r.turn).some(x=>x.id===c.id));playCard(r,r.turn,c.id,t);}
  else if(r.phase==='trick'){const winner=trickWinner(r.trick,r.trump);t=r.due;tick(r,t);assert.equal(r.turn,winner);assert.ok(Math.max(...r.tricks)<=7);}
  else if(r.phase==='round'){assert.equal(r.tricks[r.winner],7);const winner=r.winner;t=r.due;tick(r,t);assert.equal(r.chooser%2,winner);}
  t+=10;
 }
 assert.equal(r.phase,'match');assert.equal(r.wins[r.matchWinner],3);assert.ok(r.round>=3&&r.round<=5);
 applyAction(r,'h','again',null,t);assert.equal(r.phase,'lobby');assert.equal(r.hands.flat().length,0);finished++;
}
console.log(`PASS: ${finished} complete matches, staged dealing, private hands, legal moves, trump, clockwise turns, timeout, disconnect and winning-team selection.`);
