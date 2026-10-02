import { chooseBotCard } from "./bot.ts";
export type Suit = "S" | "H" | "C" | "D";
export type Card = { suit: Suit; rank: number; id: string };
export type Player = { id: string; name: string; seen: number };
export type Seat = { player: string | null; bot: boolean };
export type MatchSettings = { tricksToWin:number; bestOf:number };
export const DEFAULT_SETTINGS:MatchSettings={tricksToWin:7,bestOf:5};
export function matchSettings(r:{settings?:MatchSettings}):MatchSettings {return r.settings??DEFAULT_SETTINGS;}
export type Room = {
  receipts?:{player:string;requestId:string}[];
  teamNames?:string[]; chat?:{id:string;name:string;text:string;at:number;seat?:number}[]; settings?:MatchSettings; matchId?:string; history?: {seat:number;card:Card}[][];
  code: string; host: string; players: Player[]; seats: Seat[];
  phase: "lobby" | "trump" | "play" | "trick" | "round" | "match";
  hands: Card[][]; reserve: Card[][]; trump: Suit | null; chooser: number; turn: number;
  trick: { seat: number; card: Card }[]; lastTrick: { seat: number; card: Card }[];
  tricks: number[]; wins: number[]; round: number; deadline: number; due: number;
  winner: number | null; matchWinner: number | null; log: string[];
};
export const SUITS: Suit[] = ["S", "H", "C", "D"];
export const suitNames = { S: "Spades", H: "Hearts", C: "Clubs", D: "Diamonds" };
export function randomInt(n: number): number {
  const a = new Uint32Array(1); const max = 0x100000000 - (0x100000000 % n);
  do { crypto.getRandomValues(a); } while (a[0] >= max);
  return a[0] % n;
}
export function freshRoom(code: string, player: Player): Room {
  return { code, host: player.id, players: [player], seats: Array.from({length:4},()=>({player:null,bot:false})),
    settings:{...DEFAULT_SETTINGS}, history:[], phase:"lobby", hands:[[],[],[],[]], reserve:[[],[],[],[]], trump:null, chooser:0, turn:0,
    trick:[], lastTrick:[], tricks:[0,0], wins:[0,0], round:0, deadline:0, due:0,
    winner:null, matchWinner:null, log:[] };
}
export function seatName(r: Room, seat: number) {
  return r.players.find(p=>p.id===r.seats[seat].player)?.name ?? `Bot ${seat+1}`;
}
function log(r: Room, s: string) { r.log = [...r.log.slice(-7),s]; }
export function startRound(r: Room, now: number, winningTeam: number | null) {
  const deck: Card[] = SUITS.flatMap(suit=>Array.from({length:13},(_,i)=>({suit,rank:i+2,id:suit+(i+2)})));
  for(let i=51;i>0;i--) { const j=randomInt(i+1); [deck[i],deck[j]]=[deck[j],deck[i]]; }
  r.hands = [[],[],[],[]]; r.reserve = [[],[],[],[]];
  deck.forEach((c,i)=>(i<20?r.hands:r.reserve)[i%4].push(c));
  r.chooser = winningTeam === null ? randomInt(4) : winningTeam + 2*randomInt(2);
  r.turn=r.chooser; r.round++; r.trump=null; r.trick=[]; r.lastTrick=[];
  r.history=[]; r.tricks=[0,0]; r.winner=null; r.phase="trump"; r.deadline=now+30000; r.due=now+1500;
  log(r,`Round ${r.round}: ${seatName(r,r.chooser)} chooses trump.`);
}
export function setTrump(r: Room, suit: Suit, now: number) {
  if(r.phase!=="trump" || !SUITS.includes(suit)) throw new Error("Choose a valid trump suit.");
  r.trump=suit; r.hands.forEach((h,i)=>h.push(...r.reserve[i])); r.reserve=[[],[],[],[]];
  r.phase="play"; r.deadline=now+30000; r.due=now+1200;
  log(r,`${suitNames[suit]} is trump. ${seatName(r,r.chooser)} leads.`);
}
export function legalCards(r: Room, seat: number): Card[] {
  const hand=r.hands[seat]; const suit=r.trick[0]?.card.suit;
  const matching=hand.filter(c=>c.suit===suit);
  return matching.length?matching:hand;
}
export function trickWinner(trick: Room["trick"], trump: Suit | null) {
  const led=trick[0].card.suit;
  return trick.reduce((a,b)=> {
    const value=(c:Card)=>c.suit===trump?100+c.rank:c.suit===led?c.rank:0;
    return value(b.card)>value(a.card)?b:a;
  }).seat;
}
export function playCard(r: Room, seat: number, id: string, now: number) {
  if(r.phase!=="play" || seat!==r.turn) throw new Error("It is not your turn.");
  const c=legalCards(r,seat).find(c=>c.id===id);
  if(!c) throw new Error("You must follow the led suit if you have it.");
  r.hands[seat]=r.hands[seat].filter(x=>x.id!==id); r.trick.push({seat,card:c});
  r.deadline=now+30000; r.due=now+600;
  if(r.trick.length===4) { r.phase="trick"; r.due=now+2000; r.deadline=0; }
  else r.turn=(seat+1)%4;
}
export function botTrump(r: Room): Suit {
  return [...SUITS].sort((a,b)=> {
    const weight=(s:Suit)=>r.hands[r.chooser].filter(c=>c.suit===s).reduce((x,c)=>x+8+c.rank/3,0);
    return weight(b)-weight(a);
  })[0];
}
// Bots inspect their own hand and public trick only.
export function botCard(r: Room): Card {
  return chooseBotCard({seat:r.turn,hand:r.hands[r.turn],trick:r.trick,history:r.history??(r.lastTrick.length?[r.lastTrick]:[]),trump:r.trump});
}
export function automated(r: Room, now: number) {
  const s=r.seats[r.turn]; const p=r.players.find(p=>p.id===s.player);
  return s.bot || !p || now-p.seen>8000;
}
export function tick(r: Room, now: number): boolean {
  if(r.phase==="trump" || r.phase==="play") {
    if(now<r.deadline && (!automated(r,now) || now<r.due)) return false;
    if(r.phase==="trump") setTrump(r,botTrump(r),now);
    else playCard(r,r.turn,botCard(r).id,now);
    return true;
  }
  if(r.phase==="trick" && now>=r.due) {
    const winner=trickWinner(r.trick,r.trump); r.tricks[winner%2]++;
    log(r,`${seatName(r,winner)} wins trick ${r.tricks[0]+r.tricks[1]}.`);
    r.history=[...(r.history??[]),r.trick]; r.lastTrick=r.trick; r.trick=[]; r.turn=winner;
    if(r.tricks[winner%2]>=matchSettings(r).tricksToWin) {
      r.winner=winner%2; r.wins[winner%2]++;
      r.phase=r.wins[winner%2]>=Math.ceil(matchSettings(r).bestOf/2)?"match":"round";
      if(r.phase==="match") r.matchWinner=winner%2;
      r.trump=null; r.deadline=0; r.due=now+2200; log(r,`Team ${winner%2+1} wins round ${r.round}, ${r.tricks.join("–")}.`);
    } else { r.phase="play"; r.deadline=now+30000; r.due=now+600; }
    return true;
  }
  if(r.phase==="round" && now>=r.due) { startRound(r,now,r.winner); return true; }
  return false;
}
export function applyAction(r: Room, id: string, action: string, value: unknown, now: number) {
  const seat=r.seats.findIndex(s=>s.player===id); const host=r.host===id;
  if(action==="chat") {
    const player=r.players.find(p=>p.id===id); if(!player)throw new Error("Join the room to chat.");
    const text=typeof value==="string"?value.trim():""; if(!text||text.length>240)throw new Error("Write a message of 1–240 characters.");
    if((r.chat??[]).some(m=>m.name===player.name&&now-m.at<1500))throw new Error("Please wait a moment before sending again.");
    r.chat=[...(r.chat??[]).slice(-39),{id:crypto.randomUUID(),name:player.name,text,at:now,seat}];return;
  }
  if(action==="settings") {
    if(!host||r.phase!=="lobby")throw new Error("Only the host can change the format before starting.");
    const s=value as MatchSettings;
    if(!s||!Number.isInteger(s.tricksToWin)||s.tricksToWin<1||s.tricksToWin>7||![1,3,5,7,9].includes(s.bestOf))throw new Error("Choose 1–7 tricks and an odd best-of format from 1 to 9.");
    r.settings={tricksToWin:s.tricksToWin,bestOf:s.bestOf};return;
  }
  if(action==="seat") {
    if(r.phase!=="lobby") throw new Error("Seats can be changed before the match starts.");
    if(typeof value!=="number" || !Number.isInteger(value) || value<0 || value>3) throw new Error("Choose a seat.");
    if(r.seats[value].player && r.seats[value].player!==id) throw new Error("That seat is taken.");
    if(seat>=0) r.seats[seat]={player:null,bot:false};
    r.seats[value]={player:id,bot:false}; return;
  }
  if(action==="start") {
    if(!host || seat<0 || r.phase!=="lobby") throw new Error("The host must choose a seat before starting.");
    for(const s of r.seats) if(!s.player) s.bot=true;
    r.matchId=crypto.randomUUID(); const previousWinner=r.matchWinner; r.wins=[0,0]; r.round=0; r.matchWinner=null; startRound(r,now,previousWinner); return;
  }
  if(action==="again") {
    if(!host || r.phase!=="match") throw new Error("The host can open a new match after this one ends.");
    r.phase="lobby"; r.hands=[[],[],[],[]]; r.reserve=[[],[],[],[]]; r.trick=[];r.lastTrick=[];
    r.seats.forEach(s=>s.bot=false); r.trump=null; r.deadline=0; return;
  }
  if(seat<0) throw new Error("Wait for the next match to take a seat.");
  if(action==="trump") {
    if(seat!==r.chooser || r.phase!=="trump") throw new Error("The selected player chooses trump.");
    setTrump(r,value as Suit,now); return;
  }
  if(action==="play") { playCard(r,seat,String(value),now); return; }
  throw new Error("Unknown action.");
}
export function turnKey(r:Room) { return `${r.round}:${r.phase}:${r.tricks[0]+r.tricks[1]}:${r.trick.length}:${r.turn}`; }
export function publicView(r: Room, id: string, now: number) {
  const seat=r.seats.findIndex(s=>s.player===id);
  const {hands,reserve,players,host,...rest}=r;
  return {...rest,teamNames:r.teamNames??["Team 1","Team 2"],chat:r.chat??[],settings:matchSettings(r),matchId:r.matchId??"legacy",host:host===id,me:seat,serverTime:now,revision:0,turnKey:turnKey(r),
    seats:r.seats.map((s,i)=>({name:seatName(r,i),occupied:!!s.player,bot:s.bot,
      disconnected:!!s.player && now-(players.find(p=>p.id===s.player)?.seen??0)>8000,
      mine:s.player===id,count:hands[i].length})),
    waiting:players.filter(p=>!r.seats.some(s=>s.player===p.id)).map(p=>p.name),
    hand:seat<0?[]:hands[seat],legal:seat>=0 && r.phase==="play" && seat===r.turn?legalCards(r,seat).map(c=>c.id):[]};
}
export type View = ReturnType<typeof publicView>;



