import { defineConfig } from 'tsup';
import type { Plugin } from 'esbuild';

// Preserve the `node:` protocol prefix so built-ins like `node:sqlite`
// aren't rewritten to bare names (e.g. `sqlite`) that Node can't resolve.
const keepNodeProtocol: Plugin = {
  name: 'keep-node-protocol',
  setup(build) {
    build.onResolve({ filter: /^node:/ }, (args) => ({
      path: args.path,
      external: true,
    }));
  },
};

export default defineConfig({
  entry: ['app.ts'],
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  esbuildPlugins: [keepNodeProtocol],
});
