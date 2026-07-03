# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions.

## [Unreleased]

### Added
- **`POST /system/pairing-mode` built for real** — was only speced
  before; the only way to re-open a closed 10-minute BLE pairing
  window used to be a full `systemctl restart pi-service`.
  `peripheral.js`'s `enablePairingMode` re-opens or extends the window.
  App calls this best-effort whenever "Set up new device" is tapped,
  failing silently for a truly fresh Pi with no WiFi/REST reachable yet
  (relies on its own boot-time window instead). Found this gap while
  re-testing BLE pairing on iOS after the window had already closed.

### Fixed
- **First real iOS BLE bug**: pairing failed immediately with
  "BluetoothLE is in unknown state" on a real iPhone (the first time
  this code path had ever run on iOS — prior BLE testing was
  Android-only). Root cause: `startDeviceScan` was called immediately
  after creating the `BleManager`, but iOS's `CBCentralManager` needs a
  moment to determine its real state (PoweredOn/Unauthorized/PoweredOff)
  first; Android doesn't have this restriction, which is why it went
  uncaught. Fixed by waiting for `onStateChange` to report `PoweredOn`
  (or a clear error for Unauthorized/PoweredOff) before scanning.

### Added
- App now consumes `GET /events` — `AppBanner.js` shows live
  archive-sync status ("Archiving clips…", "Syncing music…", etc.)
  under the hostname, clearing once the activity finishes. New
  `app/events.js` (`subscribeToEvents`) is an XHR-based SSE client (RN's
  `fetch` doesn't support incrementally reading a streaming response
  body) — pure JS, no new native dependency, no EAS rebuild needed.

### Fixed
- **Real bug, found while testing the new events feature below**: both
  `cam-mount.js` and `music-mount.js` held their read-only loop mounts
  open for the entire life of the `pi-service` process, never
  releasing them. Confirmed live that this chronically blocks
  teslausb's own real operations on the same backing files — a
  lingering on-device music browse mount made `archiveloop`'s
  `copy-music.sh` fail to mount `/mnt/music` ("overlapping loop device
  exists"), silently skipping music sync to the car for an entire
  cycle. Both now auto-release after 30s of no requests
  (`pi-service/src/lib/loop-mount.js`, shared by both), trading a
  little re-mount latency for not chronically blocking teslausb.
  Verified: mount stays active during use, confirmed released after
  the idle window via `/proc/mounts`, and confirmed it re-mounts
  correctly afterward.

### Added
- **`GET /events`** — real SSE stream of live archive-sync status,
  sourced by tailing teslausb's own `archiveloop.log`
  (`pi-service/src/lib/archive-events.js`) instead of polling. Verified
  against a real, manually-triggered archive cycle (`force_sync.sh`):
  captured the full real sequence end-to-end (waiting for archive →
  reachable → archiving → finished → syncing music → finished).
- **Dropped from the API spec** (not built, and not going to be):
  `PUT /settings/archive-mode` (nothing to toggle — only one archive
  destination type exists) and `PUT /settings/music` (assumed
  `copy-music.sh` supports configurable sync modes; it's a fixed
  one-way mirror with no modes at all).

### Removed
- **On-device encryption of unarchived footage, dropped** (was a stated
  core feature in the original design). Investigated against teslausb's
  real architecture and abandoned: Tesla writes plaintext directly to a
  raw FAT32 disk image over USB mass storage, with no interception
  point that doesn't require either modifying `archiveloop` (against
  this project's own rule) or replacing it entirely (a full archive
  pipeline rewrite, risky against the one physical device everything
  depends on). Also confirmed upstream teslausb has zero encryption
  support to build on. See docs/SECURITY.md for the full reasoning —
  kept there for reference in case this is ever revisited, but not
  planned work. Updated CLAUDE.md, README.md, docs/ARCHITECTURE.md,
  docs/OPEN_QUESTIONS.md to match.

### Added
- **Music upload + delete**, both `source=archive` only. Found and
  reused the real, existing mechanism instead of building a new one:
  teslausb's own `copy-music.sh` already rsyncs (with `--delete`) from
  the archive music share down to the car's live music partition on
  its own schedule, so upload/delete only ever touch the archive share
  — never `music_disk.bin` directly, which is live-exposed to the car
  as a USB gadget and risky to write to directly. Required changing the
  archive music fstab mount from `ro` to `rw` (`archive-config.js`).
  New `POST /music/upload` (multipart, `multer`) and `DELETE /music`
  endpoints; Music tab has an "Upload music here" button (archive view
  only, `expo-document-picker`) and a delete icon per file row.
  Verified end-to-end against the real archive share: upload created a
  new folder + file, download streamed it back correctly, delete
  removed it, and both on-device rejection and path-traversal attempts
  were correctly blocked.
- **Music playback** — tapping a file in the Music tab (previously a
  disabled no-op) now streams and plays it via a "Now Playing" bar
  (`expo-audio`'s `useAudioPlayer`/`useAudioPlayerStatus`, matching the
  `useVideoPlayer` pattern already used for clips). New `GET
  /music/download?source=&path=` endpoint streams the file (HTTP Range
  supported, same as clip downloads). New native dependency
  (`expo-audio`, SDK-54-matched) — **requires the same fresh EAS
  dev-client build already needed** for the video download/delete
  work, not a separate rebuild if bundled together.
