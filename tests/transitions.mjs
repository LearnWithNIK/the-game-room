import assert from 'node:assert/strict';
import {freshRoom,applyAction,setTrump,tick,publicView,playCard} from '../lib/game.ts';
import {previewMove} from '../lib/client-state.ts';
const card=(suit,rank)=>({suit,rank,id:suit+rank});
const r=freshRoom('ABCDEF',{id:'host',name:'Host',seen:1000});
applyAction(r,'host','seat',0,1000);applyAction(r,'host','start',null,1000);setTrump(r,'S',1000);
r.phase='trick';r.tricks=[6,3];r.trick=[{seat:0,card:card('S',14)},{seat:1,card:card('S',2)},{seat:2,card:card('H',14)},{seat:3,card:card('D',14)}];r.due=2000;
tick(r,2000);assert.equal(r.phase,'round');assert.equal(r.trump,null);assert.equal(r.winner,0);
tick(r,r.due);assert.equal(r.phase,'trump');assert.equal(r.trump,null);assert.equal(r.chooser%2,0);assert.deepEqual(r.hands.map(h=>h.length),[5,5,5,5]);
assert.equal(publicView(r,'host',r.due).reserve,undefined);
for(const team of [0,1]){
 r.phase='match';r.matchWinner=team;r.trump='H';applyAction(r,'host','again',null,5000);assert.equal(r.trump,null);
 applyAction(r,'host','start',null,6000);assert.equal(r.chooser%2,team);assert.equal(r.phase,'trump');assert.equal(r.trump,null);
}
setTrump(r,'S',6000);r.turn=0;r.trick=[];
const view=publicView(r,'host',6000);const id=view.legal[0];const snapshot=JSON.stringify(view);
const preview=previewMove(view,id,6000);assert.equal(preview.hand.length,12);assert.equal(preview.trick[0].card.id,id);assert.equal(preview.turn,1);assert.equal(preview.legal.length,0);assert.equal(JSON.stringify(view),snapshot);
playCard(r,0,id,6000);const confirmed=publicView(r,'host',6000);assert.deepEqual(preview.hand,confirmed.hand);assert.deepEqual(preview.trick,confirmed.trick);
assert.equal(previewMove(view,'invalid',6000),view);
console.log('PASS: round boundary clears old trump, fresh five-card selection, next-match winner selects trump, instant legal preview matches server, illegal preview rejected.');
