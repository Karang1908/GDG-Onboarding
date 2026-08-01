# Design

<!-- impeccable:design-system 1 -->

The visual system for GDG BITS Pilani Dubai Campus' Two Truths and a Lie.
Recorded from the built code, not from intention. Written to be inherited by the
next committee.

## The one constraint that shaped everything

The host screen is **shared over a video call**. Screen-share re-encodes the
frame at low bitrate, and the first things that die are hairline strokes, subtle
gradients, and low-contrast mid-tones. So:

- Borders are **2px**, never 1px. The wheel's slice rim is 3–5px.
- Surfaces are **solid fills**. There is no decorative gradient anywhere.
- Type on the host console is heavy (500/700) and large.
- The picked player's name is set at display scale, because a room reads it off
  a compressed stream from across the table.

If you change one rule in this file, do not change this one.

## Type

Self-hosted in `public/assets/fonts/` — nothing is fetched from a CDN at
runtime, so a hostile venue network cannot break the typography mid-meeting.

| Role | Face | Weights |
| --- | --- | --- |
| Display: h1/h2/h3, buttons, wheel labels, numerals | **Google Sans** | 400 / 500 / 700 |
| UI and body: paragraphs, inputs, chips, roster | **Google Sans Text** | 400 / 500 / 700 |

- `h1` `clamp(2.25rem, 5.5vw, 4rem)`, weight 700, tracking **-0.03em**
- `h2` `clamp(1.375rem, 2.4vw, 1.75rem)`, weight 500, tracking -0.015em
- `.lede` `clamp(1rem, 1.5vw, 1.1875rem)`, `--text-2`, max 60ch
- Headings use `text-wrap: balance`

## Colour

Black-and-white ground on Google's real neutral ramp. One blue carries every
action. The four brand colours are **reserved** — they appear on the wheel, the
waiting rhythm dots, and the footer marks, and nowhere else. That reservation is
what keeps the surface reading as Google rather than as a toy.

```
--g-blue  #4285F4   --g-red    #EA4335
--g-yellow #FBBC04  --g-green  #34A853
```

| Token | Light | Dark |
| --- | --- | --- |
| `--bg` | `#FFFFFF` | `#202124` |
| `--surface` / `--surface-2` / `--surface-3` | `#FFFFFF` / `#F8F9FA` / `#F1F3F4` | `#292A2D` / `#303134` / `#3C4043` |
| `--border` / `--border-strong` | `#DADCE0` / `#BDC1C6` | `#5F6368` / `#80868B` |
| `--text` / `--text-2` / `--text-3` | `#202124` / `#5F6368` / `#80868B` | `#E8EAED` / `#BDC1C6` / `#9AA0A6` |
| `--accent` / `--on-accent` | `#1A73E8` / `#FFFFFF` | `#8AB4F8` / `#202124` |
| `--success` / `--danger` | `#188038` / `#C5221F` | `#81C995` / `#F28B82` |

Elevation is Google's own two-layer shadow (offset + blur), not a flat halo:
`--shadow-1/2/3`.

### Two colour decisions worth keeping

1. **Wheel ink is always dark (`#202124`), never white.** White on the brand
   green measures ~3.0:1; dark ink measures 4.3–9.7:1 across all four brand
   colours. The wheel keeps dark ink in both themes because the slices are brand
   objects, not theme surfaces.
2. **TRUE/LIE never rely on colour alone.** Each verdict carries a word *and* a
   drawn glyph (check / cross). Red-green colour blindness is common and this
   palette is red-green heavy.

## Theme

Light and dark are both first-class. `data-theme` is written to `<html>` by a
blocking inline script in each page's `<head>`, so the correct theme is painted
on the first frame — there is no flash. The default is **light**, and
`prefers-color-scheme` is deliberately *not* consulted: this is projected in a
lit room, so an OS-level dark setting must not decide how the room sees it. Only
an explicit toggle, stored in `localStorage['gdg-theme']`, selects dark.

The canvas wheel cannot read CSS, so it reads its palette from the custom
properties via `getComputedStyle` and re-reads on the `themechange` event that
`theme.js` dispatches.

## Shape and motion

- Every control is a **pill** (`--pill: 999px`). Cards are `28px`, fields `12px`.
- Buttons: `.btn-filled` (primary), `.btn-tonal`, `.btn-outlined`, `.btn-text`,
  plus `.icon-btn`. Disabled goes to `--surface-3` / `--text-3` with no shadow.
- Fields are Material outlined with a floating label. **Blue means focus**, not
  merely "has content"; an errored field stays red even while focused.
- Motion is one authored moment per surface: the **wheel spin** (5.2s,
  `easeOutQuart`, server picks the winner and the client animates to that exact
  slice). Everything else is a 0.15–0.35s token ease. All decorative motion is
  disabled under `prefers-reduced-motion`.

## The wheel

The signature object, and the piece with the most rules.

- Slices cycle the brand four. When `n % 4 === 1` the last slice would collide
  with the first, so it is nudged to a different brand colour.
