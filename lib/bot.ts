import type { Card, Suit } from './game';
type Play={seat:number;card:Card};
export type BotKnowledge={seat:number;hand:Card[];trick:Play[];history:Play[][];trump:Suit|null};
function winner(trick:Play[],trump:Suit|null){const led=trick[0].card.suit;return trick.reduce((a,b)=>{const value=(c:Card)=>c.suit===trump?100+c.rank:c.suit===led?c.rank:0;return value(b.card)>value(a.card)?b:a;}).seat;}
export function chooseBotCard(k:BotKnowledge):Card {
  const led=k.trick[0]?.card.suit;
  const following=k.hand.filter(c=>c.suit===led);
  const legal=following.length?following:k.hand;
  const known=new Set([...k.hand,...k.history.flat().map(p=>p.card),...k.trick.map(p=>p.card)].map(c=>c.id));
  const voids=Array.from({length:4},()=>new Set<Suit>());
  for(const trick of [...k.history,k.trick]){const suit=trick[0]?.card.suit;if(suit)for(const p of trick)if(p.card.suit!==suit)voids[p.seat].add(suit);}
  const higher=(c:Card)=>Array.from({length:14-c.rank},(_,i)=>c.rank+i+1).filter(rank=>!known.has(c.suit+rank)).length;
  const length=(s:Suit)=>k.hand.filter(c=>c.suit===s).length;
  const opponents=[(k.seat+1)%4,(k.seat+3)%4];
  const cost=(c:Card)=>c.rank+(c.suit===k.trump?16:0)+(higher(c)===0?10:0);
  const discard=()=>[...legal].sort((a,b)=>cost(a)-cost(b))[0];
  if(!k.trick.length){
    // Cash proven high cards; do not lead an unprotected king into an unseen ace.
    const score=(c:Card)=>{
      const outstanding=higher(c);const control=outstanding===0;
      const ruffRisk=c.suit!==k.trump&&opponents.some(s=>voids[s].has(c.suit)&&!voids[s].has(k.trump!));
      const trumpLead=c.suit===k.trump;
      return (control?65:0)-(ruffRisk?45:0)+length(c.suit)*3
        +(control?c.rank*.2:-c.rank*1.7)-outstanding*.25
        -(trumpLead?(control&&length(c.suit)>=4?5:24):0);
    };
    return [...legal].sort((a,b)=>score(b)-score(a)||a.rank-b.rank)[0];
  }
  const currentWinner=winner(k.trick,k.trump);
  const current=k.trick.find(p=>p.seat===currentWinner)!.card;
  const remaining=Array.from({length:3-k.trick.length},(_,i)=>(k.seat+i+1)%4);
  const futureOpponents=remaining.filter(s=>s%2!==k.seat%2);
  const exposed=(c:Card)=>higher(c)>0&&futureOpponents.some(s=>!voids[s].has(c.suit));
  const canBeRuffed=(c:Card)=>c.suit!==k.trump&&futureOpponents.some(s=>voids[s].has(led!)&&!voids[s].has(k.trump!));
  const winners=legal.filter(c=>winner([...k.trick,{seat:k.seat,card:c}],k.trump)===k.seat);
  if(currentWinner%2===k.seat%2){
    if(!futureOpponents.length||(!exposed(current)&&!canBeRuffed(current)))return discard();
    const protect=winners.filter(c=>!exposed(c)&&!canBeRuffed(c));
    return protect.sort((a,b)=>cost(a)-cost(b))[0]??discard();
  }
  if(!winners.length)return discard();
  const safe=winners.filter(c=>!exposed(c)&&!canBeRuffed(c));
  if(safe.length)return safe.sort((a,b)=>cost(a)-cost(b))[0];
  // Last to play can take the trick with a king; an unseen ace elsewhere cannot change it.
  if(!futureOpponents.length)return winners.sort((a,b)=>cost(a)-cost(b))[0];
  const cheapest=winners.sort((a,b)=>cost(a)-cost(b))[0];
  return cheapest.rank>=12&&exposed(cheapest)?discard():cheapest;
}
