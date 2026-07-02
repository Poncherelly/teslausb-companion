import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);

// /mnt/archive is already fully defined in /etc/fstab (server, share,
// credentials — see archive-config.js) with `noauto`, so nothing
// auto-mounts it at boot; both this and teslausb's own archiveloop
// mount it explicitly on demand.
//
// Unlike cam-mount.js, this mountpoint is NOT exclusively ours —
// archiveloop mounts and unmounts it independently on its own schedule
// while syncing. So the live state is checked on every call instead of
// caching a mount promise forever, and it's expected (if rare) for a
// request to land right as archiveloop unmounts mid-cycle — accepted
// narrow race for a single-user Pi, same tolerance as cam-mount.js's
// documented concurrent-write caveat.
const MOUNT_POINT = "/mnt/archive";
const MUSIC_MOUNT_POINT = "/mnt/musicarchive";

async function isMounted(mountPoint) {
  const mounts = await fs.readFile("/proc/mounts", "utf8");
  return mounts.split("\n").some((line) => line.split(" ")[1] === mountPoint);
}

export async function ensureArchiveMounted() {
  if (await isMounted(MOUNT_POINT)) return MOUNT_POINT;
  await execFileAsync("sudo", ["mount", MOUNT_POINT]);
  return MOUNT_POINT;
}

// The music share is optional (Archive settings' "Music share" field —
// see archive-config.js) — if it was never configured, /etc/fstab has
// no entry for this mountpoint at all and `mount` fails. Callers should
// surface that distinctly from "folder not found within an existing
// mount" rather than a generic 500.
export async function ensureArchiveMusicMounted() {
  if (await isMounted(MUSIC_MOUNT_POINT)) return MUSIC_MOUNT_POINT;
  try {
    await execFileAsync("sudo", ["mount", MUSIC_MOUNT_POINT]);
  } catch (err) {
    throw new Error(`archive music share not available (is it configured in Archive settings?): ${err.message}`);
  }
  return MUSIC_MOUNT_POINT;
}
