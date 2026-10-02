import assert from 'node:assert/strict';
const origin=process.env.TURUP_TEST_ORIGIN || 'http://localhost:5173';
const session=()=>({cookie:''});
async function request(s,path,body,expected=200){
 const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(s.cookie?{Cookie:s.cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const set=r.headers.get('set-cookie');if(set)s.cookie=set.split(';')[0];
 const data=await r.json();if(expected)assert.equal(r.status,expected,JSON.stringify(data));return {status:r.status,data};
}
const a=session(),b=session(),c=session(),late=session();
let {data:room}=await request(a,'/api/rooms',{name:'Host'},201);const path='/api/rooms/'+room.code;
await request(b,'/api/rooms',{name:'Partner',code:room.code});
await request(c,'/api/rooms',{name:'Challenger',code:room.code});
const claims=await Promise.all([request(a,path,{action:'seat',value:0},0),request(b,path,{action:'seat',value:0},0)]);
assert.equal(claims.filter(r=>r.status===200).length,1);assert.equal(claims.filter(r=>r.status===400).length,1);
// Fix independent seats whichever request won the race.
await request(a,path,{action:'seat',value:2});await request(b,path,{action:'seat',value:0});
await request(a,path,{action:'start'});room=(await request(a,path)).data;
assert.equal(room.seats.filter(s=>s.bot).length,2);assert.equal(room.hand.length,5);
const partner=(await request(b,path)).data;assert.equal(partner.me,0);assert.equal(room.me,2);
assert.equal(new Set([...room.hand,...partner.hand].map(c=>c.id)).size,10);
for(const hidden of ['hands','reserve','players']){assert.ok(!(hidden in room));assert.ok(!(hidden in partner));}
await request(late,'/api/rooms',{name:'Late arrival',code:room.code});const waiting=(await request(late,path)).data;
assert.equal(waiting.me,-1);assert.deepEqual(waiting.hand,[]);assert.equal((await request(late,path,{action:'seat',value:1},0)).status,400);
assert.equal((await request(session(),path,undefined,0)).status,401);
let t=0;
while(room.phase==='trump'&&t++<30){
 const who=room.chooser===2?a:room.chooser===0?b:null;
 if(who){await request(who,path,{action:'trump',value:'S',turnKey:room.turnKey});break;}
 await new Promise(r=>setTimeout(r,200));room=(await request(a,path)).data;
}
room=(await request(a,path)).data;assert.equal(room.phase,'play');assert.equal(room.hand.length,13);
// Let bots lead if necessary, keeping both humans connected.
for(t=0;t<40 && ![0,2].includes(room.turn);t++){
 await new Promise(r=>setTimeout(r,150));await request(b,path);room=(await request(a,path)).data;
}
const current=room.turn===2?a:b;const currentView=(await request(current,path)).data;
assert.ok(currentView.legal.length);const cardId=currentView.legal[0];
const stale=await request(current,path,{action:'play',value:cardId,turnKey:'stale'},0);assert.equal(stale.status,409);
const invalid=await request(current,path,{action:'play',value:'BAD',turnKey:currentView.turnKey},0);assert.equal(invalid.status,400);
const moveId=crypto.randomUUID();
const played=await request(current,path,{action:'play',value:cardId,turnKey:currentView.turnKey,requestId:moveId});assert.equal(played.data.hand.length,12);
const replayed=await request(current,path,{action:'play',value:cardId,turnKey:currentView.turnKey,requestId:moveId});
assert.equal(replayed.data.hand.length,12);assert.equal(replayed.data.revision,played.data.revision);
assert.equal((await request(current,path,{action:'play',value:cardId,turnKey:currentView.turnKey},0)).status,409);
// A committed action with a lost acknowledgement is retried with the same ID.
const retryId=crypto.randomUUID();
const first=await request(a,path,{action:'chat',value:'Retry test',requestId:retryId});
const retry=await request(a,path,{action:'chat',value:'Retry test',requestId:retryId});
assert.equal(retry.data.chat.filter(m=>m.text==='Retry test').length,1);
assert.equal(retry.data.revision,first.data.revision);
console.log('PASS: independent sessions, concurrent seat claims, two humans/two bots, private hands, late joins, authentication, trump selection, stale moves and legal card play. Room '+room.code);
