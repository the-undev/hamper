import { defineConfig, devices } from "@playwright/test";

/** The e2e API's address, which e2e/server.mjs listens on. */
const baseURL = "http://127.0.0.1:8778";

// One worker on one server: the tests share a database and run in order.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "desktop-firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  webServer: {
    command: "node e2e/server.mjs",
    url: `${baseURL}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    // SIGTERM lets e2e/server.mjs stop the API and remove its temp directory.
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
