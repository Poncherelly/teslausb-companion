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
