import { NewChangeset, NewChangesetWithCommit } from "@changesets/types";
import * as git from "@changesets/git";

async function getCommitThatAddsChangeset(changesetId: string, cwd: string) {
  let commit = await git.getCommitThatAddsFile(
    `.changeset/${changesetId}.md`,
    cwd
  );
  if (commit) {
    return commit;
  }
  let commitForOldChangeset = await git.getCommitThatAddsFile(
    `.changeset/${changesetId}/changes.json`,
    cwd
  );
  if (commitForOldChangeset) {
    return commitForOldChangeset;
  }
}

export default async function addCommitsToChangesets(
  changesets: NewChangeset[],
  cwd: string
): Promise<NewChangesetWithCommit[]> {
  return Promise.all(
    changesets.map(async cs => ({
      ...cs,
      commit: await getCommitThatAddsChangeset(cs.id, cwd)
    }))
  );
}
