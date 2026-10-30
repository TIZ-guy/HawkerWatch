# Task: front-end UI rebuild

Brief for Claude Code. Rebuilds the HawkerWatch front end on a new visual system.
Back-end routes and payloads do not change.

**Reference prototype:** the agreed look is "place-card list rows on Discover,
timetable tables inside a centre" — full-width list, photos at thumbnail scale,
colour reserved for queue status, map only on the centre page and `/map`.

## Hard constraints

- **Light theme only.** No dark mode, no `data-bs-theme`, no theme toggle.
- **No new dependencies.** Only what is already in `frontend/package.json`:
  Bootstrap 5.3, bootstrap-icons, Vue 3, Vue Router, Pinia, Axios, Leaflet.
  No Tailwind, no UI kit, no icon packs beyond bootstrap-icons.
- **Course techniques first.** Bootstrap 5 utilities and components (grid, navbar,
  card, badge, table, nav tabs, offcanvas, accordion, alert, spinner, form-control,
  input-group, list-group), Vue 3 `<script setup>` SFCs, Pinia stores, Vue Router,
  Axios. Where Bootstrap has a class, use the class rather than hand-written CSS.
- **Plain CSS for the rest**: custom properties, `position: sticky`, CSS grid,
  `object-fit`, one Google Fonts link. Nothing exotic.
- **Keep it simple.** No new abstractions, no composables unless a thing is used in
  three or more places, no renaming of props or events that already work.
- Keep every existing feature: search, filters, postal-code search, distance,
  favourites and alerts, reviews with photos, comments, status reports, 2FA, admin
  remove, map. This is a reskin plus a layout change, not a feature change.

## Depends on

`docs/stall-data-and-cuisine-rework.md`. The stall table has a **Dish** column
backed by `stall.speciality`, and the filter chips use the fixed `cuisine` enum.
Do the cuisine rework first, or leave the Dish column out and add it after.

---

## 1. Design tokens

Replace the whole of `frontend/src/style.css` with the following. Everything else in
the rebuild reads from these; no component should hard-code a colour.

```css
/* HawkerWatch design tokens. Light only.
   Colour rule: the only coloured things on a page are queue statuses and the one
   brick accent on primary actions. Everything else is ink, dim or a neutral line. */
:root {
  --bg: #ffffff;
  --sub: #faf9f7;          /* hover fill, tag fill, zebra */
  --line: #e6e3dd;         /* default border */
  --line-strong: #d6d2ca;  /* input border, pill border */
  --ink: #1a1a19;
  --dim: #6f6b64;          /* secondary text */
  --brick: #a32f26;        /* primary action only */

  /* queue status */
  --q-open: #1d6b4f;
  --q-short: #2b6397;
  --q-mod: #96620f;
  --q-long: #a32f26;
  --q-shut: #83807a;

  /* notice */
  --warn-bg: #fdf8ea;
  --warn-line: #ecd9a8;
  --warn-ink: #7c5a08;

  --radius: 12px;          /* cards, list rows */
  --radius-sm: 8px;        /* inputs, buttons, small tiles */

  /* Bootstrap overrides, so its components inherit the system */
  --bs-body-bg: var(--bg);
  --bs-body-color: var(--ink);
  --bs-secondary-color: var(--dim);
  --bs-border-color: var(--line);
  --bs-border-radius: var(--radius-sm);
  --bs-border-radius-lg: var(--radius);
  --bs-link-color: var(--brick);
  --bs-link-hover-color: #7f241e;
  --bs-font-sans-serif: "Hanken Grotesk", system-ui, -apple-system, sans-serif;
}

body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--bs-font-sans-serif);
  -webkit-font-smoothing: antialiased;
}

/* Headings are tight and heavy; this is the main thing that stops it looking
   like default Bootstrap. */
h1, h2, h3, h4, h5, .hw-title {
  font-weight: 800;
  letter-spacing: -0.03em;
}

h1, h2 { text-wrap: balance; }

/* Figures, timestamps and unit numbers line up in columns */
.hw-mono {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}

/* Queue status: a dot plus a label, coloured by status */
.hw-q {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 700;
  white-space: nowrap;
}

.hw-q::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}

.hw-q-open { color: var(--q-open); }
.hw-q-short { color: var(--q-short); }
.hw-q-mod { color: var(--q-mod); }
.hw-q-long { color: var(--q-long); }
.hw-q-shut { color: var(--q-shut); }

/* Soft pill version, for use inside dense rows where a dot is too small */
.hw-pill { font-weight: 700; border-radius: 999px; padding: 0.25rem 0.55rem; font-size: 0.78rem; }
.hw-pill-open { background: #e6f2ec; color: var(--q-open); }
.hw-pill-short { background: #e7eff6; color: var(--q-short); }
.hw-pill-mod { background: #fbf1dc; color: var(--q-mod); }
.hw-pill-long { background: #f8e8e6; color: var(--q-long); }
.hw-pill-shut { background: var(--sub); color: var(--q-shut); }

/* One bordered surface, used for list rows and rail panels only */
.hw-surface {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg);
}

a.hw-surface:hover, .hw-surface-hover:hover {
  border-color: var(--line-strong);
  background: var(--sub);
}

/* Filter pill */
.hw-chip {
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--bg);
  color: var(--ink);
  font-size: 0.8rem;
  padding: 0.35rem 0.75rem;
  white-space: nowrap;
}

.hw-chip[aria-pressed="true"] {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
  font-weight: 600;
}

/* Photo frames. Fixed heights so rows stay aligned when a photoUrl is missing. */
.hw-photo { background: var(--sub); object-fit: cover; display: block; width: 100%; }
.hw-photo-thumb { height: 84px; border-radius: var(--radius-sm); }
.hw-photo-banner { height: clamp(150px, 26vw, 232px); border-radius: var(--radius); }
.hw-photo-tile { width: 92px; height: 70px; border-radius: var(--radius-sm); }

/* Placeholder shown when a centre has no photoUrl */
.hw-photo-none {
  display: grid;
  place-items: center;
  color: var(--dim);
  background: var(--sub);
  border: 1px solid var(--line);
}

:focus-visible { outline: 2px solid var(--brick); outline-offset: 2px; }
```

