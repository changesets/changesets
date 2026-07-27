import fs from "node:fs/promises";
import path from "node:path";
import {
  PreExitButNotInPreModeError,
  PreEnterButInPreModeError,
} from "@changesets/errors";
import type { PreState } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";

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

  // Migrate from v2 to v3 pre.json file
  preState = preState ? await migratePreState(rootDir, preState) : undefined;

  return preState;
}

export async function exitPre(rootDir: string) {
  const preStatePath = path.resolve(rootDir, ".changeset", "pre.json");
  // TODO: verify that the pre state isn't broken
  const preState = await readPreState(rootDir);

  if (preState == null) {
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
  };
  await outputFile(preStatePath, JSON.stringify(newPreState, null, 2) + "\n");
}

async function migratePreState(
  rootDir: string,
  preState: PreState & {
    initialVersions?: { [pkgName: string]: string };
    changesets?: string[];
  },
): Promise<PreState> {
  if (preState.initialVersions == null && preState.changesets == null) {
    return preState;
  }

  // "initialVersions" is not used for a long time, delete it
  if (preState.initialVersions != null) {
    delete preState.initialVersions;
  }

  // "changesets" is now managed by moving them into `.changesets/pre/` instead,
  // no use tracking it in the pre.json file anymore
  if (preState.changesets != null) {
    const preChangesetsDir = path.resolve(rootDir, ".changeset", "pre");
    await fs.mkdir(preChangesetsDir, { recursive: true });

    for (const changeset of preState.changesets) {
      const oldPath = path.resolve(rootDir, ".changeset", `${changeset}.md`);
      const newPath = path.resolve(preChangesetsDir, `${changeset}.md`);
      try {
        await fs.rename(oldPath, newPath);
      } catch {
        // Best-effort only. It's possible for "changesets" to refer to a non-existing
        // changeset id before without errors
      }
    }

    delete preState.changesets;
  }

  await outputFile(
    path.resolve(rootDir, ".changeset", "pre.json"),
    JSON.stringify(preState, null, 2) + "\n",
  );

  return preState;
}
