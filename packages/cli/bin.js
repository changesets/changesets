#!/usr/bin/env node

if (globalThis.process?.getBuiltinModule) {
  const { enableCompileCache } =
    globalThis.process.getBuiltinModule("node:module");
  enableCompileCache();
}

await import("@changesets/cli");
