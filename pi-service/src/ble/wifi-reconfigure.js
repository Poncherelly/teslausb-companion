import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);

// /teslausb is teslausb's own symlink to the boot partition (see
// pi-gen-sources/00-teslausb-tweaks/files/rc.local upstream). Writing
// a fresh teslausb_setup_variables.conf here and clearing the
// WIFI_ENABLED marker makes teslausb's own boot script reconfigure
// wifi and reboot — this is NOT the generic Raspberry Pi OS
// wpa_supplicant.conf trick, which teslausb does not use once initial
// setup has completed. See docs/OPEN_QUESTIONS.md #9-11 for how this
// was reverse-engineered.
const TESLAUSB_DIR = "/teslausb";

function escapeSingleQuoted(value) {
  // The written file is later `source`d as bash by teslausb's rc.local,
  // so values must be safe inside a single-quoted bash string.
  return value.replace(/'/g, `'\\''`);
}

// rc.local moves this file to /root/teslausb_setup_variables.conf and
// re-sources it on every boot — that's the ONLY copy of the user's
// full setup config (archive destination, etc.) once initial setup
// has completed; there's no other backup of these `export` lines.
// MUST merge with whatever's already there rather than overwrite —
// confirmed the hard way (2026-07-02): an earlier version of this
// function wrote a fresh SSID/WIFIPASS-only file, which silently wiped
// out a real, working ARCHIVE_SYSTEM/ARCHIVE_SERVER config and left
// archive-sync stuck for a day before being caught and manually fixed.
const PERSISTED_CONFIG_PATH = "/root/teslausb_setup_variables.conf";

async function readExistingConfig() {
  try {
    return await fs.readFile(PERSISTED_CONFIG_PATH, "utf8");
  } catch {
    return "";
  }
}

function mergeWifiConfig(existingConfig, ssid, password) {
  const preservedLines = existingConfig
    .split("\n")
    .filter((line) => !/^export (SSID|WIFIPASS)=/.test(line) && line.trim() !== "");

  return [
    ...preservedLines,
    `export SSID='${escapeSingleQuoted(ssid)}'`,
    `export WIFIPASS='${escapeSingleQuoted(password)}'`,
    "",
  ].join("\n");
}

export async function reconfigureWifi(ssid, password) {
  await execFileAsync("sudo", ["/root/bin/remountfs_rw"]);

  const existingConfig = await readExistingConfig();
  const conf = mergeWifiConfig(existingConfig, ssid, password);
  await fs.writeFile(`${TESLAUSB_DIR}/teslausb_setup_variables.conf`, conf);

  await fs.rm(`${TESLAUSB_DIR}/WIFI_ENABLED`, { force: true });

  // teslausb's own rc.local performs the actual wifi (re)configuration
  // and reboots itself on next boot — this reboot is what triggers it.
  await execFileAsync("sudo", ["reboot"]);
}
