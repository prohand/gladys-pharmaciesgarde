# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Gladys Assistant **external integration** (Node 22+, ESM, no build step, one runtime
dependency: `@gladysassistant/integration-sdk`) that tells Gladys **which pharmacy is on duty**
and **which pharmacies are open** around the house. Started from the official JavaScript template
(`GladysAssistant/integration-template-js`); workflows aligned on `prohand/gladys-devmel`.
Requires Gladys 5.3+. One device, one widget, three scene triggers, two scene actions, two
configuration actions.

There is no national feed of pharmacies on duty: the rota comes from the user (typed, local) or
from a file published online (cloud); OpenStreetMap (Overpass API, cloud) gives the pharmacies and
their opening hours.

## Commands

```bash
npm install
npm test                                    # node --test (built-in runner)
node --test test/planning.test.js           # one file
node --test --test-name-pattern "rota"      # tests whose name matches
npm run lint                                # eslint .
npm run format:check                        # prettier --check . (CI gate)
npm run format                              # prettier --write .
npx github:GladysAssistant/integration-store .   # store admission checks
```

CI runs `format:check`, `lint`, `test` on Node 22 and 24, plus the store checks and a Docker build
on pull requests. Releases: **Actions → Release** only (bumps `package.json`, manifest `version` +
`docker_image`, rolls `CHANGELOG.md`, re-runs Prettier, tags, builds, publishes the GitHub Release).

## Architecture

```
index.js                     SDK bootstrap only (shutdown, connect)
src/app.js                   all the SDK wiring + the minute tick (states, badge, triggers, widget nudge)
src/pharmacies.js            PharmacyService: sources -> answer (duty / nearest open), transport, moments
src/sources/planning.js      rota parser (lines `date [> end] ; name ; address ; phone`, or JSON)
src/sources/remote.js        download of a published rota
src/sources/osm.js           Overpass query + parsing, distances
src/sources/openingHours.js  OSM opening_hours, common subset (unknown rather than wrong)
src/time.js                  wall-clock time in a time zone (never the container TZ)
src/location.js              house position: typed coordinates, else getHouses()
src/device.js                the "Pharmacie de garde" device and its states
src/capabilities/            scenes.js (triggers + actions), widget.js, actions.js (config buttons)
src/config.js                DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
src/store.js                 /data/state.json: OSM + published rota caches, trigger memory
src/i18n.js, src/format.js   { en, fr, de, es } texts
```

### Invariants worth knowing

- **Open, not on duty.** Only a rota says "on duty". The OSM fallback is the nearest pharmacy
  _open_ by its hours, always flagged (`source: 'osm'`, degraded badge). Never present it as duty.
- **Unknown beats wrong.** `opening_hours` outside the supported subset is `null` (unknown): such
  a pharmacy is listed, never announced open. Do not "half-parse" a rule.
- **Local time.** Rota dates and opening hours are read in `config.timezone` through `src/time.js`;
  the container runs in UTC.
- **Network only in `refresh()`.** Overpass and the published rota are fetched every
  `refresh_hours` (cached in `/data`, kept on failure); the minute tick, the widget and the scene
  actions compute from memory. The public Overpass server is shared: keep the pace polite.
- **Privacy.** The house position goes to Overpass rounded to ~100 m (`buildQuery`), nowhere else.
- **Transports.** Manifest `["local", "cloud"]`: typed rota = local, published rota / OSM = cloud.
  `GLADYS_PREFER_LOCAL` chooses between the two rotas when both have a turn.
- **Triggers fire on transitions only**; the first answer after a start is recorded, not fired
  (memory in the store). `planning_running_out` fires at most once a local day.
- **No polling**: the device has no `poll_frequency`; the tick publishes with
  `publishChangedStates` (30 min heartbeat). Every feature declares `min`/`max` (NOT NULL in
  Gladys), text features included.
- **Keys are forever**: external ids (`pharmacy` / `duty` + feature keys), config keys, action,
  trigger, scene action, widget keys, `MOMENTS` and `SOURCES` values are stored by users.

### Manifest

`test/manifest.test.js` ties `gladys-assistant-integration.json` to the code: four languages on
every text, catalog description 10–100 chars, defaults = `DEFAULT_CONFIG`, keys = handlers,
option lists = `MOMENTS` / `SOURCES` / `COUNTRIES`, transports, `location`, `gladys_version >=5.3.0`
(keywords), docs present in the four languages.

## Rules

- **Versions belong to the Release workflow.** Never edit `version` in `package.json` or the
  manifest, nor the `docker_image` tag, by hand.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]` in `CHANGELOG.md`
  (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`). Never write a version heading.
- **User-facing text** is `{ en, fr, de, es }` (manifest, action answers, widget, connection
  status); docs in `docs/en.md`, `docs/fr.md`, `docs/de.md`, `docs/es.md`, kept in sync.
- **Write only under `/data`.** Never log the house coordinates at info level.
- **Tests never touch the network**: `test/helpers/fixtures.js` has a fake `fetch`, an Overpass
  answer and a fixed clock; `createFakeGladys()` from the SDK plays Gladys.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why, in English.
