// BLE GATT peripheral — "TeslaUSB Provisioning" service.
// See docs/BLE_PROTOCOL.md for the characteristic table/rationale and
// docs/STATE_MACHINES.md for the pairing lifecycle.
//
// @abandonware/bleno is Linux/BlueZ-only and requires elevated
// privileges for raw HCI access — run pi-service as root on the Pi.
// See pi-service/README.md.

import bleno from "@abandonware/bleno";
import { getDeviceInfo } from "./device-info.js";
import { hasAdminPassword, setAdminPassword, verifyAdminPassword } from "./device-config-store.js";
import { reconfigureWifi } from "./wifi-reconfigure.js";

const SERVICE_UUID = "e5eab36e5fca456d94194db713b627ea";
const CHAR_UUIDS = {
  deviceInfo: "e5eab36e5fca456d94194db713b627eb",
  wifiConfig: "e5eab36e5fca456d94194db713b627ed",
  adminPassword: "e5eab36e5fca456d94194db713b627ee",
  status: "e5eab36e5fca456d94194db713b627ef",
};

const PAIRING_WINDOW_MS = 10 * 60 * 1000;

// Per-connection state — claiming must be re-established by each new
// connection (docs/BLE_PROTOCOL.md: "independent of BLE link-layer
// pairing"), so this resets on disconnect, not just at process start.
let claimed = false;
let status = "idle";
let statusNotifyCallback = null;

function setStatus(next) {
  status = next;
  if (statusNotifyCallback) statusNotifyCallback(Buffer.from(status));
}

const deviceInfoCharacteristic = new bleno.Characteristic({
  uuid: CHAR_UUIDS.deviceInfo,
  properties: ["read"],
  onReadRequest: (offset, callback) => {
    getDeviceInfo(status)
      .then((info) => {
        callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from(JSON.stringify(info)));
      })
      .catch(() => {
        callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
      });
  },
});

const wifiConfigCharacteristic = new bleno.Characteristic({
  uuid: CHAR_UUIDS.wifiConfig,
  properties: ["write"],
  onWriteRequest: (data, offset, withoutResponse, callback) => {
    if (!claimed) {
      callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
      return;
    }

    let payload;
    try {
      payload = JSON.parse(data.toString());
    } catch {
      callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
      return;
    }
    if (!payload.ssid || !payload.password) {
      callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
      return;
    }

    callback(bleno.Characteristic.RESULT_SUCCESS);
    setStatus("connecting_wifi");
    // Reboots the Pi on success — see wifi-reconfigure.js. No further
    // status update happens from this process instance; the app is
    // expected to fall back to polling the REST API once the Pi comes
    // back up, per docs/BLE_PROTOCOL.md's "app switches to REST once
    // wifi_connected" note. See docs/OPEN_QUESTIONS.md for the gap
    // this leaves (no live "wifi_connected" notification is possible
    // from the pre-reboot process).
    reconfigureWifi(payload.ssid, payload.password).catch(() => {
      setStatus("wifi_failed");
    });
  },
});

// Doubles as the claim mechanism (docs/BLE_PROTOCOL.md "Claiming via
// admin password"): on a fresh device with no password set yet, this
// write both sets the password and claims the device. On a device
// that already has one, the write must match it to claim. This
// intentionally means whoever sets the first password during the
// initial pairing window wins the device — losing that race means
// restarting the pairing process, not a security bypass.
const adminPasswordCharacteristic = new bleno.Characteristic({
  uuid: CHAR_UUIDS.adminPassword,
  properties: ["write"],
  onWriteRequest: (data, offset, withoutResponse, callback) => {
    const password = data.toString();
    hasAdminPassword()
      .then((exists) => {
        if (!exists) {
          return setAdminPassword(password).then(() => true);
        }
        return verifyAdminPassword(password);
      })
      .then((success) => {
        if (success) claimed = true;
        callback(success ? bleno.Characteristic.RESULT_SUCCESS : bleno.Characteristic.RESULT_UNLIKELY_ERROR);
      })
      .catch(() => callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR));
  },
});

const statusCharacteristic = new bleno.Characteristic({
  uuid: CHAR_UUIDS.status,
  properties: ["read", "notify"],
  onReadRequest: (offset, callback) => {
    callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from(status));
  },
  onSubscribe: (maxValueSize, updateValueCallback) => {
    statusNotifyCallback = updateValueCallback;
  },
  onUnsubscribe: () => {
    statusNotifyCallback = null;
  },
});

const provisioningService = new bleno.PrimaryService({
  uuid: SERVICE_UUID,
  characteristics: [
    deviceInfoCharacteristic,
    wifiConfigCharacteristic,
    adminPasswordCharacteristic,
    statusCharacteristic,
  ],
});

let requestPairingMode = null;

// Re-opens the bounded advertising window on demand — added 2026-07-03
// after finding `POST /system/pairing-mode` was speced in docs/API.md
// but never actually built, leaving a full `systemctl restart
// pi-service` (resetting the whole process) as the only way to get a
// fresh window once one closed. Resolves once advertising is confirmed
// active (or already was); rejects if BLE isn't powered on.
export function enablePairingMode() {
  if (!requestPairingMode) {
    return Promise.reject(new Error("BLE peripheral not started"));
  }
  return requestPairingMode();
}

export function startBlePeripheral() {
  let pairingWindowTimer = null;
  let isAdvertising = false;
  let poweredOn = false;

  function openPairingWindow() {
    clearTimeout(pairingWindowTimer);
    pairingWindowTimer = setTimeout(() => {
      if (!claimed) {
        isAdvertising = false;
        bleno.stopAdvertising();
      }
    }, PAIRING_WINDOW_MS);
  }

  requestPairingMode = () => {
    if (!poweredOn) {
      return Promise.reject(new Error("Bluetooth adapter is not ready"));
    }
    if (isAdvertising) {
      // Already advertising (e.g. mid-window) — just extend it rather
      // than restarting, which bleno doesn't cleanly support while
      // already active.
      openPairingWindow();
      return Promise.resolve();
    }
    bleno.startAdvertising("TeslaUSB", [SERVICE_UUID]);
    return Promise.resolve();
  };

  bleno.on("stateChange", (state) => {
    poweredOn = state === "poweredOn";
    if (poweredOn) {
      bleno.startAdvertising("TeslaUSB", [SERVICE_UUID]);
    } else {
      isAdvertising = false;
      bleno.stopAdvertising();
    }
  });

  bleno.on("advertisingStart", (error) => {
    if (error) {
      console.error("BLE advertising failed to start", error);
      return;
    }
    isAdvertising = true;
    bleno.setServices([provisioningService]);

    // Bounded advertising window (docs/STATE_MACHINES.md) — stop
    // advertising if nobody claims the device in time.
    openPairingWindow();
  });

  bleno.on("accept", () => {
    claimed = false;
    setStatus("idle");
  });

  bleno.on("disconnect", () => {
    claimed = false;
    setStatus("idle");
  });
}
