import {action,tick,view} from '@/lib/tambola';
import type {Room} from '@/lib/tambola';
import {database,cookie,identity,reply,checkOrigin} from '@/lib/rooms';
async function handle(request:Request,code:string,write:boolean){
 try{if(!/^[A-Z]{6}$/.test(code))throw Error('Invalid room code.');if(write)checkOrigin(request);const token=cookie(request);if(!token)return reply({error:'Join this room first.'},401);const id=await identity(token);const body=write?await request.json() as {action:string;value:unknown}:null;
 for(let attempt=0;attempt<8;attempt++){const row=await database().prepare('SELECT state,revision FROM rooms WHERE code=?').bind('T'+code).first<{state:string;revision:number}>();if(!row)throw Error('Tambola room not found.');const room=JSON.parse(row.state) as Room;const p=room.players.find(p=>p.id===id);if(!p)return reply({error:'Join this room first.'},403);const now=Date.now();const changed=tick(room,now);if(body)action(room,id,body.action,body.value,now);if(!changed&&!body)return reply({...view(room,id,now),revision:row.revision});const result=await database().prepare('UPDATE rooms SET state=?,revision=revision+1 WHERE code=? AND revision=?').bind(JSON.stringify(room),'T'+code,row.revision).run();if(result.meta.changes===1)return reply({...view(room,id,now),revision:row.revision+1});}
 return reply({error:'Another move just arrived. Try again.'},409);
 }catch(e){return reply({error:e instanceof Error?e.message:'Room unavailable.'},400)}
}
export async function GET(request:Request,context:{params:Promise<{code:string}>}){return handle(request,(await context.params).code,false)}
export async function POST(request:Request,context:{params:Promise<{code:string}>}){return handle(request,(await context.params).code,true)}
