# pi-service

Node.js service that runs alongside teslausb on the Pi: BLE provisioning,
REST API, encryption, archive-sync orchestration. See
[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) and
[docs/API.md](../docs/API.md).

## Running locally

```bash
npm install
npm run dev
```

Starts the REST API on port 3000 (override with `PORT=`).

## BLE

`@abandonware/bleno` (the GATT peripheral library) is an **optional**
dependency — it requires native compilation against BlueZ and only
installs/runs on Linux. On Windows/macOS dev machines, `npm install`
will skip it and the REST API still works fine; BLE code
(`src/ble/`) must be developed and tested on the Pi itself, or a Linux
VM/WSL2 with BlueZ dev headers installed.

On the Pi itself, `bluez` and `libbluetooth-dev` must be installed
first (`sudo apt-get install bluez libbluetooth-dev`) for bleno's
native module to compile at all.

The `node-gyp` entry in `overrides` is not stray — don't remove it.
Newer `node-gyp` versions require Python 3.8+ (a walrus-operator syntax
error otherwise); older Pi OS images (e.g. Raspberry Pi OS 10 "Buster")
only ship Python 3.7, so the whole tree is pinned to a node-gyp old
enough to run there. See docs/OPEN_QUESTIONS.md #11.
