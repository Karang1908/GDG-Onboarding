# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two distinct roles in the same live session:

- **Players** — new and returning council members of Google Developer Group,
  BITS Pilani Dubai Campus, joining an onboarding meeting. They open a link that
  is given to them directly on their own phones. Most are students; many are
  meeting each other for the first time. Their job: enter a name, write two true
  statements and one convincing lie, then watch for their turn.
- **Host** — one committee member running the meeting. Their job: get the room's
  attention on a wheel, land on a person, read the statements aloud, run the
  guessing, then reveal the answer. They are operating the screen while also
  talking to a room, so controls must be unmissable and hard to misfire.

Expected roster: **20–35 players** per session.

## Product Purpose

An icebreaker for a council onboarding meeting. It exists to make a room of
students who barely know each other learn something surprising about one
another quickly, with the wheel supplying the suspense and the fairness. Success
is a meeting where every person got a turn, nobody had to be picked by a human,
and the room laughed.

## Positioning

Unlike a generic spin-the-wheel tool, the game state is shared live across every
device: a player's submission appears on the host's screen the instant it is
locked in, and the host's screen genuinely does not know which statement is the
lie until they choose to reveal it. The secret is withheld by the server, not
hidden in the page.

## Operating Context

- The host screen is **shared over a video call** (Meet/Zoom screen-share).
  This is a hard design constraint: video compression destroys hairline strokes,
  low-contrast mid-tones, and subtle gradients. Motion is also degraded by
  compression and framerate drops.
- Players are on **phones**, on their own network, in a room or remote.
- The session is live and unrepeatable; a mistake mid-meeting is costly and
  visible to everyone.
- The host is talking while operating, so the interface is glanced at, not read.

## Capabilities and Constraints

- Three surfaces: a landing page (`/`), a player flow (`/player`), and a
  password-gated host console (`/admin`).
- Player flow is staged: enter name → write three statements and mark the lie →
  locked "waiting" state → "Your Turn!" when the wheel lands on them.
- Host flow is forced in order: Spin → Reveal → Next player. "Next player" is
  unavailable until Reveal has been pressed. "Put back" releases an accidental
  spin without burning a turn.
- Players who have had a turn stay on the wheel, greyed out, and are never
  picked again.
- Statements are shuffled server-side so the lie is not always in the slot the
  player typed it into.
- Realtime transport is WebSockets (Socket.IO); state lives in one long-lived
  Node process. Deployed on Render, kept awake by UptimeRobot.
- The host password comes from the `ADMIN_PASSWORD` environment variable and is
  never committed.
- The player page deliberately has **no** link back to the landing page, because
  players are given the `/player` link directly.

## Brand Commitments

- **Google Developer Group, BITS Pilani Dubai Campus.** The design must read as
  an official GDG surface.
- Logo asset at `public/assets/gdg-logo.png` (1221×204, transparent PNG). It
  must appear **top-left on every page**.
- User-specified and binding: Google's brand typography and color, a black and
  white base, a light and dark theme option, and pill-shaped buttons.

## Evidence on Hand

- Real logo asset (above). No other supplied brand assets — no photography, no
  illustration library, no committee headshots, no sponsor marks. Future work
  must not fabricate any of these.
- Player statements are user-generated at runtime; there is no seed content to
  design around, so empty and sparse states are the real first impression.

## Product Principles

1. **The room is the audience, not the operator.** The host screen is a
   broadcast surface first and a control panel second.
2. **Survive the compression.** Anything that only reads at full fidelity does
   not exist; assume a lossy video stream between the design and its viewer.
3. **The secret is the product.** Nothing in the interface may hint at which
   statement is the lie before the host reveals it.
4. **A misfire is public.** Destructive or irreversible controls must be
   visually subordinate and hard to hit by accident.
5. **Built to be inherited.** This will be reused by future GDG committees, so
   the brand system must be tokenised and documented, not hardcoded per page.

## Accessibility & Inclusion

- Must remain legible when screen-shared and re-compressed, which sets a
  practical contrast floor well above WCAG AA for body text and UI chrome.
- Both light and dark themes are required and both must meet contrast targets.
- Colour must never be the sole carrier of meaning — in particular TRUE vs LIE
  must also be conveyed by text, since GDG's palette is red/green heavy and
  red-green colour blindness is common.
