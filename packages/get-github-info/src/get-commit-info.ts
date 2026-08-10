import { loadCommitData } from "./dataloader.ts";
import { validateRepoName } from "./utils.ts";

export interface CommitInfoOptions {
  commit: string;
  repo: string;
}

export interface CommitInfo {
  commit: {
    sha: string;
    url: string;
    markdownLink: string;
  };
  author?: {
    login: string;
    url: string;
    markdownLink: string;
  };
  pull?: {
    number: number;
    url: string;
    markdownLink: string;
  };
}

/**
 * Get the information of a specific commit in a GitHub repository. Returns
 * `undefined` if the commit is not found or the GitHub repository doesn't exist.
 */
export async function getCommitInfo(
  options: CommitInfoOptions,
): Promise<CommitInfo | undefined> {
  validateRepoName(options.repo);

  const data = await loadCommitData({
    commit: options.commit,
    repo: options.repo,
  });
  if (data == null) return;

  const pr = data?.associatedPullRequests?.nodes?.sort((a, b) => {
    if (a.mergedAt == null && b.mergedAt == null) {
      return 0;
    }
    if (a.mergedAt == null) {
      return 1;
    }
    if (b.mergedAt == null) {
      return -1;
    }
    const aDate = new Date(a.mergedAt);
    const bDate = new Date(b.mergedAt);
    return aDate.getTime() - bDate.getTime();
  })[0];

  const author = pr?.author ?? data.author?.user;

  return {
    commit: {
      sha: options.commit,
      url: data.commitUrl,
      markdownLink: `[\`${options.commit.slice(0, 7)}\`](${data.commitUrl})`,
    },
    author: author
      ? {
          login: author.login,
          url: author.url,
          markdownLink: `[@${author.login}](${author.url})`,
        }
      : undefined,
    pull: pr
      ? {
          number: pr.number,
          url: pr.url,
          markdownLink: `[#${pr.number}](${pr.url})`,
        }
      : undefined,
  };
}