- **Real clip delete, unblocked for the first time**: `state` is now
  computed from real data for `source=pi` clips (`clips-scan.js`'s
  `isArchived` checks whether a Saved/Sentry clip has a matching event
  folder in the archive), replacing the previously-hardcoded
  `state: "new"` that made `DELETE /clips/{id}` reject every real
  request. The delete endpoint independently re-verifies archived
  status live at delete time rather than trusting the listing's
  annotation — that annotation is for UI display only. On-device clips
  now show an "· Archived" marker once eligible, and the video player
  modal has a "Delete from Pi" button for archived on-device clips
  (confirmation dialog first; explicitly never shown for archive-
  sourced or not-yet-archived clips).
- **"Save to Photos"** — the video player modal can now save the
  currently-playing file to the phone's Photos library (`expo-file-
  system`'s `File.downloadFileAsync` + `expo-media-library`'s
  `saveToLibraryAsync`, write-only permission so iOS only prompts for
  "add photos," not full library access). New native dependencies —
  **requires a fresh EAS dev-client build** before this can run; won't
  work against the existing installed build.
- Archive tab redesigned as a folder-drill browser (`app/
  ArchiveBrowser.js`) — Category (SavedClips/SentryClips) -> Event ->
  Files — mirroring the Music tab's folder-browser pattern per explicit
  request 2026-07-03, replacing the flat categorized list it briefly
  shared with the On Device tab. Category/event levels are derived
  client-side from the existing `GET /clips?source=archive` response;
  only the file level needs a new request (`GET /clips/{id}/files`),
  since eagerly listing every file for every event up front would be
  far slower than the already-slow ~20s full clip scan. Tapping any
  individual file (not just the representative front-camera one) plays
  it via `GET /clips/{id}/download?file=`, both new endpoints backed by
  `clips-scan.js`'s `listClipFileEntries`/`getFileDownloadPath`
  (filename validated against the real filesystem, not just
  pattern-checked, to rule out path traversal). Confirmed against the
  real archive: it has exactly two top-level folders (SavedClips,
  SentryClips) — no RecentClips, and SavedClips is real and non-empty
  (65 events) — contradicting an initial report that seemed to describe
  a different, unidentified view of the storage.

### Fixed
- **Real bug, found 2026-07-02 the day after shipping the Archive tab**:
  the Archive tab could show on-device clips instead of real archive
  clips. Root cause: the archive fetch is much slower than the
  on-device one (real CIFS mount + per-file `stat` over the network,
  ~20s vs ~1s for a similarly sized on-device listing), and `App.js`'s
  clip-fetching effect had no cancellation guard — switching tabs
  before a slow fetch resolved let its response land *after* a later,
  faster fetch had already updated state, silently overwriting the
  display with the wrong source's clips. Confirmed server-side data was
  correct and non-overlapping the whole time (65 on-device clips vs.
  232 real archive clips, zero shared timestamps) before concluding
  this was a client-side race, not a backend bug. Fixed with the same
  `cancelled` guard pattern already used in `AppBanner.js`.

### Added
- Music tab now has a Pi/Archive source toggle, reusing the same
  folder-browser UI against the optional music share configured in
  Archive settings — `GET /music?source=archive` mounts
  `/mnt/musicarchive` on demand (`archive-mount.js`'s
  `ensureArchiveMusicMounted`), with a clear error if no music share
  was configured rather than a generic 500.
- Archive tab now shows real clips instead of a placeholder message —
  `GET /clips?source=archive` (`pi-service/src/lib/archive-mount.js`,
  updated `clips-scan.js`/`routes/clips.js`) mounts the CIFS archive
  share on demand (already defined in `/etc/fstab` via Archive
  settings) and reuses the same Saved/Sentry/Recent scan logic as the
  on-device tab. Confirmed against the real archive share that it has
  no `TeslaCam/` wrapper folder (unlike the local disk image) and never
  has `RecentClips` (the rolling buffer isn't synced there). Clip ids
  now encode `source:category:timestamp` (colon-delimited, since the
  timestamp format itself contains hyphens) so download/thumbnail
  requests know which mount to resolve against without a separate query
  param. Deleting from the archive itself is explicitly rejected (403)
  — out of scope, and meaningfully riskier than deleting an on-device
  copy once archived.
- Real "Archive settings" in the Settings tab, replacing the disabled
  placeholder — `GET /archive/config` / `PUT /archive/config`
  (`pi-service/src/lib/archive-config.js`, `src/routes/archive.js`)
  read/write the CIFS destination (server, clips share, optional music
  share, username/password) directly via `/etc/fstab` +
  `/root/.teslaCamArchiveCredentials` + `ARCHIVE_SYSTEM`/
  `ARCHIVE_SERVER` in `teslausb_setup_variables.conf`, mirroring how
  upstream teslausb itself expects a CIFS archive to be configured.
  `GET` never returns the password; `PUT` reboots to apply, same UX as
  device rename. `/etc/fstab` and the credentials file are backed up
  (`.bak-<timestamp>`) before every write, given this touches the only
  working archive path on the device. Scoped down from the original
  multi-destination/rclone design in DATA_MODEL.md to match what's
  actually deployed — see docs/API.md and docs/DATA_MODEL.md for the
  full scoping note.
- Renaming the device from Settings now has its own `DeviceNameRow` UI
  (was previously only reachable via a raw `curl` to `PUT
  /system/hostname`).
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
- App banner only checked Pi reachability once at app launch, so a
  one-off transient failure (e.g. `pi-service` mid-restart) left it
  stuck showing "Pi not reachable" until the whole app was force-closed
  and reopened. Now retries every 15 seconds instead.

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
