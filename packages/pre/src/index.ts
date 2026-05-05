import fs from "node:fs/promises";
import path from "path";
import type { PreState } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import {
  PreExitButNotInPreModeError,
  PreEnterButInPreModeError,
} from "@changesets/errors";

async function outputFile(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

export async function readPreState(
  rootDir: string,
): Promise<PreState | undefined> {
  const preStatePath = path.resolve(rootDir, ".changeset", "pre.json");
  // TODO: verify that the pre state isn't broken
  let preState: PreState | undefined;
  try {
    const contents = await fs.readFile(preStatePath, "utf8");
    try {
      preState = JSON.parse(contents);
    } catch (err) {
      if (err instanceof SyntaxError) {
        console.error("error parsing json:", contents);
      }
      throw err;
    }
  } catch (err) {
    if ((err as any).code !== "ENOENT") {
      throw err;
    }
  }
  return preState;
}

export async function exitPre(rootDir: string) {
  const preStatePath = path.resolve(rootDir, ".changeset", "pre.json");
  // TODO: verify that the pre state isn't broken
  const preState = await readPreState(rootDir);

  if (preState === undefined) {
    throw new PreExitButNotInPreModeError();
  }

  await outputFile(
    preStatePath,
    JSON.stringify({ ...preState, mode: "exit" }, null, 2) + "\n",
  );
}

export async function enterPre(rootDir: string, tag: string) {
  const packages = await getPackages(rootDir);
  const preStatePath = path.resolve(packages.rootDir, ".changeset", "pre.json");
  const preState: PreState | undefined = await readPreState(packages.rootDir);
  // can't reenter if pre mode still exists, but we should allow exited pre mode to be reentered
  if (preState?.mode === "pre") {
    throw new PreEnterButInPreModeError();
  }
  const newPreState: PreState = {
    mode: "pre",
    tag,
    initialVersions: {},
    changesets: preState?.changesets ?? [],
  };
  for (const pkg of packages.packages) {
    newPreState.initialVersions[pkg.packageJson.name] = pkg.packageJson.version;
  }
  await outputFile(preStatePath, JSON.stringify(newPreState, null, 2) + "\n");
}