Delete the old `--hw-cream`, `--hw-red`, `--hw-orange`, `--hw-ink`, `.eyebrow` and
`.accent-card` rules. `.eyebrow` and `.accent-card` are used in several views;
remove each usage as you reach that file (section 4 says what replaces it).

### Fonts

In `frontend/index.html`, inside `<head>` before the module script:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap" />
```

Hanken Grotesk for everything, IBM Plex Mono only for timestamps, unit numbers and
figures (`.hw-mono`).

### Rules the whole UI follows

1. **Colour means status.** Queue status is the only thing on a page that is
   coloured, apart from `--brick` on the one primary action per view. Nothing else
   gets `text-danger`, `text-bg-success` or similar.
2. **Two surfaces only.** A border and radius go on list rows and rail panels.
   Nothing else is a card. No `shadow-sm` anywhere — remove every one.
3. **No hero graphics.** Headings do the work; a page opens with a heading, a line
   of context, then controls.
4. **Spacing** comes from Bootstrap gap/padding utilities (`g-3`, `gap-2`, `py-4`),
   not margins on individual elements.
5. **Figures and times** get `.hw-mono`.

---

## 2. Status display

`frontend/src/utils/status.js` — keep the keys and the `statusDisplay()` signature,
swap the Bootstrap badge classes for the new ones so every consumer updates at once:

```js
export const STATUS_DISPLAY = {
  OPEN: { label: 'Open', qClass: 'hw-q-open', pillClass: 'hw-pill-open', dotColor: 'var(--q-open)', icon: 'bi-check-circle' },
  SHORT_QUEUE: { label: 'Short queue', qClass: 'hw-q-short', pillClass: 'hw-pill-short', dotColor: 'var(--q-short)', icon: 'bi-person' },
  MODERATE_QUEUE: { label: 'Moderate queue', qClass: 'hw-q-mod', pillClass: 'hw-pill-mod', dotColor: 'var(--q-mod)', icon: 'bi-people' },
  LONG_QUEUE: { label: 'Long queue', qClass: 'hw-q-long', pillClass: 'hw-pill-long', dotColor: 'var(--q-long)', icon: 'bi-people-fill' },
  TEMPORARILY_CLOSED: { label: 'Temporarily closed', qClass: 'hw-q-shut', pillClass: 'hw-pill-shut', dotColor: 'var(--q-shut)', icon: 'bi-x-circle' }
}
```

Keep `STATUS_ORDER` and the `UNKNOWN_STATUS` fallback (give it `hw-q-shut` /
`hw-pill-shut`). `badgeClass` goes away — grep for it and fix every usage.

`StatusBadge.vue` gains a `variant` prop, `'dot'` (default) or `'pill'`:

```html
<span v-if="variant === 'pill'" class="badge hw-pill" :class="display.pillClass">{{ display.label }}</span>
<span v-else class="hw-q" :class="display.qClass">{{ display.label }}</span>
```

The dot form drops the bootstrap icon — the coloured dot replaces it. Keep the icon
in the pill form out too; the label is enough.

---

## 3. Shared components

### New: `frontend/src/components/CentrePhoto.vue`

Used by the list row and the centre banner, so the missing-photo case is handled once.

```html
<script setup>
const props = defineProps({
  centre: { type: Object, required: true },
  size: { type: String, default: 'thumb' } // 'thumb' | 'banner'
})
</script>

