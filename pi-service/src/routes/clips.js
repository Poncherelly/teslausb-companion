import { Router } from "express";

// Everyday-use clip endpoints — see docs/API.md "Everyday use" section.
// All require the admin session credential established during the wizard.
export const clipsRouter = Router();

clipsRouter.get("/", (req, res) => {
  res.status(501).json({ error: "not implemented" });
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
