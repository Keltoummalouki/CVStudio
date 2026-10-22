// Runs the PDF route's engine the way a serverless deployment does: from only
// the files its build trace ships (symlinks kept), with the packaged Chromium.
// A file the tracer misses (Chromium's archives, playwright-core's
// browsers.json…) makes every production export fail, while tests run from
// the full node_modules still pass. Run after `pnpm build`; Linux only, like
// the packaged Chromium.
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (process.platform !== "linux") {
  console.log("Skipped: the packaged Chromium only runs on Linux (CI checks it).");
  process.exit(0);
}

const root = resolve(import.meta.dirname, "..");
const routeDir = join(root, ".next/server/app/api/cvs/[cvId]/pdf");
const tracePath = join(routeDir, "route.js.nft.json");
if (!existsSync(tracePath)) {
  console.error("No build trace for the PDF route: run `pnpm build` first.");
  process.exit(1);
}

// 1. The bundle: traced files copied, traced symlinks recreated relatively.
const bundle = join(tmpdir(), "cvstudio-pdf-bundle");
rmSync(bundle, { recursive: true, force: true });
const { files } = JSON.parse(readFileSync(tracePath, "utf8"));
for (const rel of [...files.map((file) => relative(root, resolve(routeDir, file))), "route.js"]) {
  const source = rel === "route.js" ? join(routeDir, rel) : join(root, rel);
  const target = rel === "route.js" ? join(bundle, relative(root, source)) : join(bundle, rel);
  mkdirSync(dirname(target), { recursive: true });
  const stat = lstatSync(source);
  if (stat.isSymbolicLink() || stat.isDirectory()) {
    const real = join(bundle, relative(root, realpathSync(source)));
    if (!existsSync(target)) symlinkSync(relative(dirname(target), real), target);
  } else {
    copyFileSync(source, target);
  }
}

// 2. The packages, resolved like the compiled server chunks do (Turbopack
// loads externals through hashed aliases in .next/node_modules).
const chunks = join(bundle, ".next/server/chunks");
const aliasOf = (name) => {
  const pattern = new RegExp(`"(${name.replace("/", "\\/")}-[0-9a-f]{16})"`);
  for (const file of readdirSync(chunks)) {
    const match = file.startsWith("[externals]")
      ? pattern.exec(readFileSync(join(chunks, file), "utf8"))
      : null;
    if (match) return match[1];
  }
  return name;
};
const requireFromChunks = createRequire(join(chunks, "check.js"));

const server = createServer((_request, response) => {
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(
    "<!doctype html><title>Bundle check</title><style>@page { size: A4; }</style><p>Bundle check</p>" +
      '<script>document.fonts.ready.then(() => document.documentElement.setAttribute("data-print-ready", "true"))</script>',
  );
});
await new Promise((listening) => server.listen(0, "127.0.0.1", listening));

let browser;
try {
  // Deployed functions run with VERCEL set: it selects the packaged Chromium and its libraries.
  process.env.VERCEL ??= "1";
  const { chromium } = requireFromChunks(aliasOf("playwright-core"));
  const chromiumEntry = requireFromChunks.resolve(aliasOf("@sparticuz/chromium"));
  const { default: serverlessChromium } = await import(pathToFileURL(chromiumEntry).href);

  browser = await chromium.launch({
    args: serverlessChromium.args,
    executablePath: await serverlessChromium.executablePath(),
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("html[data-print-ready]", { state: "attached", timeout: 15_000 });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true });
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("not a PDF");
  console.log(
    `PDF bundle OK: ${files.length} traced files, Chromium ${browser.version()}, ${pdf.length}-byte PDF.`,
  );
} catch (error) {
  console.error("The PDF route's bundle cannot render a PDF on its own:");
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => undefined);
  server.close();
}