<template>
  <!-- alt="" is right: the centre name is always next to it -->
  <img
    v-if="centre.photoUrl"
    :src="centre.photoUrl"
    alt=""
    loading="lazy"
    class="hw-photo"
    :class="size === 'banner' ? 'hw-photo-banner' : 'hw-photo-thumb'"
  />
  <div
    v-else
    class="hw-photo hw-photo-none"
    :class="size === 'banner' ? 'hw-photo-banner' : 'hw-photo-thumb'"
    aria-hidden="true"
  >
    <i class="bi bi-shop"></i>
  </div>
</template>
```

### New: `frontend/src/components/StallTable.vue`

The stall list inside a centre. Replaces the grid of `StallCard`s there.
`StallCard.vue` stays for Favourites, Home stall results and `StallView`'s status box.

- Props: `stalls` (Array), `centre` (Object, for the report form).
- Columns: Unit, Stall, Dish, Queue, Reported. Unit and Reported use `.hw-mono`.
- Stall cell: name as a `RouterLink` to `/stalls/:id` (`text-reset text-decoration-none`),
  cuisine and star rating on a second line in `small text-secondary`.
- Queue cell: `<StatusBadge :status="..." />` (dot form), or `<span class="text-secondary">No reports</span>`.
- Wrap in `<div class="table-responsive">` with `<table class="table align-middle mb-0">`;
  `<thead>` cells get `small text-uppercase text-secondary fw-semibold`.
- Keep the `id="stall-{{ stall._id }}"` anchor on each row — `StallView` links back to it.
- Row click is the name link only; do not make the whole row clickable.

### Changed: `frontend/src/components/HawkerCentreCard.vue` → list row

Same name, same props (`centre`, `distanceKm`), same slot. New markup: a two-column
grid, photo then body, as one bordered row rather than a shadowed card.

```html
<article class="hw-surface hw-surface-hover p-3 position-relative d-grid gap-3 centre-row">
  <CentrePhoto :centre="centre" />
  <div class="min-w-0 d-flex flex-column">
    <div class="d-flex justify-content-between align-items-start gap-2">
      <div class="min-w-0">
        <h3 class="h6 mb-1">
          <RouterLink class="stretched-link text-reset text-decoration-none" :to="`/hawker-centres/${centre._id}`">
            {{ centre.name }}
          </RouterLink>
        </h3>
        <p class="small text-secondary mb-2">
          <!-- area/address, distance, stall counts, separated by middots -->
        </p>
      </div>
      <FavouriteButton class="flex-shrink-0 position-relative" target-type="HawkerCentre" :target-id="centre._id" :name="centre.name" />
    </div>
    <!-- cuisine tags: up to 3, small bordered spans -->
    <div class="mt-auto d-flex flex-wrap align-items-center gap-2 small">
      <!-- live status + .hw-mono timestamp, or ClosureBadge when closed -->
    </div>
  </div>
  <slot />
