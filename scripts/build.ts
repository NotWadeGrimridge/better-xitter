import { walk } from "@std/fs";
import { dirname, fromFileUrl, join, relative } from "@std/path";
import { zipSync } from "fflate";

const SOURCE_DIR = fromFileUrl(new URL("../src/", import.meta.url));
const DIST_DIR = fromFileUrl(new URL("../dist/", import.meta.url));

type Manifest = {
  content_scripts?: { js?: string[] }[];
  web_accessible_resources?: { resources?: string[] }[];
};

const TARGETS = [
  {
    manifest: "manifest.json",
    outDir: "chrome",
    archive: "better-xitter-chrome.zip",
  },
  {
    manifest: "manifest.firefox.json",
    outDir: "firefox",
    archive: "better-xitter-firefox.xpi",
  },
];

async function getScriptEntries(manifestPath: string): Promise<string[]> {
  const manifest: Manifest = JSON.parse(await Deno.readTextFile(manifestPath));
  const popupHtml = await Deno.readTextFile(join(SOURCE_DIR, "popup.html"));

  const entries = [
    ...(manifest.content_scripts ?? []).flatMap((script) => script.js ?? []),
    ...(manifest.web_accessible_resources ?? []).flatMap((resource) =>
      resource.resources ?? []
    ),
    ...popupHtml
      .matchAll(/<script\b[^>]*src=["'](?<src>[^"']+)["']/giu)
      .map((match) => match.groups?.src ?? ""),
  ];

  return [...new Set(entries.filter((entry) => entry.endsWith(".js")))];
}

async function bundle(entry: string, outDir: string): Promise<void> {
  const { success, stderr } = await new Deno.Command(Deno.execPath(), {
    args: [
      "bundle",
      "--platform=browser",
      "--minify",
      "--output",
      join(outDir, entry),
      join(SOURCE_DIR, entry.replace(/\.js$/u, ".ts")),
    ],
    stdout: "null",
    stderr: "piped",
  }).output();

  if (!success) {
    throw new Error(
      `Bundle failed for ${entry}:\n${new TextDecoder().decode(stderr)}`,
    );
  }
}

async function buildTarget(
  { manifest, outDir, archive }: (typeof TARGETS)[number],
): Promise<void> {
  const manifestPath = join(SOURCE_DIR, manifest);
  const targetDir = join(DIST_DIR, outDir);

  const entries = await getScriptEntries(manifestPath);
  await Promise.all(entries.map((entry) => bundle(entry, targetDir)));

  await Deno.copyFile(manifestPath, join(targetDir, "manifest.json"));

  for await (
    const file of walk(SOURCE_DIR, { exts: [".html"], includeDirs: false })
  ) {
    const target = join(targetDir, relative(SOURCE_DIR, file.path));
    await Deno.mkdir(dirname(target), { recursive: true });
    await Deno.copyFile(file.path, target);
  }

  const files: Record<string, Uint8Array> = {};
  for await (const file of walk(targetDir, { includeDirs: false })) {
    files[relative(targetDir, file.path)] = await Deno.readFile(file.path);
  }
  await Deno.writeFile(join(DIST_DIR, archive), zipSync(files, { level: 9 }));
}

await Promise.all(TARGETS.map((target) => buildTarget(target)));
