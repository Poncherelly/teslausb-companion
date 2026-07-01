import { Router } from "express";

// Everyday-use clip endpoints — see docs/API.md "Everyday use" section.
// All require the admin session credential established during the wizard.
export const clipsRouter = Router();

// Fake data for the first end-to-end vertical slice (no real Pi storage
// or archive-sync process wired up yet). Shape matches docs/DATA_MODEL.md.
const FAKE_CLIPS = [
  {
    id: "1",
    filename: "2026-06-30_18-42-10-front.mp4",
    category: "sentry",
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
    timestamp: "2026-07-01T09:02:44Z",
    size: 62914560,
    checksum: "ghi789",
    state: "archiving",
    encrypted_on_disk: true,
    locked_by_download: false,
  },
];

clipsRouter.get("/", (req, res) => {
  const { category, state } = req.query;
  let clips = FAKE_CLIPS;
  if (category) clips = clips.filter((c) => c.category === category);
  if (state) clips = clips.filter((c) => c.state === state);
  res.json({ clips });
});

clipsRouter.get("/:id/download", (req, res) => {
  res.status(501).json({ error: "not implemented" });
});

clipsRouter.delete("/:id", (req, res) => {
  res.status(501).json({ error: "not implemented" });
});

clipsRouter.get("/:id/thumbnail", (req, res) => {
  res.status(501).json({ error: "not implemented" });
});
