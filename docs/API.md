# REST API

All endpoints except `/setup/*` require the admin session credential
established during the wizard. `/setup/*` endpoints must stop responding
once `DeviceConfig.first_boot_complete = true` and BLE is not in pairing
mode — re-opening them after that point defeats the pairing-window
security model in STATE_MACHINES.md.

## Wizard (only reachable during BLE pairing window / before first-boot complete)

- `POST /setup/wifi`
- `POST /setup/admin` — **superseded for initial setup** (2026-07-02):
  the admin password is now set/verified over BLE as the claim
  mechanism itself, before WiFi even exists to reach this endpoint —
  see docs/BLE_PROTOCOL.md "Claiming via admin password". This REST
  endpoint may still make sense later for *changing* an existing
  password once already connected, but doesn't gate initial claiming.
- `POST /setup/archive` — mode (`private`/`convenient`) + first destination
- `POST /setup/tesla/callback` — receives Tesla OAuth code, exchanges
  server-side, Tier 2 only
- `GET /setup/status` — wizard progress polling

## Everyday use (admin session required)

- `GET /clips?source=pi|archive&category=&state=` — powers the "On
  device" tab's flat categorized list directly; the Archive tab
  (`app/ArchiveBrowser.js`, added 2026-07-03) instead uses this same
  response client-side to derive a folder-drill view (Category ->
  Event -> Files), matching the Music tab's folder-browser pattern —
  see docs/DATA_MODEL.md
- `GET /clips/{id}/files` — added 2026-07-03: lists every real file for
  one clip (all camera angles plus, for Saved/Sentry events, sidecar
  files like `event.json`/`event.mp4`/`thumb.png`) as `{files: [{name,
  size}]}`. Powers the Archive tab's third drill-down level.
- `GET /clips/{id}/download[?file=<name>]` — decrypt + stream; sets
  `locked_by_download` for the duration; must never write to `state`.
  `?file=` (added 2026-07-03) streams one specific file from the
  clip's own directory instead of the representative front-camera
  file — `name` must exactly match a real file in that directory
  (checked against the filesystem, not just pattern-validated) to rule
  out path traversal.
- `DELETE /clips/{id}` — **must reject at the API layer** anything not
  `state=archived`; share one internal function with the deletion sweep
  so there is exactly one code path allowed to delete. Also rejects
  `source=archive` outright (403) — deleting the archive copy itself
  isn't supported. As of 2026-07-03 this is a real, working gate, not
  permanently-unreachable code: it live-verifies against the archive
  (`clips-scan.js`'s `isArchived`) at delete time, rather than trusting
  `state` from an earlier `GET /clips` response — see
  `pi-service/src/routes/clips.js`. `GET /clips?source=pi` separately
  annotates `state: "archived"` for display (`annotateArchivedState`),
  but that's for the app's UI, not the safety check itself.
- `GET /clips/{id}/thumbnail`
- `GET /music?source=pi|archive&path=<relative path>` — **folder
  browser, not a flat list** (revised 2026-07-02 after real data showed
  the music partition is a generic user-organized folder tree —
  `Music/<artist>/<album>`, `boombox/`, plus arbitrary other top-level
  folders like "Comedy" or "kids music" — not a fixed two-category
  shape). Returns `{path, entries: [{name, type: "folder"|"file",
  size?}]}` for the requested directory. `source` added same day as
  `GET /clips?source=` — `archive` requires a music share to have been
  configured in Archive settings (`musicShareName`); if none was
  configured, the mount attempt fails and the error message says so
  explicitly rather than a generic 500. Implemented in
  `pi-service/src/lib/music-scan.js` (source-agnostic folder browser)
  and `src/lib/archive-mount.js` (`ensureArchiveMusicMounted`).
- `GET /music/download?source=pi|archive&path=<relative path>` — added
  2026-07-03, streams a single file for in-app playback the same way
  clip downloads do (Express's `res.sendFile` supports HTTP Range
  requests natively). `path` must resolve to a real file within the
  mount (`music-scan.js`'s `resolveMusicFile`, same path-traversal
  protection as the folder browser). Powers `app/MusicBrowser.js`'s
  "Now Playing" bar (`expo-audio`'s `useAudioPlayer`/
  `useAudioPlayerStatus`).
- `POST /music/upload?source=archive&path=<folder>` / `DELETE
  /music?source=archive&path=<file>` — added 2026-07-03, **`source=archive`
  only, `pi` rejected with 403**. Neither ever touches the on-device
  `music_disk.bin` directly — that partition is live-exposed to the car
  as a USB gadget, and writing to it while the car might have it
  mounted risks corruption. Instead these write to/delete from the
  archive music share, and teslausb's own `copy-music.sh` (already
  running on the Pi, unmodified) rsyncs — with `--delete` — from there
  down to the car's local partition on its own schedule. Upload is
  multipart (`multer`, field name `file`); both validate the target
  path/filename the same way the folder browser does
  (`music-scan.js`'s `resolveUploadDir`/`deleteMusicFile`/
  `isSafeFilename`). `PUT /settings/music` **dropped 2026-07-03** — it
  assumed `copy-music.sh` supports configurable sync modes
  (`sync`/`overwrite`/`ignore` per the original `MusicSettings` entity
  in docs/DATA_MODEL.md); it doesn't, upstream's script is a fixed
  one-way mirror with no modes. There's nothing real for this endpoint
  to control.
- `GET /archive/config`, `PUT /archive/config` — **revised 2026-07-02,
  scoped down from the original multi-destination
  `/archive/destinations` design** to match what's actually deployed:
  a single CIFS destination (server, clips share, optional music
  share, username/password), read/written via `/etc/fstab` +
  `/root/.teslaCamArchiveCredentials` + `ARCHIVE_SYSTEM`/
  `ARCHIVE_SERVER` in `teslausb_setup_variables.conf`. `GET` never
  returns the password. `PUT` reboots to apply, same pattern as
  `PUT /system/hostname`. Multi-destination management and cloud
  (rclone) destinations are still future work — see
  docs/ARCHIVE_AND_TESLA.md. Implemented in
  `pi-service/src/lib/archive-config.js` / `src/routes/archive.js`.
- `PUT /settings/archive-mode` — private/convenient toggle, revisitable
  — **deferred 2026-07-03**, not just "not implemented yet": only one
  CIFS destination *type* exists (no cloud/rclone destinations built),
  so a mode toggle would have nothing real to switch between. Revisit
  once cloud archive destinations exist.
- `GET /system/status` — hostname, version (storage used/free, queue
  depth, BLE state, Tesla token health still TODO)
- `PUT /system/hostname` — rename the Pi, reboots to apply
- `POST /system/pairing-mode` — explicit re-enable trigger, physical
  button or authenticated web UI action only
- `GET /events` — added 2026-07-03, real (SSE, not WebSocket) stream of
  live archive-sync status, sourced by tailing teslausb's own
  `archiveloop.log` (`pi-service/src/lib/archive-events.js`) rather
  than polling. Emits `{type, message}` where `type` is one of
  `archiving`/`idle`/`error`/`unreachable`/`syncing_music`/`waiting`/
  `waiting_idle`/`info`. BLE state changes and Tesla wake status are
  not wired into it — those were aspirational at spec time and remain
  unbuilt (Tier 2 doesn't exist at all yet). Consumed by
  `app/AppBanner.js` (`app/events.js`'s `subscribeToEvents`, an XHR-based
  SSE client — React Native's `fetch` doesn't support incrementally
  reading a streaming response body, so this uses the classic
  `onprogress`-diffing pattern instead of a new dependency) to show live
  status like "Archiving clips…" under the hostname.
