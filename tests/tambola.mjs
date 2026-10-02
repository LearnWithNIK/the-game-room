import assert from 'node:assert/strict';
import {action,claim,createRoom,qualified,shuffle,ticket,tick,view} from '../lib/tambola.ts';
const host={id:'host',name:'Host',seen:0};
for(let i=0;i<500;i++){const t=ticket();const n=t.flat().filter(x=>x!==null);assert.equal(n.length,15);assert.equal(new Set(n).size,15);for(const row of t)assert.equal(row.filter(x=>x!==null).length,5);for(let c=0;c<9;c++){const col=t.map(r=>r[c]).filter(x=>x!==null);assert.ok(col.length>=1&&col.length<=3);assert.deepEqual(col,[...col].sort((a,b)=>a-b));}}
const r=createRoom('ABCDEF',host);action(r,'host','seat',0,0);action(r,'host','start',null,0);assert.equal(r.tickets.length,4);assert.equal(r.drawOrder.length,90);assert.equal(new Set(r.drawOrder).size,90);assert.equal(view(r,'host',0).ticket,r.tickets[0]);assert.equal(view(r,'stranger',0).ticket,null);assert.ok(!('tickets' in view(r,'host',0)));assert.ok(!('drawOrder' in view(r,'host',0)));
assert.equal(tick(r,7999),false);assert.equal(tick(r,8000),true);assert.equal(r.drawn.length,1);assert.equal(r.nextDraw,16000);assert.throws(()=>action(r,'host','mark',r.drawOrder[1],8001));
const own=r.tickets[0].flat().find(x=>x!==null&&r.drawn.includes(x));if(own){action(r,'host','mark',own,8000);assert.ok(r.marks[0].includes(own));action(r,'host','mark',own,8000);assert.ok(!r.marks[0].includes(own));}
// Shared claims on the same call, but not on a later call.
r.tickets[0]=[[1,2,3,4,5,null,null,null,null],[6,7,8,9,10,null,null,null,null],[11,12,13,14,15,null,null,null,null]];
r.tickets[1]=r.tickets[0];r.drawn=[1,2,3,4,5];r.marks[0]=[1,2,3,4,5];r.marks[1]=[1,2,3,4,5];assert.equal(qualified(r,0,'early'),true);claim(r,0,'early');claim(r,1,'early');assert.equal(r.claims.length,2);r.drawn.push(6);assert.throws(()=>claim(r,2,'early'));
console.log('PASS: 500 valid tickets, private ticket views, bot fill, 8s draw, mark/unmark validation, shared same-call claim.');
