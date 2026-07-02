import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";

const execFileAsync = promisify(execFile);

// Standard hostname rules: letters/digits/hyphens, no leading/trailing
// hyphen, max 63 chars (a single DNS label limit).
const HOSTNAME_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

export function isValidHostname(name) {
  return typeof name === "string" && HOSTNAME_PATTERN.test(name);
}

// Same reboot-to-apply pattern as wifi-reconfigure.js — simplest way
// to be sure every subsystem (mDNS, DHCP hostname option, etc.) picks
// up the change consistently. Split into two functions so the caller
// can respond to the HTTP request *before* rebooting — awaiting the
// reboot itself kills the process mid-response, and the client never
// sees the answer.
export async function applyHostnameFiles(newHostname) {
  const oldHostname = os.hostname();
  await execFileAsync("sudo", ["/root/bin/remountfs_rw"]);
  await fs.writeFile("/etc/hostname", `${newHostname}\n`);

  const hosts = await fs.readFile("/etc/hosts", "utf8");
  await fs.writeFile("/etc/hosts", hosts.split(oldHostname).join(newHostname));
}

export async function rebootToApply() {
  await execFileAsync("sudo", ["reboot"]);
}
