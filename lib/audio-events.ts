import type { View } from './game';
import type { SoundName } from './audio';
export type AudioEvent={key:string;sound:SoundName;delay?:number};
export function tableAudioEvents(before:View|null,after:View):AudioEvent[]{
  // Joining or reconnecting mid-round must not replay historical actions.
  if(!before||before.code!==after.code)return [];
  const match=after.matchId;const round=`${match}:${after.round}`;const events:AudioEvent[]=[];
  const sameRound=before.matchId===after.matchId&&before.round===after.round;
  const oldCards=new Set(sameRound?[...(before.history??[]).flat(),...before.lastTrick,...before.trick].map(p=>p.card.id):[]);
  const newCards=[...(after.history??[]).flat(),...after.trick];
  const unique=new Set<string>();
  for(const p of newCards)if(!oldCards.has(p.card.id)&&!unique.has(p.card.id)){unique.add(p.card.id);events.push({key:`${round}:play:${p.card.id}`,sound:'play'});}
  const ownNewRound=!sameRound&&after.phase==='trump';
  const oldHand=new Set(sameRound?before.hand.map(c=>c.id):[]);
  const newHand=after.hand.filter(c=>!oldHand.has(c.id));
  if(after.me>=0&&newHand.length&&(ownNewRound||after.hand.length>before.hand.length)){
    if(sameRound)events.push({key:`${round}:draw`,sound:'draw'});
    newHand.forEach((c,i)=>events.push({key:`${round}:deal:${c.id}`,sound:'deal',delay:i*100}));
  }
  const beforeOwn=before.me>=0&&before.turn===before.me&&['play','trump'].includes(before.phase);
  const afterOwn=after.me>=0&&after.turn===after.me&&['play','trump'].includes(after.phase);
  if(afterOwn&&(!beforeOwn||before.turnKey!==after.turnKey))events.push({key:`${round}:turn:${after.turnKey}`,sound:'turn'});
  if(after.phase==='match'&&before.phase!=='match'&&after.me>=0){
    events.push({key:`${match}:outcome`,sound:after.matchWinner===after.me%2?'win':'lose'});
  }else if(after.phase==='round'&&before.phase!=='round'&&after.me>=0&&after.winner===after.me%2){
    events.push({key:`${round}:won`,sound:'round'});
  }
  return events;
}
