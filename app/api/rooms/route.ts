import { applyAction, freshRoom, publicView, randomInt } from "@/lib/game";
import { database, loadRoom, saveRoom, cookie, identity, reply, checkOrigin } from "@/lib/rooms";
export async function POST(request:Request) {
  try {
    checkOrigin(request);
    const body=await request.json() as {name?:unknown;code?:unknown;settings?:unknown;teamNames?:unknown};
    const name=typeof body.name==="string"?body.name.trim():"";
    if(name.length<1 || name.length>20) throw new Error("Enter a name of 1–20 characters.");
    const token=cookie(request)??Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
    const id=await identity(token);const now=Date.now();const secure=new URL(request.url).protocol==="https:";
    if(body.code!==undefined) {
      const code=String(body.code).toUpperCase().trim();
      if(!/^[A-Z]{6}$/.test(code)) throw new Error("Enter a six-letter room code.");
      for(let attempt=0;attempt<8;attempt++) {
        const {room,revision}=await loadRoom(code); let p=room.players.find(p=>p.id===id);
        if(p) {p.name=name;p.seen=now;}
        else {if(room.players.length>=12) throw new Error("This room is full.");room.players.push({id,name,seen:now});}
        if(await saveRoom(room,revision)) return reply({...publicView(room,id,now),revision:revision+1},200,token,secure);
      }
      return reply({error:"The room is busy. Please join again."},409);
    }
    for(let attempt=0;attempt<5;attempt++) {
      const code=Array.from({length:6},()=>"ABCDEFGHJKLMNPQRSTUVWXYZ"[randomInt(24)]).join("");
      const room=freshRoom(code,{id,name,seen:now});
      if(body.settings!==undefined)applyAction(room,id,"settings",body.settings,now);
      if(body.teamNames!==undefined){if(!Array.isArray(body.teamNames)||body.teamNames.length!==2||body.teamNames.some(n=>typeof n!=="string"||!n.trim()||n.trim().length>20))throw new Error("Give each team a name of 1–20 characters.");room.teamNames=body.teamNames.map(n=>n.trim());}
      const result=await database().prepare("INSERT INTO rooms (code, state, revision) VALUES (?, ?, 0) ON CONFLICT(code) DO NOTHING").bind(code,JSON.stringify(room)).run();
      if(result.meta.changes===1) return reply(publicView(room,id,now),201,token,secure);
    }
    throw new Error("Could not create the room. Please try again.");
  } catch(error) {console.error("Room request failed",error instanceof Error?error.message:"unknown");return reply({error:error instanceof Error?error.message:"Rooms are temporarily unavailable."},400);}
}

