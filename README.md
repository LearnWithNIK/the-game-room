# The Game Room

The root homepage lists both games. Turup has its own homepage at `/turup`, and Tambola / Housie is at `/tambola`. Older Turup invitation links using `/?room=ABCDEF` redirect to `/turup?room=ABCDEF`; new invitations link directly to the game route.

A mobile-friendly web implementation of the agreed four-player Turup rules. Private hands, chosen seats, two teams, 30-second timers, bots, reconnect support and configurable matches (default best of five).

## Rules

Partners sit opposite. A shuffled standard 52-card deck is dealt in two stages: five cards per player, trump selection, then eight more. A random player chooses trump in round one. A random partner from the previous winning team chooses it in later rounds, and leads first. Play goes clockwise. Follow the led suit whenever possible; otherwise any card is legal. Highest trump wins, or highest card in the led suit if no trump was played. Ace is highest. Trump may be led anytime. The trick winner leads the next trick. By default, seven tricks ends a round immediately and three round wins ends the match. Before starting, the host can choose 1–7 tricks to win and best of 1, 3, 5, 7 or 9 rounds.

The host starts with one to four humans; bots fill unoccupied seats. Newcomers wait until the next match. Thirty seconds is allowed for both trump selection and moves. A bot covers a human after a timeout or disconnected heartbeat. Reconnection restores control after any committed bot move.

## Implementation

React/Vinext frontend and Cloudflare Worker routes. D1 stores authoritative room state. An atomic revision comparison prevents simultaneous requests overwriting one another. Strategic turn keys reject stale move requests. Each player's session uses an HttpOnly cookie; the database stores only a token hash. Responses contain only that player's hand and public state. Bots use their own hand and public cards only, track played high cards and suit voids, preserve winning partner cards and avoid exposed high leads when stronger cards remain unseen.

Rooms synchronize every 400 ms, with heartbeats saved at most every two seconds. Card moves are previewed immediately, then confirmed by the server; background requests never block card taps. Bots play after 600 ms and completed tricks resolve after 850 ms. Each round clears trump and redeals five cards for a fresh selection. A new match retains the previous winning team for its opening trump choice. Bot steps and deadlines advance on room requests; if every visitor leaves, play resumes when someone returns. This first version does not yet implement continuous background scheduling or production traffic rate limits. Player reconnection uses the same browser session. Different people should use separate browser profiles or devices. Additional games can have their own engine and room screens.

Sound uses short Web Audio effects unlocked by a trusted tap or keypress. Mute and volume are remembered on the device. Dealing is staggered at 100 ms per card; played cards appear immediately.

## Development

Install the locked dependencies, generate migrations, and build using the scripts in package.json. For Windows environments with an npm shim problem, run npm via its absolute npm-cli.js path. `node scripts/run-framework.mjs dev` starts development; `node scripts/run-framework.mjs build` builds the Worker. Apply generated SQL to the local D1 before testing rooms. Sites applies production migrations during deployment.

`node tests/game.mjs` verifies 100 complete matches and key rules. Integration checks verify independent sessions, concurrent seating, hidden hands, stale turns, reconnects and late-join restrictions.

The hosted game is public. Create a room and share its invite link before starting; newcomers wait until the next match.



## Tambola / Housie

The same hosted site also offers `/tambola`. Each room has four seats; bots fill seats without a human player. Every player gets a private, valid 3×9 ticket with five numbers per row from 1–90. A referee bot calls one new number every eight seconds. Players can mark or unmark only called numbers on their own ticket; taps update immediately and reconcile with the server. Other players see marked counts, completed-line counts, claims, and called numbers, never private ticket numbers. Early Five, Top/Middle/Bottom Line, and Full House claims are server-validated. A prize can be shared by players qualifying on the same draw. Claims pause the referee and show winners to everyone; Full House shows a final winner celebration. The host can open a new game after Full House. The draw sound uses Kenney Casino Audio (CC0), included under `public/audio`.