</article>
```

```css
.centre-row { grid-template-columns: 112px 1fr; }
@media (max-width: 460px) { .centre-row { grid-template-columns: 84px 1fr; } }
```

Notes:

- `FavouriteButton` needs `position-relative` so `stretched-link` does not cover it.
- Add `.min-w-0 { min-width: 0 }` to `style.css` — needed on grid children holding text.
- Drop the hover `transform` and the `shadow-sm`; the border/fill change is the hover.
- Drop the "View stalls and updates →" line. The whole row is the link now.
- Cuisine tags need the centre's cuisines. The centre list API does not return them
  today, so either add a `cuisines` array to the centre list response (preferred, a
  `distinct` on the centre's active stalls) or leave the tag row out. **Do not fetch
  stalls per row.**

### Changed: `StallCard.vue`, `CommunityUpdateCard.vue`, `ClosureBadge.vue`

- Swap `card border-0 shadow-sm` for `hw-surface`, keep the inner padding utilities.
- Replace every `text-danger` / `btn-outline-danger` with `text-brick` /
  `btn-outline-dark`, except the one primary button per view, which becomes
  `.btn.hw-btn-primary` (add to `style.css`: `background: var(--brick); color: #fff; border: 0;`).
- `ClosureBadge`: use the warn tokens — `border: 1px solid var(--warn-line)`,
  `background: var(--warn-bg)`, `color: var(--warn-ink)` — instead of a Bootstrap
  badge colour.
- `StarRating.vue`: stars in `var(--q-mod)`, count in `small text-secondary`.
- `LoadingState.vue` / `ErrorState.vue`: keep as-is but drop any card/shadow wrapper.

### Changed: `FilterChips.vue`

Keep the component and its API (`options`, `multiple`, `label`, `small`, `v-model`).
Change only the classes: `btn rounded-pill` plus `btn-danger`/`btn-outline-secondary`
becomes `hw-chip`, with the selected state driven by the existing `aria-pressed`
binding (the CSS above keys off it). Remove the `btn-*` classes entirely.

### Changed: `SearchBar.vue`, `PlaceSearch.vue`

`form-control` keeps working through the Bootstrap variable overrides. Add
`border-color: var(--line-strong)` and drop any `shadow`. Use an `input-group` with
a `bi-search` prefix so search fields read as search.

---

## 4. View-by-view

### `App.vue`

- Navbar: `navbar navbar-expand-lg bg-white border-bottom sticky-top`, keep the
  collapse and toggler. Remove `text-danger` from the brand; style it as
  `fw-bold` ink with "Watch" wrapped in `<span class="text-brick">`.
- Remove the `bi-geo-alt-fill` icon from the brand.
- Nav labels: **Discover, Map, Reports, Saved, Profile** (rename "Explore Map" →
  "Map", "Community reports" → "Reports", "Favourites" → "Saved"). Update nothing
  in the router — paths stay.
- Active link: `.nav-link.router-link-active` becomes ink + `fw-semibold` with a 2px
  bottom border in `--ink`, not red text.
- Log in / Log out buttons: `btn-sm btn-outline-dark` and `btn-sm hw-btn-primary`.

### `HomeView.vue` — Discover

The current two-card hero and the nested filter card both go. New order:

1. `<h1 class="display-6">See the queue before you go</h1>` plus one
   `lead text-secondary` line (keep the existing copy about community updates
   expiring after 60 minutes — move it to the foot of the page instead).
   Remove the `.eyebrow` span.
2. One search row: `SearchBar` and `PlaceSearch` side by side in a `row g-2`, with a
   `hw-btn-primary` Search button. No card around them.
3. One `FilterChips` row for `quickFilters`, then the cuisine chips, then the
   distance chips when `nearMe || searchedPlace` — all directly on the page, no card,
   `gap-2` between rows.
4. A results header row: `<h2 class="h5">{{ centres.length }} centres…</h2>` on the
   left, the sort/radius note on the right, with a `border-bottom`.
5. **Full-width list, one column:** `<div class="d-grid gap-3">` of
   `HawkerCentreCard`. Drop the `row g-4` / `col-sm-6 col-lg-4` grid — rows are
   full width now.
