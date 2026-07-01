# Data model

Entities the Pi service is responsible for. Field lists are a starting
point for schema design, not a final spec — expect refinement once
implementation starts.

## Clip

- `id`
- `filename`
- `category`: `sentry` | `saved` | `recent`
- `timestamp`
- `size`
- `checksum`
- `state`: `new` | `archiving` | `archived` (then removed on deletion)
- `encrypted_on_disk`: bool
- `locked_by_download`: bool — in-use lock, see STATE_MACHINES.md

## ArchiveDestination

- `id`
- `type`: `cifs` | `rsync` | `nfs` | `rclone:gdrive` | `rclone:onedrive` | ...
- `scope`: `local` | `cloud`
- `credentials` — encrypted at rest on the Pi, never on the phone
- `encrypt_before_upload`: bool — defaults true when `scope=cloud`
- `enabled`: bool

## ArchiveMode

Single device-level setting: `private` | `convenient`. Gates which
`ArchiveDestination.scope` values the app will let the user add. See
`SECURITY.md` for the UX and required disclaimer copy. This is a
revisitable setting, not a one-time wizard choice — see ARCHIVE_AND_TESLA.md notes.

## MusicSettings

- `mode`: `sync` | `overwrite` | `ignore`
- `source_path`

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
