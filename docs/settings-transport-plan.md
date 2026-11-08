# Settings transport: a reusable preset-code library

A plan for packaging the "share a link, get the same thing back" system that
goo-moire and JM26 each hand-roll today, so the next project (and the next
setting in an existing project) gets it by declaring a schema instead of
writing a codec.

The working goal, in the user's words: *"as we develop settings that are
important to the thing and user editable, let's keep them all in the preset
block so our encode/decode system stays plumbed."* Everything below is in
service of making that sentence cheap to honor.

## What the two projects do today

| | goo-moire (`src/lib/encoding/presetEncoder.ts`) | JM26 (`share.js`, `ensemble.js`, `library.js`) |
|---|---|---|
| Code shape | one base64url blob, version byte inside | `<version>.<data>[.<pattern>][~<ensemble>]`, dot-separated parts |
| Values on the wire | per-field fixed point (`u16 ×100`, `u8`, `int16`) at hand-picked byte offsets | every preset param as a 10-bit position, bit-packed in schema order |
| Schema | implicit in code; types duplicated in `Index.tsx`, `Canvas.tsx`, `ControlPanel.tsx` | generated from `ui_params.json` (`category: "preset"`) into `share_schemas.json`, **every historical version kept** |
| Old codes | decoder cascade `decodeV3 → V4 → V5`, plus JSON v0–v2 | by **name**: params the old version names are set, others keep current values; if a param's scale/min/max changed, converted by value |
| Secondary parts | movement packed into the same struct | pattern record (own format byte, 1..63 melody / 64..127 FRP) and gzip'd ensemble; a part this page can't read is **skipped with a message**, the rest still loads |
| Apply | read `?p=` once on mount → `setSettings`; export button copies URL | param bus `bridge.has/get/set/on`; live code field (debounced), copy code / copy link, paste code or link, `location.hash` on load |
| Storage of codes | URL only (+ OG image keyed by the code, server-side, so it must be a query param) | URL fragment, and a shared library (Vercel Blob) where "a preset is exactly a code" — the server validates codes with a regex and a 400-char limit |
| Drift observed | `goo.driftFriction` is in the UI but not the encoder; `audio.maxVoices` never encoded | none visible: the schema is generated from the param table, so it can't drift |

The lesson from the comparison: JM26's **name-keyed schema history** is the
right general mechanism, not goo's "append fields at the end". Append-only is
a special case of it. History also lets you rename, remove or reorder fields
without breaking a single old link, and it is what makes "every old code
loads" a property you can test rather than a promise.

## What the library owns, and what it doesn't

Owns (pure, isomorphic, zero dependencies, no DOM):

1. **Codecs**: how one field becomes bits and back.
2. **Schema**: an ordered, named set of fields with defaults; the single source
   of the settings *type* (`Infer<typeof schema>`).
3. **History**: snapshots of every published schema version, so any old code
   decodes against the schema it was written with and lands on the current one.
4. **Grammar**: the code string — sections, separators, charset, `isCode()` for
   servers.
5. **Decode report**: what was set, defaulted, converted, skipped, and why, in
   words the UI can show.

Does not own: application state. It produces and consumes plain objects. Thin
adapters (React hook, param-bus applier, link read/write) live in the package
but are optional entry points, and the DOM (buttons, status lines) stays in
the app.

## Design

### Codecs are bit widths

Everything packs through one MSB-first bit writer, so a `bool` costs one bit,
a `uint(10)` ten, and flags pack themselves (goo's hand-rolled byte 30 and
JM26's `pack10` are the same thing).

```ts
bool()                                   // 1 bit
uint(bits) / int(bits)                   // raw integers
scaled({ bits, scale, signed? })         // goo style: value * scale, e.g. spacing*100 in 16 bits
quantized({ bits, min, max, curve? })    // JM26 style: position on a curve (linear, square, octaves, bipolar…)
enumOf(labels)                           // stored by index, *migrated by label*
rgb()                                    // 24 bits, hex in/out (color normalization is the app's job)
group({ ... })                           // nesting, for goo's layer1/layer2/goo/audio shape
local(default)                           // 0 bits: in the type, never on the wire (audio.maxVoices)
custom({ bits, encode, decode })         // escape hatch
```

Numeric codecs decode to **values** (Hz, px, seconds), not positions. That
makes JM26's `migratePosition` fall out for free: decode the old field with
the old codec to a value, clamp into the current range, done. The app's bus
converts value to control position itself (bridge already has `enginePos`).

`enumOf` migrates by label, which fixes a latent bug in both projects: JM26
stores select option *indices*, goo stores type ids; inserting an option in
the middle breaks every old code. With history, index → old label → current
index.

### Schema and history

```ts
export const preset = defineSchema({
  version: 6,
  fields: {
    layer1: group({ spacing: scaled({ bits: 16, scale: 100 }), ..., type: enumOf(["dots", "lines", "squares"]) }),
    layer2: group({ ... }),
    goo: group({ enabled: bool(), blur: uint(8), threshold: uint(8), ..., driftFriction: scaled({ bits: 8, scale: 100 }) }),
    audio: group({ ..., maxVoices: local(64) }),
  },
  history: schemaHistory,   // imported JSON, see below
});

export type Settings = Infer<typeof preset>;
```

`schemaHistory` is a committed JSON file holding, per version, the flat list
of `[path, codecKind, codecParams]`. It is the generalization of JM26's
`share_schemas.json` and the replacement for goo's decoder cascade. A test
keeps it honest:

```ts
test("schema history", () => assertHistory(preset));
// fails if the live schema differs from history[version]; the fix is either
// `npx settings-transport snapshot` (bumps version, appends a snapshot) or
// reverting the schema change.
```

That test is the enforcement mechanism for the workflow. Adding a setting is:
add a field, run the snapshot, commit. Forgetting the schema is impossible
because the settings *type* comes from it; forgetting the version bump fails
CI.

### Decoding an old code

Given a code at version N and the current schema M:

- Look up `history[N]`, read its fields to values.
- Every name that exists in M is set (clamped / label-migrated as above);
  every name M has that N lacks is **left alone** (the caller merges over
  current state or defaults, its choice); names N has that M dropped are
  reported, not errors.
- N > M → error "from a newer version than this page knows".
- No parseable version → the app's `legacy(string)` hook (goo keeps its v0–v5
  decoders in one sealed file; JM26 keeps today's grammar readable the same
  way).

