# Reliability: USB gadget watchdog and OTA updates

## Background: USB gadget enumeration is a known, partially unsolved
   community issue

Not something confirmed fixed by any recent TeslaCam update. Long-running
issue in the teslausb GitHub history (issues/discussions going back to
2019, still active as of newer Model 3/Y glovebox USB3 port reports).
Two distinct failure patterns show up in the wild, and they call for
different responses:

1. **Never enumerates at all on a given car/port combination.** Some
   community members attribute this to genuine hardware limitations —
   the Pi not being designed for USB3-speed gadget emulation, or
   specific host-controller quirks on newer glovebox ports — not
   something software alone fixes. Manage expectations accordingly;
   don't oversell the watchdog below as a universal fix.
2. **Enumerates fine, then silently drops after some time**, requiring
   an unplug/replug (or full reboot) to recover. This pattern *is*
   software-addressable — see below.

## USB gadget watchdog

Design for failure pattern 2 above.

- **Continuous health-check loop, not just a boot-time check.** Poll
  whether the gadget has reached and is maintaining "configured" state
  (Linux configfs gadget framework exposes this). The failure mode is a
  mid-session drop, not just a bad boot, so a one-time startup check is
  insufficient.
- **On loss of configured state past a timeout, soft-cycle the gadget**
  — unbind and rebind the UDC in software. This is the software
  equivalent of the manual unplug/replug fix users are already doing,
  without physical intervention.
- **Reactive only, never proactive/periodic.** Do not cycle the gadget
  preemptively while it looks healthy — that itself interrupts an
  in-progress recording. Only trigger on genuine, confirmed loss of
  configured state.
- **Log every drop/recovery event with timestamps.** Surface this in
  the app (e.g. "USB reconnected 3 times today"). Chronic drops on a
  specific car/port combination is the signal that this may be failure
  pattern 1 (hardware-limited) rather than something further software
  tuning will fix — point users toward known-working cable/hub
  recommendations in that case rather than implying the app will
  eventually solve it.
- Minimizing boot-to-gadget time is a related, complementary mitigation
  (faster time to "configured" reduces the window for problems);
  worth tracking as a performance goal independent of the watchdog
  itself.

## OTA updates

### Flow (product-level, already agreed)

1. App alerts when an update is available.
2. Setting: auto-download (to local storage, not yet applied) vs.
   manual trigger.
3. Apply either on explicit user trigger or a scheduled time-of-day the
   user sets — never silently mid-use. Scheduling matters for avoiding
   interrupted recordings during the apply/reboot step, not (given the
   design below) for avoiding a fatal power loss.
4. Every stage surfaced in the app: available → downloaded, ready to
   apply → applying → applied successfully / rolled back. A rollback
   firing must be visible to the user, never silent.

### Core safety mechanism: A/B (dual-slot) updates

The central worry — car goes to sleep / loses power mid-update and
bricks the unit — is solved structurally, not by being careful about
timing alone.

- Two complete system slots (A/B). One active (currently running,
  currently serving the USB gadget), one inactive.
- Downloads and writes go entirely to the **inactive** slot. The active
  slot, and the gadget it's serving, is never touched during download
  or install — the Pi keeps working as a USB drive throughout.
- Verify the new slot's signature/checksum before doing anything else
  with it.
- Only after full, verified write does the Pi flip a small boot-config
  flag ("boot into the other slot next time") and reboot.
- **Trial boot / automatic rollback**: mark a freshly-switched boot as
  a trial. If the new slot fails to reach a healthy state (gadget
  successfully configured, core services running) within a couple of
  boot attempts, automatically flip the flag back to the previous,
  known-good slot and boot that instead. Same pattern Android/ChromeOS
  use for exactly this problem.

Failure-mode walkthrough:
- Power lost during download → active slot untouched, nothing to
  recover from, download resumes/retries later.
- Power lost while writing the inactive slot → active/running slot
  still untouched; partial write in the inactive slot is discarded and
  retried later.
- Power lost at the boot-switch flag write → smallest possible exposure
  window (single flag write, not a multi-minute operation); trial-boot
  rollback catches anything that still goes wrong.

**Net result: no point in the update sequence permanently bricks the
device.** Worst case is "update didn't take, will retry" — a
fundamentally different, acceptable failure mode.

### Implementation note

Don't build slot-management from scratch. **RAUC** is a mature,
self-hosted, open-source A/B update framework purpose-built for headless
embedded Linux devices (Raspberry Pi is a first-class target), with
signed-bundle verification and rollback already solved. Free, no hosted
service dependency — fits the zero-cost constraint. Evaluate before
writing custom slot logic.

### Rollout safety, independent of the A/B mechanism itself

- Host a version manifest for free (GitHub Releases API costs nothing).
- **Staged rollout, not all-devices-at-once**, even at hobby-project
  scale — a percentage-based or opt-in beta channel lets real-world
  gadget behavior on an update surface before it reaches everyone.
- **Treat any change touching the USB-gadget/UDC code path as the most
  conservative part of the system.** Test it hardest, roll it out
  slowest. A gadget regression is uniquely bad here because the failure
  is invisible to the user until they're relying on footage that was
  never recorded.
- Apply-time updates should require: parked, not mid-archive, gadget
  currently in a healthy configured state before starting.
