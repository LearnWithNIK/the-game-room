import { redirect } from "next/navigation";

type HomeProps = { searchParams: Promise<{ room?: string }> };

export default async function Home({ searchParams }: HomeProps) {
  const room = (await searchParams).room?.toUpperCase();
  // Existing Turup invitations pointed to the root URL. Keep them usable.
  if (room && /^[A-Z]{6}$/.test(room)) redirect(`/turup?room=${room}`);

  return (
    <main className="games-home">
      <header className="games-header">
        <a className="games-brand" href="/" aria-label="The Game Room home"><span aria-hidden="true">♠</span><span>THE GAME ROOM<small>PLAY TOGETHER</small></span></a>
        <span className="games-header-note">Good games. Great company.</span>
      </header>
      <section className="games-hero" aria-labelledby="games-title">
        <p className="games-kicker">YOUR TABLE IS READY</p>
        <h1 id="games-title">Pick a game.<br/><em>Bring your people.</em></h1>
        <p>Play with friends in a private room, or let bots fill the empty seats. Choose a game to get started.</p>
      </section>
      <section className="games-list" aria-label="Available games">
        <a href="/turup" className="game-tile game-tile-turup">
          <div className="game-tile-art cards-art" aria-hidden="true"><span className="display-card display-card-back">♣</span><span className="display-card display-card-front"><b>A</b><i>♠</i><small>A ♠</small></span></div>
          <div className="game-tile-copy"><span className="game-tile-type">CARD GAME · 4 PLAYERS</span><h2>Turup</h2><p>Choose trump, play your hand, and win tricks with your partner.</p><span className="game-tile-action">Play Turup <b aria-hidden="true">↗</b></span></div>
        </a>
        <a href="/tambola" className="game-tile game-tile-tambola">
          <div className="game-tile-art balls-art" aria-hidden="true"><span className="draw-ball ball-one">17</span><span className="draw-ball ball-two">42</span><span className="draw-ball ball-three">88</span></div>
          <div className="game-tile-copy"><span className="game-tile-type">HOUSIE · 1–4 PLAYERS</span><h2>Tambola</h2><p>Mark your ticket as numbers are called and claim the winning lines.</p><span className="game-tile-action">Play Tambola <b aria-hidden="true">↗</b></span></div>
        </a>
      </section>
      <footer className="games-footer"><span>♠ &nbsp; ♥ &nbsp; ♣ &nbsp; ♦</span><p>Choose a game, create a room, share the link.</p></footer>
    </main>
  );
}
