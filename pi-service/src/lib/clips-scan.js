import fs from "node:fs/promises";
import path from "node:path";

// Tesla's own dashcam layout groups each moment into up to 4 camera
// files (front/back/left_repeater/right_repeater). docs/DATA_MODEL.md's
// Clip entity has a single `filename` — for now one Clip represents
// the whole group (front camera as the representative filename, size
// summed across all camera files), not one Clip per camera file. This
// is a simplification worth revisiting once download/delete need to
// act on individual camera angles — see docs/OPEN_QUESTIONS.md.
//
// `checksum` (docs/DATA_MODEL.md) is intentionally omitted here —
// hashing every video file on every list request would be expensive on
// this hardware; it belongs to archive-sync verification, not listing,
// which isn't built yet either.

function parseTeslaTimestamp(str) {
  // "2025-12-02_17-26-30" -> "2025-12-02T17:26:30"
  const match = str.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, date, hour, minute, second] = match;
  return `${date}T${hour}:${minute}:${second}`;
}

async function sumSizes(dir, filenames) {
  const stats = await Promise.all(filenames.map((f) => fs.stat(path.join(dir, f))));
  return stats.reduce((sum, s) => sum + s.size, 0);
}

// RecentClips: flat directory, files named `{timestamp}-{camera}.mp4`.
async function scanRecentClips(dir, category) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const groups = new Map();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(/^(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})-(.+)\.mp4$/);
    if (!match) continue;
    const [, timestampKey, camera] = match;
    if (!groups.has(timestampKey)) groups.set(timestampKey, []);
    groups.get(timestampKey).push({ name: entry.name, camera });
  }

  const clips = [];
  for (const [timestampKey, files] of groups) {
    const totalSize = await sumSizes(dir, files.map((f) => f.name));
    const front = files.find((f) => f.camera === "front") ?? files[0];
    clips.push({
      id: `${category}-${timestampKey}`,
      filename: front.name,
      category,
      timestamp: parseTeslaTimestamp(timestampKey),
      size: totalSize,
      state: "new",
      encrypted_on_disk: false,
      locked_by_download: false,
    });
  }
  return clips;
}

// SavedClips/SentryClips: one subdirectory per event, named by
// timestamp, containing camera files plus event.json/event.mp4/thumb.png.
async function scanEventClips(dir, category) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const clips = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const eventDir = path.join(dir, entry.name);
    let files;
    try {
      files = await fs.readdir(eventDir, { withFileTypes: true });
    } catch {
      continue;
    }

    const mp4s = files.filter((f) => f.isFile() && f.name.endsWith(".mp4"));
    if (mp4s.length === 0) continue;

    const totalSize = await sumSizes(eventDir, mp4s.map((f) => f.name));
    const front = mp4s.find((f) => f.name.includes("-front.mp4")) ?? mp4s[0];

    clips.push({
      id: `${category}-${entry.name}`,
      filename: front.name,
      category,
      timestamp: parseTeslaTimestamp(entry.name),
      size: totalSize,
      state: "new",
      encrypted_on_disk: false,
      locked_by_download: false,
    });
  }
  return clips;
}

export async function scanClips(mountPoint) {
  const base = path.join(mountPoint, "TeslaCam");
  const [recent, saved, sentry] = await Promise.all([
    scanRecentClips(path.join(base, "RecentClips"), "recent"),
    scanEventClips(path.join(base, "SavedClips"), "saved"),
    scanEventClips(path.join(base, "SentryClips"), "sentry"),
  ]);
  return [...recent, ...saved, ...sentry];
}
