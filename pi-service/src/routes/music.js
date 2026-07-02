import { Router } from "express";
import { ensureMusicMounted } from "../lib/music-mount.js";
import { ensureArchiveMusicMounted } from "../lib/archive-mount.js";
import { browseMusic } from "../lib/music-scan.js";

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

musicRouter.get("/", async (req, res) => {
  if (process.platform !== "linux") {
    return res.status(501).json({ error: "real music library only available on the Pi" });
  }
  const source = req.query.source === "archive" ? "archive" : "pi";
  try {
    const mountPoint = source === "archive" ? await ensureArchiveMusicMounted() : await ensureMusicMounted();
    const result = await browseMusic(mountPoint, req.query.path || "");
    if (!result) return res.status(404).json({ error: "path not found" });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
