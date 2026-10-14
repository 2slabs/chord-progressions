import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const production = process.argv.includes("--production");

// Dialogs are loaded from a data: URL, so they can't fetch anything. For each
// imported .html file: bundle and inline <script type="module" src>, inline
// <link rel="stylesheet">, and turn url("./...") assets into data: URIs.
function inlineUrls(text: string, dir: string, watchFiles: string[]): string {
  return text.replace(/url\("(\.\/[^"]+)"\)/g, (_, rel: string) => {
    const file = path.resolve(dir, rel);
    watchFiles.push(file);
    const type = rel.endsWith(".woff2") ? "font/woff2" : "application/octet-stream";
    return `url("data:${type};base64,${fs.readFileSync(file).toString("base64")}")`;
  });
}

const inlineUi: esbuild.Plugin = {
  name: "inline-ui",
  setup(build) {
    build.onLoad({ filter: /\.html$/ }, async (args) => {
      let html = await fs.promises.readFile(args.path, "utf8");
      const watchFiles: string[] = [];
      for (const tag of html.match(/<script type="module" src="[^"]+"><\/script>/g) ?? []) {
        const entry = path.resolve(path.dirname(args.path), tag.match(/src="([^"]+)"/)![1]);
        const out = await esbuild.build({
          entryPoints: [entry],
          bundle: true,
          write: false,
          format: "iife",
          target: "safari16",
          minify: production,
          metafile: true,
        });
        watchFiles.push(...Object.keys(out.metafile.inputs).map((f) => path.resolve(f)));
        const js = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
        html = html.replace(tag, () => `<script>${js}</script>`);
      }
      // Stylesheets become <style> blocks; url("./...") assets (fonts) become data: URIs.
      for (const tag of html.match(/<link rel="stylesheet" href="[^"]+"\s*\/?>/g) ?? []) {
        const file = path.resolve(path.dirname(args.path), tag.match(/href="([^"]+)"/)![1]);
        watchFiles.push(file);
        const css = inlineUrls(fs.readFileSync(file, "utf8"), path.dirname(file), watchFiles);
        html = html.replace(tag, () => `<style>${css}</style>`);
      }
      html = inlineUrls(html, path.dirname(args.path), watchFiles);
      return { contents: html, loader: "text", watchFiles };
    });
  },
};

await esbuild.build({
  entryPoints: ["src/extension.ts"],
  outfile: manifest.entry,
  bundle: true,
  format: "cjs",
  platform: "node",
  sourcesContent: false,
  logLevel: "info",
  minify: production,
  sourcemap: !production,
  plugins: [inlineUi],
});
