import { loadPullData } from "./dataloader.ts";
import { validateRepoName } from "./utils.ts";

export interface PullRequestInfoOptions {
  pull: number;
  repo: string;
}

export interface PullRequestInfo {
  pull: {
    number: number;
    url: string;
  };
  author?: {
    login: string;
    url: string;
  };
  commit?: {
    sha: string;
    url: string;
  };
}

/**
 * Get the information of a specific pull request in a GitHub repository. Returns
 * `undefined` if the pull request is not found or the GitHub repository doesn't exist.
 */
export async function getPullRequestInfo(
  options: PullRequestInfoOptions,
): Promise<PullRequestInfo | undefined> {
  validateRepoName(options.repo);

  const data = await loadPullData({ pull: options.pull, repo: options.repo });
  if (data == null) return;

  return {
    pull: {
      number: options.pull,
      url: data.url,
    },
    author: data.author
      ? {
          login: data.author.login,
          url: data.author.url,
        }
      : undefined,
    commit: data.mergeCommit
      ? {
          sha: data.mergeCommit.abbreviatedOid,
          url: data.mergeCommit.commitUrl,
        }
      : undefined,
  };
}
