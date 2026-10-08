// Starts the API for the browser suite on 8778 with its own temp database and data directory, serving the built frontend.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const frontendDir = path.resolve(import.meta.dirname, "..");
const projectDir = path.resolve(frontendDir, "../backend/src/Hamper.Api");
const webRoot = path.join(frontendDir, "dist");
const dataDir = mkdtempSync(path.join(tmpdir(), "hamper-e2e-"));

const api = spawn(
  "dotnet",
  [
    "run",
    "--project",
    projectDir,
    "--no-launch-profile",
    "-c",
    "Release",
    "--",
    "--urls",
    "http://127.0.0.1:8778",
    "--webroot",
    webRoot,
    "--ConnectionStrings:Hamper",
    `Data Source=${path.join(dataDir, "e2e.db")}`,
    "--Storage:DataDir",
    dataDir,
  ],
  {
    env: { ...process.env, ASPNETCORE_ENVIRONMENT: "Production" },
    stdio: ["ignore", "inherit", "inherit"],
  },
);

let stopping = false;
const stop = () => {
  if (stopping) {
    return;
  }
  stopping = true;
  api.kill("SIGTERM");
  rmSync(dataDir, { recursive: true, force: true });
};

api.on("exit", (code) => {
  if (!stopping) {
    rmSync(dataDir, { recursive: true, force: true });
    process.exit(code ?? 1);
  }
});
process.on("exit", stop);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    stop();
    process.exit(0);
  });
}
