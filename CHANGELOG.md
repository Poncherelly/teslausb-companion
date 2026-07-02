# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions.

## [Unreleased]

### Added
- Fourth "Settings" tab, replacing the standalone "+ Device" button —
  houses "Set up new device" (opens the BLE pairing screen) and a
  disabled "Archive settings" placeholder for future work.
- Automatic light/dark theme (`app/theme.js`, `useColorScheme()`),
  applied across all screens. No manual toggle — follows the phone's
  system setting per the user's explicit preference.

### Added
- `PUT /system/hostname` — renames the Pi (updates `/etc/hostname` +
  `/etc/hosts`, reboots to apply, same pattern as WiFi reconfiguration).
  `GET /system/status` now also returns the hostname, shown in a new
  app banner (name + Pi hostname) at the top of every screen.

### Fixed
- **Real data-loss bug, found and fixed 2026-07-02**:
  `wifi-reconfigure.js` was overwriting the *entire*
  `teslausb_setup_variables.conf` with just `SSID`/`WIFIPASS` every
  time BLE WiFi reconfiguration ran. Since this file is the *only*
  persisted copy of the full setup config once initial setup has
  completed, repeated WiFi-reconfiguration testing silently deleted a
  real, working archive destination (`ARCHIVE_SYSTEM`/`ARCHIVE_SERVER`
  for the user's actual NAS), leaving `archiveloop` stuck waiting on
  `localhost` instead of the real server for about a day before being
  caught. Root cause understood via `archiveloop`'s own fallback logic
  (`ARCHIVE_SYSTEM` unset → defaults to `"none"` → `ARCHIVE_SERVER=
  localhost`). Fixed by reading and merging with the existing
  persisted config instead of overwriting it — verified the merge
  logic directly, and confirmed on the real Pi that archive-sync
  resumed working correctly (full cycle: mount, check for new clips,
  sync music, unmount, 0 errors). Same lesson applies to `PUT
  /system/hostname` and any future setup-time config write — merge,
  never blindly overwrite this file.
- BLE reconnect reliability: connections now retry a few times before
  giving up (BLE is flaky, especially right after the app was
  force-closed rather than backgrounded), and the pairing screen now
  explicitly releases its BLE connection on close instead of relying
  on implicit teardown — was causing "device was disconnected, no way
  to reconnect" errors that needed a full app restart to clear.
- Pairing screen's password input had no explicit text color and was
  hard to read against some backgrounds even though it was working
  correctly — fixed by setting an explicit theme-aware color.

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

### Added
- Real BLE pairing wizard driven from the app itself (2026-07-02), not
  a generic scanner: `react-native-ble-plx` wired into
  `app/BlePairingScreen.js`, requiring a switch off classic Expo Go
  onto an EAS-built development client (`eas.json` "development"
  profile, `expo-dev-client`). Full flow verified end-to-end on
  Android against the real Pi: scan → connect → device info read →
  claim code → WiFi credentials → real reboot → confirmed rejoin on
  the same network. iOS build not started yet.
  - Android BLE runtime permissions must be requested conditionally by
    API level — `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT` only exist on
    Android 12+ (API 31+); requesting them on older versions can
    silently prevent *any* permission dialog from appearing at all.
    Pre-12 relies on the legacy `BLUETOOTH`/`BLUETOOTH_ADMIN` manifest
    permissions, auto-granted at install with no runtime prompt.
  - Android needs an explicit `device.requestMTU(247)` after
    connecting — the default ~20-byte usable payload isn't enough for
    the WiFi config JSON. iOS negotiates MTU automatically.
  - Confirmed docs/STATE_MACHINES.md's bounded advertising window
    (10 min) is real and matters for dev/testing: `pi-service` had
    been running 10+ hours unclaimed and had stopped advertising
    entirely — needed a restart to get a fresh window before the app
    could find it at all.

### Added
- Music/Boombox folder browser: real data (2026-07-02) showed the
  music partition (`music_disk.bin`) is a generic user-organized
  folder tree (`Music/<artist>/<album>`, `boombox/`, plus arbitrary
  other top-level folders like "Comedy"/"kids music"), not a fixed
  two-category split — so it's a folder browser (`GET /music?path=`,
  `pi-service/src/lib/music-{mount,scan}.js`, `app/MusicBrowser.js`,
  third "Music" tab), not a flat list. Verified against real data on
  the Pi.

### Changed
- **Redesigned the BLE claim mechanism**: dropped the separate random
  "claim code" characteristic entirely — it had no real channel to
  reach a non-technical user on a headless Pi (SSH-only isn't
  workable). The admin password characteristic now doubles as the
  claim mechanism: first-ever pairing sets it, re-pairing must match
  it. Documented, accepted tradeoff: first-claim is a race (whoever
  sets the password first wins); losing it just means restarting the
  pairing window, not a security bypass. See docs/BLE_PROTOCOL.md
  "Claiming via admin password".
- Pairing screen UX pass, driven by real usage friction:
  - Added spinners for scanning/claiming/WiFi-sending instead of bare
    text, so it doesn't look frozen.
  - The post-WiFi-reboot wait now actively polls `GET /system/status`
    every few seconds and shows a real "Connected!" confirmation
    instead of "wait a bit then close manually" — resolves the
    previously-open docs/OPEN_QUESTIONS.md #12 gap.
  - `device-info` gained a `wifi_connected` field so the wizard skips
    re-sending WiFi credentials (and triggering an unnecessary reboot)
    on an already-connected device — found this was a real problem,
    not theoretical: re-opening the pairing screen on an
    already-configured device previously forced WiFi re-entry (and a
    real reboot) every single time.
  - The app now pre-fills the password field from `expo-secure-store`
    on a recognized device, rather than saving it and never using it.

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
