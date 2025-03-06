import { context } from "esbuild";
import { isModule, options } from "./build";

(async () => {
  if (!isModule(__filename)) {
    return;
  }
  Promise.all([
    context(options.node).then((ctx) => ctx.watch()),
    context(options.web).then((ctx) => ctx.watch()),
    context(options.webTest).then((ctx) => ctx.watch()),
  ]);
})();
