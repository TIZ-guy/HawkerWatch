# Task: stall data import + cuisine rework

Brief for Claude Code. Everything below is to be implemented in this repo.
Keep to the existing style of each file: `backend/utils/` and `backend/controllers/`
use 4-space indent and semicolons; `backend/models/`, `backend/scripts/` and the Vue
files use 2-space indent and no semicolons. Keep it simple — plain Mongoose, plain
Vue 3 `<script setup>`, Bootstrap classes already in use. No new dependencies.

---

## 1. What changes

### 1a. `cuisine` becomes a category, not a dish

Today `Stall.cuisine` is free text and holds dish names ("Chicken rice", "Laksa",
"Char kway teow"). Filter chips are built by counting whatever text users typed, so
the chips are long, inconsistent and duplicate each other.

After this change:

| field | type | holds |
| --- | --- | --- |
| `cuisine` | enum, optional | one of 12 fixed categories — `Chinese`, `Malay`, … |
| `speciality` | free text, optional, max 60 | the dish — "Chicken rice", "Laksa" |

`cuisine` drives filtering (exact match, fixed chips). `speciality` is display only
and is searched alongside the name.

The 12 categories, in this order (chip order follows it):

```
Chinese, Malay, Indian, Peranakan, Western, Japanese, Korean, Thai, Vietnamese, Dessert, Drinks, Others
```

Notes on the taxonomy, so later edits stay consistent:

- `Dessert` and `Drinks` are kept as categories because hawker centres really do
  have dessert and drinks stalls, and users look for them.
- `Indonesian` folds into `Malay`; `Sri Lankan`/`Pakistani` into `Indian`;
  `Seafood`/`Vegetarian`/zi char into `Chinese`. Halal is *not* in the list — it is a
  certification, not a cuisine, and it would need its own boolean field to be honest.
- `Others` is the escape hatch (Middle Eastern, fusion, mala, etc.).

### 1b. Stall data for every hawker centre

`backend/data/stalls.json` (already in this repo) holds 1437 stalls across 123
centres, keyed by the NEA serial number, which is `HawkerCentre.sourceId`.

A new script `pnpm import:stalls` loads it. See section 4.

---

## 2. `backend/data/stalls.json`

Shape:

```json
{
  "description": "...",
  "generatedAt": "2026-10-29",
  "dataset": "data.gov.sg d_bda4baa634dd1cc7a6c7cad5f19e2d68 (NEA, Dates of Hawker Centres Closure)",
  "cuisines": ["Chinese", "Malay", "..."],
  "sourceNotes": { "researched": "...", "generated": "..." },
  "centres": [
    {
      "sourceId": "72",
      "name": "Maxwell Food Centre (Kim Hua Market)",
      "source": "researched",
      "stalls": [
        { "name": "Tian Tian Hainanese Chicken Rice", "unitNumber": "01-10", "cuisine": "Chinese", "speciality": "Chicken rice" },
        { "name": "Mr Appam", "unitNumber": "01-99", "cuisine": "Indian", "speciality": "Appam" }
      ]
    }
  ]
}
```

Guarantees the importer can rely on:

- `sourceId` matches `HawkerCentre.sourceId` exactly (it is NEA's `serial_no`).
- `cuisine` is always one of the 12 values in `cuisines`.
- `unitNumber` is already normalised to the app's format (`01-23`, zero-padded,
  up to 4 digits plus an optional letter) and is **unique within its centre**, or
  `null` when the source had no usable unit number.
- `name` is unique within its centre.
- 3 market-only centres (NEA stall count 0) have an empty `stalls` array.

`source` per centre:

- `"researched"` — 28 centres (Maxwell, Old Airport Road, Chinatown Complex, Tiong
  Bahru, Amoy Street, Hong Lim, Tekka, Newton, Changi Village, East Coast Lagoon,
  Bedok 85, Pek Kio, …). Real stall names, units and dishes from published food
  guides. A snapshot — stalls close and change hands, so it will drift.
- `"generated"` — the other 95 centres have no published stall list, so these are
  plausible Singapore-style stalls, roughly 28% of the centre's NEA cooked-food
  stall count (5–14 stalls). **They are not real businesses.** Keep the
  `source` field in mind if the app ever shows a data provenance note.

