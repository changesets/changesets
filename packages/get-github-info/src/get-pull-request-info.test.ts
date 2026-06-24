import nock from "nock";
import { expect, test, beforeEach, afterEach } from "vitest";
import { getPullRequestInfo } from "./get-pull-request-info.ts";

process.env.GITHUB_TOKEN = "token";

const apiPath = `/graphql`;

beforeEach(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
  nock.enableNetConnect();
});

test("throws error on invalid repo name", async () => {
  await expect(() =>
    getPullRequestInfo({
      pull: 1613,
      repo: "https://github.com/JedWatson/react-select",
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Please pass a valid GitHub repository in the form of "userOrOrg/repoName". Received: "https://github.com/JedWatson/react-select".]`,
  );
});

test("handles missing commit data", async () => {
  nock("https://api.github.com", {
    reqheaders: {
      Authorization: `Token ${process.env.GITHUB_TOKEN}`,
    },
  })
    .post(apiPath)
    .reply(200, JSON.stringify({ data: { repo__0: { pull__1613: null } } }));

  const result = await getPullRequestInfo({
    pull: 1613,
    repo: "emotion-js/emotion",
  });
  expect(result).toBeUndefined();
});

test("returns pull request info", async () => {
  let githubQuery = "";

  nock("https://api.github.com", {
    reqheaders: {
      Authorization: `Token ${process.env.GITHUB_TOKEN}`,
    },
  })
    .post(apiPath, ({ query }) => {
      githubQuery = query;
      return true;
    })
    .reply(
      200,
      JSON.stringify({
        data: {
          repo__0: {
            pull__1613: {
              url: "https://github.com/emotion-js/emotion/pull/1613",
              author: {
                login: "Andarist",
                url: "https://github.com/Andarist",
              },
              mergeCommit: {
                commitUrl:
                  "https://github.com/emotion-js/emotion/commit/a085003d4c8ca284c116668d7217fb747802ed85",
                abbreviatedOid: "a085003",
              },
            },
          },
        },
      }),
    );

  const result = await getPullRequestInfo({
    pull: 1613,
    repo: "emotion-js/emotion",
  });
  expect(result).toMatchInlineSnapshot(`
    {
      "author": {
        "login": "Andarist",
        "url": "https://github.com/Andarist",
      },
      "commit": {
        "sha": "a085003",
        "url": "https://github.com/emotion-js/emotion/commit/a085003d4c8ca284c116668d7217fb747802ed85",
      },
      "pull": {
        "number": 1613,
        "url": "https://github.com/emotion-js/emotion/pull/1613",
      },
    }
  `);

  expect(githubQuery).toMatchInlineSnapshot(`
    "query {
      repo__0: repository(
        owner: "emotion-js",
        name: "emotion"
      ) {
        pull__1613: pullRequest(number: 1613) {
          ...PullFragment
        }
      }
    }
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
    }
    "
  `);
});
