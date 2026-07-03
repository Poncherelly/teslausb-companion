import fs from "node:fs";

// Tails teslausb's own archiveloop.log (unmodified upstream process —
// see docs/ARCHITECTURE.md) to surface live archive-sync status over
// SSE, instead of the app having to guess or poll. Polls for size
// changes rather than fs.watch — more predictable across filesystems,
// and this log is written to infrequently enough that a short interval
// costs nothing.
const LOG_PATH = "/mutable/archiveloop.log";
const POLL_INTERVAL_MS = 2000;

// Maps a subset of archiveloop's real log lines (confirmed against
// /root/bin/archiveloop's own `log "..."` calls) to a small set of
// user-facing states. Most lines (fsck, snapshot diffing, LED
// triggers, etc.) are intentionally ignored as noise.
const PATTERNS = [
  [/Starting recording archiving/, { type: "archiving", message: "Archiving clips…" }],
  [/^.*Archiving\.\.\.$/, { type: "archiving", message: "Archiving clips…" }],
  [/Finished archiving\./, { type: "idle", message: "Archive cycle finished" }],
  [/Archiving failed\./, { type: "error", message: "Archive cycle failed" }],
  [/Couldn't connect archive, skipping archive step/, { type: "unreachable", message: "Archive unreachable — skipped this cycle" }],
  [/Starting music sync\.\.\./, { type: "syncing_music", message: "Syncing music…" }],
  [/^.*Copying music\.\.\.$/, { type: "syncing_music", message: "Copying music…" }],
  [/Finished copying music\./, { type: "idle", message: "Music sync finished" }],
  [/Copying music failed\./, { type: "error", message: "Music sync failed" }],
  [/Music archive not configured or unreachable/, { type: "info", message: "Music archive not configured" }],
  [/Waiting for archive to be reachable\.\.\./, { type: "waiting", message: "Waiting for archive…" }],
  [/Archive is reachable\./, { type: "info", message: "Archive reachable" }],
  [/waiting up to \d+ seconds for idle interval/, { type: "waiting_idle", message: "Waiting for car to be idle…" }],
  [/couldn't determine idle interval/, { type: "waiting_idle", message: "Waiting for car to be idle…" }],
];

function classifyLine(line) {
  for (const [pattern, event] of PATTERNS) {
    if (pattern.test(line)) return event;
  }
  return null;
}

const subscribers = new Set();
let lastSize = null;
let pollTimer = null;

async function pollForNewLines() {
  let stat;
  try {
    stat = await fs.promises.stat(LOG_PATH);
  } catch {
    return; // log doesn't exist yet (e.g. archiveloop hasn't run since boot)
  }

  if (lastSize === null) {
    lastSize = stat.size; // first poll after a subscriber connects: don't replay history
    return;
  }
  if (stat.size < lastSize) {
    lastSize = 0; // log was rotated/truncated
  }
  if (stat.size === lastSize) return;

  const start = lastSize;
  lastSize = stat.size;

  const chunks = [];
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(LOG_PATH, { start, end: stat.size - 1, encoding: "utf8" });
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", resolve);
    stream.on("error", reject);
  }).catch(() => {});

  const lines = chunks.join("").split("\n").filter(Boolean);
  for (const line of lines) {
    const event = classifyLine(line);
    if (event) broadcast(event);
  }
}

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of subscribers) {
    res.write(payload);
  }
}

export function subscribe(res) {
  subscribers.add(res);
  if (!pollTimer) {
    pollTimer = setInterval(pollForNewLines, POLL_INTERVAL_MS);
  }
}

export function unsubscribe(res) {
  subscribers.delete(res);
  if (subscribers.size === 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    lastSize = null; // next subscriber starts fresh from "now", not stale history
  }
}
