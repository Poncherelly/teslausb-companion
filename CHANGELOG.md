# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions.

## [Unreleased]

### Added
- Initial project scaffolding: README, CONTRIBUTING, .gitignore.
- Design docs moved into `docs/` (architecture, data model, API, BLE
  protocol, state machines, security, archive/Tesla integration, open
  questions).

### Decided
- Tech stack: Node.js + Express + `@abandonware/bleno` for the Pi
  service; React Native (Expo dev client) + `react-native-ble-plx` for
  the mobile app. Targets both iOS and Android. See CLAUDE.md "Tech
  stack" for rationale.

- First end-to-end vertical slice: `GET /clips` returns fake data
  (filtered by `category`/`state`) from `pi-service`; the app fetches
  and renders it in a basic list screen. Verified running for real on
  a Pi Zero W over the home WiFi network, viewed live on a phone via
  Expo Go. Pinned Expo SDK to 54 to match the Expo Go client version
  available on the tester's phone (SDK 57/56 both reported
  "incompatible" — Expo Go's public release lags newly-shipped SDKs).
  `source=pi|archive` filtering from docs/API.md is not implemented
  yet (no real archive-sync process exists to distinguish them).

### Added
- BLE "TeslaUSB Provisioning" GATT service (`pi-service/src/ble/`):
  device info, claim code, WiFi config, admin password, and status
  characteristics per docs/BLE_PROTOCOL.md. The WiFi config write
  performs teslausb's real reconfiguration (write
  `teslausb_setup_variables.conf`, clear `WIFI_ENABLED`, reboot), not a
  simulation. Verified end-to-end on real Pi Zero W hardware via a
  generic BLE scanner app (nRF Connect): claim-code gating, device info
  read, admin password write-and-hash, and a real WiFi reconfiguration
  reboot that successfully rejoined the network. Not yet wired into
  the actual mobile app (still on classic Expo Go, no BLE library) —
  see docs/OPEN_QUESTIONS.md #12 for the one known design gap (no live
  `wifi_connected` notification is possible from the pre-reboot
  process).

### Added
- Real clip listing, replacing fake data: `pi-service/src/lib/cam-mount.js`
  loop-mounts teslausb's `cam_disk.bin` (read-only) and
  `clips-scan.js` scans the real `TeslaCam/{RecentClips,SavedClips,
  SentryClips}` structure, grouping each Tesla camera-angle set into
  one Clip (see docs/DATA_MODEL.md real-data note). Falls back to
  fake data on non-Linux dev machines or if the mount fails. `GET
  /clips` now sorts newest-first.
- App: two-tab "On device"/"Archive" browser per docs/ARCHITECTURE.md,
  with clips grouped into Saved/Sentry/Recent sections within the "On
  device" tab (added after testing against real data showed a flat
  list of 65 clips was unusable — Recent clips buried the few
  Saved/Sentry ones at the bottom of the scroll). "Archive" tab is a
  placeholder — no archive-sync process exists yet.
  Verified against real data on the Pi (65 real clips: 61 recent, 4
  sentry, 0 saved) and viewed live on a phone via Expo Go.

### Added
- Real download/delete/thumbnail for clips, plus tap-to-play video
  streaming in the app:
  - `GET /clips/{id}/download` streams the representative camera file
    with HTTP Range support (Express's `sendFile`), tracked by an
    in-use lock (`pi-service/src/lib/download-locks.js`) that's
    reflected live in `locked_by_download` on the listing endpoint.
  - `DELETE /clips/{id}` enforces the archived-only guardrail from
    docs/STATE_MACHINES.md — correctly rejects every clip right now,
    since no archive-sync process exists yet to mark anything
    `archived`. That's the intended safety behavior, not a bug.
  - `GET /clips/{id}/thumbnail` serves the real `thumb.png` for
    Saved/Sentry events (none exists for Recent clips).
  - App: thumbnails in the clip list, and tapping a clip opens a
    full-screen player (`expo-video`) that streams directly from the
    download endpoint's Range support — no separate streaming
    endpoint needed.
  - Verified end-to-end on real hardware: full real-file download
    (byte-exact), lock true during transfer/false after, delete
    correctly rejected (403), real thumbnail byte-exact, and live
    video playback on the phone.

### Discovered (real-hardware testing, 2026-07-01)

- teslausb's actual headless WiFi reconfiguration mechanism: it does
  **not** use the generic Raspberry Pi OS "drop wpa_supplicant.conf on
  the boot partition" trick once initial setup has completed. It reads
  `SSID`/`WIFIPASS` from `teslausb_setup_variables.conf` and gates
  (re)configuration on the absence of a `WIFI_ENABLED` marker file —
  both live on the boot partition (symlinked to `/teslausb` on the
  running OS). To change WiFi after first setup: add a fresh
  `teslausb_setup_variables.conf` with the new credentials, delete
  `WIFI_ENABLED`, reboot. Underscores why the BLE pairing wizard
  (docs/BLE_PROTOCOL.md) is worth prioritizing — this manual process is
  exactly what it replaces.
- Real-hardware Node.js/apt/BlueZ constraints on Pi Zero W + Buster —
  see CLAUDE.md "Real-hardware constraints" and
  docs/OPEN_QUESTIONS.md #9-10.
- Got `@abandonware/bleno` actually compiling and loading on the real
  Pi Zero W. Needed: `pi-bluetooth` package (Zero W's BT chip is
  UART-attached and otherwise never initializes), the `pi` user added
  to the `bluetooth` group, and — the real blocker — pinning
  `node-gyp` to `9.4.1` via `overrides` in `pi-service/package.json`,
  since newer `node-gyp` versions require Python 3.8+ and Buster only
  has 3.7. See docs/OPEN_QUESTIONS.md #11. No BLE peripheral code
  written yet — this just proves the module can load on this hardware.
