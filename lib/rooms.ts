import { env } from "cloudflare:workers";
import type { Room } from "./game";
export function database() {
  if(!env.DB) throw new Error("Rooms are temporarily unavailable. Please try again.");
  return env.DB;
}
export async function loadRoom(code:string) {
  const row=await database().prepare("SELECT state, revision FROM rooms WHERE code = ?").bind(code).first<{state:string;revision:number}>();
  if(!row) throw new Error("Room not found. Check the six-letter code.");
  return {room:JSON.parse(row.state) as Room,revision:row.revision};
}
export async function saveRoom(room:Room,revision:number) {
  const result=await database().prepare("UPDATE rooms SET state = ?, revision = revision + 1 WHERE code = ? AND revision = ?")
    .bind(JSON.stringify(room),room.code,revision).run();
  return result.meta.changes===1;
}
export function cookie(request:Request) { return request.headers.get("cookie")?.match(/(?:^|;\s*)turup_session=([a-f0-9]{64})(?:;|$)/)?.[1]??null; }
export async function identity(token:string) {
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
}
export function reply(data:unknown,status=200,token?:string,secure=true) {
  const headers:Record<string,string>={"Cache-Control":"no-store"};
  if(token) headers["Set-Cookie"]=`turup_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secure?"; Secure":""}`;
  return Response.json(data,{status,headers});
}
export function checkOrigin(request:Request) {
  if(request.headers.get("origin")!==new URL(request.url).origin) throw new Error("Please use the game page to make moves.");
}
