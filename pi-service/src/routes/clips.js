import path from "node:path";
import { Router } from "express";
import { ensureCamMounted } from "../lib/cam-mount.js";
import { ensureArchiveMounted } from "../lib/archive-mount.js";
import {
  deleteClip,
  getDownloadPath,
  getFileDownloadPath,
  getThumbnailPath,
  isArchived,
  listClipFileEntries,
  parseId,
  scanClips,
} from "../lib/clips-scan.js";
import { isClipLocked, lockClip, unlockClip } from "../lib/download-locks.js";

// Everyday-use clip endpoints — see docs/API.md "Everyday use" section.
// All require the admin session credential established during the wizard.
export const clipsRouter = Router();

// Fake data fallback for local dev off the Pi (Windows/macOS, or Linux
// without a mounted cam_disk.bin) — no real teslausb storage to read.
// Shape matches docs/DATA_MODEL.md.
const FAKE_CLIPS = [
  {
    id: "1",
    filename: "2026-06-30_18-42-10-front.mp4",
    category: "sentry",
    source: "pi",
    timestamp: "2026-06-30T18:42:10Z",
    size: 52428800,
    checksum: "abc123",
    state: "archived",
    encrypted_on_disk: true,
    locked_by_download: false,
  },
  {
    id: "2",
    filename: "2026-07-01_08-15-03-front.mp4",
    category: "recent",
    source: "pi",
    timestamp: "2026-07-01T08:15:03Z",
    size: 41943040,
    checksum: "def456",
    state: "new",
    encrypted_on_disk: true,
    locked_by_download: false,
  },
  {
    id: "3",
    filename: "2026-07-01_09-02-44-front.mp4",
    category: "saved",
    source: "pi",
    timestamp: "2026-07-01T09:02:44Z",
    size: 62914560,
    checksum: "ghi789",
    state: "archiving",
    encrypted_on_disk: true,
    locked_by_download: false,
  },
];

// `source=pi` (default) is the on-device cam disk; `source=archive` is
// the CIFS backup share configured in Settings (see archive-config.js).
// The archive share root directly contains RecentClips/SavedClips/
// SentryClips — no "TeslaCam" wrapper folder like the local disk image
// has (confirmed 2026-07-02 against the real share).
async function getClipsRoot(source) {
  if (source === "archive") return ensureArchiveMounted();
  const mountPoint = await ensureCamMounted();
  return path.join(mountPoint, "TeslaCam");
}

// Cross-references on-device Saved/Sentry clips against the archive to
// compute real `state` (added 2026-07-03, replacing the previously
// hardcoded `state: "new"` for every real clip — see
// docs/DATA_MODEL.md). If the archive isn't reachable/configured at
// all, every clip is left as `new` rather than failing the whole
// listing — an unreachable archive shouldn't break "On device"
// browsing.
async function annotateArchivedState(clips) {
  let archiveRoot;
  try {
    archiveRoot = await ensureArchiveMounted();
  } catch {
    return clips;
  }
  return Promise.all(
    clips.map(async (c) => {
      const parsed = parseId(c.id);
      if (!parsed) return c;
      const archived = await isArchived(archiveRoot, parsed.category, parsed.timestampKey);
      return archived ? { ...c, state: "archived" } : c;
    })
  );
}

async function getClips(source) {
  if (process.platform !== "linux") return source === "archive" ? [] : FAKE_CLIPS;
  try {
    const clipsRoot = await getClipsRoot(source);
    let clips = await scanClips(clipsRoot, source);
    if (source === "pi") clips = await annotateArchivedState(clips);
    return clips.map((c) => ({ ...c, locked_by_download: isClipLocked(c.id) }));
  } catch (err) {
    console.error(`Falling back to empty clip list — ${source} mount failed:`, err.message);
    return source === "archive" ? [] : FAKE_CLIPS;
  }
}

clipsRouter.get("/", async (req, res) => {
  const { category, state, source = "pi" } = req.query;
  let clips = await getClips(source);
  if (category) clips = clips.filter((c) => c.category === category);
  if (state) clips = clips.filter((c) => c.state === state);
  clips = [...clips].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  res.json({ clips });
});

