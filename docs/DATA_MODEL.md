# Data model

Entities the Pi service is responsible for. Field lists are a starting
point for schema design, not a final spec — expect refinement once
implementation starts.

## Clip

- `id` — encodes `source` + `category` + timestamp as
  `${source}:${category}:${timestampKey}` (colon-delimited, since the
  Tesla timestamp format itself contains hyphens) — see
  `pi-service/src/lib/clips-scan.js`
- `filename`
- `category`: `sentry` | `saved` | `recent`
- `source`: `pi` | `archive` — added 2026-07-02 alongside `GET
  /clips?source=` (API.md); `recent` never appears for `source=archive`
  since RecentClips (the rolling buffer) isn't synced to the archive
- `timestamp`
- `size`
- `checksum`
- `state`: `new` | `archiving` | `archived` (then removed on deletion)
- `encrypted_on_disk`: bool
- `locked_by_download`: bool — in-use lock, see STATE_MACHINES.md

**Real-data note (2026-07-01):** Tesla's own dashcam layout records up
to 4 camera angles (front/back/left_repeater/right_repeater) per
moment, but this entity has a single `filename`. First real
implementation (`pi-service/src/lib/clips-scan.js`) treats one Clip as
the whole camera-angle group — `filename`/`size` come from the front
camera / summed across all angles — not one Clip per file. Revisit if
per-angle download/delete is ever needed. `checksum` is not populated
by the listing endpoint (expensive to hash video files on every
request) and there's still no checksum-based archive-sync verification
step — `archiveloop` itself (the real, working sync process) doesn't
expose one.

**`state` is still not computed from real data (2026-07-02):** every
real clip from both `source=pi` and `source=archive` currently reports
`state: "new"` unconditionally — nothing cross-references whether a
given on-device clip has a matching copy in the archive yet. This is
why `DELETE /clips/{id}` still rejects every real request (correctly,
per the `state=archived` guardrail) even though the archive itself is
real and working. Building that correlation is the natural next step
once on-device delete-after-archive is wanted.

## ArchiveDestination

Original design (below) covers multiple simultaneous destinations
across local and cloud backends. **Only a single CIFS destination is
actually implemented as of 2026-07-02** — `GET /archive/config` /
`PUT /archive/config` (see API.md), backed directly by `/etc/fstab` +
`/root/.teslaCamArchiveCredentials`, matching how upstream teslausb
itself expects a CIFS archive to be configured. The fields below remain
the target shape for when multi-destination/cloud support is built:

- `id`
- `type`: `cifs` | `rsync` | `nfs` | `rclone:gdrive` | `rclone:onedrive` | ...
- `scope`: `local` | `cloud`
- `credentials` — encrypted at rest on the Pi, never on the phone
- `encrypt_before_upload`: bool — defaults true when `scope=cloud`
- `enabled`: bool

What's actually returned by `GET /archive/config` today: `configured`
(bool), `server`, `shareName` (clips), `musicShareName` (nullable),
`shareUser`, `reachable` (bool|null, live TCP probe of port 445) — no
`credentials` field, the password is write-only.

## ArchiveMode

Single device-level setting: `private` | `convenient`. Gates which
`ArchiveDestination.scope` values the app will let the user add. See
`SECURITY.md` for the UX and required disclaimer copy. This is a
revisitable setting, not a one-time wizard choice — see ARCHIVE_AND_TESLA.md notes.

## MusicSettings

- `mode`: `sync` | `overwrite` | `ignore`
- `source_path`

## MusicEntry (added 2026-07-02, real-data-driven)

Not originally speced — added after mounting the real music partition
showed it's a generic, user-organized folder tree (`Music/<artist>/
<album>`, `boombox/`, plus arbitrary other top-level folders), not a
flat list. `GET /music?path=` (see API.md) returns these for one
directory at a time:

- `name`
- `type`: `folder` | `file`
- `size` — files only

## TeslaAuth (Tier 2 only)

- `refresh_token` — encrypted at rest, long-lived
- `expires_at`
- `scopes`
- **Never store the access token.** Memory-only, requested only when
  about to initiate a keep-awake call, discarded immediately after.
- `client_id` / `client_secret` — per-user's own Tesla developer app
  credentials, not shared across users. See ARCHIVE_AND_TESLA.md.

## DeviceConfig

- WiFi credentials — encrypted at rest
- Admin password hash
- BLE pairing state
- `first_boot_complete`: bool
