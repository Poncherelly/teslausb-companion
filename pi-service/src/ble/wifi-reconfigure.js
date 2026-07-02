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

export async function reconfigureWifi(ssid, password) {
  await execFileAsync("sudo", ["/root/bin/remountfs_rw"]);

  const conf = [
    `export SSID='${escapeSingleQuoted(ssid)}'`,
    `export WIFIPASS='${escapeSingleQuoted(password)}'`,
    "",
  ].join("\n");
  await fs.writeFile(`${TESLAUSB_DIR}/teslausb_setup_variables.conf`, conf);

  await fs.rm(`${TESLAUSB_DIR}/WIFI_ENABLED`, { force: true });

  // teslausb's own rc.local performs the actual wifi (re)configuration
  // and reboots itself on next boot — this reboot is what triggers it.
  await execFileAsync("sudo", ["reboot"]);
}
