export type Prize='early'|'top'|'middle'|'bottom'|'house';
export type Player={id:string;name:string;seen:number};
export type Ticket=(number|null)[][];
export type Claim={prize:Prize;seat:number;draw:number};
export type Room={code:string;host:string;players:Player[];seats:(string|null)[];tickets:Ticket[];marks:number[][];drawOrder:number[];drawn:number[];nextDraw:number;phase:'lobby'|'play'|'finished';claims:Claim[]};
export const prizes:Prize[]=['early','top','middle','bottom','house'];
const random=(n:number)=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n};
export function shuffle<T>(items:T[]):T[]{const a=[...items];for(let i=a.length-1;i>0;i--){const j=random(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function ticket():Ticket {
  for(let attempt=0;attempt<10000;attempt++){
    const grid:Ticket=Array.from({length:3},()=>Array<number|null>(9).fill(null));
    const cells=shuffle(Array.from({length:27},(_,i)=>i));const chosen:number[]=[];const rows=[0,0,0],cols=Array(9).fill(0);
    // Guarantee one entry in each decade; randomise the remaining six cells.
    for(let col=0;col<9;col++){const options=shuffle([0,1,2]).filter(row=>rows[row]<5);if(!options.length)break;const row=options[0];chosen.push(row*9+col);rows[row]++;cols[col]++;}
    if(chosen.length!==9)continue;
    for(const cell of cells){const row=Math.floor(cell/9),col=cell%9;if(chosen.includes(cell)||rows[row]>=5||cols[col]>=3)continue;chosen.push(cell);rows[row]++;cols[col]++;if(Number(chosen.length)===15)break;}
    if(Number(chosen.length)!==15||rows.some(n=>n!==5))continue;
    for(let col=0;col<9;col++){const count=cols[col];const low=col===0?1:col*10;const high=col===8?90:col*10+9;const nums=shuffle(Array.from({length:high-low+1},(_,i)=>low+i)).slice(0,count).sort((a,b)=>a-b);const occupied=[0,1,2].filter(row=>chosen.includes(row*9+col));occupied.forEach((row,i)=>grid[row][col]=nums[i]);}
    return grid;
  }
  throw new Error('Could not prepare a ticket.');
}
export function createRoom(code:string,host:Player):Room {return {code,host:host.id,players:[host],seats:[null,null,null,null],tickets:[],marks:[[],[],[],[]],drawOrder:[],drawn:[],nextDraw:0,phase:'lobby',claims:[]};}
const numbers=(t:Ticket)=>t.flat().filter((n):n is number=>n!==null);
export function qualified(room:Room,seat:number,prize:Prize):boolean {
  const t=room.tickets[seat];if(!t)return false;const marked=new Set(room.marks[seat]);const all=(row:(number|null)[])=>row.every(n=>n===null||marked.has(n));
  if(prize==='early')return marked.size>=5;
  if(prize==='house')return numbers(t).every(n=>marked.has(n));
  return all(t[{top:0,middle:1,bottom:2}[prize]]);
}
export function claim(room:Room,seat:number,prize:Prize){
  if(!prizes.includes(prize)||!room.tickets[seat])throw new Error('Choose a valid prize.');
  if(!qualified(room,seat,prize))throw new Error('Your marked ticket does not qualify yet.');
  if(room.claims.some(c=>c.seat===seat&&c.prize===prize))throw new Error('You already claimed this prize.');
  const first=room.claims.find(c=>c.prize===prize);
  if(first&&first.draw!==room.drawn.length)throw new Error('This prize was won on an earlier number.');
  room.claims.push({seat,prize,draw:room.drawn.length});if(prize==='house')room.phase='finished';
}
export function tick(room:Room,now:number):boolean {
  if(room.phase!=='play'||now<room.nextDraw)return false;
  const number=room.drawOrder[room.drawn.length];if(number===undefined){room.phase='finished';return true;}
  room.drawn.push(number);room.nextDraw=now+8000;
  for(let seat=0;seat<4;seat++)if(room.seats[seat]===null){if(numbers(room.tickets[seat]).includes(number))room.marks[seat].push(number);for(const prize of prizes){if(qualified(room,seat,prize)&&!room.claims.some(c=>c.seat===seat&&c.prize===prize)){try{claim(room,seat,prize)}catch{}}}}
  if(room.drawn.length===90)room.phase='finished';return true;
}
export function action(room:Room,id:string,kind:string,value:unknown,now:number){
  const seat=room.seats.indexOf(id);const host=room.host===id;
  if(kind==='seat'){
    if(room.phase!=='lobby')throw new Error('Seats are available before a game starts.');
    if(!Number.isInteger(value)||Number(value)<0||Number(value)>3)throw new Error('Choose a seat.');const next=Number(value);
    if(room.seats[next]&&room.seats[next]!==id)throw new Error('That seat is taken.');if(seat>=0)room.seats[seat]=null;room.seats[next]=id;return;
  }
  if(kind==='start'){
    if(!host||seat<0||room.phase!=='lobby')throw new Error('The host must take a seat before starting.');
    room.tickets=Array.from({length:4},ticket);room.marks=[[],[],[],[]];room.drawOrder=shuffle(Array.from({length:90},(_,i)=>i+1));room.drawn=[];room.nextDraw=now+8000;room.claims=[];room.phase='play';return;
  }
  if(kind==='again'){
    if(!host||room.phase!=='finished')throw new Error('The host can open a new game after Full House.');
    room.phase='lobby';room.tickets=[];room.marks=[[],[],[],[]];room.drawn=[];room.drawOrder=[];room.claims=[];room.nextDraw=0;return;
  }
  if(seat<0)throw new Error('Take a seat before playing.');
  if(kind==='mark'){
    if(room.phase!=='play'&&room.phase!=='finished')throw new Error('The game has not started.');
    const n=Number(value);if(!Number.isInteger(n)||!numbers(room.tickets[seat]).includes(n))throw new Error('That number is not on your ticket.');
    if(!room.drawn.includes(n))throw new Error('The referee has not called that number yet.');
    if(room.marks[seat].includes(n))room.marks[seat]=room.marks[seat].filter(x=>x!==n);else room.marks[seat].push(n);return;
  }
  if(kind==='claim'){if(room.phase!=='play'&&room.phase!=='finished')throw new Error('The game has not started.');claim(room,seat,value as Prize);return;}
  throw new Error('Unknown move.');
}
export function view(room:Room,id:string,now:number){const seat=room.seats.indexOf(id);return {code:room.code,phase:room.phase,host:room.host===id,me:seat,seatNames:room.seats.map((player,i)=>room.players.find(p=>p.id===player)?.name??`Bot ${i+1}`),occupied:room.seats.map(Boolean),waiting:room.players.filter(p=>!room.seats.includes(p.id)).map(p=>p.name),ticket:seat<0?null:room.tickets[seat]??null,marks:seat<0?[]:room.marks[seat],drawn:room.drawn,last:room.drawn.at(-1)??null,nextDraw:room.nextDraw,claims:room.claims,progress:room.seats.map((_,i)=>({marked:room.marks[i].length,lines:['top','middle','bottom'].filter(p=>qualified(room,i,p as Prize)).length})),serverTime:now,revision:0};}
export type View=ReturnType<typeof view>;


