import { execSync } from "node:child_process";
import type { TestProject } from "vitest/node";

export type LocalSupabase = {
  url: string;
  publishableKey: string;
  secretKey: string;
};

declare module "vitest" {
  export interface ProvidedContext {
    supabase: LocalSupabase;
  }
}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** Reads the running local stack's endpoints; refuses anything that is not local. */
export default function setup(project: TestProject) {
  let raw: string;
  try {
    // A fixed command string: nothing user-supplied reaches the shell.
    raw = execSync("pnpm exec supabase status -o json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error("Local Supabase is not running. Start it with `pnpm db:start`.");
  }

  const status = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  const url = status.API_URL ?? "";
  if (!LOCAL_HOSTS.has(new URL(url).hostname)) {
    throw new Error(`Refusing to run database tests against a non-local URL: ${url}`);
  }

  project.provide("supabase", {
    url,
    publishableKey: status.PUBLISHABLE_KEY ?? status.ANON_KEY ?? "",
    secretKey: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY ?? "",
  });
}
