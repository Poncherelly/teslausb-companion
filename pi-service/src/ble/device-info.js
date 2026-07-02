import fs from "node:fs/promises";
import os from "node:os";
import { hasAdminPassword } from "./device-config-store.js";

const FW_VERSION = "0.1.0";

// BLE and WiFi are independent radios — the peripheral runs
// regardless of WiFi state, so this needs its own real check. A
// non-empty wlan0 entry with an IPv4 address means it's actually
// associated with a network, not just powered on.
function isWifiConnected() {
  const wlan0 = os.networkInterfaces().wlan0;
  return Boolean(wlan0?.some((iface) => iface.family === "IPv4"));
}

export async function getDeviceInfo(pairingState) {
  let serialLast4 = "0000";
  try {
    const cpuinfo = await fs.readFile("/proc/cpuinfo", "utf8");
    const match = cpuinfo.match(/^Serial\s*:\s*(\w+)/m);
    if (match) serialLast4 = match[1].slice(-4);
  } catch {
    // Not running on a Pi (e.g. local dev) — keep the placeholder.
  }

  return {
    serial_last4: serialLast4,
    fw_version: FW_VERSION,
    pairing_state: pairingState,
    // Tells the app whether to show "set a password" (first-ever
    // pairing) or "enter your password" (re-pairing) — see
    // docs/BLE_PROTOCOL.md "Claiming via admin password".
    has_admin_password: await hasAdminPassword(),
    // Lets the app skip re-sending WiFi credentials (and triggering
    // an unnecessary reboot) on a device that's already connected.
    wifi_connected: isWifiConnected(),
  };
}
