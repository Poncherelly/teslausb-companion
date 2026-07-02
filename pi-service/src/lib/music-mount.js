import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);

// Same approach as cam-mount.js — teslausb stores the music/boombox
// library inside a raw FAT32 disk image, not plain files on the Pi's
// own filesystem.
const MUSIC_DISK_IMAGE = "/backingfiles/music_disk.bin";
const MOUNT_POINT = "/tmp/music-ro"; // tmpfs — always writable even
// though / is read-only by default (see docs/OPEN_QUESTIONS.md #9-11).

let mountPromise = null;

async function isMounted() {
  const mounts = await fs.readFile("/proc/mounts", "utf8");
  return mounts.includes(MOUNT_POINT);
}

async function mountMusicDisk() {
  if (await isMounted()) return MOUNT_POINT;

  await fs.mkdir(MOUNT_POINT, { recursive: true });
  const { stdout } = await execFileAsync("sudo", [
    "/sbin/losetup", "-f", "-P", "--show", "-r", MUSIC_DISK_IMAGE,
  ]);
  const loopDevice = stdout.trim();
  await execFileAsync("sudo", ["mount", "-o", "ro", `${loopDevice}p1`, MOUNT_POINT]);
  return MOUNT_POINT;
}

export async function ensureMusicMounted() {
  if (!mountPromise) mountPromise = mountMusicDisk();
  return mountPromise;
}
