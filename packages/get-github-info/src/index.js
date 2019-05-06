import fetch from "node-fetch";
import DataLoader from "dataloader";

function makeQuery(requests) {
  return `
      query {
        ${requests
          .map(
            ({ commit, repo }, i) =>
              `a${i}: search(
            type: ISSUE
            query: "sha:${commit}+repo:${repo}"
            first: 1
          ) {
            edges {
              node {
                ... on PullRequest {
                  number
                  author {
                    login
                  }
                }
              }
            }
          }`
          )
          .join("\n")}}
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
const GHDataLoader = new DataLoader(async requests => {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error(
      "Please create a GitHub personal access token at https://github.com/settings/tokens/new and add it to a .env file in the root of the repository"
    );
  }
  const data = await fetch(
    `https://api.github.com/graphql?access_token=${process.env.GITHUB_TOKEN}`,
    {
      method: "POST",
      body: JSON.stringify({ query: makeQuery(requests) })
    }
  ).then(x => x.json());

  // this is mainly for the case where there's an authentication problem
  if (!data.data) {
    throw new Error(
      `An error occurred when fetching data from GitHub\n${JSON.stringify(
        data
      )}`
    );
  }
  return Object.values(data.data).map(({ edges }) => {
    if (
      edges[0] &&
      edges[0].node &&
      typeof edges[0].node.number === "number" &&
      edges[0].node.author &&
      typeof edges[0].node.author.login === "string"
    ) {
      return {
        user: edges[0].node.author.login,
        number: edges[0].node.number
      };
    }
    return null;
  });
});

export async function getInfo(request) {
  if (!request.commit) {
    throw new Error("Please pass a commit SHA to getInfo");
  }

  if (!request.repo) {
    throw new Error(
      "Please pass a GitHub repository in the form of userOrOrg/repoName to getInfo"
    );
  }

  const data = await GHDataLoader.load(request);
  return {
    // TODO: fetch the username some other way if there is no PR
    // since there should generally be a GH username
    user: data === null ? null : data.user,
    pull: data === null ? null : data.number,
    links: {
      commit: `https://github.com/${request.repo}/commit/${request.commit}`,
      pull:
        data === null
          ? null
          : `https://github.com/${request.repo}/pulls/${data.number}`,
      user: data === null ? null : `https://github.com/${data.user}`
    }
  };
}
