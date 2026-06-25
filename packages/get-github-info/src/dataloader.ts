import DataLoader from "dataloader";
import { readEnv } from "./env.ts";

/*
  Why are we using dataloader? It provides us with two things:

  1. Caching - Since there could be many release lines for a single commit,
     caching prevents us from making multiple requests for the same commit.

  2. Batching - Multiple release lines may be called simulataneously, and
     batching allows us to make a single network request instead of many.
*/

interface CommitInput {
  kind: "commit";
  commit: string;
  repo: string;
}

interface PullInput {
  kind: "pull";
  pull: number;
  repo: string;
}

// TODO: Look into auto-generating this
interface CommitOutput {
  commitUrl: string;
  associatedPullRequests: {
    nodes: Array<{
      number: number;
      url: string;
      mergedAt: string | null;
      author: {
        login: string;
        url: string;
      } | null;
    }>;
  };
  author: {
    user: {
      login: string;
      url: string;
    } | null;
  } | null;
}

// TODO: Look into auto-generating this
interface PullOutput {
  url: string;
  author: {
    login: string;
    url: string;
  } | null;
  mergeCommit: {
    commitUrl: string;
    abbreviatedOid: string;
  } | null;
}

// Set maxBatchSize to 50 to prevent potentially sending a massive query and hitting rate limits
const GHDataLoader = new DataLoader(batchLoad, { maxBatchSize: 50 });

export async function loadCommitData(options: Omit<CommitInput, "kind">) {
  const result = await GHDataLoader.load({ ...options, kind: "commit" });
  return result as CommitOutput | null;
}

export async function loadPullData(options: Omit<PullInput, "kind">) {
  const result = await GHDataLoader.load({ ...options, kind: "pull" });
  return result as PullOutput | null;
}

async function batchLoad(
  requests: ReadonlyArray<CommitInput | PullInput>,
): Promise<Array<CommitOutput | PullOutput | Error>> {
  const { GITHUB_GRAPHQL_URL, GITHUB_SERVER_URL, GITHUB_TOKEN } =
    await readEnv();
  if (!GITHUB_TOKEN) {
    throw new Error(
      `Please create a GitHub personal access token at ${GITHUB_SERVER_URL}/settings/tokens/new?scopes=read:user,repo:status&description=changesets-${new Date()
        .toISOString()
        .substring(
          0,
          10,
        )} with \`read:user\` and \`repo:status\` permissions and add it as the GITHUB_TOKEN environment variable`,
    );
  }
  const repos: ReposWithCommitsAndPRsToFetch = {};
  requests.forEach(({ repo, ...data }) => {
    repos[repo] ??= [];
    repos[repo].push(data);
  });

  let fetchResponse;
  try {
    fetchResponse = await fetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${GITHUB_TOKEN}`,
      },
      body: JSON.stringify({ query: makeQuery(repos) }),
    });
  } catch (e) {
    throw new Error("Failed to fetch data from GitHub", { cause: e });
  }

  let data: { errors?: unknown; data?: Record<string, unknown> };
  try {
    data = (await fetchResponse.json()) as {
      errors?: unknown;
      data?: Record<string, unknown>;
    };
  } catch (e) {
    throw new Error("Failed to parse data from GitHub", { cause: e });
  }

  if (data.errors) {
    throw new Error(
      `Fetched data from GitHub returned errors\n${JSON.stringify(data.errors, null, 2)}`,
    );
  }

  // this is mainly for the case where there's an authentication problem
  if (!data.data) {
    throw new Error(
      `Fetched data from GitHub has missing data\n${JSON.stringify(data)}`,
    );
  }

  const repoNames = Object.keys(repos);
  return requests.map((request) => {
    const repoKey = `repo__${repoNames.indexOf(request.repo)}`;
    const dataKey = `${request.kind}__${request.kind === "pull" ? request.pull : request.commit}`;
    return (data.data![repoKey] as any)?.[dataKey];
  });
}

type ReposWithCommitsAndPRsToFetch = Record<
  string,
  ({ kind: "commit"; commit: string } | { kind: "pull"; pull: number })[]
>;

function makeQuery(repos: ReposWithCommitsAndPRsToFetch) {
  let query = "query {\n";
  let needsCommitFragment = false;
  let needsPullFragment = false;

  const repoNames = Object.keys(repos);
  for (let i = 0; i < repoNames.length; i++) {
    const repoData = repos[repoNames[i]];
    const [owner, name] = repoNames[i].split("/");

    query += `\
  repo__${i}: repository(
    owner: ${JSON.stringify(owner)},
    name: ${JSON.stringify(name)}
  ) {\n`;

    for (const data of repoData) {
      if (data.kind === "commit") {
        needsCommitFragment = true;
        query += `\
    commit__${data.commit}: object(expression: ${JSON.stringify(data.commit)}) {
      ... on Commit {
        ...CommitFragment
      }
    }\n`;
      } else if (data.kind === "pull") {
        needsPullFragment = true;
        query += `\
    pull__${data.pull}: pullRequest(number: ${JSON.stringify(data.pull)}) {
      ...PullFragment
    }\n`;
      }
    }

    query += "  }\n";
  }

  query += "}\n";

  if (needsCommitFragment) {
    query += `\
fragment CommitFragment on Commit {
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
}\n`;
  }

  if (needsPullFragment) {
    query += `\
fragment PullFragment on PullRequest {
  url
  author {
    login
    url
  }
  mergeCommit {
    commitUrl
    abbreviatedOid
  }
}\n`;
  }

  return query;
}
