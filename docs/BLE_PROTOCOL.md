# BLE protocol

## Scope — deliberately narrow

BLE's only job is getting the Pi onto WiFi and establishing a claim.
Everything else in the wizard (admin password confirmation, archive
config, Tesla OAuth) hands off to the REST API over WiFi. Do not build
chunked-write infrastructure to carry wizard steps that don't belong on
BLE — Tesla OAuth in particular needs a real browser/webview and cannot
happen over a GATT characteristic.

## Service: TeslaUSB Provisioning

| Characteristic | Property | Purpose |
|---|---|---|
| Device info | Read | JSON: `{serial_last4, fw_version, pairing_state}` |
| Claim code | Write | App writes the code printed on the device (serial or dedicated pairing code). Out-of-band secret, independent of BLE link-layer pairing. |
| WiFi config | Write | SSID + password; only accepted after a valid claim code this session |
| Admin password | Write | Sets the credential the REST API requires from here on |
| Status | Read + Notify | `idle → connecting_wifi → wifi_failed → wifi_connected(ip)` — app switches to REST once `wifi_connected` |

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

## Advertising lifecycle

See `STATE_MACHINES.md` for the full state machine (bounded advertising
window, timeout behavior, re-pairing trigger).
