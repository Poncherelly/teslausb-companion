# Open questions

Things flagged during design that need verifying against current
reality rather than being treated as settled. Check these before or
while implementing the relevant feature — don't assume the answer
below is still accurate by the time this gets built, especially the
Tesla-related ones, since that API has changed more than once in the
period this project was being designed.

1. **Can an individual complete Tesla's Fleet API app registration
   without a registered business entity?** Circumstantial evidence says
   yes (see ARCHIVE_AND_TESLA.md), not directly confirmed. Do a real
   test registration first.

2. **Exact mechanics of sharing one `.well-known` public-key-hosting
   domain across many individually-registered Tesla apps** — confirm
   Tesla's domain-verification/vehicle-pairing flow actually permits
   this (as MyTeslamate's product implies) before designing the Tier 2
   flow around it.

3. **BLE MTU negotiation** — confirm actual negotiated MTU on target
   hardware/OS combinations (Android BLE stack, iOS Core Bluetooth)
   rather than assuming; affects whether WiFi password writes need
   chunking after all.

4. **Moot as of 2026-07-03** — on-Pi encryption itself was dropped (see
   docs/SECURITY.md), so this performance-benchmarking question no
   longer applies. Kept here in case encryption is ever revisited.

5. **Tesla Fleet API pricing and discount amounts are not stable** —
   the discount has already changed once (from $10 to $14/month) during
   this project's design period. Don't hardcode assumptions about exact
   dollar amounts into user-facing copy; reference Tesla's own current
   documentation instead of a fixed number where possible.

6. **Push notification relay was deliberately deferred to webhook/email
   only for v1** (no managed push infrastructure) — revisit only if
   there's a clear zero/near-zero-cost path to real push later, and keep
   it opt-in and disclosed if it ever appears, matching the existing
   Private/Convenient disclosure pattern.

7. **RAUC (or equivalent A/B update framework) compatibility with the
   specific Pi models/OS images this project targets** — confirm it
   works cleanly alongside the USB gadget configuration (configfs) setup
   before committing to it as the OTA mechanism. See RELIABILITY.md.

8. **Whether the "never enumerates at all" USB gadget failure pattern
   (as opposed to the "drops mid-session" pattern) has any software
   mitigation at all**, or is purely a hardware/host-controller
   limitation on certain car/port combinations — see RELIABILITY.md.
   Worth tracking community reports as this project gets built, since
   the answer may differ across Tesla models/years/firmware.

9. **RESOLVED (2026-07-01), confirmed against real hardware**: Node.js
   on a Pi Zero W running the stock teslausb image (Raspberry Pi OS
   10 "Buster", ARMv6). Official Node.js binaries dropped ARMv6
   support years ago; the community `unofficial-builds.nodejs.org`
   project still publishes ARMv6 binaries up to current versions, but
   they're compiled against a newer `libstdc++`/glibc than Buster
   ships — versions above v18.x fail at runtime with
   `GLIBCXX_3.4.30 not found` even though the architecture matches.
   **v18.20.4 is the practical ceiling on this exact OS/hardware
   combo.** Relevant to item 4 above (weaker hardware may also mean an
   older, EOL Node runtime — factor that into any security posture
   decisions for on-Pi encryption).

10. **Buster's default apt mirror (`raspbian.raspberrypi.org`) is gone
    (404) now that Buster is EOL** — any Pi still running the original
    teslausb image needs `/etc/apt/sources.list` repointed to
    `http://legacy.raspbian.org/raspbian/` before `apt-get update` will
    work at all. Needed to install `bluez`/`libbluetooth-dev` (not
    present by default on the teslausb image) for BLE peripheral work.

11. **RESOLVED (2026-07-01)**: `@abandonware/bleno` failed to compile
    on this same Pi Zero W/Buster combo even with `libbluetooth-dev`
    installed. Root cause wasn't the C++ compiler at all — it was
    `node-gyp`'s bundled `gyp` build tool: versions from roughly
    late-2023 onward use a Python `:=` walrus operator (Python 3.8+
    syntax) in their own source, and Buster only ships Python 3.7.3.
    Fixed by pinning `"overrides": {"node-gyp": "9.4.1"}` in
    `pi-service/package.json` (see the file for why), which forces the
    whole dependency tree (including transitive native-module deps
    like `bluetooth-hci-socket`) onto a node-gyp version old enough to
    run on Python 3.7. Also needed: `pi-bluetooth` (not installed by
    default; the Zero W's onboard BT chip is UART-attached and needs
    this package's `hciuart` service to initialize `hci0` at all) and
    adding the runtime user to the `bluetooth` group (otherwise
    `bluetoothd` is invisible to non-root D-Bus callers even though the
    controller is genuinely present).

12. **No live `wifi_connected` BLE notification is possible with the
    current design.** The WiFi config write triggers teslausb's real
    reconfiguration mechanism, which reboots the Pi — the bleno process
    handling that write ends at the reboot, so it can never itself
    notify a later status change. Either the app needs to poll the REST
    API after a delay once it stops seeing BLE activity, or a fresh BLE
    advertising session on next boot needs to carry the "did wifi
    actually connect" answer instead of the pre-reboot process. Not
    resolved — flagging for whoever builds the app-side wizard flow.

13. **RESOLVED (2026-07-02):** Music/Boombox folder structure explored
    and confirmed — see docs/DATA_MODEL.md's `MusicEntry` note and
    `pi-service/src/lib/music-scan.js`. It's a generic user-organized
    folder tree, not a fixed two-category split.

14. **RESOLVED (2026-07-02), important lesson for future config
    writes:** `pi-service/src/ble/wifi-reconfigure.js` used to
    overwrite the entire `teslausb_setup_variables.conf` with just
    `SSID`/`WIFIPASS`. Since that file is the *only* persisted copy of
    the full setup config (archive destination, etc.) once initial
    setup completes, this silently deleted a real, working
    `ARCHIVE_SYSTEM`/`ARCHIVE_SERVER` config during repeated
    WiFi-reconfiguration testing, leaving `archiveloop` stuck checking
    `localhost` instead of the real NAS for about a day. Fixed by
    reading and merging with the existing config instead of
    overwriting it. **Any future code that writes this file (e.g. the
    new `PUT /system/hostname`, which doesn't touch this file but sets
    a precedent) must merge, never blindly overwrite.** This device's
    real archive destination, for reference: CIFS, server
    `192.168.50.6`, shares `TeslaCam/ModelY` (clips) and `TeslaMusic`
    (music) — already fully configured via `/etc/fstab` and
    `/root/.teslaCamArchiveCredentials`, which are independent of
    `teslausb_setup_variables.conf` and were never at risk.