The result is `{ value, report }` where `report` is
`{ version, set, defaulted, dropped, converted, skipped: [{section, reason}] }`,
enough to say "41 settings set, 2 converted from an older version; the melody
part was skipped: this page has the FRP panel".

### Sections

A code is `<version>.<main>[.<section>…]`. The first section is the schema
above and is required; a failure there is the only hard error. Further
sections carry a leading format byte and decode independently:

```ts
const code = defineCode({
  main: preset,
  sections: {
    movement: section(movementSchema),          // goo: can now be omitted entirely
    pattern:  section(frpSchema, { formats: [64, 127] }),
    ensemble: opaque(),                         // JM26: app-encoded gzip blob, async, library only frames it
  },
});
```

This is JM26's grammar made general. The `~` ensemble separator and goo's
query-param blob both become legacy inputs the parser accepts.

### Adapters

- `link`: `read({ hash | query: "p" })`, `write(code, …)`, `cleanInput(text)`
  (take what follows the last `#` or `?p=`, so pasted links work). Goo stays
  on `?p=` because the OG image route needs it server-side; JM26 stays on the
  fragment.
- `controller`: framework-free `createShare({ current, apply, onChange })`
  that implements the JM26 behaviors (debounced live code, copy code / copy
  link, paste → apply, hash on load, `summary(report)` words). Returns the
  same `{ code(), apply(), summary() }` shape JM26's `library.js` consumes.
- `react`: `usePresetLink(schema, [state, setState], { transport })`, read
  once on mount, `share()` returns the URL; live URL rewriting is **opt-in**
  (neither project does it today).
- `bus`: `applyToBus(decoded, { has, set })` for parameter buses.
- `server`: `isCode(text, { maxLength })`, for JM26's library API and any
  future store. Zero DOM, runs on the edge.

## Packaging

Separate repository, `settings-transport` (name open; the artifact is really a
"preset code"), TypeScript source, built to a dependency-free ESM `dist/` with
`.d.ts`, tested with vitest. Entry points: `settings-transport`,
`settings-transport/react`, `settings-transport/link`, `settings-transport/server`.

Why separate from day one: JM26's site is a build artifact copied out of
LocalDSP by a deploy script and is plain ESM with no bundler, so it needs a
single vendorable file; goo can `npm install` from GitHub or npm. A package
inside goo's tree would serve one of the two.

For this session, the prototype can be built under `packages/settings-transport/`
in this repo so it is reviewable next to its first consumer, then lifted out
unchanged.

## Phases

1. **Core** — bit writer/reader, base64url, codecs, `defineSchema`, history +
   `assertHistory` + snapshot CLI, `defineCode` with sections, grammar and
   `isCode`, decode report, `legacy` hook. Tests: round-trip for every codec,
   history migration (rename, reorder, remove, enum relabel, range change),
   and **real fixtures**: goo v3/v4/v5 URLs from the wild and JM26 codes from
   `share_schemas.json` versions 1–6 plus a library code, decoded into the
   expected values.
2. **Adapters** — `link`, `controller`, `react`, `bus`, `server`.
3. **Goo port** (first consumer) — schema v6 replaces `presetEncoder.ts`;
   v0–v5 move to `legacy.ts`; the three duplicated settings interfaces become
   `Infer<typeof preset>`; `driftFriction` is added as the demonstration of
   the workflow; movement becomes an optional section; `audio.enabled = false`
   and the color randomization stay as app-side post-decode steps. Verify by
   decoding a handful of existing shared links before and after.
4. **JM26 port** (second consumer, in LocalDSP) — `gen_share_schema.py` emits
   the library's history JSON instead of `share_schemas.json` (or the schema
   is built at runtime from `ui_params.json` plus history); melody/FRP records
   become sections with label-migrated enums; ensemble becomes an `opaque`
   section; `api/_library.js` uses `isCode`. Ship the built ESM via the deploy
   script. Every code in the shared library must still load.
5. **Docs** — README with the contract to paste into a project's `CLAUDE.md`:

   > User-editable settings live in the preset schema (`src/preset.ts`). Add a
   > field there first, run `settings-transport snapshot`, and the type,
   > encoder, decoder and link handling follow. Never edit `schema-history.json`
   > by hand.

## Decisions to make

- Package name and where it lives (recommendation above: its own repo, with
  the prototype built here first).
- Whether goo adopts sections now (movement optional) or keeps one blob
  until the second consumer forces the grammar.
- Scope of the React adapter: read-once + `share()` only, or also opt-in live
  URL rewriting.