- **Labels degrade** for the real roster size (20–35): full name → first name →
  clipped first name with an ellipsis, measured against the available radius.
  Font size is derived from arc length per slice, clamped to 13–52px.
- Finished players **keep their slice**, greyed to `--surface-3`, so the wheel
  never reshuffles mid-game. The server refuses to pick them.
- The rim is drawn in `--wheel-rim` (the page background) so slices read as
  separated tiles after compression.
- Roster rows carry a colour swatch matching that player's slice, so a name on
  the list maps to the wheel.

## Page frame

`body` is a flex column with a **definite** `height: 100dvh` and `overflow:
hidden`; `main` is `flex: 1 1 auto; min-height: 0` with `overflow-y: auto`, and
`.footer` takes `margin-top: auto`.

Two rules here are load-bearing:

- **`height`, not `min-height`.** `min-height` is not a definite height, so no
  percentage or flex height constraint below it resolves — the roster then
  expands to all 24 rows and drags the page ~1300px past the viewport. This is
  what makes the whole fit-to-viewport layout work.
- **Do not reintroduce per-page `min-height: calc(100dvh - Npx)`.** That was the
  original approach and it made the footer's position wander page to page; the
  subtracted constant was a guess at the chrome height and was wrong everywhere
  but one page.

`main`'s `overflow-y: auto` is a safety valve, not the plan: content scales with
viewport height so it fits, but on an extreme viewport it scrolls there rather
than being clipped out of reach.

Because zoom shrinks the CSS viewport, vertical rhythm (paddings, gaps, textarea
heights, empty states) is sized in **vh**, not vw — at zoom it is height that
runs out first.

## Logo and mark

Two assets, two jobs:

- **Lockup** (wordmark + mark) in the app bar, `44px` tall desktop / `36px`
  mobile.
- **Mark alone** (`gdg-mark.png`, square, transparent) in the landing wheel's
  hub, and as the favicon (`favicon.png`, 256px). The hub is white in *both*
  themes because the mark carries a black outline that would vanish on the dark
  ground.

`public/assets/gdg-logo.png` is the untouched source. Two derived files ship:

- `gdg-logo-light.png` — resized only
- `gdg-logo-dark.png` — **only the black wordmark is recoloured to white**; the
  four-colour mark is pixel-identical

### Regenerating the dark logo

The recolour rule is "near-neutral and dark becomes white", which would also eat
the **mark's black outlines** — those must stay black in dark mode. So the rule
is gated on x position, and the geometry of the source matters:

| Region | Columns in `gdg-logo.png` (1221×204) |
| --- | --- |
| Chevron mark (both halves) | 35 – 272 |
| Gap between the two halves | 145 – 162 |
| Gap before the wordmark | 273 – 310 |
| Wordmark starts | 311 |

Gate the recolour at **x ≥ 292**. Do not derive that cutoff by "first
transparent column after the mark" — the mark's own two halves have a gap at
145, and using it recolours the right half's outlines white while leaving the
left half black.

They are swapped by CSS on `data-theme`. Do **not** reintroduce a CSS filter for
this: `invert()` turned the brand yellow brown and the red salmon. Both files are
128px tall, which covers 3.7× DPR at the 34px render size.

## Player statements are hostile input

Statements are free text typed by students, and the server only caps them at 240
characters — it does not require spaces. A single unbroken 240-character token
will blow a card past the edge of the page unless it is allowed to break
mid-word. Both places statements render carry `overflow-wrap: anywhere`:

- `.statement-list li` — the player's own screen
- `.claims li` — the host console (plus `min-width: 0` on the grid child, or the
  `1fr` track refuses to shrink)

This matters more on the host console than anywhere else: that screen is
projected to the room, and a horizontal overflow there is visible to everyone.

## Master Reset

One button, `#reset-btn`, styled `.btn-danger` — outlined and red, never filled,
because it sits next to the primary action and a misfire is public. It:

1. wipes all players, statements, and turn history on the server;
2. emits a global `game:reset` to **every** connected socket (not just players
   still on record), which makes each player client drop its stored session and
   empty its form fields;
3. leaves the room able to play again immediately, same names allowed.

Clearing the form matters: without it a player who re-joins finds their previous
statements still sitting in the textareas.

## Rules this system follows

Drawn from the craft floor, and worth keeping:

- **No eyebrows / kickers** above headings. The heading carries its own weight.
- **No emoji as icons.** Every icon is a drawn SVG symbol in one consistent
  weight, inlined per page as a `<defs><symbol>` sprite.
- No gradient text, no glass-as-decoration, no hairline borders.
- Empty states are authored, not blank: the wheel, the spotlight, and the roster
  each say what is missing and what to do about it.
- Errors name the problem and the recovery, and move focus to the field at fault.

## Where to change things

All tokens are the first ~140 lines of `public/style.css`. To restyle for a
future GDG event, change the token block — not the components. Component rules
below the token block reference variables only.
