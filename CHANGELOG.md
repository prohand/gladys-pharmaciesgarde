# Changelog

All notable changes to this integration are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/), bumped by the Release workflow.

## [Unreleased]

### Added

- First version of the Pharmacies de garde integration, started from the
  official JavaScript template.
- Three sources: a duty rota typed in the configuration (local), a rota
  published online (cloud) and the pharmacies open around the house from
  OpenStreetMap (cloud), with the `local` / `cloud` transport badge and the
  "Prefer the local connection" toggle choosing between the two rotas.
- The "Pharmacie de garde" device: name, address, phone, source and distance of
  the recommended pharmacy, and the nearest open one.
- "Pharmacies" dashboard widget: the pharmacy to go to, the open pharmacies
  around, a map link and the official finder of the country (3237 in France).
- Scene triggers: the pharmacy on duty changed, no pharmacy available, rota
  running out. Scene actions: find the pharmacy on duty (now, tonight, tomorrow,
  next Sunday), refresh the pharmacies.
- Configuration actions: test the sources, show the next turns.
- English, French, German and Spanish everywhere (configuration screen,
  messages, widget, documentation).
- `SECURITY.md`, `CLAUDE.md`, CI, release and build workflows.

[Unreleased]: https://github.com/prohand/gladys-pharmaciesgarde/commits/main
