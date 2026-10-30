# Gladys — Pharmacies de garde

External integration for [Gladys Assistant](https://gladysassistant.com): **the pharmacy on duty**
and **the pharmacies open around your home**, as a device, a dashboard widget, scene triggers and
scene actions.

Built from the official template
[`GladysAssistant/integration-template-js`](https://github.com/GladysAssistant/integration-template-js)
with the JavaScript SDK [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

User documentation: [English](docs/en.md) · [Français](docs/fr.md) · [Deutsch](docs/de.md) ·
[Español](docs/es.md).

> At night in France, the reference stays the **3237**. This integration is a convenience, not a
> medical service.

## Sources — local and cloud

| Source                        | Transport | Gives                                               |
| ----------------------------- | --------- | --------------------------------------------------- |
| Duty rota typed in the config | `local`   | the pharmacy on duty (never leaves Gladys)          |
| Duty rota published online    | `cloud`   | the pharmacy on duty, from a URL (open data, town…) |
| OpenStreetMap (Overpass API)  | `cloud`   | the pharmacies around the house and their hours     |

The manifest declares `"transports": ["local", "cloud"]`: each answer carries its badge, the
"Prefer the local connection" toggle picks between the two rotas, and the OpenStreetMap fallback
(nearest **open** pharmacy, not on duty) shows as **degraded**. The house position comes from
Gladys (`"location": true`) and is sent to Overpass rounded to about 100 m.

## What it adds to Gladys

| Surface       | Key                     | What                                                            |
| ------------- | ----------------------- | --------------------------------------------------------------- |
| Device        | `pharmacy` / `duty`     | name, address, phone, source, distance; nearest open pharmacy   |
| Widget        | `pharmacies`            | pharmacy to go to, open pharmacies, map link, official finder   |
| Scene trigger | `duty_changed`          | the pharmacy on duty (or nearest open) changed                  |
| Scene trigger | `no_pharmacy_available` | nothing on duty, nothing open around                            |
| Scene trigger | `planning_running_out`  | the rota ends within N days (once a day)                        |
| Scene action  | `get_pharmacy`          | which pharmacy now / tonight / tomorrow / next Sunday (outputs) |
| Scene action  | `refresh_pharmacies`    | fetch the online sources again                                  |
| Config action | `test_sources`          | report of every source, unreadable rota lines included          |
| Config action | `show_planning`         | the next turns of the rota                                      |

## Project structure

```
.
├─ index.js                          # SDK bootstrap
├─ src/
│  ├─ app.js                         # SDK wiring + minute tick
│  ├─ pharmacies.js                  # sources -> answer, transport badge, moments
│  ├─ sources/                       # planning (rota), remote (URL), osm, openingHours
│  ├─ capabilities/                  # scenes, widget, configuration actions
│  ├─ device.js  location.js  config.js  store.js  time.js  i18n.js  format.js
├─ docs/                             # en, fr, de, es — re-hosted by Gladys
├─ test/                             # node --test, fake Gladys of the SDK, no network
├─ gladys-assistant-integration.json # manifest
├─ Dockerfile                        # Node 24 Alpine, read-only rootfs, /data volume
├─ CHANGELOG.md  CLAUDE.md  SECURITY.md  cover.png
└─ .github/                          # CI, Release, Build, GitHub releases, Dependabot
```

## Development

```bash
npm install
npm test
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store .
```

Run against a Gladys instance:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="pharmaciesgarde" \
LOG_LEVEL=debug \
npm start
```

## Release

1. Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md).
2. **Actions → Release → Run workflow**, pick `patch`, `minor` or `major`.

The workflow bumps `package.json` and the manifest (`version` + `docker_image`), rolls the
changelog, tags `vX.Y.Z`, builds the `linux/amd64` + `linux/arm64` image to
`ghcr.io/prohand/gladys-pharmaciesgarde`, publishes the GitHub Release and runs the store checks.

First publication: add the GitHub topic `gladys-assistant-integration` to the repository, make
the ghcr.io package public, and turn on **Private vulnerability reporting** (see
[`SECURITY.md`](SECURITY.md)).

## Data

Pharmacy data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL.

## License

Apache-2.0
