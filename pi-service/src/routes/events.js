import { Router } from "express";
import { subscribe, unsubscribe } from "../lib/archive-events.js";

// SSE stream of live archive-sync status (see docs/API.md, added
// 2026-07-03) — tails teslausb's own archiveloop.log rather than
// polling GET /clips repeatedly.
export const eventsRouter = Router();

eventsRouter.get("/", (req, res) => {
  if (process.platform !== "linux") {
    return res.status(501).json({ error: "not available outside the Pi" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("\n");

  subscribe(res);
  req.on("close", () => unsubscribe(res));
});
