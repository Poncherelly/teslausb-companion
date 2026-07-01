# app

React Native (Expo) mobile app for browsing, downloading, and deleting
clips/music from the Pi and the archive. See
[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) and
[docs/BLE_PROTOCOL.md](../docs/BLE_PROTOCOL.md).

## Running locally

```bash
npm install
npm start
```

## BLE

Uses `react-native-ble-plx` for the BLE central role (connecting to the
Pi's GATT peripheral during first-use setup). This requires a native
module not included in classic Expo Go — use a custom dev client / EAS
Build once BLE code is added (see CLAUDE.md "Tech stack").
