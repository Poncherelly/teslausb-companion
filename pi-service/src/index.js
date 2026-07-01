import express from "express";
import { setupRouter } from "./routes/setup.js";
import { clipsRouter } from "./routes/clips.js";

const app = express();
app.use(express.json());

app.get("/system/status", (req, res) => {
  res.json({ status: "ok", version: "0.1.0" });
});

app.use("/setup", setupRouter);
app.use("/clips", clipsRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`pi-service listening on port ${port}`);
});
