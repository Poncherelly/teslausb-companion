# Security

## Threat model, stated plainly

A Raspberry Pi has no secure enclave/TPM by default. Design for
realistic threats (casual SD-card snooping, a stolen Pi, a stolen phone)
not a sophisticated attacker with the physical SD card and unlimited
time — and say so to users rather than overclaiming.

## On-Pi encryption — dropped (2026-07-03)

**Investigated against the real teslausb architecture and abandoned.**
The design below assumed some interception point between "Tesla writes
a clip" and "archive-sync copies it off," but there isn't one: Tesla
writes plaintext video directly to a raw FAT32 disk image
(`cam_disk.bin`) over USB mass storage — a raw block device, not
through any API this project can hook. Encrypting in-place would need
either a background watcher racing the car's own writes (real
corruption risk to a live, working USB gadget), or modifying/replacing
`archiveloop` (upstream teslausb's own script) so archived copies get
decrypted again before reaching the NAS — both against this project's
"never modify teslausb's own code" rule and its general risk tolerance
for the one physical device everything depends on. Confirmed separately
that upstream teslausb itself has zero encryption support to build on
(no config variables, no scripts, `cryptsetup` not even installed).

Kept below for reference in case this gets revisited, but it is **not
planned work** as of this writing.

## On-Pi encryption — narrow and transient, by design (original design, not built)

Purpose: protect clips only during the brief window between "Tesla
writes it" and "archive-sync copies it off" — i.e. against someone
stealing the Pi itself while unarchived footage is still sitting on it.
Not a permanent-storage encryption scheme.

- Random per-device AES-256 key generated during first-use wizard,
  never derived from anything guessable.
- Key lives on the Pi only (no phone-side custody needed) — the only
  thing being defended against is a stolen Pi with unarchived footage
  still on it. A stolen Pi with the key but no unarchived footage
  (because archiving succeeded) has nothing to decrypt.
- Use libsodium/NaCl (`crypto_secretstream`) for streaming authenticated
  encryption — video files are large; don't hand-roll AES modes or
  require holding a whole file in memory for a MAC check.
- Wizard toggle: on by default, but benchmark on lowest-supported
  hardware (Pi Zero / Zero 2 W) before defaulting on everywhere —
  continuous video encryption is real CPU work concurrent with
  teslausb's existing filesystem-repair and copy work.

## Archive-side encryption — conditional, not universal

- **Local NAS (Private mode)**: no archive-side encryption by default.
  It's the user's own already-trusted network; encrypting here mainly
  adds a "basic user can't view their own files later" problem for
  little real benefit.
- **Cloud (Convenient mode)**: `encrypt_before_upload` should default
  true. The moment footage leaves the house, the earlier reasoning no
  longer applies — encrypt, and make the app itself the decryption tool
  for cloud-archived clips (mirrors the Pi decrypt-on-stream pattern).

## Phone downloads — decrypt-on-stream, no key on the phone

The app never holds the encryption key. `GET /clips/{id}/download`
decrypts server-side (on the Pi) and streams plaintext over the already
authenticated/TLS'd session. Once downloaded, standard phone-OS security
takes over — that's an accepted, explicit handoff, not a gap.

## Private / Convenient archive mode — labeling and disclosure

Final copy decisions from design discussion:

- Labels: **Private** / **Convenient** (not "Secure" — that implies a
  safety guarantee neither option can actually make, since both depend
  entirely on the user's own setup).
- Captions (describe scope, not safety):
  - Private: "Accessible only from your home network."
  - Convenient: "Accessible from anywhere you're signed in."
- **Required disclaimer, visible on this screen every time, mode-aware**:
  - Private: "Both options are only as secure as your own setup. Use a
    strong WiFi password and keep your router and NAS updated."
  - Convenient: "Both options are only as secure as your own setup. Use
    a strong account password and enable two-factor authentication."
- This disclaimer should also live permanently in app settings (not
  just the one-time wizard), since a user's setup can degrade over time
  (e.g. router factory-reset) well after the wizard is long past.
- Mode is a **revisitable setting**, not a one-time wizard choice.
  Switching Private → Convenient just unlocks new destination choices.
  Switching Convenient → Private while a cloud destination is active
  should not silently disconnect it — confirm with the user, and only
  gate *new* destination selection going forward.
- Destination cards for cloud options, when gated by Private mode,
  should show *why* they're disabled ("Requires convenient mode"), not
  just sit inert.

## Tesla credentials (Tier 2)

Never capture username/password. OAuth only, via embedded browser to
Tesla's real login domain. Store only the encrypted refresh token;
access tokens are memory-only and requested only immediately before a
keep-awake call, then discarded. See `ARCHIVE_AND_TESLA.md` for the
per-user app registration requirement this implies.
