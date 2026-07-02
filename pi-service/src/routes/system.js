import { Router } from "express";
import os from "node:os";
import { applyHostnameFiles, isValidHostname, rebootToApply } from "../lib/hostname-update.js";

export const systemRouter = Router();

systemRouter.get("/status", (req, res) => {
  // hostname is what shows up in the router's connected-devices list
  // (e.g. "teslausb-ModelY") — lets the app confirm which physical Pi
  // it's talking to.
  res.json({ status: "ok", version: "0.1.0", hostname: os.hostname() });
});

// Reboots to apply, like the WiFi reconfiguration flow — see
// docs/BLE_PROTOCOL.md / wifi-reconfigure.js for the same pattern.
systemRouter.put("/hostname", async (req, res) => {
  if (process.platform !== "linux") {
    return res.status(501).json({ error: "not available outside the Pi" });
  }
  const { hostname } = req.body;
  if (!isValidHostname(hostname)) {
    return res.status(400).json({ error: "invalid hostname — letters, numbers, and hyphens only" });
  }
  try {
    await applyHostnameFiles(hostname);
    res.status(202).json({ message: "hostname updated, rebooting to apply" });
    rebootToApply().catch((err) => console.error("reboot failed:", err.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
