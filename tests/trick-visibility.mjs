import assert from 'node:assert/strict';
import {freshRoom,playCard,tick} from '../lib/game.ts';
const r=freshRoom('ABCDEF',{id:'host',name:'Host',seen:1000});r.phase='play';r.trump='S';r.turn=3;
const card=(rank)=>({id:'S'+rank,suit:'S',rank});r.trick=[0,1,2].map(seat=>({seat,card:card(seat+2)}));r.hands[3]=[card(14)];
playCard(r,3,'S14',1000);assert.equal(r.phase,'trick');assert.equal(r.due,3000);assert.equal(r.trick.length,4);
for(const now of [1001,1850,2999]){assert.equal(tick(r,now),false);assert.equal(r.trick.length,4);assert.equal(r.tricks[1],0);}
assert.equal(tick(r,3000),true);assert.equal(r.lastTrick.length,4);assert.equal(r.trick.length,0);assert.equal(r.tricks[1],1);
console.log('PASS: fourth card and all four cards remain visible for two seconds before scoring and clearing.');