### Known limitation: basement units

Golden Mile and a few others have `B1-30` style units. `normaliseUnitNumber()` only
accepts numeric levels, so those stalls are in the data with `unitNumber: null`.
Do not "fix" this by loosening the regex unless you also handle it in
`StallForm.vue` and the duplicate check — leaving them without a unit is fine and is
already valid (the unique index is partial).

---

## 3. Backend file-by-file changes

### `backend/utils/constants.js`

Add, next to `STATUS_VALUES`:

```js
// Stall cuisine categories. Kept deliberately short so the filter chips stay usable.
// The frontend has its own copy in frontend/src/utils/cuisines.js - keep them in step.
export const CUISINE_VALUES = [
    'Chinese', 'Malay', 'Indian', 'Peranakan', 'Western', 'Japanese',
    'Korean', 'Thai', 'Vietnamese', 'Dessert', 'Drinks', 'Others'
]
export const SPECIALITY_MAX_LENGTH = 60
```

### `backend/models/Stall.js`

```js
cuisine: { type: String, trim: true, enum: CUISINE_VALUES },
speciality: { type: String, trim: true },   // the dish, e.g. "Chicken rice"
```

- Import `CUISINE_VALUES` from `../utils/constants.js`.
- Keep `cuisine` optional. Mongoose `enum` allows `undefined`, so nothing else is needed.
- Add an index: `stallSchema.index({ hawkerCentre: 1, cuisine: 1 })` — the centre
  page filters by it.

### `backend/utils/stallUtils.js`

- Replace `CUISINE_MAX = 40` with nothing (the enum now bounds it); add
  `export const SPECIALITY_MAX = 60`.
- In `checkStallDetails`, extend the type-check loop to
  `['name', 'cuisine', 'speciality', 'unitNumber']`.
- Replace the `if ('cuisine' in input)` block with an exact, case-insensitive match
  against the list, so `"chinese"` from a request still saves as `"Chinese"`:

```js
    if ('cuisine' in input) {
        const text = String(input.cuisine || '').trim();
        if (text) {
            const cuisine = CUISINE_VALUES.find(value => value.toLowerCase() === text.toLowerCase());
            if (!cuisine) {
                return { message: `Cuisine must be one of: ${CUISINE_VALUES.join(', ')}.` };
            }
            details.cuisine = cuisine;
        } else {
            details.cuisine = undefined;
        }
    }
```

- Add a `speciality` block modelled on the old `cuisine` one (trim, collapse
  whitespace, max `SPECIALITY_MAX`, empty string clears it to `undefined`).

### `backend/controllers/stallController.js`

- `getStalls` (and the centre-stalls handler, same pattern): the cuisine filter must
  become an exact match, not `contains()`:

```js
        if (req.query.cuisine) {
            filter.cuisine = req.query.cuisine;
        }
```

  Leave the `search` filter on `contains()`, but widen it to the dish too:

```js
        if (req.query.search) {
            filter.$or = [{ name: contains(req.query.search) }, { speciality: contains(req.query.search) }];
        }
```

  (`filter.name` is no longer set when searching — check nothing downstream assumes it.)

- `updateStall`: add `'speciality'` to the
  `for (const field of ['name', 'cuisine', 'unitNumber'])` loop.
- Update the header comments that list the body fields (three places mention
  `{ name, cuisine, unitNumber }`).

### `backend/docs/openapi.js`

- `Stall` schema (~line 128): `cuisine` becomes
  `{ type: 'string', enum: CUISINE_VALUES, example: 'Chinese' }`; add
  `speciality: { type: 'string', maxLength: 60, example: 'Chicken rice' }`.
- The two `query('cuisine', 'Part of the cuisine')` parameters (~line 304, ~line 364)
  become `query('cuisine', 'Exact cuisine category')` with the enum.
- Both request bodies (~line 313, ~line 376) and their examples gain `speciality`
  and use a category for `cuisine`.

### `backend/tests/stalls.test.js`

