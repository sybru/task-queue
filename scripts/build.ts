import { type BuildOptions, build } from "esbuild";

export const isModule = (__filename: string) => require.main?.filename === __filename;

const main: BuildOptions = {
  bundle: true,
  minify: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  minifyWhitespace: true,
  treeShaking: true,
};

export const options: {
  node: BuildOptions;
  web: BuildOptions;
  webTest: BuildOptions;
} = {
  node: {
    ...main,
    entryPoints: ["./src/node/index.ts"],
    outfile: "dist/node/index.js",
    platform: "node",
    plugins: [
      {
        name: "on-end",
        setup: (build) => {
          build.onEnd(() => {
            const text = ((build.initialOptions.entryPoints as string[]) ?? []).map((entryPoint: string) => `  ${entryPoint}`).join("\n");
            console.log([new Date(), text, ""].join("\n"));
          });
        },
      },
    ],
  },
  web: {
    ...main,
    entryPoints: ["./src/web/index.ts"],
    outfile: "dist/web/index.js",
    platform: "browser",
    external: ["node:events", "node:crypto"],
    plugins: [
      {
        name: "on-end",
        setup: (build) => {
          build.onEnd(() => {
            const text = ((build.initialOptions.entryPoints as string[]) ?? []).map((entryPoint: string) => `  ${entryPoint}`).join("\n");
            console.log([new Date(), text, ""].join("\n"));
          });
        },
      },
    ],
  },
  webTest: {
    ...main,
    entryPoints: ["./src/web/__tests__/index.ts"],
    outfile: "__tests__/web/index.js",
    platform: "browser",
    external: ["node:events", "node:crypto"],
    plugins: [
      {
        name: "on-end",
        setup: (build) => {
          build.onEnd(() => {
            const text = ((build.initialOptions.entryPoints as string[]) ?? []).map((entryPoint: string) => `  ${entryPoint}`).join("\n");
            console.log([new Date(), text, ""].join("\n"));
          });
        },
      },
    ],
  },
};

(async () => {
  if (!isModule(__filename)) {
    return;
  }
  console.log("Build process");
  Promise.all([
    build({
      ...options.node,
    }),
    build({
      ...options.web,
    }),
  ]);
})();
