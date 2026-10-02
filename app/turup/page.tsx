"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, ArrowLeft, Users, Bot, Crown, Check, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { TableAudio, DEFAULT_SOUND, sanitizeSound } from "@/lib/audio";
import type { SoundSettings } from "@/lib/audio";
import { tableAudioEvents } from "@/lib/audio-events";
import type { Card, Suit, View } from "@/lib/game";
import { previewMove } from "@/lib/client-state";
import { sendMove } from "@/lib/transport";
const symbols={S:"♠",H:"♥",C:"♣",D:"♦"};
const names={S:"Spades",H:"Hearts",C:"Clubs",D:"Diamonds"};
const rank=(n:number)=>({11:"J",12:"Q",13:"K",14:"A"}[n]??String(n));
function PlayingCard({card,disabled,onClick,small=false,dealDelay}:{card:Card;disabled?:boolean;onClick?:()=>void;small?:boolean;dealDelay?:number}) {
  const content=<><span className="card-corner">{rank(card.rank)}<b>{symbols[card.suit]}</b></span><span className="card-suit">{symbols[card.suit]}</span><span className="card-bottom">{rank(card.rank)} {symbols[card.suit]}</span></>;
  const cls=`playing-card ${card.suit==="H"||card.suit==="D"?"red":"black"} ${small?"small":""} ${dealDelay!==undefined?"dealing-card":""}`;
  return onClick?<button className={cls} style={dealDelay===undefined?undefined:{animationDelay:`${dealDelay}ms`}} disabled={disabled} onClick={onClick} aria-label={`Play ${rank(card.rank)} of ${names[card.suit]}`}>{content}</button>:<div className={cls} style={dealDelay===undefined?undefined:{animationDelay:`${dealDelay}ms`}} aria-label={`${rank(card.rank)} of ${names[card.suit]}`}>{content}</div>;
}
function TurnTimer({deadline,offset}:{deadline:number;offset:number}) {
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(timer);},[]);
  const seconds=Math.min(30,Math.max(0,Math.ceil((deadline-now-offset)/1000)));
  return <span className={`timer ${seconds<=10?"urgent":""}`} aria-label={`${seconds} seconds remaining`}>{seconds}<small>SEC</small></span>;
}
export default function Home() {
  const [name,setName]=useState("");const [code,setCode]=useState("");const [view,setView]=useState<View|null>(null);
  const [bubbleNow,setBubbleNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setBubbleNow(Date.now()),500);return()=>clearInterval(timer);},[]);
  const [setup,setSetup]=useState(false);const [format,setFormat]=useState({tricksToWin:7,bestOf:5});const [teamNames,setTeamNames]=useState(["Team 1","Team 2"]);const [message,setMessage]=useState("");const [chatOpen,setChatOpen]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);const [rules,setRules]=useState(false);const [connection,setConnection]=useState(true);
  const [soundSettings,setSoundSettings]=useState<SoundSettings>({...DEFAULT_SOUND});
  const audio=useRef<TableAudio|null>(null);const soundsSeen=useRef(new Set<string>());const previousAudioView=useRef<View|null>(null);
  const [dealCards,setDealCards]=useState<Record<string,number>>({});const [dealing,setDealing]=useState(false);
  const dealPrevious=useRef<View|null>(null);const dealTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    const engine=new TableAudio();audio.current=engine;let settings={...DEFAULT_SOUND};
    try{settings=sanitizeSound(JSON.parse(localStorage.getItem("turup.sound")??"null"));}catch{}
    engine.configure(settings);setSoundSettings(settings);
    const gesture=(event:Event)=>{if(!event.isTrusted)return;engine.unlock();};
    const tap=(event:MouseEvent)=>{const target=event.target as Element;const button=target.closest?.('button');if(button&&!button.disabled&&!button.classList.contains('playing-card'))engine.play('button');};
    document.addEventListener('pointerdown',gesture,true);document.addEventListener('keydown',gesture,true);document.addEventListener('click',tap,true);
    return()=>{document.removeEventListener('pointerdown',gesture,true);document.removeEventListener('keydown',gesture,true);document.removeEventListener('click',tap,true);engine.close();audio.current=null;};
  },[]);
  const updateSound=(next:SoundSettings)=>{const value=sanitizeSound(next);setSoundSettings(value);audio.current?.configure(value);try{localStorage.setItem('turup.sound',JSON.stringify(value));}catch{}};
  useEffect(()=>{
    if(!view){previousAudioView.current=null;dealPrevious.current=null;setDealCards({});setDealing(false);return;}
    const before=previousAudioView.current;
    for(const event of tableAudioEvents(before,view)){if(!soundsSeen.current.has(event.key)){soundsSeen.current.add(event.key);audio.current?.play(event.sound,event.delay);}}
    if(soundsSeen.current.size>800){const currentMatch=view.matchId;soundsSeen.current=new Set([...soundsSeen.current].filter(key=>key.startsWith(currentMatch)));}
    previousAudioView.current=view;
    const previous=dealPrevious.current;const same=previous?.matchId===view.matchId&&previous?.round===view.round;
    const existing=new Set(same?previous!.hand.map(c=>c.id):[]);
    const incoming=view.hand.filter(c=>!existing.has(c.id));
    if(incoming.length&&['trump','play'].includes(view.phase)&&(!same||view.hand.length>(previous?.hand.length??0))){
      if(dealTimer.current)clearTimeout(dealTimer.current);
      setDealCards(Object.fromEntries(incoming.map((c,i)=>[c.id,i*100])));setDealing(true);
      dealTimer.current=setTimeout(()=>{setDealCards({});setDealing(false);},incoming.length*100+230);
    }
    dealPrevious.current=view;
  },[view]);
  useEffect(()=>()=>{if(dealTimer.current)clearTimeout(dealTimer.current);},[]);
  const offset=useRef(0);const actionPending=useRef(false);const generation=useRef(0);
  const pollAbort=useRef<AbortController|null>(null);const viewRef=useRef<View|null>(null);
  const accept=useCallback((v:View)=> {
    const current=viewRef.current;if(current?.code===v.code && v.revision<current.revision)return;
    offset.current=v.serverTime-Date.now();viewRef.current=v;setView(v);setConnection(true);
    setError(previous=>previous==="Could not confirm the move. Reconnecting…"?"":previous);
  },[]);
  useEffect(()=>{const room=(new URLSearchParams(location.search).get("room")??"").toUpperCase();setCode(room);
    if(/^[A-Z]{6}$/.test(room))void fetch(`/api/rooms/${room}`,{signal:AbortSignal.timeout(8000)}).then(async r=>{if(r.ok)accept(await r.json() as View);}).catch(()=>{});
  },[accept]);
  const enter=useCallback(async(join:boolean)=>{
    if(actionPending.current)return;
    if(!name.trim()){setError("Enter your name above before joining or creating a room.");audio.current?.play('invalid');document.getElementById('player-name')?.focus();return;}
    if(join&&!/^[A-Z]{6}$/.test(code)){setError("Enter the six-letter room code.");audio.current?.play('invalid');document.getElementById('room-code')?.focus();return;}
    actionPending.current=true;setBusy(true);setError("");
    try{const r=await fetch("/api/rooms",{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(8000),body:JSON.stringify({name,...(join?{code}:{settings:format,teamNames})})});
      const v=await r.json() as View & {error?:string};if(!r.ok)throw new Error(v.error??"Could not join the room.");generation.current++;accept(v);history.replaceState(null,"",`/turup?room=${v.code}`);
    }catch(e){audio.current?.play("invalid");setError(e instanceof Error?e.message:"Could not connect. Please try again.");}
    finally{actionPending.current=false;setBusy(false);}
  },[name,code,accept,format,teamNames]);
  const act=useCallback(async(action:string,value?:unknown)=>{
    const current=viewRef.current;if(!current||actionPending.current)throw new Error("A move is already being sent.");
    actionPending.current=true;generation.current++;pollAbort.current?.abort();pollAbort.current=null;
    setBusy(true);setError("");
    if(action==="play"&&typeof value==="string") {audio.current?.play("select");const preview=previewMove(current,value,Date.now()+offset.current);viewRef.current=preview;setView(preview);}
    let rejection="";
    try{const r=await sendMove(`/api/rooms/${current.code}`,{action,value,turnKey:current.turnKey});
      const v=await r.json() as View & {error?:string};if(!r.ok){rejection=v.error??"Move could not be sent.";throw new Error(rejection);}accept(v);return {phase:v.phase,room:v.code};
    }catch(e){
      audio.current?.play("invalid");
      // An acknowledgement can be lost after a committed move: re-read instead of resending it.
      viewRef.current=current;setView(current);setError(rejection||"Could not confirm the move. Reconnecting…");
      try{const r=await fetch(`/api/rooms/${current.code}`,{cache:"no-store",signal:AbortSignal.timeout(15000)});if(r.ok)accept(await r.json() as View);else setConnection(false);}catch{setConnection(false);}
      throw e;
    }finally{actionPending.current=false;setBusy(false);}
  },[accept]);
  const move=(action:string,value?:unknown)=>{void act(action,value).catch(()=>{});};
  useEffect(()=>{if(!view?.code)return;const room=view.code;let alive=true;
    async function poll(){if(!alive||actionPending.current||pollAbort.current)return;
      const controller=new AbortController();pollAbort.current=controller;const g=generation.current;
      const timeout=setTimeout(()=>controller.abort(),15000);
      try{const r=await fetch(`/api/rooms/${room}`,{cache:"no-store",signal:controller.signal});const v=await r.json() as View & {error?:string};
        if(!r.ok)throw new Error(v.error??"Could not refresh the table.");if(alive&&g===generation.current&&!actionPending.current)accept(v);
      }catch{if(alive&&g===generation.current&&!actionPending.current)setConnection(false);}
      finally{clearTimeout(timeout);if(pollAbort.current===controller)pollAbort.current=null;}
    }
    const resume=()=>{if(document.visibilityState!=="hidden")void poll();};
    const timer=setInterval(()=>void poll(),1000);
    window.addEventListener("online",resume);window.addEventListener("focus",resume);document.addEventListener("visibilitychange",resume);
    return()=>{alive=false;clearInterval(timer);window.removeEventListener("online",resume);window.removeEventListener("focus",resume);document.removeEventListener("visibilitychange",resume);pollAbort.current?.abort();pollAbort.current=null;};
  },[view?.code,accept]);
  useEffect(()=>{
    const context=(document as unknown as {modelContext?:{registerTool:(t:unknown,o:unknown)=>Promise<void>}}).modelContext;
    if(!context?.registerTool)return;const controller=new AbortController();
    const register=(tool:unknown)=>void Promise.resolve(context.registerTool(tool,{signal:controller.signal})).catch(()=>{});
    register({name:"read_turup_room",description:"Read the current room, your private hand and legal moves.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>viewRef.current});
    register({name:"play_turup_card",description:"Play a legal card from your hand on your turn.",inputSchema:{type:"object",properties:{cardId:{type:"string"}},required:["cardId"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(input:{cardId:string})=>{if(!viewRef.current?.legal.includes(input.cardId))throw new Error("Not a legal move.");return act("play",input.cardId);}});
    return()=>controller.abort();
  },[act]);
  async function invite(){try{await navigator.clipboard.writeText(`${location.origin}/turup?room=${view?.code}`);setCopied(true);setTimeout(()=>setCopied(false),2200);}catch{setError(`Share room code ${view?.code} with your friends.`);}}
  const active=view&&["trump","play","trick"].includes(view.phase);
  const me=view?.me??-1;const base=me>=0?me:0;
  const ownTurn=!!view&&me===view.turn&&["trump","play"].includes(view.phase);
  const resultActive=!!view&&(view.phase==="round"||view.phase==="match"||(view.phase==="lobby"&&view.matchWinner!==null));
  const resultTeam=view?.matchWinner??view?.winner??0;
  const shutout=resultActive&&!!view&&view.tricks[1-resultTeam]===0&&view.tricks[resultTeam]>=view.settings.tricksToWin;
  const lost=resultActive&&me>=0&&me%2!==resultTeam;
  const sortedHand=[...(view?.hand??[])].sort((a,b)=>"SHCD".indexOf(a.suit)-"SHCD".indexOf(b.suit)||b.rank-a.rank);
  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="/turup" aria-label="Turup home"><span className="brand-mark">♠</span><span>TURUP<span className="brand-sub">CARD ROOM</span></span></a><div className="top-actions"><a className="game-switch" href="/">All games</a>{view&&<span className="room-tag">ROOM <b>{view.code}</b></span>}<Popover><PopoverTrigger asChild><Button variant="ghost" className="sound-button" aria-label="Sound settings">{soundSettings.enabled&&soundSettings.volume>0?<Volume2 size={18}/>:<VolumeX size={18}/>}<span>Sound</span></Button></PopoverTrigger><PopoverContent align="end" className="sound-panel"><div className="sound-heading"><label htmlFor="sound-toggle">Game sounds</label><Switch id="sound-toggle" checked={soundSettings.enabled} onCheckedChange={enabled=>updateSound({...soundSettings,enabled})}/></div><div className="volume-heading"><label id="volume-label">Volume</label><span>{soundSettings.volume}%</span></div><Slider aria-labelledby="volume-label" value={[soundSettings.volume]} min={0} max={100} step={5} onValueChange={values=>updateSound({...soundSettings,volume:values[0]})}/><p>Remembered on this device. Sound starts after your first tap.</p></PopoverContent></Popover><Button variant="ghost" onClick={()=>setRules(!rules)} className="rules-button">{rules?"Close rules":"How to play"}</Button></div></header>
    {rules&&<section className="rules-panel"><h2>The rules of the table</h2><p>Partners sit opposite. Choose trump from your first five cards, then receive eight more. Play clockwise and follow the led suit if you have it. Otherwise play any card. Highest trump wins; without trump, highest card of the led suit wins. The trick winner leads next.</p><p>{view?`${view.settings.tricksToWin} tricks wins a round. First to ${Math.ceil(view.settings.bestOf/2)} rounds wins the best-of-${view.settings.bestOf} match.`:"Seven tricks wins a round. First to three rounds wins the default best-of-five match."} Each move and trump choice has 30 seconds; a bot acts on timeout. Bots fill empty seats and cover disconnects. Newcomers wait for the next match. Hands stay private.</p></section>}
    {!view?<section className="start-layout"><div className="start-intro"><div className="eyebrow">THE TABLE IS OPEN</div><h1>A good hand.<br/>Better company.</h1><p>Four players. Two teams.<br/>A little strategy, a lot of Turup.</p><div className="start-facts"><span><Users size={18}/>Friends across the table</span><span><Bot size={18}/>Bots fill the empty seats</span></div><div className="start-score"><div><strong>Win the round</strong><span>First team to 7 tricks.</span></div><div><strong>Take the match</strong><span>Best of 5 rounds. First to 3 wins.</span></div><p>The host can customise the format before play.</p></div><a className="tambola-teaser" href="/tambola"><b>Want a different game?</b><span>Try Tambola / Housie →</span></a></div><div className="entry-panel"><div className="eyebrow">TAKE YOUR PLACE</div><h2>Let’s play.</h2><label htmlFor="player-name">Your name</label><Input id="player-name" value={name} maxLength={20} onChange={e=>setName(e.target.value)} placeholder="What should we call you?" autoComplete="nickname"/><Button className="gold-button full" disabled={busy} onClick={()=>setSetup(!setup)}>Create a room</Button>{setup&&<section className="create-setup" aria-label="Create match"><h3>Set up your match</h3><div className="setup-grid"><div><label htmlFor="create-tricks">Tricks to win</label><select id="create-tricks" value={format.tricksToWin} onChange={e=>setFormat({...format,tricksToWin:Number(e.target.value)})}>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n} {n===1?"trick":"tricks"}</option>)}</select></div><div><label htmlFor="create-rounds">Match length</label><select id="create-rounds" value={format.bestOf} onChange={e=>setFormat({...format,bestOf:Number(e.target.value)})}>{[1,3,5,7,9].map(n=><option key={n} value={n}>{n===1?"Single round":"Best of "+n}</option>)}</select></div></div>{teamNames.map((n,i)=><div key={i}><label htmlFor={"team-name-"+i}>Team {i+1} name</label><Input id={"team-name-"+i} value={n} maxLength={20} onChange={e=>setTeamNames(teamNames.map((v,j)=>i===j?e.target.value:v))}/></div>)}<Button className="gold-button full" disabled={busy} onClick={()=>void enter(false)}>Create match & choose seat</Button><p>Friends joining your room use this format.</p></section>}<div className="divider"><span>or join your friends</span></div><label htmlFor="room-code">Room code</label><div className="join-row"><Input id="room-code" value={code} onChange={e=>setCode(e.target.value.replace(/[^a-z]/gi,"").toUpperCase().slice(0,6))} placeholder="ABCDEF" autoComplete="off"/><Button variant="outline" disabled={busy} onClick={()=>void enter(true)}>Join room</Button></div><p className="entry-note">Enter your name and six-letter code to join. Start with 1–4 people; bots fill empty seats.</p>{error&&<p className="error" role="alert">{error}</p>}</div></section>:<>
    <div className="game-heading"><div><div className="eyebrow">{view.phase==="lobby"?"GATHER YOUR TEAM":`BEST OF ${view.settings.bestOf}`}</div><h1>{view.phase==="lobby"?"Choose your seat.":`Round ${view.round}`}</h1></div><Button variant="outline" onClick={()=>void invite()}><Copy size={16}/>{copied?"Link copied":"Invite friends"}</Button></div>
    {!connection&&<div className="connection" role="status">Reconnecting… a bot will cover your seat. Keep this page open.</div>}
    {error&&<div className="error" role="alert">{error}</div>}
    <p className="room-format">{view.teamNames.join(" vs ")} · First to {view.settings.tricksToWin} tricks · Best of {view.settings.bestOf}</p><div className="play-layout"><div className="table-column"><section className={`table ${resultActive?(view.matchWinner!==null?"match-victory":"round-victory"):""} ${view.phase==="lobby"&&!resultActive?"lobby-table":""} ${shutout?"shutout-table":""} ${view.phase==="round"||view.phase==="match"?"celebrating-table":""}`} aria-label="Game table"><div className="table-ring"/>{resultActive&&<div className="confetti" aria-hidden="true" key={`${view.matchId}:${view.round}:${view.phase}`}>{Array.from({length:view.phase==="match"?48:18},(_,i)=><i key={i} style={{left:`${(i*37)%100}%`,animationDelay:`${(i%9)*.09}s`,background:i%2?"#f3d17e":"#9ed8c7"}}/>)}</div>}
      {view.seats.map((s,i)=>{const pos=(i-base+4)%4;const spoken=[...view.chat].reverse().find(m=>m.seat===i&&bubbleNow+offset.current-m.at<6500);return <div key={i} className={`seat seat-${pos} ${active&&view.turn===i?"current-seat":""} ${s.mine?"my-seat":""} ${resultActive&&i%2===resultTeam?"winner-seat":shutout?"shutout-seat":""}`}>{spoken&&<div className="speech-bubble" key={spoken.id} role="status"><b>{s.name}</b><span>{spoken.text}</span></div>}<div className="seat-avatar">{s.bot?<Bot size={23}/>:s.occupied?s.name.slice(0,1).toUpperCase():<Users size={23}/>}</div><span className="seat-name">{s.occupied||s.bot?s.name:`Seat ${i+1}`}{s.mine&&<small>YOU</small>}</span><span className={`team-label team-${i%2}`}>{view.teamNames[i%2]}{s.bot?" · Bot":s.disconnected?" · Bot covering":""}</span>{view.phase==="lobby"&&<Button size="sm" variant={s.mine?"secondary":"outline"} disabled={busy||(s.occupied&&!s.mine)} onClick={()=>move("seat",i)}>{s.mine?<><Check size={14}/>Your seat</>:s.occupied?"Taken":"Sit here"}</Button>}{active&&<span className="card-count">{s.count} cards</span>}</div>;})}
      {view.phase==="lobby"&&!resultActive?<div className="table-center lobby-center"><span className="table-emblem">♠</span><h2>Partners sit opposite.</h2><p>Pick Team 1 or Team 2.<br/>Empty seats become bots.</p></div>:<><div className="table-trump"><div className="trump-pill">{view.trump?<><span className={view.trump==="H"||view.trump==="D"?"red-symbol":""}>{symbols[view.trump]}</span> {names[view.trump]} trump</>:view.phase==="round"?"Round complete · new trump next":view.phase==="match"?"Match complete":"Choose a new trump"}</div></div><div className="table-center gameplay-center"><div className="trick-cards">{view.trick.map(({card,seat})=><div key={card.id} className={`trick-card played-${(seat-base+4)%4}`}><PlayingCard card={card} small/><span>{view.seats[seat].name}</span></div>)}{view.phase==="trump"?<div className="trump-announcement"><span className="eyebrow">NEW ROUND · NEW TRUMP</span><h2>{ownTurn?"Choose your trump":`${view.seats[view.chooser].name} chooses trump`}</h2><p>{ownTurn?"Use your first five cards.":"Waiting for a fresh selection."}</p></div>:resultActive?<div className={`outcome-panel ${lost?"loss-panel":""}`}><Crown size={27}/>{shutout&&<div className="shutout-taunt"><span aria-hidden="true">😅</span><b>{view.teamNames[1-resultTeam]} got swept!</b><small>{view.tricks[resultTeam]}–0 · Not a single trick. Better bring your A-game next time!</small></div>}<h2>{view.matchWinner!==null?`${view.teamNames[view.matchWinner]} are the champions!`:`${view.teamNames[view.winner??0]} win the round!`}</h2><p>{view.matchWinner!==null?`${view.wins[view.matchWinner]}–${view.wins[1-view.matchWinner]} · A match to remember. Well played!`:"One step closer to victory. Fresh cards are next."}</p></div>:!view.trick.length&&<span className="table-watermark">TURUP</span>}</div></div></>}
    </section>
    {view.phase==="lobby"?<div className="lobby-controls"><div><b>{view.seats.filter(s=>s.occupied).length} of 4 seats filled</b><p>{view.host?me<0?"Choose your seat to start.":"Ready? Bots will take any empty seats.":"The host will start the match."}</p></div>{view.host&&<Button className="gold-button" disabled={busy||me<0} onClick={()=>move("start")}>Start match</Button>}</div>:<section className="hand-section">{busy&&<p className="move-status" role="status">Sending move…</p>}<div className="hand-header"><div><h2>{me<0?"You’re waiting for the next match":ownTurn?view.phase==="trump"?"Choose your trump":dealing?"Dealing your cards…":"Your turn. Play a card.":view.phase==="round"?`${view.teamNames[view.winner??0]} win the round!`:view.phase==="match"?`${view.teamNames[view.matchWinner??0]} win the match!`:view.phase==="trick"?"Resolving the trick…":`${view.seats[view.turn].name}’s turn`}</h2><p>{view.phase==="trump"?"Choose a suit from your first five cards.":view.phase==="play"?ownTurn?(view.trick.length?`Follow ${names[view.trick[0].card.suit]} if you have it.`:"Lead any suit, including trump."):"Your hand stays private.":view.phase==="round"?"Fresh cards and a new trump choice come next.":view.phase==="match"?`First to ${Math.ceil(view.settings.bestOf/2)} rounds. Well played.`:"The highest trump, or highest led-suit card, wins."}</p></div>{view.deadline>0&&<TurnTimer deadline={view.deadline} offset={offset.current}/>}</div>
      {view.phase==="trump"&&ownTurn&&<div className="trump-choices">{(["S","H","C","D"] as Suit[]).map(s=><Button key={s} variant="outline" disabled={busy||dealing} onClick={()=>move("trump",s)}><b className={s==="H"||s==="D"?"red-symbol":""}>{symbols[s]}</b>{names[s]}</Button>)}</div>}
      {me>=0&&active&&<p className="hand-hint">{dealing?"Cards arrive one at a time.":"Swipe your hand to see every card."}</p>}{me>=0&&active&&<div className="hand" aria-label="Your private hand">{sortedHand.map(card=><PlayingCard key={`${view.matchId}:${view.round}:${card.id}`} card={card} dealDelay={dealCards[card.id]} disabled={busy||dealing||!view.legal.includes(card.id)} onClick={view.phase==="play"?()=>move("play",card.id):undefined}/>)}</div>}
      {view.phase==="match"&&view.host&&<Button className="gold-button" onClick={()=>move("again")} disabled={busy}><RotateCcw size={16}/>Open the next match</Button>}
    </section>}
    </div><aside className="match-panel"><div className="panel-title"><Crown size={18}/><h2>Match score</h2><span>First to {Math.ceil(view.settings.bestOf/2)}</span></div>{[0,1].map(team=><div key={team} className={`score-team team-${team}`}><div className="score-name"><b>{view.teamNames[team]}</b><span>{view.seats.filter((_,i)=>i%2===team).map(s=>s.occupied||s.bot?s.name:"Open seat").join(" & ")}</span></div><div className="win-dots" aria-label={`${view.wins[team]} rounds won`}>{Array.from({length:Math.ceil(view.settings.bestOf/2)},(_,i)=>i).map(i=><span key={i} className={i<view.wins[team]?"won":""}/>)}</div><strong>{view.wins[team]}</strong></div>)}<div className="round-score"><span>This round · tricks</span><div><b>{view.tricks[0]}</b><span>—</span><b>{view.tricks[1]}</b></div><p>First to {view.settings.tricksToWin} wins</p></div>{view.waiting.length>0&&<div className="waiting"><b>{view.phase==="lobby"?"Choosing seats":"Waiting for next match"}</b><p>{view.waiting.join(", ")}</p></div>}<div className="table-notes"><span className="eyebrow">AT THE TABLE</span>{view.log.length?view.log.slice(-4).map((s,i)=><p key={i}>{s}</p>):<p>Share your room code and get your team together.</p>}</div>{view.lastTrick.length>0&&<details className="last-trick"><summary>Previous trick</summary><div>{view.lastTrick.map(t=><p key={t.seat}>{view.seats[t.seat].name}: {rank(t.card.rank)}{symbols[t.card.suit]}</p>)}</div></details>}</aside></div>
    <section className="room-chat"><Button variant="outline" onClick={()=>setChatOpen(!chatOpen)}>{chatOpen?"Close chat":"Table chat"} · {view.chat.length}</Button>{chatOpen&&<div className="chat-content"><h2>Chat with the table</h2><div className="chat-messages" aria-live="polite">{view.chat.length?view.chat.map(m=><p key={m.id} className={`chat-message ${m.seat===view.me?"own-message":""}`}><b>{m.name}</b><span>{m.text}</span></p>):<p>Say hello to your teammates and opponents.</p>}</div><form onSubmit={e=>{e.preventDefault();if(message.trim())void act("chat",message).then(()=>setMessage("")).catch(()=>{});}}><Input aria-label="Chat message" value={message} maxLength={240} placeholder="Message the table…" onChange={e=>setMessage(e.target.value)}/><Button type="submit" disabled={busy||!message.trim()}>Send</Button></form><p className="chat-note">Visible to everyone in this room. Voice chat is not enabled.</p></div>}</section>
    <Button variant="ghost" className="back-button" onClick={()=>{generation.current++;viewRef.current=null;setView(null);setError("");history.replaceState(null,"","/turup");}}><ArrowLeft size={16}/>Leave table</Button>
    </>}
    <footer><span>♠ ♥ ♣ ♦</span><p>Good cards. Fair play. Great company.</p></footer>
  </main>;
}



