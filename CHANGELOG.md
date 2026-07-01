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
