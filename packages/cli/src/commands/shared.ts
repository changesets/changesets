import fs from "node:fs/promises";
import path from "node:path";
import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import { log } from "@clack/prompts";

export async function ensureChangesetFolder(rootDir: string) {
  try {
    await fs.access(path.resolve(rootDir, ".changeset"));
  } catch {
    log.error(
      `
  There is no .changeset folder.
  If this is the first time ${c.green("Changesets")} have been used in this project, run ${c.cyan("changeset init")} to get set up.
  If you expected there to be changesets, you should check git history for when the folder was removed to ensure you do not lose any configuration.
        `.trim(),
    );
    throw new ExitError(1);
  }
}
