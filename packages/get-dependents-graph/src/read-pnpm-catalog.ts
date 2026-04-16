import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";

export function readPnpmCatalog(rootDir: string): Record<string, string> {
  const catalogPath = path.join(rootDir, "pnpm-workspace.yaml");
  try {
    const content = fs.readFileSync(catalogPath, "utf-8");
    const parsed = load(content) as
      | { catalog?: Record<string, string> }
      | null
      | undefined;
    return parsed?.catalog ?? {};
  } catch {
    return {};
  }
}