- Line ~43/48: the fake stall's `cuisine` becomes `'Chinese'`; add
  `speciality: 'Chicken rice'` and include it in `toObject()`.
- Line ~71: the `checkStallDetails` expectation gains `speciality` handling.
- Line ~96: the add-stall body becomes
  `{ name: 'Ah Hock Chicken Rice', cuisine: 'Chinese', speciality: 'Chicken rice', unitNumber: '#1-23' }`.
- Add two cases: a rejected cuisine (`'Chicken rice'` → 400 with the "must be one of"
  message) and a lowercase cuisine (`'chinese'` → saved as `'Chinese'`).

---

## 4. New script: `backend/scripts/importStalls.js`

Add `"import:stalls": "node scripts/importStalls.js"` to `backend/package.json`.

Behaviour (match `importHawkerClosures.js` / `seedMockData.js` style — 2-space
indent, no semicolons, `import 'dotenv/config'` first):

1. Refuse to run when `NODE_ENV === 'production'`, like the seed does.
2. `connectDB()`, then read `data/stalls.json` with `fs.readFileSync` +
   `JSON.parse` (resolve the path from `import.meta.url`, as `seedMockData.js` does
   for its photo folder).
3. For each centre in the file, find the `HawkerCentre` by `sourceId`. Skip with a
   counted warning if it is missing (the centre import has not run yet).
4. For each stall, upsert on `{ hawkerCentre, name }` so re-running updates instead
   of duplicating, and so stalls that users added by hand survive:

```js
      await Stall.updateOne(
        { hawkerCentre: centre._id, name: stall.name },
        { $set: { unitNumber: stall.unitNumber || undefined, cuisine: stall.cuisine, speciality: stall.speciality, isActive: true } },
        { upsert: true, runValidators: true }
      )
```

5. Wrap each stall in its own try/catch and collect failures, the way
   `hawkerImportService.js` does — one clashing unit number must not stop the rest.
6. Print a summary: centres matched, centres skipped, stalls created/updated, failures.
7. `mongoose.disconnect()` in a `.finally()`.

`addedBy` is left unset on imported stalls. That already means "nobody can edit this
but an admin" in `updateStall`, which is the right behaviour for imported data.

### `backend/scripts/seedMockData.js`

- The 10 demo stalls (~line 119) move to the new fields, e.g.
  `{ hawkerCentre: kampong._id, name: 'Ah Demo Chicken Rice', unitNumber: '01-01', cuisine: 'Chinese', speciality: 'Chicken rice' }`.
  Mapping for the rest: Laksa → `Chinese`/"Laksa", Char kway teow → `Chinese`,
  Drinks stall → `Drinks`/"Kopi and teh", Prawn mee → `Chinese`, Nasi lemak →
  `Malay`, Fishball noodles → `Chinese`, Satay → `Malay`, Carrot cake → `Chinese`,
  Duck rice → `Chinese`.
- After the `importHawkerCentres()` call at the end, import the stalls too, so one
  `pnpm seed` gives a fully populated app. Export the import as a function from
  `importStalls.js` (e.g. `importStallsFromFile()`) and call it here, logging the
  summary; skip it with a warning when the centre import failed.

---

## 5. Frontend file-by-file changes

### New `frontend/src/utils/cuisines.js`

The frontend cannot import from `backend/`, so it keeps its own copy:

```js
// Must match CUISINE_VALUES in backend/utils/constants.js.
export const CUISINES = [
  'Chinese', 'Malay', 'Indian', 'Peranakan', 'Western', 'Japanese',
  'Korean', 'Thai', 'Vietnamese', 'Dessert', 'Drinks', 'Others'
]

// FilterChips wants [{ value, label }]
export const cuisineOptions = CUISINES.map((cuisine) => ({ value: cuisine, label: cuisine }))
```

### `frontend/src/components/StallForm.vue`

- The cuisine `<input>` becomes a `<select>` over `CUISINES` with a
  `<option value="">Any</option>` first (it is optional).
- Add a `speciality` text input, `maxlength="60"`, label "Dish (optional)",
  placeholder "e.g. Chicken rice".
- Add `speciality` to the `details` object sent in `save()`, and initialise it from
  `props.stall?.speciality || ''`.
