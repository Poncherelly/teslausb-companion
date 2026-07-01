# State machines

## BLE provisioning lifecycle

1. **First boot** — default config present, advertises BLE for a bounded
   window (target: 10–15 min, configurable).
2. App connects within window → **Setup wizard** (WiFi, then hands off
   to REST for the rest).
3. Wizard completes → **Operational** (WiFi only, BLE advertising off).
4. If window times out with no app connecting → **Operational**
   directly, running on default config, BLE off.
5. Re-entering pairing mode requires an explicit trigger (physical
   button, or an authenticated call from the already-paired web UI) —
   never an indefinite/always-on BLE broadcast.

## Clip lifecycle

`new` → `archiving` → `archived` → `deleted`.

- Only the archive-sync process may advance this chain, and only after
  verifying the copy landed (checksum/byte-count match at the
  destination, not just a zero exit code).
- `DELETE` is only valid from `archived`. Enforce this at the API layer,
  not just in UI logic.
- **Download-to-phone is a side path, not a chain transition.** Decrypts
  and streams from any of `new`/`archiving`/`archived`; never writes to
  `state`. This is what keeps a phone download from being misread as an
  archive confirmation and triggering deletion.
- **In-use lock**: while a download is streaming, mark the clip busy;
  the deletion sweep skips or briefly retries busy clips rather than
  racing an in-flight read. An *interrupted* download (already landed
  bytes, connection dropped) is not a case needing protection — only an
  *in-progress* download racing the sweep is.

## Storage watermarks

Three states based on percentage of the TeslaCam partition free
(percentage, not absolute GB, so it works across card sizes):

- **Normal** (below soft threshold, default 80%) — no action.
- **Warning** (soft threshold crossed) — notify, no deletion. Include
  the reason if known (archive unreachable vs. can't keep up with
  recording volume — these need different user responses).
- **Critical** (hard threshold crossed, default 95%) — active cleanup:
  1. Delete oldest `RecentClips` first, re-checking free space after
     each deletion, stopping as soon as back under threshold.
  2. If `RecentClips` exhausted and still critical: **do not
     auto-delete unarchived `SavedClips`/`SentryClips`.** Enter a hard
     stop state — urgent notification, prominent in-app surfacing —
     and let the user decide. Never silently sacrifice deliberately
     saved footage.
  3. Cleanup priority order should be user-configurable (data model:
     ordered priority list, not a hardcoded two-tier rule).

Log every deletion (filename, size, timestamp, category, reason —
`archived` vs. `storage-pressure-recentclips`) from day one; cheap now,
essential later for "where did my clip go" support questions.

Cleanup sweep must respect the same in-use/locking discipline as
downloads — never delete a file the archive-sync process has mid-copy.
