import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data");
const CONFIG_PATH = path.join(DATA_DIR, "device-config.json");

function hash(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function readConfig() {
  try {
    return JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

export async function setAdminPassword(password) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify({ admin_password_hash: hash(password) }, null, 2));
}

export async function hasAdminPassword() {
  const config = await readConfig();
  return Boolean(config.admin_password_hash);
}

export async function verifyAdminPassword(password) {
  const config = await readConfig();
  return config.admin_password_hash === hash(password);
}
