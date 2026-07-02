// BLE GATT peripheral — "TeslaUSB Provisioning" service.
// See docs/BLE_PROTOCOL.md for the characteristic table/rationale and
// docs/STATE_MACHINES.md for the pairing lifecycle.
//
// @abandonware/bleno is Linux/BlueZ-only and requires elevated
// privileges for raw HCI access — run pi-service as root on the Pi.
// See pi-service/README.md.

import bleno from "@abandonware/bleno";
import { generateClaimCode } from "./claim-code.js";
import { getDeviceInfo } from "./device-info.js";
import { setAdminPassword } from "./device-config-store.js";
import { reconfigureWifi } from "./wifi-reconfigure.js";

const SERVICE_UUID = "e5eab36e5fca456d94194db713b627ea";
const CHAR_UUIDS = {
  deviceInfo: "e5eab36e5fca456d94194db713b627eb",
  claimCode: "e5eab36e5fca456d94194db713b627ec",
  wifiConfig: "e5eab36e5fca456d94194db713b627ed",
  adminPassword: "e5eab36e5fca456d94194db713b627ee",
  status: "e5eab36e5fca456d94194db713b627ef",
};

const PAIRING_WINDOW_MS = 10 * 60 * 1000;

// Per-session state — the claim code must be re-supplied by each new
// connection (docs/BLE_PROTOCOL.md: "independent of BLE link-layer
// pairing"), so this resets on disconnect, not just at process start.
let claimed = false;
let status = "idle";
let expectedClaimCode = generateClaimCode();
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

const claimCodeCharacteristic = new bleno.Characteristic({
  uuid: CHAR_UUIDS.claimCode,
  properties: ["write"],
  onWriteRequest: (data, offset, withoutResponse, callback) => {
    if (data.toString().trim() === expectedClaimCode) {
      claimed = true;
      callback(bleno.Characteristic.RESULT_SUCCESS);
    } else {
      callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
    }
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

const adminPasswordCharacteristic = new bleno.Characteristic({
  uuid: CHAR_UUIDS.adminPassword,
  properties: ["write"],
  onWriteRequest: (data, offset, withoutResponse, callback) => {
    if (!claimed) {
      callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
      return;
    }
    setAdminPassword(data.toString())
      .then(() => callback(bleno.Characteristic.RESULT_SUCCESS))
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
    claimCodeCharacteristic,
    wifiConfigCharacteristic,
    adminPasswordCharacteristic,
    statusCharacteristic,
  ],
});

export function startBlePeripheral() {
  let pairingWindowTimer = null;

  bleno.on("stateChange", (state) => {
    if (state === "poweredOn") {
      expectedClaimCode = generateClaimCode();
      console.log(`BLE claim code: ${expectedClaimCode}`);
      bleno.startAdvertising("TeslaUSB", [SERVICE_UUID]);
    } else {
      bleno.stopAdvertising();
    }
  });

  bleno.on("advertisingStart", (error) => {
    if (error) {
      console.error("BLE advertising failed to start", error);
      return;
    }
    bleno.setServices([provisioningService]);

    // Bounded advertising window (docs/STATE_MACHINES.md) — stop
    // advertising if nobody claims the device in time.
    clearTimeout(pairingWindowTimer);
    pairingWindowTimer = setTimeout(() => {
      if (!claimed) bleno.stopAdvertising();
    }, PAIRING_WINDOW_MS);
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
