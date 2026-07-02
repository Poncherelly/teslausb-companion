import fs from "node:fs/promises";

const FW_VERSION = "0.1.0";

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
  };
}
