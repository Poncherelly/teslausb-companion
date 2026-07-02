import { Router } from "express";
import {
  isValidCredentialField,
  isValidHost,
  isValidShareName,
  readArchiveConfig,
  rebootToApply,
  writeArchiveConfig,
} from "../lib/archive-config.js";

export const archiveRouter = Router();

archiveRouter.get("/config", async (req, res) => {
  if (process.platform !== "linux") {
    return res.status(501).json({ error: "not available outside the Pi" });
  }
  try {
    res.json(await readArchiveConfig());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

archiveRouter.put("/config", async (req, res) => {
  if (process.platform !== "linux") {
    return res.status(501).json({ error: "not available outside the Pi" });
  }

  const { server, shareName, musicShareName, shareUser, sharePassword } = req.body;

  if (!isValidHost(server)) {
    return res.status(400).json({ error: "invalid server — enter a hostname or IP address" });
  }
  if (!isValidShareName(shareName)) {
    return res.status(400).json({ error: "invalid share name for clips" });
  }
  if (musicShareName != null && musicShareName !== "" && !isValidShareName(musicShareName)) {
    return res.status(400).json({ error: "invalid share name for music" });
  }
  if (!isValidCredentialField(shareUser)) {
    return res.status(400).json({ error: "username is required" });
  }
  if (!isValidCredentialField(sharePassword)) {
    return res.status(400).json({ error: "password is required" });
  }

  try {
    await writeArchiveConfig({
      server,
      shareName,
      musicShareName: musicShareName || null,
      shareUser,
      sharePassword,
    });
    res.status(202).json({ message: "archive destination updated, rebooting to apply" });
    rebootToApply().catch((err) => console.error("reboot failed:", err.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
