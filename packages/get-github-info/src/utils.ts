const validRepoNameRegex = /^[\w.-]+\/[\w.-]+$/;

export function validateRepoName(repo: string) {
  if (!validRepoNameRegex.test(repo)) {
    throw new Error(
      `Please pass a valid GitHub repository in the form of "userOrOrg/repoName". Received: ${JSON.stringify(repo)}.`,
    );
  }
}
