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
