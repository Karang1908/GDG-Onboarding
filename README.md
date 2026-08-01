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
  `localStorage`. It follows the device preference until the user overrides it.
  A blocking inline script sets the theme before first paint, so there is no
  flash of the wrong theme.
- **Logo**: `public/assets/gdg-logo.png`, top-left on every page. In dark mode it
  is inverted in CSS rather than swapped for a second file.

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

## Running locally

```bash
npm install
npm start
```

Then open http://localhost:3000. To test properly, open `/admin` in one window
and `/player` in a couple of others (or on your phone, using your machine's LAN
IP).

## Deploying to Render

> Heads up: this folder lives inside `~/Desktop`, which is itself a git repo. Run
> `git init` **in this folder** so you push only this project, not your whole
> Desktop:
>
> ```bash
> cd ~/Desktop/councilonboarding
> git init && git add . && git commit -m "Two truths and a lie"
> git branch -M main
> git remote add origin <your-repo-url> && git push -u origin main
> ```

1. Push this folder to a GitHub repo.
2. On Render: **New → Web Service**, point it at the repo.
3. Settings (or just let `render.yaml` apply them):
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/healthz`
4. Deploy. Render sets `PORT` itself; the server reads it.

### Keeping it awake with UptimeRobot

Render's free tier sleeps after ~15 minutes of inactivity and takes ~50s to wake.
Point an UptimeRobot HTTP monitor at:

```
https://<your-service>.onrender.com/healthz
```

with a 5-minute interval. Set this up **before** the meeting, not during it.

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
- **Reset game** — clears every player and starts over.

## Notes

- State lives in the server process. `state.json` is written as a crash-restart
  safety net; it does **not** survive a redeploy. Don't redeploy mid-game.
- The player page has no link back to the landing page, since players are given
  the `/player` link directly.
