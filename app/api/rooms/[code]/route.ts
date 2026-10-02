import { tick, applyAction, publicView, turnKey } from "@/lib/game";
import { loadRoom, saveRoom, cookie, identity, reply, checkOrigin } from "@/lib/rooms";
async function handle(request:Request,code:string,write:boolean) {
  try {
    if(!/^[A-Z]{6}$/.test(code)) return reply({error:"Invalid room code."},400);
    if(write) checkOrigin(request);
    const token=cookie(request);if(!token) return reply({error:"Join this room first."},401);
    const id=await identity(token);const body=write?await request.json() as {action:string;value:unknown;turnKey?:string;requestId?:string}:null;
    if(body?.requestId!==undefined && (typeof body.requestId!=="string"||! /^[a-f0-9-]{36}$/.test(body.requestId)))return reply({error:"Invalid move identifier."},400);
    for(let attempt=0;attempt<8;attempt++) {
      const {room,revision}=await loadRoom(code);const now=Date.now();
      const p=room.players.find(p=>p.id===id);if(!p) return reply({error:"Join this room first."},403);
      // Check before ticking or validating the old turn: the first request may have committed.
      if(body?.requestId && room.receipts?.some(r=>r.player===id&&r.requestId===body.requestId))return reply({...publicView(room,id,now),revision});
      // A committed bot move remains final; reconnecting humans control subsequent moves.
      let changed=write || now-p.seen>=2000; p.seen=now; changed=tick(room,now)||changed;
      if(body) {if(["play","trump"].includes(body.action) && body.turnKey!==turnKey(room)) return reply({error:"The turn has changed. Please try again."},409);applyAction(room,id,body.action,body.value,now);}
      if(body?.requestId)room.receipts=[...(room.receipts??[]),{player:id,requestId:body.requestId}].slice(-64);
      if(!changed) return reply({...publicView(room,id,now),revision});
      if(await saveRoom(room,revision)) return reply({...publicView(room,id,now),revision:revision+1});
    }
    return reply({error:"Another move just arrived. Please try again."},409);
  } catch(error) {console.error("Room update failed",error instanceof Error?error.message:"unknown");return reply({error:error instanceof Error?error.message:"Room temporarily unavailable."},400);}
}
export async function GET(request:Request,context:{params:Promise<{code:string}>}) {return handle(request,(await context.params).code,false);}
export async function POST(request:Request,context:{params:Promise<{code:string}>}) {return handle(request,(await context.params).code,true);}

