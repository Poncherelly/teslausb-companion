// BLE GATT peripheral — "TeslaUSB Provisioning" service.
// See docs/BLE_PROTOCOL.md for the characteristic table and
// docs/STATE_MACHINES.md for the pairing lifecycle.
//
// Not wired into src/index.js yet: @abandonware/bleno requires BlueZ
// and only runs on Linux, so it can't be imported unconditionally on a
// dev machine. Wire this in behind a Linux-only check once BLE work
// starts, and test on real Pi hardware.
