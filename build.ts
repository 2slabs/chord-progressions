import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const production = process.argv.includes("--production");

// Dialogs are loaded from a data: URL, so they can't fetch anything. Bundle each
// <script type="module" src="..."> in an imported .html file and inline it, and
// inline url("./...") assets.
const inlineUiScripts: esbuild.Plugin = {
  name: "inline-ui-scripts",
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
      // Fonts and other assets referenced as url("./...") become data: URIs.
      html = html.replace(/url\("(\.\/[^"]+)"\)/g, (_, rel: string) => {
        const file = path.resolve(path.dirname(args.path), rel);
        watchFiles.push(file);
        const type = rel.endsWith(".woff2") ? "font/woff2" : "application/octet-stream";
        return `url("data:${type};base64,${fs.readFileSync(file).toString("base64")}")`;
      });
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
  plugins: [inlineUiScripts],
});
