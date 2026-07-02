# BLE protocol

## Scope — deliberately narrow

BLE's only job is getting the Pi onto WiFi and establishing a claim.
Everything else in the wizard (admin password confirmation, archive
config, Tesla OAuth) hands off to the REST API over WiFi. Do not build
chunked-write infrastructure to carry wizard steps that don't belong on
BLE — Tesla OAuth in particular needs a real browser/webview and cannot
happen over a GATT characteristic.

## Service: TeslaUSB Provisioning

Implemented in `pi-service/src/ble/peripheral.js`.

| Characteristic | Property | Purpose | UUID |
|---|---|---|---|
| Device info | Read | JSON: `{serial_last4, fw_version, pairing_state, has_admin_password, wifi_connected}` | `e5eab36e-5fca-456d-9419-4db713b627eb` |
| WiFi config | Write | SSID + password; only accepted after claiming this session (see below) | `e5eab36e-5fca-456d-9419-4db713b627ed` |
| Admin password | Write | Doubles as the claim mechanism — see "Claiming via admin password" | `e5eab36e-5fca-456d-9419-4db713b627ee` |
| Status | Read + Notify | `idle → connecting_wifi → wifi_failed → wifi_connected(ip)` — app switches to REST once `wifi_connected` | `e5eab36e-5fca-456d-9419-4db713b627ef` |

Service UUID: `e5eab36e-5fca-456d-9419-4db713b627ea`.

There is no longer a separate "claim code" characteristic — see below
for why (redesigned 2026-07-02, was originally a 5th characteristic
with its own UUID `...627ec`, now removed).

**Resolved 2026-07-02 (see docs/OPEN_QUESTIONS.md #12):** the WiFi
config write triggers a real reboot on the Pi (teslausb's own
reconfiguration mechanism — see `wifi-reconfigure.js`) to actually
apply new credentials. The *current* bleno process ends at that
reboot, so no process is left running to notify `wifi_connected` over
BLE — instead, the app's pairing screen polls `GET /system/status`
over REST every few seconds after sending WiFi config, and shows a
real "connected" confirmation once the Pi responds again, rather than
just telling the user to wait and guess.

`device-info`'s `wifi_connected` field (checked by looking for a real
IPv4 address on `wlan0`, since BLE and WiFi are independent radios and
the peripheral runs regardless of WiFi state) also lets the app skip
re-sending WiFi credentials — and triggering an unnecessary reboot —
on a device that's already connected. Found this was a real, not just
theoretical, problem: re-opening the pairing screen on an
already-configured device previously forced WiFi re-entry every time.

Client implementation: `app/BlePairingScreen.js`, using
`react-native-ble-plx`. Verified end-to-end on real Pi Zero W hardware
against both a generic BLE scanner (nRF Connect, 2026-07-01) and the
actual app itself (2026-07-02) — full scan → claim → WiFi handoff →
real reboot → confirmed rejoin. Required switching the app off classic
Expo Go onto an EAS-built development client (see CLAUDE.md "Tech
stack"), since BLE needs a native module Expo Go doesn't include.
iOS not yet built/tested (Android only so far).

## Claiming via admin password (redesigned 2026-07-02)

The original design used a separate randomly-generated "claim code,"
printed on a sticker or blinked via an LED, as an out-of-band secret
proving "is this my device" independent of BLE pairing. For a headless
hobby device with no display and no manufacturing step to print a
sticker, that secret had no real channel to reach the user — SSH into
the Pi to read a log file isn't a usable answer for a non-technical
owner.

Instead, the **admin password characteristic is the claim mechanism**:

- **Fresh device, no password set yet:** the write both sets the
  password and claims the device. Whoever does this first, during the
  bounded advertising window (see `STATE_MACHINES.md`), wins the
  device.
- **Already-configured device:** the write must match the existing
  password (checked against the stored hash) to claim it.

`device-info`'s `has_admin_password` field tells the app which prompt
to show ("set a password" vs. "enter your password").

**Known, accepted tradeoff:** this removes protection against a
*different* phone racing to claim a *brand-new* device during its
first-ever pairing window — there's no secret gating that specific
moment anymore. If you lose that race, the fix is simple: restart the
pairing process (re-trigger the advertising window) and try again
faster. This is a deliberate, documented tradeoff for a personal/home
project, not an oversight — see CLAUDE.md's "Local/private by default"
constraint for why a bank-grade threat model isn't the bar here.
Re-pairing an *already-claimed* device is unaffected — that still
requires knowing the real password.

The app saves the password locally (`expo-secure-store`,
`app/BlePairingScreen.js`) so the user isn't retyping it constantly.
If the password is changed later (e.g. via a future settings screen),
the app's saved copy goes stale and needs one manual re-entry.

## MTU

Negotiate MTU up front rather than assuming. Default BLE MTU is small
(historically 23 bytes, negotiable higher on modern stacks); admin
passwords and WiFi credentials fit fine on a negotiated MTU without
needing chunking infrastructure.

**Confirmed 2026-07-02:** on Android, this isn't optional — the
default ~20-byte usable payload is too small for the WiFi config JSON,
and the client must call `device.requestMTU(247)` explicitly after
connecting (`react-native-ble-plx`). iOS negotiates MTU automatically
and doesn't expose an equivalent call.

## Advertising lifecycle

See `STATE_MACHINES.md` for the full state machine (bounded advertising
window, timeout behavior, re-pairing trigger).
