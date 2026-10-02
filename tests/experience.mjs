import assert from 'node:assert/strict';
const origin='http://localhost:5173';
async function req(cookie,path,body){const r=await fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]??cookie};}
const host=await req('','/api/rooms',{name:'Host',settings:{tricksToWin:3,bestOf:3},teamNames:['Royal Aces','Emerald Kings']});assert.equal(host.status,201);assert.deepEqual(host.data.settings,{tricksToWin:3,bestOf:3});assert.deepEqual(host.data.teamNames,['Royal Aces','Emerald Kings']);
const guest=await req('','/api/rooms',{name:'Guest',code:host.data.code});assert.equal(guest.status,200);assert.deepEqual(guest.data.teamNames,host.data.teamNames);
let chat=await req(host.cookie,'/api/rooms/'+host.data.code,{action:'chat',value:'Good luck!'});assert.equal(chat.status,200);assert.equal(chat.data.chat.at(-1).text,'Good luck!');assert.equal((await req(host.cookie,'/api/rooms/'+host.data.code,{action:'chat',value:'Again'})).status,400);
chat=await req(guest.cookie,'/api/rooms/'+host.data.code,{action:'chat',value:'You too!'});assert.equal(chat.status,200);assert.equal(chat.data.chat.length,2);assert.ok(!('players' in chat.data));assert.ok(!('hands' in chat.data));
assert.equal((await req('','/api/rooms',{name:'Invalid',settings:{tricksToWin:8,bestOf:3}})).status,400);assert.equal((await req('','/api/rooms',{name:'Invalid',teamNames:['', 'Team']})).status,400);
console.log('PASS: pre-room format, team names, guest inheritance, shared chat, spam limit, invalid setup, hidden hands.');
