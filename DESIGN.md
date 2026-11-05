# Squeekverse design

## Overview

Squeekverse is a tiny 3D planet lit by a real hamster's wheel, for people following Squeekchain. A WebGL planet fills the screen behind everything (`src/world/scene.ts`). Each room is a printed "seed packet" sheet slid over it, and the dock moves between rooms. Rooms are built as HTML strings in `src/rooms/*.ts` and styled from the single sheet `src/style.css`.

The look comes from seed packet printing: flat ink colours, a display serif, and solid offset shadows in ember that read like misregistered print. The sky is the real state of the wheel, so every surface has to work in night, day and lost themes. Copy is plain and calls the hamster "he".

## Colors

Tokens are declared in `src/style.css`. Six of them change with the sky through `html[data-sky]`, which `src/lib/store.ts` sets.

| Token | Night (default) | Day | Lost | Job |
| --- | --- | --- | --- | --- |
| `--sky-top` | `#120d30` | `#1f5ee0` | `#262538` | Top of the sky, page background |
| `--sky-low` | `#3b2a78` | `#9fdcff` | `#5e5b72` | Bottom of the sky |
| `--packet` | `#241b57` | `#fff1c9` | `#2e2d42` | Room, dock and card surface |
| `--ink` | `#fff1c9` | `#23194f` | `#f1eee0` | Primary text |
| `--ink-soft` | `#c9bdf0` | `#57507f` | `#b9b6c7` | Secondary text |
| `--line` | `#4a3a93` | `#e2cf95` | `#55536c` | Borders and dividers |

Fixed in every sky:

| Token | Value | Job |
| --- | --- | --- |
| `--sunflower` | `#ffc62b` | Primary action, selected state, focus ring, race progress |
| `--ember` | `#ff8a3d` | Offset shadows, bar fill, warnings, the hamster |
| `--leaf` | `#2f8f5b` | Field and foliage art |
| `--moth` | `#b9a7f5` | Night accents, odds bars, the race pace marker |
| `--soil` | `#2a1a12` | Race lane, flower centres |

Literal colours in use: `#23194f` is the dark ink on sunflower fills, and `#fff1c9` is the light ink on dark art. The race infield is `#1f6b43`, the stem green from `shared/sunflower.ts`, chosen over `--leaf` so light text on it stays readable.

## Typography

Both families are bundled through `@fontsource` and imported at the top of `src/style.css`.

- **Display:** `--display`, `'Caprasimo', Georgia, serif`, weight 400. Used for headings, large numbers and fieldset legends.
- **Body:** `--body`, `'Figtree Variable', system-ui, sans-serif`. Regular for text, 600 to 700 for labels and buttons.
- **Numbers that change:** `.num` sets tabular figures.

| Role | Size | Where |
| --- | --- | --- |
| Room title | `clamp(2rem, 3.6vw, 3rem)` | `.room h2`, line height 1.05 |
| Large figure | `clamp(2.4rem, 5vw, 3.6rem)` | `.big`, line height 1 |
| Section title | `1.3rem` | `.room h3`, `.race-goals legend`, `.race-goal` |
| Body | `1rem` | `body`, line height 1.5 |
| Small | `.875rem` | `.small`, `.goal span` |
| Fine print | `.8rem` | `.axis`, `.gallery figcaption`, `.race-track text` |

The home page adds larger sizes of its own (`.hero h1`, `.beat h2`). The race room adds no new sizes.

## Layout

- `--gutter` is `clamp(16px, 3.4vw, 40px)` and `--dock` is `74px`, or `70px` on phones.
- `.room` is a fixed sheet. On desktop it sits on the right, `min(560px, 46vw)` wide, above the dock.
- At `max-width: 860px` it becomes a sheet rising from below, with its top at `34svh`, so the planet keeps the top of the screen. Rooms scroll inside themselves.
- `.room section + section` separates sections with a dashed `--line` rule.
- `.row` is a wrapping flex row, `.row.spread` pushes its ends apart, and `.stack` is a 10px grid.
- `.dock` scrolls sideways when its items do not fit. The Distance race item is fourth, so it is on screen at 320 and 390 wide without scrolling.
- `.goal-row` wraps, and each `.goal` grows from a 60px basis, so the goals share one row at 390 wide and wrap at narrower widths.
- `.race-track` scales with the room's width from a 360 by 200 viewBox.

