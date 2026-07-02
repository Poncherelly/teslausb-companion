import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data");
const CONFIG_PATH = path.join(DATA_DIR, "device-config.json");

export async function setAdminPassword(password) {
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify({ admin_password_hash: hash }, null, 2));
}
