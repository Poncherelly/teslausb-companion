import { Router } from "express";
import { ensureMusicMounted } from "../lib/music-mount.js";
import { browseMusic } from "../lib/music-scan.js";

// docs/API.md originally specced GET /music as a flat list. Real data
// (2026-07-02) showed the music partition is a generic, user-organized
// folder tree (Music/<artist>/<album>, boombox/, and arbitrary other
// top-level folders) — this is a folder browser instead, navigated via
// ?path=. See docs/DATA_MODEL.md / docs/API.md for the updated shape.
export const musicRouter = Router();

musicRouter.get("/", async (req, res) => {
  if (process.platform !== "linux") {
    return res.status(501).json({ error: "real music library only available on the Pi" });
  }
  try {
    const mountPoint = await ensureMusicMounted();
    const result = await browseMusic(mountPoint, req.query.path || "");
    if (!result) return res.status(404).json({ error: "path not found" });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
