import { readPreState } from "@changesets/pre";
import { readChangesets } from "@changesets/read";
import type { PreState, NewChangeset } from "@changesets/types";

export type ChangesetState = {
  preState: PreState | undefined;
  changesets: NewChangeset[];
};

export async function readChangesetState(
  cwd: string = process.cwd(),
): Promise<ChangesetState> {
  const preState = await readPreState(cwd);
  const isInPreMode = preState != null && preState.mode === "pre";

  let changesets = await readChangesets(cwd);

  if (isInPreMode) {
    changesets = changesets.filter((x) => !x.id.startsWith("pre/"));
  }

  return {
    preState: isInPreMode ? preState : undefined,
    changesets,
  };
}
