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
function resolveSafePath(mountPoint, relativePath) {
  const target = path.normalize(path.join(mountPoint, relativePath || ""));
  if (target !== mountPoint && !target.startsWith(mountPoint + path.sep)) {
    return null;
  }
  return target;
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
