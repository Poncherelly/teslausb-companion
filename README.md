# teslausb-companion

A companion mobile app and Pi-side service layer for
[teslausb](https://github.com/marcone/teslausb) — the open-source project
that turns a Raspberry Pi into a USB drive for a Tesla's dashcam/Sentry
footage, with automatic archiving.

This project adds a first-use BLE setup wizard, a mobile app for
browsing/downloading/deleting/uploading clips and music, and optional
Tesla vehicle keep-awake integration — all on top of an existing
teslausb installation.

**Status: working, real, in daily use against real hardware** (a Pi
Zero W running teslausb). Built and verified so far: BLE pairing +
WiFi/claim handoff, on-device clip browsing/download, an Archive tab
with real archive-sync data (folder-drill Category -> Event -> Files,
matching the real NAS structure), in-app video playback with
Save-to-Photos and delete-once-archived, a Music tab with in-app
streaming/upload/delete for both on-device and archived music, and a
Settings tab covering device rename and archive destination
configuration. See CHANGELOG.md for the detailed history.

**Dropped:** on-device encryption of unarchived footage — investigated
and abandoned 2026-07-03 given teslausb's real architecture (see
docs/SECURITY.md); `encrypted_on_disk` remains a placeholder field.
Possibly revisited someday, not planned work.

**Not yet built:** Tesla Fleet API integration, cloud/rclone archive
destinations, iOS build (Android-only so far), and the zero-SSH
pi-gen-based distribution image (currently everything is installed by
hand over SSH).

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