6. Stall results section unchanged in behaviour; keep `StallCard` in a
   `row g-3` / `col-md-6` grid so it reads differently from the centre list.
7. Footer line: "123 centres · 1,437 stalls · community reports expire after
   60 minutes" in `small text-secondary`. Use the real counts if the API gives them.

Keep every bit of the existing script: debounced search, `loadResults`, distance
sorting, `clearFilters`, the `is-refreshing` opacity, the location error alert.
**No map panel on this page** — the map stays on `/map` and the centre page.

### `HawkerCentreView.vue`

New order:

1. Breadcrumb: `Discover › {{ area }} › {{ centre.name }}` in `small text-secondary`.
2. `<CentrePhoto :centre="centre" size="banner" />`.
3. Title block: `h1`, then a `d-flex flex-wrap gap-3 small text-secondary` meta row
   (address with postal code, opening note, distance). Favourite button sits here.
4. Figures strip — four cells in one bordered box, `.hw-mono` values:
   Stalls (`foodStallCount`), Listed here (stall count), Live reports, Rating.

   ```html
   <dl class="hw-surface d-flex flex-wrap m-0 overflow-hidden hw-stats">
     <div class="p-3 flex-fill min-w-0"><dt class="small text-uppercase text-secondary">Stalls</dt><dd class="h5 hw-mono mb-0">103</dd></div>
     <!-- … -->
   </dl>
   ```

   ```css
   .hw-stats > div + div { border-left: 1px solid var(--line); }
   ```

5. `OfficialClosureAlert` directly under it, restyled with the warn tokens.
6. Two columns, `row g-4`: `col-lg-8` main, `col-lg-4` rail.
   - **Main:** `nav nav-tabs`-style tabs for Stalls / Reviews / Comments (use
     Bootstrap nav with `nav-underline`, which matches the flat look better than
     `nav-tabs`), the stall search field, the cuisine `FilterChips`, then
     `<StallTable>`. Keep the "Add a stall" button and `StallForm`.
   - **Rail (`position-sticky` with `top: 1rem` at `lg` and up):**
     `CentreMap` inside a `hw-surface overflow-hidden` panel, then the report-queue
     panel (`ReportStatusForm`), then the favourite-reminder panel.
7. Under the tabs, a review-photo strip: the most recent review photos as
   `.hw-photo-tile` images from `/api/review-photos/:id`, in a `d-flex flex-wrap gap-2`.
   `PhotoGallery.vue` already renders review photos — reuse it, just give it the tile class.

Keep the existing `cuisineOptions` computed, the local filtering, the `#stall-…`
hash scrolling and the add/edit/remove flows exactly as they are.

### `StallView.vue`

- Replace the `.eyebrow` span with a breadcrumb back to the centre (the link is
  already there — restyle it as `small text-secondary` with `bi-arrow-left`).
- Title block: `h1`, then one meta line — dish (`speciality`), cuisine, `Unit #…`
  in `.hw-mono`, centre name as a link. Then `StarRating`.
- Action row: `FavouriteButton` with label, "Write a review" as
  `btn-sm btn-outline-dark`, Edit and Remove as `btn-sm btn-outline-secondary`.
  Only the review button is `hw-btn-primary`.
- Keep the `row g-4` of closure alert + live status, but put both in `hw-surface`
  panels instead of bare sections.
- `ReviewSection` unchanged in behaviour; restyle its cards as `hw-surface` and its
  submit button as `hw-btn-primary`.

### `ExploreMapView.vue`

- Keep the `col-lg-8` map / `col-lg-4` aside split and all the Leaflet code.
- Map panel: `hw-surface overflow-hidden` instead of `card border-0 shadow-sm`.
- The centre list in the aside becomes a `d-grid gap-2` of compact rows
  (name, area, live status dot, `.hw-mono` distance) in one `hw-surface`, not a card
  per centre. Make it `position-sticky` at `lg` and up.
- Marker colours must come from the status tokens — pass `dotColor` from
  `statusDisplay()` into the Leaflet `circleMarker` `fillColor` so the map agrees
  with the list. Keep the white 3px stroke.

