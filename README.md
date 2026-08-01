# Two Truths and a Lie — Council Onboarding

A live, multi-device party game. Players submit two truths and one lie from their
phones; the host spins a wheel on the projector and reveals the lie.

Everything syncs over WebSockets, so a player's submission appears on the host
screen instantly — no refreshing.

## Pages

| Page      | Who       | What it does                                                     |
| --------- | --------- | ---------------------------------------------------------------- |
| `/`       | Everyone  | Landing page: choose Player or Host                              |
| `/player` | Players   | Enter name → write 3 statements → locked → "Your Turn!" when picked |
| `/admin`  | Host      | Spin the wheel, read statements aloud, reveal the lie            |

## Brand and theming

The interface uses Google's design language for GDG BITS Pilani Dubai Campus.

- **Type**: Google Sans (display) and Google Sans Text (UI), **self-hosted** in
  `public/assets/fonts/`. Nothing is fetched from a CDN at runtime, so the game
  looks right even if the venue's network is hostile.
- **Colour**: a black-and-white ground on Google's neutral ramp, one blue action
  colour, and the four brand colours reserved for the wheel and rhythm marks.
- **Theme**: light and dark, toggled from the app bar and remembered in
  `localStorage`. It **always opens light**, deliberately ignoring the device's
  dark-mode setting — the host screen is projected in a lit room and must never
  come up dark because of someone's OS preference. A viewer who picks dark keeps
  it on that device.
  A blocking inline script sets the theme before first paint, so there is no
  flash of the wrong theme.
- **Logo**: top-left on every page. Two derived files ship — `gdg-logo-light.png`
  and `gdg-logo-dark.png` — swapped by CSS on `data-theme`. Do not go back to a
  CSS `invert()` filter: it turned the brand yellow brown and the red salmon.

Design tokens all live at the top of `public/style.css`. To restyle for a future
event, change the token block — not the components. `DESIGN.md` records the
system in full.

## The host password

`/admin` is password protected. The password is read from the `ADMIN_PASSWORD`
environment variable and is **never** written into the source.

- **Locally**: it lives in `.env` (gitignored, so it is not pushed).
  Copy `.env.example` to `.env` if you ever need to recreate it.
- **On Render**: set `ADMIN_PASSWORD` in the dashboard under Environment.
  `render.yaml` declares it with `sync: false`, so Render will prompt you for the
  value on first deploy rather than reading it from the repo.

If `ADMIN_PASSWORD` is unset the server boots but refuses every host sign-in, and
prints a loud warning at startup — so you find out at boot, not mid-meeting.

The check is enforced on the server for every host action, not just at the login
screen. Someone who skips the page and opens a raw socket still gets nothing.

### Brute-force protection

The URL is public, so guessing is throttled. The first **8** wrong answers from
an address are rejected instantly — a host who typos twice notices nothing —
after which each further failure is answered with a doubling delay, capped at
30 seconds.

Two properties worth keeping if you ever touch this:

- **It is keyed by IP, not by socket.** A per-socket counter is worthless,
  because an attacker just reconnects to reset it.
- **It delays rather than locks out.** The correct password is *never* delayed,
  so the real host can always get in — even while someone else is hammering the
  same address.

## Running locally

```bash
npm install
npm run dev      # serves public/ — edit and refresh
```

## Production build

```bash
npm install
npm run build    # public/ -> dist/
npm start        # serves dist/ when it exists, else public/
```

`build.js` syntax-checks the server, then minifies CSS/JS, collapses HTML
whitespace, content-hashes every asset filename and rewrites the references,
and drops files nothing loads.

At serve time the server gzips text responses and sets cache headers:
hashed assets get `max-age=31536000, immutable` (a change produces a new
filename, so they can never go stale) and HTML gets `no-cache`, or clients
would keep loading the old hashed references.

Measured: CSS 29KB -> 18.7KB minified -> **4.7KB gzipped**; the Socket.IO
client 156KB -> **38KB gzipped**. `dist/` is gitignored — build it on deploy.

Then open http://localhost:3000. To test properly, open `/admin` in one window
and `/player` in a couple of others (or on your phone, using your machine's LAN
IP).

## Deploying

The app needs a **persistent Node process** — it holds open WebSocket
connections and keeps game state in memory. Railway, Fly.io, Koyeb, Heroku or a
VPS all work. **Vercel and Netlify do not**: serverless functions cannot hold a
socket open and wipe in-memory state between invocations.

Whatever the host, it needs:

- Build command: `npm run build`
- Start command: `npm start`
- `ADMIN_PASSWORD` set in the environment (without it `/admin` never unlocks)
- `PORT` — the server reads it; most platforms set it automatically

Pick a region close to the room. If the host sleeps when idle (most free
tiers), point an UptimeRobot HTTP monitor at `/healthz` on a 5-minute interval,
set up the day before rather than during the meeting.

## How the secret is kept

The host must not be able to see which statement is the lie before pressing
Reveal — including by opening devtools. Two things enforce that:

- **The lie index is withheld server-side.** `adminView()` in `server.js` sends
  `lieIndex: null` until the host reveals. The answer is not in the page at all
  beforehand, so there is nothing to inspect.
- **Statements are shuffled on submit.** If they were stored in typed order, the
  lie would always be the one the player marked, in the slot they marked it.
  `shuffleStatements()` randomises the order and stores the lie's new position.

## Host controls

- **Spin the wheel** — picks randomly from players who have submitted and have
  not had a turn yet. The server picks the winner, so the wheel can never land
  on someone ineligible.
- **Reveal the lie** — marks each statement TRUE or LIE on both the host screen
  and that player's phone.
- **Next player** — stays disabled until you press Reveal, so you can't skip past
  someone without showing the room the answer. Then it ends the turn and greys
  that player out on the wheel. They keep their slice (so the wheel doesn't
  reshuffle) but can't be picked again.
- **Put back** — releases the current player without using up their turn, for
  when you spin by accident.
- **×** next to a name — removes someone (e.g. a duplicate or a test entry).
- **Master Reset** — wipes every player, their statements and all turns taken,
  and sends every player screen back to the start with its form cleared, so the
  same room can play again.

## Notes

- State lives in the server process. `state.json` is written as a crash-restart
  safety net; it does **not** survive a redeploy. Don't redeploy mid-game.
- The player page has no link back to the landing page, since players are given
  the `/player` link directly.
