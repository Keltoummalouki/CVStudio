// Removes the Next.js production build output while leaving `.next/dev`
// (a running `next dev` server's own directory) untouched. On Windows, folders
// synced by OneDrive can become read-only cloud placeholders that fs.rm cannot
// delete, so the native rmdir is used there.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const buildDir = resolve(import.meta.dirname, "..", ".next");
const KEEP = new Set(["dev"]);

function remove(target) {
  if (process.platform === "win32" && statSync(target).isDirectory()) {
    execFileSync("cmd.exe", ["/d", "/c", "rmdir", "/s", "/q", target], { stdio: "inherit" });
  } else {
    rmSync(target, { recursive: true, force: true });
  }
}

if (existsSync(buildDir)) {
  const leftovers = [];
  for (const entry of readdirSync(buildDir)) {
    if (KEEP.has(entry)) continue;
    const target = join(buildDir, entry);
    remove(target);
    if (existsSync(target)) leftovers.push(target);
  }
  if (leftovers.length > 0) {
    console.error(
      `Could not remove:\n${leftovers.join("\n")}\nStop running Next.js production servers and retry.`,
    );
    process.exit(1);
  }
}
