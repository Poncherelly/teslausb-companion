import { createLoopMount } from "./loop-mount.js";

// Same approach as cam-mount.js — teslausb stores the music/boombox
// library inside a raw FAT32 disk image, not plain files on the Pi's
// own filesystem.
const MUSIC_DISK_IMAGE = "/backingfiles/music_disk.bin";
const MOUNT_POINT = "/tmp/music-ro"; // tmpfs — always writable even
// though / is read-only by default (see docs/OPEN_QUESTIONS.md #9-11).

// See loop-mount.js — auto-releases after idle rather than holding the
// loop device for the life of the process. This one matters more than
// cam-mount.js's: confirmed for real 2026-07-03 that a lingering mount
// here made archiveloop's own copy-music.sh fail to mount /mnt/music
// ("overlapping loop device exists"), silently skipping music sync to
// the car for that entire cycle.
export const ensureMusicMounted = createLoopMount(MUSIC_DISK_IMAGE, MOUNT_POINT);