## Elevation & Depth

There are no blurred shadows on surfaces. Depth comes from solid offset shadows and from stacking order.

- `.stamp` has `3px 4px 0 var(--ember)`, growing on hover and collapsing on press.
- `.beat .copy` and `.hero .label` have `4px 5px 0 var(--ember)`.
- `.goal input:checked + span` has the same shadow as `.stamp`.
- The race track repeats this in its art: an ember copy of the lane sits offset by 3 and 4 units.
- Outlined controls and notes use an inset 2px ring, such as `inset 0 0 0 2px var(--line)`.
- Stacking: world canvas below, then `.room` (10), `.topbar` (20), `.dock` (30).

## Shapes

- Pills, `999px`: `.stamp`, `.pulse`.
- 18px: home copy cards. 12 to 14px: inputs, notes, `.keeper`, `.holder`, `.goal span`. 6px: `.bar`.
- Phone sheets round their top corners by 20px.
- The race track is a stadium, with its geometry in `shared/race.ts` (`TRACK_PATH`, `trackPoint`).

## Components

**Stamp button**, `.stamp` and `.stamp.quiet` in `src/style.css`. The filled version is the view's main action. The quiet version is an inset ring, for secondary actions. States: hover, active, `[disabled]`.

**Link button**, `.link-button`. A low weight action that looks like underlined text, 44px tall.

**Goal picker**, `.race-goals`, `.goal-row` and `.goal` in `src/rooms/race.ts`. A fieldset of native radios with the input laid invisibly over its label, so arrow keys and clicks are the browser's own. The label is 48px tall. Selected uses a sunflower fill and ember shadow, plus darker text, and keyboard focus puts the sunflower ring on the label.

**Race track**, `.race-track`, `.race-marker` and `.race-wheel` in `src/rooms/race.ts`. An inline SVG with `role="img"` and a label that states progress.
- A sunflower stroke over a soil lane shows the settled share, through `pathLength="100"` and `stroke-dasharray`.
- The hamster marks settled work. A moth diamond marks usual pace. They differ in shape as well as colour, and `.race-key` names both.
- Markers move by a one second transform transition, off under reduced motion.
- The wheel turns only when the sky is day, at the real rpm, and only with `prefers-reduced-motion: no-preference`.

**Race states**, in `update()` in `src/rooms/race.ts`: no goal picked, waiting for the settled record, running, and finished. Status text is in `role="status"` regions that exist from the start and change only when their text does. A restart can be undone with the Undo button. A typed goal that fails shows `.note.warm` tied to the field by `aria-describedby`, and focus returns to the field.

**Bar**, `.bar` with an inner `i`. **Note**, `.note` and `.note.warm`. **Tables**, plain `table` with `.r` for right aligned figures.

**Dock**, `.dock` in `src/main.ts`. Links with a 24px icon from `ICONS`. `aria-current="page"` fills the item with sunflower.

## Do's and Don'ts

- Do start a new room from `<header><h2>` then `<section>` blocks, inside the `Room` type from `src/rooms/ui.ts`.
- Do use `.stamp` once per view for the main action, and `.stamp.quiet` or `.link-button` for the rest.
- Do use `--packet`, `--ink`, `--ink-soft` and `--line` for anything on a sheet, so that it follows the sky. Check art in day as well as night.
- Do keep live values updating in place with `onLive`, without rewriting the room, so focus and scroll survive. `src/rooms/race.ts` shows the pattern.
- Don't add blurred shadows, gradients on text, or small tracked capitals above headings.
- Don't change contract addresses outside `shared/chain.ts`, or mix round numbers from `history` and `live`, since they can come from different deployments.
- Don't use emoji or dash symbols in room copy.

To add a room:

1. Write `src/rooms/<name>.ts` exporting a `Room`.
2. Add its id to `PlaceId`, plus a spot and a landmark in `src/world/landmarks.ts`.
3. Add its icon and an entry in `PLACES` in `src/main.ts`, which also gives it a hash route.
4. Put pure logic in `shared/` with a test in `tests/`.
5. Run `npm run build` and commit `dist/`.
