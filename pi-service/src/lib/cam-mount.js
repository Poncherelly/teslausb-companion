import { createLoopMount } from "./loop-mount.js";

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

// See loop-mount.js — auto-releases after idle rather than holding the
// loop device for the life of the process, so it doesn't chronically
// block archiveloop's own snapshot/fsck steps against the same image.
export const ensureCamMounted = createLoopMount(CAM_DISK_IMAGE, MOUNT_POINT);
