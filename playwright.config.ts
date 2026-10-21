import { defineConfig, devices } from "@playwright/test";
import { OWNER_STORAGE_STATE } from "./tests/e2e/support/accounts";
import { localSupabase } from "./tests/e2e/support/local-supabase";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;
const supabase = localSupabase();

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // One local server and one local Auth instance: keep contention realistic.
  workers: process.env.CI ? 2 : 4,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // In CI: annotations on the pull request, plus an HTML report uploaded when a test fails.
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "en-US",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: OWNER_STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], storageState: OWNER_STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],
  // Tests run against a fresh production build wired to the local Supabase stack.
  webServer: {
    command: `pnpm clean && pnpm build && pnpm start --port ${PORT}`,
    url: `${baseURL}/en/login`,
    // E2E_REUSE=1 reuses an already running, locally wired server while iterating.
    reuseExistingServer: process.env.E2E_REUSE === "1",
    // A cold CI runner also downloads the fonts and compiles from scratch.
    timeout: process.env.CI ? 420_000 : 240_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabase.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
      APP_TIME_ZONE: "UTC",
    },
  },
});
