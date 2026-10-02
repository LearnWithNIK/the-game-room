import type { View } from './game';
// Only the local player's already-legal move is previewed. The server still validates it.
export function previewMove(view: View, cardId: string, now: number): View {
  if(view.phase !== 'play' || view.turn !== view.me || !view.legal.includes(cardId)) return view;
  const card=view.hand.find(card=>card.id===cardId);if(!card)return view;
  const trick=[...view.trick,{seat:view.me,card}];
  return {...view,hand:view.hand.filter(c=>c.id!==cardId),trick,legal:[],
    seats:view.seats.map((s,i)=>i===view.me?{...s,count:s.count-1}:s),
    phase:trick.length===4?'trick':'play',turn:trick.length===4?view.turn:(view.turn+1)%4,
    deadline:trick.length===4?0:now+30000};
}
