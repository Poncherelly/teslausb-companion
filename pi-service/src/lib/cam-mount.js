import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);

// teslausb stores recordings inside a raw FAT32 disk image
// (cam_disk.bin) that it exposes to the car as a USB mass-storage
// gadget — there's no plain directory of clip files on the Pi's own
// filesystem to read directly. Loop-mounting it read-only is the
// simplest way to browse it. Known limitation: if the car is actively
// writing to this same image at the time (i.e. driving right now),
// a live read-only mount of a filesystem being concurrently written
// can show stale/inconsistent listings — teslausb's own snapshot
// mechanism (see /backingfiles/snapshots/) exists for a consistent
// point-in-time view and would be the more correct source once
// archive-sync integration is built.
const CAM_DISK_IMAGE = "/backingfiles/cam_disk.bin";
const MOUNT_POINT = "/tmp/cam-ro"; // under tmpfs — always writable even
// though / is read-only by default (see docs/OPEN_QUESTIONS.md #9-11).

let mountPromise = null;

async function isMounted() {
  const mounts = await fs.readFile("/proc/mounts", "utf8");
  return mounts.includes(MOUNT_POINT);
}

async function mountCamDisk() {
  if (await isMounted()) return MOUNT_POINT;

  await fs.mkdir(MOUNT_POINT, { recursive: true });
  const { stdout } = await execFileAsync("sudo", [
    "/sbin/losetup", "-f", "-P", "--show", "-r", CAM_DISK_IMAGE,
  ]);
  const loopDevice = stdout.trim();
  await execFileAsync("sudo", ["mount", "-o", "ro", `${loopDevice}p1`, MOUNT_POINT]);
  return MOUNT_POINT;
}

// Mounts on first call and reuses the same mount for subsequent calls
// within this process's lifetime — cheap to call from every request.
export async function ensureCamMounted() {
  if (!mountPromise) mountPromise = mountCamDisk();
  return mountPromise;
}
