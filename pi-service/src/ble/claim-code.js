import crypto from "node:crypto";

// 6-digit code, regenerated each time advertising (re)starts. In the
// real product this also gets printed on a physical sticker/LED
// pattern (see docs/BLE_PROTOCOL.md) — for now it's logged to the
// console, since we don't have that hardware step yet.
export function generateClaimCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}
