# Architecture

## Components

- **Pi service** — runs alongside existing teslausb scripts. Owns: BLE
  GATT provisioning service, REST API, clip state machine, storage
  watermark/cleanup logic. Does not orchestrate archive-sync itself —
  that's `archiveloop`, teslausb's own unmodified process (see "Why the
  app never talks to the archive directly" below). On-device encryption
  was investigated and dropped — see docs/SECURITY.md.
- **Mobile app** (iOS/Android) — talks to the Pi service only, never
  directly to a NAS or cloud archive. See "Why the app never talks to
  the archive directly" below.
- **Archive destination** — local NAS (CIFS/rsync/NFS, already supported
  by upstream teslausb) or cloud (via rclone remotes: Google Drive,
  OneDrive, etc.), reached only through the Pi.
- **Tesla Fleet API** — optional, Tier 2 only. See `ARCHIVE_AND_TESLA.md`.

## Two-phase network model

1. **BLE (provisioning only)** — first boot, bounded advertising window.
   Sole job: get the Pi onto WiFi and establish a claim. See
   `BLE_PROTOCOL.md` and `STATE_MACHINES.md`.
2. **WiFi (everything else)** — REST API over the local network
   (`teslausb.local` via mDNS, matching existing teslausb convention).
   All wizard steps past WiFi setup (admin password, archive config,
   Tesla OAuth) happen here, not over BLE.

## Why the app never talks to the archive directly

Even though the NAS is reachable on the same LAN as the phone, all
archive browsing/listing/deleting routes through the Pi's REST API
(`GET /clips?source=archive`), not a direct SMB/rclone connection from
the phone. Reasons: avoids storing NAS/cloud credentials on the phone,
works identically regardless of archive backend (including cloud
backends the phone can't natively browse), keeps deletion authority in
one place (the Pi's state machine), works the same whether the phone is
on the home LAN or not (as long as the Pi can reach the archive).

## Clip lifecycle (summary — full detail in STATE_MACHINES.md)

`new` → `archiving` → `archived` → `deleted`. Only the archive-sync
process may advance this state. Phone downloads are a read-only side
path (decrypt + stream) that never touches it — see `SECURITY.md` for
why, and `STATE_MACHINES.md` for the in-use lock that prevents the
deletion sweep from racing an in-progress download.

## Two-tab clip browser

The app shows "On device" (Pi) and "Archive" tabs against the identical
`GET /clips?source=` shape. A clip mid-transfer appears in both tabs
with an "Archiving"/"Syncing" badge until state flips to `archived`.

Within each tab, group by `category` (Recent/Saved/Sentry) rather than
one flat chronological list — confirmed necessary after testing a flat
list against real data (2026-07-01): Recent clips vastly outnumber
Saved/Sentry, burying the latter at the bottom of the scroll with no
visual separation. Category should be a section header/grouping, not
just per-row subtext.

## Music tab (added 2026-07-02)

A third top-level tab alongside "On device"/"Archive" — a folder
browser (`app/MusicBrowser.js`), not a flat list, since the music
partition is a generic user-organized folder tree, not a fixed
Music/Boombox split. See docs/DATA_MODEL.md's `MusicEntry` real-data
note and docs/API.md's `GET /music?path=`.
