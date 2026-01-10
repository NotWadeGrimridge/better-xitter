/// <reference lib="deno.ns" />

import { copy, ensureDir, walk } from "@std/fs";
import { dirname, fromFileUrl, join, relative } from "@std/path";
import { zipSync } from "fflate";

const projectRoot = new URL("../", import.meta.url);
const sourceDir = new URL("./src/", projectRoot);
const chromeDistDir = new URL("./dist/chrome/", projectRoot);
const firefoxDistDir = new URL("./dist/firefox/", projectRoot);
const chromeDistZip = new URL("./dist/better-xitter-chrome.zip", projectRoot);
const firefoxDistZip = new URL("./dist/better-xitter-firefox.xpi", projectRoot);
const chromeManifestPath = new URL("./manifest.json", sourceDir);
const firefoxManifestPath = new URL("./manifest.firefox.json", sourceDir);
const popupHtmlPath = new URL("./popup.html", sourceDir);

type ManifestContentScript = {
  js?: string[];
};

type ManifestWebAccessibleResources = {
  resources?: string[];
};

type ExtensionManifest = {
  content_scripts?: ManifestContentScript[];
  web_accessible_resources?: ManifestWebAccessibleResources[];
};

async function getManifestEntries(
  manifestPath: URL,
): Promise<string[]> {
  const manifestText = await Deno.readTextFile(manifestPath);
  const manifest = JSON.parse(manifestText) as ExtensionManifest;

  const scriptEntries: string[] = [];

  if (manifest.content_scripts) {
    for (const contentScript of manifest.content_scripts) {
      if (!contentScript.js) continue;
      for (const script of contentScript.js) {
        if (script.endsWith(".js")) {
          scriptEntries.push(script);
        }
      }
    }
  }

  if (manifest.web_accessible_resources) {
    for (const resource of manifest.web_accessible_resources) {
      if (!resource.resources) continue;
      for (const item of resource.resources) {
        if (item.endsWith(".js")) {
          scriptEntries.push(item);
        }
      }
    }
  }

  return scriptEntries;
}

async function getPopupScriptEntries(): Promise<string[]> {
  const popupHtml = await Deno.readTextFile(popupHtmlPath);
  const entries: string[] = [];

  // Simple scan for script tags with src attributes; popup.html is small and controlled.
  const scriptTagPattern = /<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
  for (const match of popupHtml.matchAll(scriptTagPattern)) {
    const src = match[1];
    if (src.endsWith(".js")) {
      entries.push(src);
    }
  }

  return entries;
}

async function getEntryPoints(manifestPath: URL): Promise<string[]> {
  const manifestEntries = await getManifestEntries(manifestPath);
  const popupEntries = await getPopupScriptEntries();

  const all = [...manifestEntries, ...popupEntries];
  const unique = new Set<string>();
  for (const entry of all) {
    unique.add(entry);
  }

  return Array.from(unique);
}

async function bundle(entry: string, distDir: URL): Promise<void> {
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

async function buildTarget(
  distDir: URL,
  manifestPath: URL,
  distZip: URL,
): Promise<void> {
  await ensureDir(distDir);

  const sourceRoot = fromFileUrl(sourceDir);
  const distRoot = fromFileUrl(distDir);

  const jsEntries = await getEntryPoints(manifestPath);
  for (const jsEntry of jsEntries) {
    const tsEntry = jsEntry.endsWith(".js")
      ? `${jsEntry.slice(0, -3)}.ts`
      : jsEntry;
    await bundle(tsEntry, distDir);
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

async function build(): Promise<void> {
  await buildTarget(chromeDistDir, chromeManifestPath, chromeDistZip);
  await buildTarget(firefoxDistDir, firefoxManifestPath, firefoxDistZip);
}

if (import.meta.main) {
  await build();
}
