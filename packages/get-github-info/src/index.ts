// @ts-ignore
import fetch from "node-fetch";
import DataLoader from "dataloader";

type RequestData = {
  commit: string;
  repo: string;
};

function makeQuery(repos: any) {
  return `
      query {
        ${Object.keys(repos)
          .map(
            (repo, i) =>
              `a${i}: repository(
            owner: ${JSON.stringify(repo.split("/")[0])}
            name: ${JSON.stringify(repo.split("/")[1])}
          ) {
            ${repos[repo]
              .map(
                (
                  commit: string
                ) => `a${commit}: object(expression: ${JSON.stringify(
                  commit
                )}) {
            ... on Commit {
            commitUrl
            associatedPullRequests(first: 50) {
              nodes {
                number
                url
                mergedAt
                author {
                  login
                  url
                }
              }
            }
            author {
              user {
                login
                url
              }
            }
          }}`
              )
              .join("\n")}
          }`
          )
          .join("\n")}
        }
    `;
}

// why are we using dataloader?
// it provides use with two things
// 1. caching
// since getInfo will be called inside of changeset's getReleaseLine
// and there could be a lot of release lines for a single commit
// caching is important so we don't do a bunch of requests for the same commit
// 2. batching
// getReleaseLine will be called a large number of times but it'll be called at the same time
// so instead of doing a bunch of network requests, we can do a single one.
const GHDataLoader = new DataLoader(async (requests: RequestData[]) => {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error(
      "Please create a GitHub personal access token at https://github.com/settings/tokens/new and add it as the GITHUB_TOKEN environment variable"
    );
  }
  let repos: Record<RequestData["repo"], Array<RequestData["commit"]>> = {};
  requests.forEach(({ commit, repo }) => {
    if (repos[repo] === undefined) {
      repos[repo] = [];
    }
    repos[repo].push(commit);
  });

  const data = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.GITHUB_TOKEN}`
    },
    body: JSON.stringify({ query: makeQuery(repos) })
  }).then((x: any) => x.json());

  // this is mainly for the case where there's an authentication problem
  if (!data.data) {
    throw new Error(
      `An error occurred when fetching data from GitHub\n${JSON.stringify(
        data
      )}`
    );
  }

  let cleanedData: Record<any, any> = {};
  let dataKeys = Object.keys(data.data);
  Object.keys(repos).forEach((repo, index) => {
    cleanedData[repo] = {};
    for (let nearlyCommit in data.data[dataKeys[index]]) {
      cleanedData[repo][nearlyCommit.substring(1)] =
        data.data[dataKeys[index]][nearlyCommit];
    }
  });

  return requests.map(({ repo, commit }) => cleanedData[repo][commit]);
});

export async function getInfo(
  request: RequestData
): Promise<{
  user: string | null;
  pull: number | null;
  links: {
    commit: string;
    pull: string | null;
    user: string | null;
  };
}> {
  if (!request.commit) {
    throw new Error("Please pass a commit SHA to getInfo");
  }

  if (!request.repo) {
    throw new Error(
      "Please pass a GitHub repository in the form of userOrOrg/repoName to getInfo"
    );
  }

  const data = await GHDataLoader.load(request);
  let user = null;
  if (data.author && data.author.user) {
    user = data.author.user;
  }

  let associatedPullRequest =
    data.associatedPullRequests &&
    data.associatedPullRequests.nodes &&
    data.associatedPullRequests.nodes.length
      ? (data.associatedPullRequests.nodes as any[]).sort((a, b) => {
          if (a.mergedAt === null && b.mergedAt === null) {
            return 0;
          }
          if (a.mergedAt === null) {
            return 1;
          }
          if (b.mergedAt === null) {
            return -1;
          }
          a = new Date(a.mergedAt);
          b = new Date(b.mergedAt);
          return a > b ? 1 : a < b ? -1 : 0;
        })[0]
      : null;
  if (associatedPullRequest) {
    user = associatedPullRequest.author;
  }
  return {
    user: user ? user.login : null,
    pull: associatedPullRequest ? associatedPullRequest.number : null,
    links: {
      commit: `[\`${request.commit}\`](${data.commitUrl})`,
      pull: associatedPullRequest
        ? `[#${associatedPullRequest.number}](${associatedPullRequest.url})`
        : null,
      user: user ? `[@${user.login}](${user.url})` : null
    }
  };
}
