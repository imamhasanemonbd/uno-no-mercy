# No Mercy

A lightweight private-room browser card game. Node 22+ and one dependency (`ws`).

```sh
npm install
npm start
```

Open http://localhost:3000. Create a room, copy its invite link, and have a second player join in a separate browser profile or device. On a local network, use the host computer’s LAN address rather than localhost. `PORT` defaults to 3000.

## Included

2–6 players, host-controlled start, private hands, cryptographic shuffle, server-side move validation, color matching, Skip, Reverse, Wild, +2/+4/+6/+10, equal-or-higher draw stacking, 25-card elimination, rematches and reconnects. Original SVG-like CSS card artwork, mobile layout and reduced-motion support. Room identity is stored per tab; use separate profiles for separate players.

## House rules

This is a simplified No Mercy inspired game, not a reproduction of the official deck or rules. Drawing ends the turn; no 0/7 swaps, roulette or UNO-call penalties. The house rules are visible in the app.

## Deployment

Deploy `npm start` on a Node host that supports long-lived WebSocket connections, with HTTPS and WebSocket upgrade forwarding. Configure playnomercy.uno in that provider, then add its required DNS records. For players in Bangladesh, choose a nearby available region such as Singapore after comparing latency.

Rooms live in memory in one server process. Restarting the process clears rooms; do not enable multiple replicas without shared room routing/state. Empty rooms expire after one hour. A disconnected player retains their seat and turn until they reconnect; there is no turn timeout yet. The external Google Fonts stylesheet is optional; system fonts are used if unavailable.

## Checks

`npm test` runs game-rule and real WebSocket integration tests. Never publish real player tokens; they permit reconnecting to that player’s hand.
