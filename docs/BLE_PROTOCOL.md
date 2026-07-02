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
| Device info | Read | JSON: `{serial_last4, fw_version, pairing_state}` | `e5eab36e-5fca-456d-9419-4db713b627eb` |
| Claim code | Write | App writes the code printed on the device (serial or dedicated pairing code). Out-of-band secret, independent of BLE link-layer pairing. | `e5eab36e-5fca-456d-9419-4db713b627ec` |
| WiFi config | Write | SSID + password; only accepted after a valid claim code this session | `e5eab36e-5fca-456d-9419-4db713b627ed` |
| Admin password | Write | Sets the credential the REST API requires from here on | `e5eab36e-5fca-456d-9419-4db713b627ee` |
| Status | Read + Notify | `idle → connecting_wifi → wifi_failed → wifi_connected(ip)` — app switches to REST once `wifi_connected` | `e5eab36e-5fca-456d-9419-4db713b627ef` |

Service UUID: `e5eab36e-5fca-456d-9419-4db713b627ea`.

**Known gap (see docs/OPEN_QUESTIONS.md #12):** the WiFi config write
triggers a real reboot on the Pi (teslausb's own reconfiguration
mechanism — see `wifi-reconfigure.js`) to actually apply new
credentials. The *current* bleno process ends at that reboot, so no
process is left running to notify `wifi_connected` — the app cannot
observe that transition over BLE and must fall back to polling the
REST API after a delay, or a fresh BLE advertising session on next
boot. Still unresolved as of 2026-07-02 — the app's pairing screen
(`app/BlePairingScreen.js`) currently just tells the user to wait and
close the screen manually; it doesn't yet poll for the Pi coming back.

Client implementation: `app/BlePairingScreen.js`, using
`react-native-ble-plx`. Verified end-to-end on real Pi Zero W hardware
against both a generic BLE scanner (nRF Connect, 2026-07-01) and the
actual app itself (2026-07-02) — full scan → claim → WiFi handoff →
real reboot → confirmed rejoin. Required switching the app off classic
Expo Go onto an EAS-built development client (see CLAUDE.md "Tech
stack"), since BLE needs a native module Expo Go doesn't include.
iOS not yet built/tested (Android only so far).

## Why the claim code matters independent of BLE pairing

A headless device with no screen/keypad falls back to BLE "Just Works"
pairing, which protects against eavesdropping but not against a
different phone connecting during the advertising window and racing to
pair first. The printed claim code is the actual answer to "is this my
device." Put it on a sticker and also expose it via the device-info
characteristic or an LED pattern, so a legitimate owner isn't stuck if
the sticker is missing.

## MTU

Negotiate MTU up front rather than assuming. Default BLE MTU is small
(historically 23 bytes, negotiable higher on modern stacks); WiFi
passwords and claim codes fit fine on a negotiated MTU without needing
chunking infrastructure.

**Confirmed 2026-07-02:** on Android, this isn't optional — the
default ~20-byte usable payload is too small for the WiFi config JSON,
and the client must call `device.requestMTU(247)` explicitly after
connecting (`react-native-ble-plx`). iOS negotiates MTU automatically
and doesn't expose an equivalent call.

## Advertising lifecycle

See `STATE_MACHINES.md` for the full state machine (bounded advertising
window, timeout behavior, re-pairing trigger).
