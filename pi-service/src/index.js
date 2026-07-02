import express from "express";
import cors from "cors";
import { setupRouter } from "./routes/setup.js";
import { clipsRouter } from "./routes/clips.js";
import { musicRouter } from "./routes/music.js";
import { systemRouter } from "./routes/system.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/setup", setupRouter);
app.use("/clips", clipsRouter);
app.use("/music", musicRouter);
app.use("/system", systemRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`pi-service listening on port ${port}`);
});

// @abandonware/bleno only builds/runs on Linux — skip it entirely on
// other platforms so the REST API still works for local dev.
if (process.platform === "linux") {
  const { startBlePeripheral } = await import("./ble/peripheral.js");
  startBlePeripheral();
}
