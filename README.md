# teslausb-companion

A companion mobile app and Pi-side service layer for
[teslausb](https://github.com/marcone/teslausb) — the open-source project
that turns a Raspberry Pi into a USB drive for a Tesla's dashcam/Sentry
footage, with automatic archiving.

This project adds a first-use BLE setup wizard, a mobile app for
browsing/downloading/deleting clips and music, optional Tesla vehicle
keep-awake integration, and transient on-device encryption of unarchived
footage — all on top of an existing teslausb installation.

**Status: pre-code.** Design and planning are complete; no implementation
exists yet.

## Project docs

Start with [CLAUDE.md](CLAUDE.md) for the project brief and hard
constraints, then:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — component map, network model
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — core entities
- [docs/API.md](docs/API.md) — REST endpoint list
- [docs/BLE_PROTOCOL.md](docs/BLE_PROTOCOL.md) — GATT service/characteristics
- [docs/STATE_MACHINES.md](docs/STATE_MACHINES.md) — pairing/clip/storage lifecycles
- [docs/SECURITY.md](docs/SECURITY.md) — encryption, Private vs. Convenient modes
- [docs/ARCHIVE_AND_TESLA.md](docs/ARCHIVE_AND_TESLA.md) — archive destinations, Tesla Fleet API cost model
- [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) — things to verify before/during implementation

## Relationship to teslausb

This is a **separate project**, not a fork of teslausb. It assumes a Pi
already running teslausb and talks to it over BLE (setup) and REST
(everyday use). teslausb's own code is never modified here.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching/PR workflow.

## License

Not yet decided.
