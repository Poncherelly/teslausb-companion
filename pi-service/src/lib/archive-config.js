import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import net from "node:net";

const execFileAsync = promisify(execFile);

// Only CIFS/SMB is handled here — the only archive backend actually
// deployed on real hardware so far, and the only one upstream teslausb
// sets up via plain fstab entries (rsync/NFS/rclone exist upstream too,
// but rclone in particular needs its own OAuth-webview wizard — see
// docs/ARCHIVE_AND_TESLA.md — and isn't built yet).
const PERSISTED_CONFIG_PATH = "/root/teslausb_setup_variables.conf";
const FSTAB_PATH = "/etc/fstab";
const CREDENTIALS_PATH = "/root/.teslaCamArchiveCredentials";

const CLIPS_MOUNT = "/mnt/archive";
const MUSIC_MOUNT = "/mnt/musicarchive";

// Conservative charsets — these values get spliced directly into
// /etc/fstab and a bash-sourced env file, not passed through a shell
// with proper quoting, so validate strictly rather than escape.
const HOST_PATTERN = /^[a-zA-Z0-9.-]+$/;
const SHARE_PATTERN = /^[\w.-]+(\/[\w.-]+)*$/;

export function isValidHost(value) {
  return typeof value === "string" && value.length > 0 && HOST_PATTERN.test(value);
}

export function isValidShareName(value) {
  return typeof value === "string" && value.length > 0 && SHARE_PATTERN.test(value);
}

export function isValidCredentialField(value) {
  return typeof value === "string" && value.length > 0 && !/[\r\n]/.test(value);
}

export function parseFstabLine(fstab, mountPoint) {
  const line = fstab
    .split("\n")
    .find((l) => l.trim().startsWith("//") && l.includes(` ${mountPoint} `));
  if (!line) return null;
  const match = line.match(/^\/\/([^/]+)\/(\S+)\s/);
  return match ? { server: match[1], share: match[2] } : null;
}

function buildFstabLine(server, share, mountPoint, mode) {
  return `//${server}/${share} ${mountPoint} cifs ${mode},noauto,credentials=${CREDENTIALS_PATH},iocharset=utf8,file_mode=0777,dir_mode=0777,vers=default, 0`;
}

// musicLine may be null (caller didn't supply a music share) — in that
// case any existing /mnt/musicarchive line is left completely alone
// rather than removed, so an already-working music sync isn't torn out
// just because this particular update didn't mention it.
export function mergeFstab(existingFstab, clipsLine, musicLine) {
  const lines = existingFstab.split("\n").filter((line) => line.trim() !== "");
  let sawClips = false;
  let sawMusic = false;
  const updated = lines.map((line) => {
    if (line.includes(` ${CLIPS_MOUNT} `)) {
      sawClips = true;
      return clipsLine;
    }
    if (musicLine && line.includes(` ${MUSIC_MOUNT} `)) {
      sawMusic = true;
      return musicLine;
    }
    return line;
  });
  if (!sawClips) updated.push(clipsLine);
  if (musicLine && !sawMusic) updated.push(musicLine);
  return `${updated.join("\n")}\n`;
}

// Same merge-not-overwrite rule as wifi-reconfigure.js applies here:
// this file is the only persisted copy of the full setup config once
// initial setup completes, so any line this function doesn't
// explicitly own (SSID/WIFIPASS, etc.) must survive untouched.
export function mergeSetupVariables(existingConfig, server) {
  const preservedLines = existingConfig
    .split("\n")
    .filter((line) => !/^export (ARCHIVE_SYSTEM|ARCHIVE_SERVER)=/.test(line) && line.trim() !== "");
  return [...preservedLines, "export ARCHIVE_SYSTEM=cifs", `export ARCHIVE_SERVER=${server}`, ""].join("\n");
}

function probeReachable(host, port = 445, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

export async function readArchiveConfig() {
  const fstab = await fs.readFile(FSTAB_PATH, "utf8").catch(() => "");
  const clips = parseFstabLine(fstab, CLIPS_MOUNT);
  const music = parseFstabLine(fstab, MUSIC_MOUNT);

  let shareUser = null;
  try {
    const creds = await fs.readFile(CREDENTIALS_PATH, "utf8");
    const match = creds.match(/^username=(.*)$/m);
    shareUser = match ? match[1] : null;
  } catch {
    shareUser = null;
  }

  const reachable = clips ? await probeReachable(clips.server) : null;

  return {
    configured: Boolean(clips),
    server: clips?.server ?? null,
    shareName: clips?.share ?? null,
    musicShareName: music?.share ?? null,
    shareUser,
    reachable,
  };
}

export async function writeArchiveConfig({ server, shareName, musicShareName, shareUser, sharePassword }) {
  await execFileAsync("sudo", ["/root/bin/remountfs_rw"]);

  // Cheap safety net given this touches the only working archive path —
  // lets a bad write be undone by hand over SSH without reflashing.
  const backupSuffix = `.bak-${Date.now()}`;
  await fs.copyFile(FSTAB_PATH, `${FSTAB_PATH}${backupSuffix}`).catch(() => {});
  await fs.copyFile(CREDENTIALS_PATH, `${CREDENTIALS_PATH}${backupSuffix}`).catch(() => {});

  const existingFstab = await fs.readFile(FSTAB_PATH, "utf8").catch(() => "");
  const clipsLine = buildFstabLine(server, shareName, CLIPS_MOUNT, "rw");
  const musicLine = musicShareName ? buildFstabLine(server, musicShareName, MUSIC_MOUNT, "ro") : null;
  await fs.writeFile(FSTAB_PATH, mergeFstab(existingFstab, clipsLine, musicLine));

  await fs.writeFile(CREDENTIALS_PATH, `username=${shareUser}\npassword=${sharePassword}\n`, { mode: 0o600 });

  const existingSetupConfig = await fs.readFile(PERSISTED_CONFIG_PATH, "utf8").catch(() => "");
  await fs.writeFile(PERSISTED_CONFIG_PATH, mergeSetupVariables(existingSetupConfig, server));
}

// Same split-then-reboot pattern as hostname-update.js: the fstab
// change only actually takes hold for archiveloop (already running,
// with the old ARCHIVE_SERVER baked into its env) after a fresh boot,
// so rebooting is what applies this rather than an optional extra step.
export async function rebootToApply() {
  await execFileAsync("sudo", ["reboot"]);
}
