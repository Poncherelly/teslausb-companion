// In-use lock so the deletion sweep never races an in-flight download
// (docs/STATE_MACHINES.md "In-use lock"). In-memory only — fine for a
// single-process service; doesn't need to survive a restart.
const lockedClipIds = new Set();

export function lockClip(id) {
  lockedClipIds.add(id);
}

export function unlockClip(id) {
  lockedClipIds.delete(id);
}

export function isClipLocked(id) {
  return lockedClipIds.has(id);
}
