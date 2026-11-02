# No Mercy

A lightweight private-room browser card game. Node 22+ and one dependency (`ws`).

```sh
npm install
npm start
```

Open http://localhost:3000. Create a room, copy its invite link, and have a second player join in a separate browser profile or device. On a local network, use the host computer’s LAN address rather than localhost. `PORT` defaults to 3000.

## Included

2–6 players, host-controlled start, private hands, cryptographic shuffle, server-side move validation, 168-card base deck, Skip, Reverse, Discard All, Skip Everyone, colored +2/+4, Wild Reverse +4, Wild +6/+10, Color Roulette, equal-or-higher draw stacking, 7 hand swaps, 0 hand passing, draw-until-playable, UNO calls/catches, 25-card elimination, rematches and reconnects. Original CSS card artwork, mobile landscape layout, fullscreen control, scrollable hands and reduced-motion support. Room identity is stored per tab; use separate profiles for separate players.

Animations use public, numbered server events: played cards fly from their player to the pile, draws cascade from the deck, hand exchanges animate separately from penalties, and each new round deals cards with staggered motion. Repeated state broadcasts do not replay the same event. Private hand identities are never included in animation events. Roulette reveals only cards that its rule makes public.

## Deck and rules

Base-game rules: [Mattel instructions](https://service.mattel.com/instruction_sheets/HVW18-Eng.pdf). The official sheet confirms 168 cards and action rules but does not itemize copy counts; the [counted breakdown](https://ruthlessgame.com/blog/uno/todas-las-cartas) is used for the copy counts.

Per color: two of every number 0–9; three each Skip, Reverse, +2, Discard All; two each colored +4 and Skip Everyone. Wilds: eight Reverse +4, eight Color Roulette, four +6, four +10. Total 168. There is no plain Wild card in this deck.

A playable card drawn during a normal draw must be played before the turn advances; Wild color and 7 swap target remain player choices. UNO calls and catches are resolved in server arrival order until the next player starts. Roulette’s chosen color becomes the active color. Playing the final card wins immediately, including a final 0 or 7. Single-round wins only; optional points scoring and the separate expansion pack are not included.

## Deployment

Deploy `npm start` on a Node host that supports long-lived WebSocket connections, with HTTPS and WebSocket upgrade forwarding. Configure playnomercy.uno in that provider, then add its required DNS records. For players in Bangladesh, choose a nearby available region such as Singapore after comparing latency.

Rooms live in memory in one server process. Restarting the process clears rooms; do not enable multiple replicas without shared room routing/state. Empty rooms expire after one hour. A disconnected player retains their seat and turn until they reconnect; there is no turn timeout yet. The external Google Fonts stylesheet is optional; system fonts are used if unavailable.

## Checks

`npm test` runs game-rule and real WebSocket integration tests. Never publish real player tokens; they permit reconnecting to that player’s hand.
