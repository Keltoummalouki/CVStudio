import { execSync } from "node:child_process";

export type LocalSupabase = { url: string; publishableKey: string; secretKey: string };

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
let cached: LocalSupabase | undefined;

/**
 * End-to-end tests run the app against the LOCAL Supabase stack only
 * (`pnpm db:start`). Anything else is refused so tests can never create users
 * or delete data in a hosted project.
 */
export function localSupabase(): LocalSupabase {
  if (cached) return cached;

  let raw: string;
  try {
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
    throw new Error(`Refusing to run end-to-end tests against a non-local Supabase: ${url}`);
  }

  cached = {
    url,
    publishableKey: status.PUBLISHABLE_KEY ?? status.ANON_KEY ?? "",
    secretKey: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY ?? "",
  };
  return cached;
}
