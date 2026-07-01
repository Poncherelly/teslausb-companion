import { Router } from "express";

// Wizard endpoints — see docs/API.md "Wizard" section.
// Must stop responding once DeviceConfig.first_boot_complete = true
// and BLE is not in pairing mode (see docs/STATE_MACHINES.md).
export const setupRouter = Router();

setupRouter.post("/wifi", (req, res) => {
  res.status(501).json({ error: "not implemented" });
});

setupRouter.post("/admin", (req, res) => {
  res.status(501).json({ error: "not implemented" });
});

setupRouter.post("/archive", (req, res) => {
  res.status(501).json({ error: "not implemented" });
});

setupRouter.post("/tesla/callback", (req, res) => {
  res.status(501).json({ error: "not implemented" });
});

setupRouter.get("/status", (req, res) => {
  res.status(501).json({ error: "not implemented" });
});