- The old placeholder `e.g. Chicken rice` on the cuisine field must go — that is
  exactly the confusion this change removes.

### `frontend/src/views/HomeView.vue`

- Delete the `loadCuisineOptions`-style code that counts cuisines off every stall
  (~lines 137–150) and the `cuisineOptions` ref. Import `cuisineOptions` from
  `../utils/cuisines.js` instead. The chips are now a fixed, ordered list, so the
  `v-if="cuisineOptions.length"` guard (~line 193) can go too.
- Everything else (the `getStalls({ cuisine })` call, the centre-narrowing by
  cuisine) keeps working unchanged.

### `frontend/src/views/HawkerCentreView.vue`

- `cuisineOptions` (~line 43) currently maps distinct cuisine strings. Keep it
  derived — a centre page should only show chips for cuisines actually present — but
  build it from the fixed list so the order is stable:

```js
const cuisineOptions = computed(() => {
  const present = new Set(stalls.value.map((stall) => stall.cuisine).filter(Boolean))
  return cuisineOptions_ALL.filter((option) => present.has(option.value))
})
```

  (import the full list under a clear name, e.g. `import { cuisineOptions as allCuisineOptions }`.)
- The local search (~line 54) should match `speciality` as well:
  `[stall.name, stall.cuisine, stall.speciality, stall.unitNumber]`.
- The `SearchBar` placeholder (~line 237) becomes "Stall name, dish or unit".

### `frontend/src/components/StallCard.vue` (~line 136) and `frontend/src/views/StallView.vue` (~line 127)

Show the dish first and the category after it, since the dish is what people
recognise. E.g. in `StallCard.vue`:

```html
<span v-if="stall.speciality">{{ stall.speciality }}</span>
<span v-if="stall.speciality && stall.cuisine"> · </span>
<span v-if="stall.cuisine" class="text-secondary">{{ stall.cuisine }}</span>
<span v-if="(stall.speciality || stall.cuisine) && stall.unitNumber"> · </span>
```

In `StallView.vue` keep the existing `bi-egg-fried` icon on whichever of the two is
shown first, and update the copy-on-save block (~line 83) to also take
`stall.value.speciality = updated.speciality`.

### `frontend/src/services/hawkerService.js`

Update the two comments (~line 74, ~line 85) that list the body fields to include
`speciality`. No code change — `addStall`/`updateStall` pass the object straight
through.

---

## 6. Migration for existing databases

Anyone with data from before this change has dish names sitting in `cuisine`, which
now fails the enum on save. One-off script or a `node --eval`, whichever you prefer —
the rule is: move the old value into `speciality`, then set `cuisine` from a keyword
guess, defaulting to `Chinese`:

```
Chicken rice / Laksa / Char kway teow / Prawn mee / Fishball noodles / Carrot cake / Duck rice  -> Chinese
Nasi lemak / Satay                                                                              -> Malay
Drinks                                                                                          -> Drinks
```

Simplest honest option for a dev database: re-run `pnpm seed`, which wipes stalls
anyway, then `pnpm import:stalls`.

---

## 7. Order of work

1. `constants.js` → `Stall.js` → `stallUtils.js` → `stallController.js` (backend contract first).
2. `importStalls.js` + `package.json` script, then run it against a seeded database
   and check a few centres in MongoDB.
3. `cuisines.js` → `StallForm.vue` → `HomeView.vue` → `HawkerCentreView.vue` →
   `StallCard.vue` → `StallView.vue`.
4. `openapi.js` and `stalls.test.js` last, then `pnpm test` in `backend/`.

## 8. Done when

- `pnpm seed` then `pnpm import:stalls` leaves ~1400 stalls spread over 120 centres.
- The home page shows 12 fixed cuisine chips; picking "Indian" narrows to centres
  with Indian stalls.
- A centre page shows only the categories present in that centre.
- Adding a stall with cuisine "Chicken rice" via the API returns 400; "chinese"
  saves as "Chinese".
- Searching "laksa" still finds the laksa stalls, now by `speciality`.
- `pnpm test` passes in `backend/`.
