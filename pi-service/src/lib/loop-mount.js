import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);

// Read-only loop mounts for browsing raw FAT32 disk images
// (cam_disk.bin, music_disk.bin) that teslausb's own real processes
// also need access to (archiveloop's snapshot/fsck steps,
// copy-music.sh's mount of /mnt/music). Holding a loop device open
// indefinitely blocks those — confirmed for real 2026-07-03: a
// lingering on-device music browse mount caused archiveloop to log
// "overlapping loop device exists for /backingfiles/music_disk.bin"
// and silently skip syncing music to the car that entire cycle. So
// unlike a naive "mount once, keep forever" cache, this releases the
// loop device after a short idle period with no new requests, trading
// a little re-mount latency for not chronically blocking teslausb's
// own operations.
const IDLE_UNMOUNT_MS = 30_000;

export function createLoopMount(imagePath, mountPoint) {
  let mountPromise = null;
  let idleTimer = null;

  async function isMounted() {
    const mounts = await fs.readFile("/proc/mounts", "utf8");
    return mounts.includes(mountPoint);
  }

  async function doMount() {
    if (await isMounted()) return mountPoint;
    await fs.mkdir(mountPoint, { recursive: true });
    const { stdout } = await execFileAsync("sudo", [
      "/sbin/losetup", "-f", "-P", "--show", "-r", imagePath,
    ]);
    const loopDevice = stdout.trim();
    await execFileAsync("sudo", ["mount", "-o", "ro", `${loopDevice}p1`, mountPoint]);
    return mountPoint;
  }

  async function releaseMount() {
    mountPromise = null;
    try {
      await execFileAsync("sudo", ["umount", mountPoint]);
    } catch {
      // Already unmounted (or briefly busy) — the next ensureMounted()
      // call re-checks /proc/mounts and mounts fresh if needed either way.
    }
  }

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimer = null;
      releaseMount();
    }, IDLE_UNMOUNT_MS);
  }

  // Mounts on first call (or after an idle release) and reuses the
  // same mount for calls within the idle window — still cheap to call
  // from every request, but no longer holds the loop device forever.
  return async function ensureMounted() {
    resetIdleTimer();
    if (!mountPromise) mountPromise = doMount();
    return mountPromise;
  };
}
