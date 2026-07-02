import { Router } from "express";
import { ensureMusicMounted } from "../lib/music-mount.js";
import { ensureArchiveMusicMounted } from "../lib/archive-mount.js";
import { browseMusic, resolveMusicFile } from "../lib/music-scan.js";

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
