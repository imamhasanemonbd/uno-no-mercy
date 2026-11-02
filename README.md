# No Mercy

A lightweight private-room browser card game. Node 22+ for local development. Cloudflare Workers + Durable Objects for deployment.

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

## Cloudflare deployment (GitHub auto-deploy)

The repository is ready for Workers Builds; no separate backend host is needed. `worker.js` serves the frontend through Workers Static Assets and routes each room to its own SQLite-backed Durable Object. State is saved after each accepted action, and idle WebSockets use hibernation. Empty rooms expire after one hour without connected players. `npm start` still runs the in-memory Node server locally.

In Cloudflare **Workers & Pages → Create application → Connect GitHub**, select `imamhasanemonbd/uno-no-mercy`:

| Setting | Value |
| --- | --- |
| Project name | `uno-no-mercy` (matches `wrangler.jsonc`) |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | Leave empty |
| Deploy command | `npx wrangler deploy` |
| Preview command | Keep Cloudflare’s default `npx wrangler preview` |

Deploy, then test the generated workers.dev URL with two devices. Future pushes to `main` trigger deployment automatically. The first deployment provisions the `GameRoom` Durable Object namespace through the checked-in migration; no manual database or binding creation is needed.

To connect `playnomercy.uno`, first add it to your Cloudflare account and complete nameserver setup. Once the zone is active, open the Worker → **Settings → Domains & Routes → Add → Custom Domain** and enter `playnomercy.uno`. Cloudflare configures the domain’s DNS record and HTTPS certificate. Resolve any existing conflicting record for that hostname before adding it.

Cloudflare account and usage limits apply; use its dashboard to monitor requests and Durable Object storage. Multiplayer latency depends on the players’ networks and room location, rather than static asset loading alone.

### Local Cloudflare runtime

```sh
npm run dev:cloudflare
```

Open the printed localhost URL (usually port 8787). `.wrangler/` stores local state and is ignored by Git. No Cloudflare account is needed for local development or tests. `npm run check:cloudflare` checks deployment bundling without publishing. `npm run deploy` publishes when run from an authenticated Cloudflare environment.

The Cloudflare backend persists rooms across runtime restarts and reconnects. The optional Node backend keeps rooms in a single process: restarting it clears rooms, and multiple Node replicas require shared room routing/state. In either backend, a disconnected player retains their turn until reconnecting; there is no turn timeout. The Google Fonts stylesheet is optional; system fonts are used if unavailable.

## Checks

`npm test` runs game-rule tests plus real WebSocket tests for Node and the Cloudflare runtime, including storage recovery after a restart. Never publish real player tokens; they permit reconnecting to that player’s hand.
