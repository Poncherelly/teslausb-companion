import multer from "multer";
import { Router } from "express";
import { ensureMusicMounted } from "../lib/music-mount.js";
import { ensureArchiveMusicMounted } from "../lib/archive-mount.js";
import {
  browseMusic,
  deleteMusicFile,
  isSafeFilename,
  resolveMusicFile,
  resolveUploadDir,
} from "../lib/music-scan.js";

// docs/API.md originally specced GET /music as a flat list. Real data
// (2026-07-02) showed the music partition is a generic, user-organized
// folder tree (Music/<artist>/<album>, boombox/, and arbitrary other
// top-level folders) — this is a folder browser instead, navigated via
// ?path=. See docs/DATA_MODEL.md / docs/API.md for the updated shape.
//
// `source=pi` (default) is the on-device music_disk.bin; `source=archive`
// is the optional music share from Archive settings (added 2026-07-02,
// same day as the clips source= param — see archive-mount.js).
export const musicRouter = Router();

// Upload/delete only ever target the archive music share (added
// 2026-07-03), never the on-device music_disk.bin directly — that
// partition is live-exposed to the car as a USB gadget, and writing to
// it directly while the car might have it mounted risks corruption
// (same caution as cam-mount.js's read-only cam disk mount). teslausb's
// own copy-music.sh already rsyncs (with --delete) from the archive
// music share down to the car's local partition on its own schedule —
// see /root/bin/copy-music.sh on the Pi — so uploads/deletes made here
// reach the car through that existing, real mechanism rather than a
// new one built from scratch.
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (req.query.source !== "archive") {
        return cb(new Error("music upload is only supported for the archive"));
      }
      ensureArchiveMusicMounted()
        .then((mountPoint) => resolveUploadDir(mountPoint, req.query.path || ""))
        .then((dir) => (dir ? cb(null, dir) : cb(new Error("invalid upload path"))))
        .catch((err) => cb(err));
    },
    filename: (req, file, cb) => {
      if (!isSafeFilename(file.originalname)) {
        return cb(new Error("invalid filename"));
      }
      cb(null, file.originalname);
    },
  }),
});

async function getMusicMount(source) {
  return source === "archive" ? ensureArchiveMusicMounted() : ensureMusicMounted();
}

musicRouter.get("/", async (req, res) => {
  if (process.platform !== "linux") {
    return res.status(501).json({ error: "real music library only available on the Pi" });
  }
  const source = req.query.source === "archive" ? "archive" : "pi";
  try {
    const mountPoint = await getMusicMount(source);
    const result = await browseMusic(mountPoint, req.query.path || "");
    if (!result) return res.status(404).json({ error: "path not found" });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Streams a single file for in-app playback (added 2026-07-03) — Express's
// res.sendFile supports HTTP Range requests natively, same as the clips
// download endpoint, which is what lets the player seek without
// downloading the whole file first.
musicRouter.get("/download", async (req, res) => {
  if (process.platform !== "linux") {
    return res.status(501).json({ error: "real music library only available on the Pi" });
  }
  const source = req.query.source === "archive" ? "archive" : "pi";
  try {
    const mountPoint = await getMusicMount(source);
    const filePath = await resolveMusicFile(mountPoint, req.query.path || "");
    if (!filePath) return res.status(404).json({ error: "file not found" });
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /music/upload?source=archive&path=<folder> — multipart form,
// field name "file". source=archive only — see the comment above the
// `upload` multer instance for why.
musicRouter.post(
  "/upload",
  (req, res, next) => {
    if (process.platform !== "linux") {
      return res.status(501).json({ error: "real music library only available on the Pi" });
    }
    if (req.query.source !== "archive") {
      return res.status(403).json({ error: "uploading directly to the device isn't supported" });
    }
    next();
  },
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "no file uploaded" });
    res.status(201).json({ name: req.file.filename, size: req.file.size });
  }
);

// DELETE /music?source=archive&path=<file> — source=archive only, same
// reasoning as upload.
musicRouter.delete("/", async (req, res) => {
  if (process.platform !== "linux") {
    return res.status(501).json({ error: "real music library only available on the Pi" });
  }
  if (req.query.source !== "archive") {
    return res.status(403).json({ error: "deleting on-device music directly isn't supported" });
  }
  try {
    const mountPoint = await ensureArchiveMusicMounted();
    const deleted = await deleteMusicFile(mountPoint, req.query.path || "");
    if (!deleted) return res.status(404).json({ error: "file not found" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
