import fs from "node:fs/promises";
import path from "node:path";

// Unlike clips (fixed RecentClips/SavedClips/SentryClips layout),
// the music partition is just a generic user-organized folder tree —
// e.g. Music/<artist>/<album>/*.mp3, boombox/*.mp3, plus arbitrary
// other top-level folders (confirmed against real data 2026-07-02:
// "Comedy", "kids music", etc. alongside "Music" and "boombox"). A
// flat listing doesn't make sense here; this is a folder browser.

const IGNORED_ENTRIES = new Set(["System Volume Information", ".metadata_never_index"]);

// Resolves `relativePath` against the mount root and refuses to
// escape it (e.g. "../../etc") — this is a public-ish API endpoint.
export function resolveSafePath(mountPoint, relativePath) {
  const target = path.normalize(path.join(mountPoint, relativePath || ""));
  if (target !== mountPoint && !target.startsWith(mountPoint + path.sep)) {
    return null;
  }
  return target;
}

// Filenames only (no slashes) — used both for the uploaded file's own
// name and for validating a delete target, so a single check covers
// both directions of path-traversal risk.
export function isSafeFilename(name) {
  return typeof name === "string" && name.length > 0 && !/[\\/]|\.\./.test(name);
}

// Deletes a single file (added 2026-07-03 for music delete) — only
// ever called against the archive music share (see routes/music.js);
// teslausb's own copy-music.sh rsyncs with --delete from there down to
// the car's live music partition on its own schedule, so this never
// touches the gadget-exposed on-device partition directly.
export async function deleteMusicFile(mountPoint, relativePath) {
  const filePath = resolveSafePath(mountPoint, relativePath);
  if (!filePath) return false;
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return false;
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

// Resolves (and creates if missing) the destination folder for an
// upload — same path-traversal protection as browseMusic, plus
// creating intermediate folders since a user might upload into a new
// artist/album folder that doesn't exist yet.
export async function resolveUploadDir(mountPoint, relativePath) {
  const dirPath = resolveSafePath(mountPoint, relativePath || "");
  if (!dirPath) return null;
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

// Resolves a specific file for streaming/download (added 2026-07-03 for
// in-app playback) — must exist and be a real file, not just pass the
// path-traversal check, since a directory or missing path would make
// `res.sendFile` behave oddly.
export async function resolveMusicFile(mountPoint, relativePath) {
  const filePath = resolveSafePath(mountPoint, relativePath);
  if (!filePath) return null;
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return null;
  } catch {
    return null;
  }
  return filePath;
}

export async function browseMusic(mountPoint, relativePath = "") {
  const dirPath = resolveSafePath(mountPoint, relativePath);
  if (!dirPath) return null;

  let dirents;
  try {
    dirents = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return null;
  }

  const entries = [];
  for (const dirent of dirents) {
    if (IGNORED_ENTRIES.has(dirent.name) || dirent.name.startsWith(".")) continue;

    if (dirent.isDirectory()) {
      entries.push({ name: dirent.name, type: "folder" });
    } else if (dirent.isFile()) {
      const stat = await fs.stat(path.join(dirPath, dirent.name));
      entries.push({ name: dirent.name, type: "file", size: stat.size });
    }
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { path: relativePath, entries };
}
