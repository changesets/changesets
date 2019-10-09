import * as path from "path";
import * as fs from "fs-extra";
import { PreState } from "@changesets/types";

export async function readPreState(cwd: string) {
  let preStatePath = path.resolve(cwd, ".changeset", "pre.json");
  // TODO: verify that the pre state isn't broken
  let preState: PreState | undefined;
  try {
    preState = await fs.readJson(preStatePath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
  return preState;
}