### `CommunityReportsView.vue`

- Heading, then the report form in one `hw-surface` panel (keep the `row g-3` fields).
- Feed: `d-grid gap-3` of `CommunityUpdateCard` as `hw-surface` rows, each with the
  status dot, stall and centre names, and a `.hw-mono` timestamp.
- Keep the flag/moderation controls and the auto-refresh behaviour.

### `FavouritesView.vue`

- Keep the three sections (Hawker centres, Stalls, No longer listed).
- Centres: `d-grid gap-3` full-width `HawkerCentreCard` rows, matching Discover.
- Stalls: keep the `row g-3` `StallCard` grid.
- Empty state: a `hw-surface` panel with a heading, one line and a
  `hw-btn-primary` "Browse centres" link. No card shadow.

### `ProfileView.vue`

- Keep the `col-lg-5` / `col-lg-7` split and all four sections.
- Each section becomes `hw-surface` with `p-4`; remove `card border-0 shadow-sm`.
- Section headings `h2.h6 text-uppercase` with letter-spacing, so the page reads as
  settings rather than content.
- One primary button per form (`hw-btn-primary`), the rest `btn-outline-dark`.
- `TwoFactorSettings.vue` follows the same treatment.

### `LoginView.vue` / `RegisterView.vue`

- Keep the centred `col-lg-5` column and both forms, including the 2FA challenge step.
- Drop the card: put the form directly on the page with a `hw-surface p-4` wrapper.
- Remove the `.eyebrow`; lead with the `h1`.
- Submit button `hw-btn-primary w-100`; the cross-link ("Create an account" /
  "Log in") as a plain text link below.
- `PasswordChecklist.vue` / `PasswordInput.vue`: keep the logic, use `--q-open` for
  met rules and `--dim` for unmet, instead of green/grey Bootstrap text classes.

---

## 5. Responsive and accessibility

- Breakpoints: the list is one column at every width; the centre page rail drops
  below the main column under `lg`; the figures strip wraps.
- Every `table` lives in `.table-responsive`. At phone width the stall table scrolls
  horizontally — that is accepted, do not switch to a card layout.
- Any grid or flex child holding text gets `min-w-0`.
- Chips are real `<button>`s with `aria-pressed` (already true of `FilterChips`).
- Status is never colour alone — the label is always present next to the dot.
- Keep the `:focus-visible` outline from the tokens; do not remove outlines.
- Check contrast after the change: `--dim` on `--bg` is 5.4:1, and every status
  colour on `--bg` is above 4.5:1. Do not lighten them.

## 6. Order of work

1. `style.css`, `index.html` fonts, `status.js`, `StatusBadge.vue` — the system.
2. `FilterChips.vue`, `CentrePhoto.vue`, `HawkerCentreCard.vue`, `StallCard.vue`,
   `ClosureBadge.vue`, `StarRating.vue` — shared pieces.
3. `App.vue`, then `HomeView.vue` — check the list reads well before going further.
4. `StallTable.vue`, then `HawkerCentreView.vue`.
5. `StallView.vue`, `ExploreMapView.vue`, `CommunityReportsView.vue`,
   `FavouritesView.vue`, `ProfileView.vue`, `LoginView.vue`, `RegisterView.vue`.
6. Grep for leftovers: `shadow-sm`, `text-danger`, `btn-danger`,
   `btn-outline-danger`, `text-bg-`, `eyebrow`, `accent-card`, `--hw-`. All should
   be gone.
7. `pnpm test:unit` in `frontend/`. Component tests that assert on `badgeClass` or
   on `btn-danger` will fail — update the assertions to the new classes rather than
   changing the components back.

## 7. Done when

- No page has a box-shadow, and borders appear only on list rows, rail panels and
  inputs.
- The only coloured text on Discover is the queue status on each row.
- Discover is a single full-width column of photo rows; no map panel.
- A centre page shows a banner photo, four figures, tabs, a stall table, and a rail
  with the map above the report form.
- Every centre without a `photoUrl` still lines up with its neighbours.
- Nav reads Discover / Map / Reports / Saved / Profile, with an ink active state.
- `pnpm test:unit` passes and nothing in `frontend/package.json` changed.
