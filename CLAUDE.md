# teslausb-companion — project brief

## What this is

A companion mobile app (iOS/Android) and Pi-side service layer built on top of
the existing open-source [teslausb](https://github.com/marcone/teslausb)
project. teslausb turns a Raspberry Pi into a USB drive for a Tesla's
dashcam/Sentry footage, with automatic archiving to a NAS or other backend.

This project adds:
- A first-use setup wizard reachable over Bluetooth Low Energy (BLE),
  handing off to WiFi/REST for everything past initial provisioning.
- A mobile app for browsing, downloading, and deleting clips and music,
  both on the Pi and on the archive.
- Optional Tesla vehicle integration to keep the car awake until an
  archive run completes.
- Transient on-device encryption of unarchived footage.

**Status as of this doc: pre-code.** Everything below reflects a completed
design/planning phase. No implementation exists yet. Treat this as the
source of truth for product decisions; treat actual code, once it exists,
as the source of truth for implementation details.

## Hard constraints — read these before proposing anything

1. **Zero recurring out-of-pocket cost for the maintainer, at any scale.**
   This is the single most load-bearing constraint in the whole project.
   Any design that has cost scaling with user count (a shared paid API
   registration, a hosted relay the maintainer operates and pays for,
   etc.) is wrong by default — see `docs/ARCHIVE_AND_TESLA.md` for why
   this ruled out a shared Tesla Fleet API app registration.
2. **Local/private by default.** The core product promise is "footage
   never leaves your house" unless the user explicitly opts into
   something else (cloud archive, push notifications via relay). Any
   feature that silently changes that needs to be flagged, not shipped
   quietly.
3. **Free core product.** Everything except the optional Tesla
   keep-awake feature must work with zero sign-up, zero payment, zero
   third-party account. The Tesla feature requires the *user's own* free
   sign-up with Tesla — never payment to the app.

## Two-tier product model

- **Tier 1 (free, no sign-up)**: local storage, transient on-Pi
  encryption, archiving (local NAS or, in "Convenient" mode, cloud via
  rclone), browsing/downloading/deleting clips and music, the two-tab
  (Pi / Archive) browser. This is the entire product minus one feature.
- **Tier 2 (free, requires the user's own Tesla developer sign-up)**:
  keep-awake-during-archive. Gated behind Tesla's own registration flow,
  not a payment to this project. See `docs/ARCHIVE_AND_TESLA.md`.

## Where to look for detail

- `docs/ARCHITECTURE.md` — component map, BLE-then-WiFi network model
- `docs/DATA_MODEL.md` — core entities (Clip, ArchiveDestination, etc.)
- `docs/API.md` — REST endpoint list, wizard vs. everyday-use split
- `docs/BLE_PROTOCOL.md` — GATT service/characteristics, claim-code security
- `docs/STATE_MACHINES.md` — BLE pairing lifecycle, clip lifecycle, storage watermarks
- `docs/SECURITY.md` — encryption scope/rationale, Private vs. Convenient
  archive modes, required wizard disclaimer copy
- `docs/ARCHIVE_AND_TESLA.md` — archive destination options, Tesla Fleet
  API cost model and the per-user-registration decision
- `docs/RELIABILITY.md` — USB gadget enumeration watchdog and the A/B
  (dual-slot) OTA update design; read this before touching anything
  related to the gadget/UDC code path or the update mechanism
- `docs/OPEN_QUESTIONS.md` — things that need verifying against current
  reality before or during implementation; don't assume these are settled

## Tech stack

Decided 2026-07-01 (see [CHANGELOG.md](CHANGELOG.md)):

- **Pi service** (`pi-service/`) — Node.js + Express (REST API),
  `@abandonware/bleno` for the BLE GATT peripheral role (the actively
  maintained fork; the original `bleno` is unmaintained and breaks on
  modern BlueZ), Server-Sent Events for `GET /events`, Node's built-in
  `crypto` module for on-device encryption.
- **Mobile app** (`app/`) — React Native via Expo, using a custom dev
  client / EAS Build (not classic Expo Go, which doesn't support the
  BLE native module), `react-native-ble-plx` for the BLE central role.
  Targets both iOS and Android — the maintainer already holds both
  Apple and Google developer accounts from another project, so this
  introduces no new recurring cost under the zero-cost constraint above.

Rationale: one language (JavaScript/TypeScript) across both halves,
chosen to match the maintainer's existing Node.js experience rather
than introducing a second language (e.g. Dart for Flutter) purely for
the mobile side.

**Confirmed built (2026-07-02):** the custom dev client is real, not
just decided — `app/eas.json` "development" profile builds via EAS
(Expo account `poncherelly`/team `poncherellys-team`, project slug
`teslausb-companion`), and `react-native-ble-plx` is wired into
`app/BlePairingScreen.js`. Android build verified end-to-end against
the real Pi (see docs/BLE_PROTOCOL.md). iOS build not started —
needs device registration for ad-hoc distribution since it's not going
through TestFlight/App Store.

### Real-hardware constraints (confirmed 2026-07-01, see docs/OPEN_QUESTIONS.md #9-10)

The maintainer's test unit is a Pi Zero W running the stock teslausb
image (Raspberry Pi OS 10 "Buster", ARMv6, EOL). This isn't
necessarily every user's hardware, but it's the actual floor the
product needs to keep working on:

- **Node v18.20.4 (via `unofficial-builds.nodejs.org`) is the newest
  Node that runs on this exact OS/hardware combo.** Newer versions have
  ARMv6 binaries but are compiled against a `libstdc++` too new for
  Buster and fail at runtime. Official nodejs.org binaries dropped
  ARMv6 entirely years ago. Don't assume `apt install nodejs` or a
  recent official binary will work when writing install docs/scripts —
  test against the oldest supported OS image, not just current
  Raspberry Pi OS.
- **Buster's default apt mirror is dead (404).** Any install
  script/doc for this hardware generation needs
  `deb http://legacy.raspbian.org/raspbian/ buster main contrib
  non-free rpi` in `/etc/apt/sources.list`, not the stock mirror.
- **`bluez`/`libbluetooth-dev` are not installed by default** on the
  teslausb image (it doesn't use Bluetooth itself) — BLE peripheral
  work needs these installed explicitly before `@abandonware/bleno`'s
  native module will even compile.
- The root filesystem is **read-only by default** (teslausb's own
  crash-safety design, see RELIABILITY.md) — any setup step that writes
  to disk needs `sudo /root/bin/remountfs_rw` first.
