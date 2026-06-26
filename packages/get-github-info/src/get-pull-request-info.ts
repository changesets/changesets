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
    markdownLink: string;
  };
  author?: {
    login: string;
    url: string;
    markdownLink: string;
  };
  commit?: {
    sha: string;
    url: string;
    markdownLink: string;
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
      markdownLink: `[#${options.pull}](${data.url})`,
    },
    author: data.author
      ? {
          login: data.author.login,
          url: data.author.url,
          markdownLink: `[@${data.author.login}](${data.author.url})`,
        }
      : undefined,
    commit: data.mergeCommit
      ? {
          sha: data.mergeCommit.abbreviatedOid,
          url: data.mergeCommit.commitUrl,
          markdownLink: `[\`${data.mergeCommit.abbreviatedOid.slice(0, 7)}\`](${data.mergeCommit.commitUrl})`,
        }
      : undefined,
  };
}