// Streams the representative file by default (front camera — see
// docs/DATA_MODEL.md's real-data note), or a specific file within the
// clip's own directory via `?file=` (added 2026-07-02 for the Archive
// tab's folder-drill view, which lets a user open any individual
// camera angle / sidecar file, not just the representative one). Never
// touches `state` (a download is a side path, not an archive-sync
// transition — see docs/STATE_MACHINES.md).
clipsRouter.get("/:id/download", async (req, res) => {
  if (process.platform !== "linux") {
    return res.status(501).json({ error: "real clips only available on the Pi" });
  }
  const parsed = parseId(req.params.id);
  if (!parsed) return res.status(404).json({ error: "clip not found" });
  try {
    const clipsRoot = await getClipsRoot(parsed.source);
    const filePath = req.query.file
      ? await getFileDownloadPath(clipsRoot, req.params.id, req.query.file)
      : await getDownloadPath(clipsRoot, req.params.id);
    if (!filePath) return res.status(404).json({ error: "clip not found" });

    lockClip(req.params.id);
    res.sendFile(filePath, (err) => {
      unlockClip(req.params.id);
      if (err && !res.headersSent) {
        res.status(500).json({ error: "download failed" });
      }
    });
  } catch (err) {
    unlockClip(req.params.id);
    res.status(500).json({ error: err.message });
  }
});

// Lists every real file in a clip's directory (all camera angles plus
// sidecar files like event.json/thumb.png for Saved/Sentry events) —
// powers the Archive tab's folder-drill view (Category -> Event ->
// Files).
clipsRouter.get("/:id/files", async (req, res) => {
  if (process.platform !== "linux") {
    return res.status(501).json({ error: "real clips only available on the Pi" });
  }
  const parsed = parseId(req.params.id);
  if (!parsed) return res.status(404).json({ error: "clip not found" });
  const clipsRoot = await getClipsRoot(parsed.source);
  const files = await listClipFileEntries(clipsRoot, req.params.id);
  if (!files) return res.status(404).json({ error: "clip not found" });
  res.json({ files });
});

// Only valid from state=archived (docs/STATE_MACHINES.md). Verifies
// live against the archive right before deleting (added 2026-07-03)
// rather than trusting a possibly-stale `state` from an earlier GET
// /clips response — this is the actual safety gate, not the listing's
// annotation, which is just for display.
clipsRouter.delete("/:id", async (req, res) => {
  if (process.platform !== "linux") {
    return res.status(501).json({ error: "real clips only available on the Pi" });
  }
  const parsed = parseId(req.params.id);
  if (!parsed) return res.status(404).json({ error: "clip not found" });
  if (parsed.source === "archive") {
    return res.status(403).json({ error: "deleting from the archive itself isn't supported" });
  }

  let archived = false;
  try {
    const archiveRoot = await ensureArchiveMounted();
    archived = await isArchived(archiveRoot, parsed.category, parsed.timestampKey);
  } catch {
    archived = false;
  }
  if (!archived) {
    return res.status(403).json({ error: "only archived clips can be deleted" });
  }
  if (isClipLocked(req.params.id)) {
    return res.status(409).json({ error: "clip is currently being downloaded" });
  }

  const clipsRoot = await getClipsRoot(parsed.source);
  const deleted = await deleteClip(clipsRoot, req.params.id);
  if (!deleted) return res.status(404).json({ error: "clip not found" });
  res.status(204).send();
});

clipsRouter.get("/:id/thumbnail", async (req, res) => {
  if (process.platform !== "linux") {
    return res.status(501).json({ error: "real clips only available on the Pi" });
  }
  const parsed = parseId(req.params.id);
  if (!parsed) return res.status(404).json({ error: "no thumbnail for this clip" });
  const clipsRoot = await getClipsRoot(parsed.source);
  const thumbPath = await getThumbnailPath(clipsRoot, req.params.id);
  if (!thumbPath) return res.status(404).json({ error: "no thumbnail for this clip" });
  res.sendFile(thumbPath);
});
