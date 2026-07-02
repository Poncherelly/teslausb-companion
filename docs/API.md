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

- `GET /clips?source=pi|archive&category=&state=` — powers both tabs
- `GET /clips/{id}/download` — decrypt + stream; sets `locked_by_download`
  for the duration; must never write to `state`
- `DELETE /clips/{id}` — **must reject at the API layer** anything not
  `state=archived`; share one internal function with the deletion sweep
  so there is exactly one code path allowed to delete
- `GET /clips/{id}/thumbnail`
- `GET /music?path=<relative path>` — **folder browser, not a flat
  list** (revised 2026-07-02 after real data showed the music
  partition is a generic user-organized folder tree — `Music/<artist>/
  <album>`, `boombox/`, plus arbitrary other top-level folders like
  "Comedy" or "kids music" — not a fixed two-category shape). Returns
  `{path, entries: [{name, type: "folder"|"file", size?}]}` for the
  requested directory. Implemented in `pi-service/src/lib/music-scan.js`.
  `DELETE /music/{id}`, `PUT /settings/music` not implemented yet.
- `GET /archive/destinations`, `POST /archive/destinations`,
  `PATCH /archive/destinations/{id}`, `DELETE /archive/destinations/{id}`
- `PUT /settings/archive-mode` — private/convenient toggle, revisitable
- `GET /system/status` — storage used/free, queue depth, BLE state,
  Tesla token health (Tier 2)
- `POST /system/pairing-mode` — explicit re-enable trigger, physical
  button or authenticated web UI action only
- `GET /events` — SSE/WebSocket stream for live archive progress, BLE
  state changes, Tesla wake status; drives live badge updates in the app
  without polling
