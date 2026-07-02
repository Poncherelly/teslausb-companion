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

async function isMounted() {
  const mounts = await fs.readFile("/proc/mounts", "utf8");
  return mounts.split("\n").some((line) => line.split(" ")[1] === MOUNT_POINT);
}

export async function ensureArchiveMounted() {
  if (await isMounted()) return MOUNT_POINT;
  await execFileAsync("sudo", ["mount", MOUNT_POINT]);
  return MOUNT_POINT;
}
