/// <reference lib="deno.ns" />

import { copy, ensureDir, walk } from "@std/fs";
import { dirname, fromFileUrl, join, relative } from "@std/path";
import { zipSync } from "fflate";

const projectRoot = new URL("../", import.meta.url);
const sourceDir = new URL("./src/", projectRoot);
const distDir = new URL("./dist/chrome/", projectRoot);
const distZip = new URL("./dist/better-xitter-chrome.zip", projectRoot);
const manifestPath = new URL("./manifest.json", sourceDir);

const entryPoints = [
  "content.ts",
  "popup.ts",
  "hide-affiliates/home_timeline_xhr_hook.ts",
  "mute-affiliates/affiliates_page_xhr_hook.ts",
  "client-info/tweet_client_info_page.ts",
];

async function bundle(entry: string): Promise<void> {
  const entryPath = fromFileUrl(new URL(entry, sourceDir));
  const outName = entry.endsWith(".ts") ? `${entry.slice(0, -3)}.js` : entry;
  const outputPath = fromFileUrl(
    new URL(outName, distDir),
  );

  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "bundle",
      "--platform=browser",
      "--minify",
      "--output",
      outputPath,
      entryPath,
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();
  if (code !== 0) {
    const message = new TextDecoder().decode(stderr || stdout);
    throw new Error(`Bundle failed for ${entry}:\n${message}`);
  }
}

async function build(): Promise<void> {
  await ensureDir(distDir);

  const sourceRoot = fromFileUrl(sourceDir);
  const distRoot = fromFileUrl(distDir);

  for (const entry of entryPoints) {
    await bundle(entry);
  }

  await Deno.copyFile(manifestPath, new URL("./manifest.json", distDir));

  for await (
    const entry of walk(sourceDir, { exts: [".html"], includeDirs: false })
  ) {
    const relPath = relative(sourceRoot, entry.path);
    const toPath = join(distRoot, relPath);
    await ensureDir(dirname(toPath));
    await copy(entry.path, toPath, { overwrite: true });
  }

  const files: Record<string, Uint8Array> = {};
  for await (const entry of walk(distRoot, { includeDirs: false })) {
    const relPath = relative(distRoot, entry.path);
    files[relPath] = await Deno.readFile(entry.path);
  }
  const zipped = zipSync(files, { level: 9 });
  await Deno.writeFile(distZip, zipped);
}

if (import.meta.main) {
  await build();
}
