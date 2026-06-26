import nock from "nock";
import { expect, test, beforeEach, afterEach, vi } from "vitest";
import { getCommitInfo } from "./get-commit-info.ts";

const apiPath = `/graphql`;

beforeEach(() => {
  vi.stubEnv("GITHUB_TOKEN", "token");
  nock.disableNetConnect();
});

afterEach(() => {
  vi.unstubAllEnvs();
  nock.cleanAll();
  nock.enableNetConnect();
});

test("throws error on invalid repo name", async () => {
  await expect(() =>
    getCommitInfo({
      commit: "c7e9c69",
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
    .reply(
      200,
      JSON.stringify({ data: { repo__0: { commit__a085003: null } } }),
    );

  const result = await getCommitInfo({
    commit: "a085003",
    repo: "emotion-js/emotion",
  });
  expect(result).toBeUndefined();
});

test("associated with multiple PRs with only one merged", async () => {
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
            commit__a085003: {
              commitUrl:
                "https://github.com/emotion-js/emotion/commit/a085003d4c8ca284c116668d7217fb747802ed85",
              associatedPullRequests: {
                nodes: [
                  {
                    number: 973,
                    url: "https://github.com/emotion-js/emotion/pull/973",
                    mergedAt: null,
                    author: {
                      login: "mitchellhamilton",
                      url: "https://github.com/mitchellhamilton",
                    },
                  },
                  {
                    number: 1600,
                    url: "https://github.com/emotion-js/emotion/pull/1600",
                    mergedAt: null,
                    author: {
                      login: "mitchellhamilton",
                      url: "https://github.com/mitchellhamilton",
                    },
                  },
                  {
                    number: 1613,
                    url: "https://github.com/emotion-js/emotion/pull/1613",
                    mergedAt: "2019-11-07T06:43:58Z",
                    author: {
                      login: "Andarist",
                      url: "https://github.com/Andarist",
                    },
                  },
                  {
                    number: 1628,
                    url: "https://github.com/emotion-js/emotion/pull/1628",
                    mergedAt: null,
                    author: {
                      login: "Andarist",
                      url: "https://github.com/Andarist",
                    },
                  },
                  {
                    number: 1630,
                    url: "https://github.com/emotion-js/emotion/pull/1630",
                    mergedAt: null,
                    author: {
                      login: "Andarist",
                      url: "https://github.com/Andarist",
                    },
                  },
                ],
              },
              author: {
                user: {
                  login: "Andarist",
                  url: "https://github.com/Andarist",
                },
              },
            },
          },
        },
      }),
    );

  const result = await getCommitInfo({
    commit: "a085003",
    repo: "emotion-js/emotion",
  });
  expect(result).toMatchInlineSnapshot(`
    {
      "author": {
        "login": "Andarist",
        "markdownLink": "[@Andarist](https://github.com/Andarist)",
        "url": "https://github.com/Andarist",
      },
      "commit": {
        "markdownLink": "[\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003d4c8ca284c116668d7217fb747802ed85)",
        "sha": "a085003",
        "url": "https://github.com/emotion-js/emotion/commit/a085003d4c8ca284c116668d7217fb747802ed85",
      },
      "pull": {
        "markdownLink": "[#1613](https://github.com/emotion-js/emotion/pull/1613)",
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
        commit__a085003: object(expression: "a085003") {
          ... on Commit {
            ...CommitFragment
          }
        }
      }
    }
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
    }
    "
  `);
});

test("associated with multiple PRs with multiple merged gets the one that was merged first", async () => {
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
            commit__a085003: {
              commitUrl:
                "https://github.com/emotion-js/emotion/commit/a085003d4c8ca284c116668d7217fb747802ed85",
              associatedPullRequests: {
                nodes: [
                  {
                    number: 973,
                    url: "https://github.com/emotion-js/emotion/pull/973",
                    mergedAt: null,
                    author: {
                      login: "mitchellhamilton",
                      url: "https://github.com/mitchellhamilton",
                    },
                  },
                  {
                    number: 1600,
                    url: "https://github.com/emotion-js/emotion/pull/1600",
                    mergedAt: "2019-11-20T06:43:58Z",
                    author: {
                      login: "mitchellhamilton",
                      url: "https://github.com/mitchellhamilton",
                    },
                  },
                  {
                    number: 1613,
                    url: "https://github.com/emotion-js/emotion/pull/1613",
                    mergedAt: "2019-11-07T06:43:58Z",
                    author: {
                      login: "Andarist",
                      url: "https://github.com/Andarist",
                    },
                  },
                  {
                    number: 1628,
                    url: "https://github.com/emotion-js/emotion/pull/1628",
                    mergedAt: null,
                    author: {
                      login: "Andarist",
                      url: "https://github.com/Andarist",
                    },
                  },
                  {
                    number: 1630,
                    url: "https://github.com/emotion-js/emotion/pull/1630",
                    mergedAt: null,
                    author: {
                      login: "Andarist",
                      url: "https://github.com/Andarist",
                    },
                  },
                ],
              },
              author: {
                user: {
                  login: "Andarist",
                  url: "https://github.com/Andarist",
                },
              },
            },
          },
        },
      }),
    );

  const result = await getCommitInfo({
    commit: "a085003",
    repo: "emotion-js/emotion",
  });
  expect(result).toMatchInlineSnapshot(`
    {
      "author": {
        "login": "Andarist",
        "markdownLink": "[@Andarist](https://github.com/Andarist)",
        "url": "https://github.com/Andarist",
      },
      "commit": {
        "markdownLink": "[\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003d4c8ca284c116668d7217fb747802ed85)",
        "sha": "a085003",
        "url": "https://github.com/emotion-js/emotion/commit/a085003d4c8ca284c116668d7217fb747802ed85",
      },
      "pull": {
        "markdownLink": "[#1613](https://github.com/emotion-js/emotion/pull/1613)",
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
        commit__a085003: object(expression: "a085003") {
          ... on Commit {
            ...CommitFragment
          }
        }
      }
    }
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
    }
    "
  `);
});

test("gets the author of the associated pull request if it exists rather than the author of the commit", async () => {
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
            commit__c7e9c69: {
              commitUrl:
                "https://github.com/JedWatson/react-select/commit/c7e9c697dada15ce3ff9a767bf914ad890080433",
              associatedPullRequests: {
                nodes: [
                  {
                    number: 3682,
                    url: "https://github.com/JedWatson/react-select/pull/3682",
                    mergedAt: "2019-10-02T07:37:15Z",
                    author: {
                      login: "lmvco",
                      url: "https://github.com/lmvco",
                    },
                  },
                ],
              },
              author: {
                user: {
                  login: "JedWatson",
                  url: "https://github.com/JedWatson",
                },
              },
            },
          },
        },
      }),
    );

  const result = await getCommitInfo({
    commit: "c7e9c69",
    repo: "JedWatson/react-select",
  });
  expect(result).toMatchInlineSnapshot(`
    {
      "author": {
        "login": "lmvco",
        "markdownLink": "[@lmvco](https://github.com/lmvco)",
        "url": "https://github.com/lmvco",
      },
      "commit": {
        "markdownLink": "[\`c7e9c69\`](https://github.com/JedWatson/react-select/commit/c7e9c697dada15ce3ff9a767bf914ad890080433)",
        "sha": "c7e9c69",
        "url": "https://github.com/JedWatson/react-select/commit/c7e9c697dada15ce3ff9a767bf914ad890080433",
      },
      "pull": {
        "markdownLink": "[#3682](https://github.com/JedWatson/react-select/pull/3682)",
        "number": 3682,
        "url": "https://github.com/JedWatson/react-select/pull/3682",
      },
    }
  `);

  expect(githubQuery).toMatchInlineSnapshot(`
    "query {
      repo__0: repository(
        owner: "JedWatson",
        name: "react-select"
      ) {
        commit__c7e9c69: object(expression: "c7e9c69") {
          ... on Commit {
            ...CommitFragment
          }
        }
      }
    }
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
    }
    "
  `);
});

test("uses custom GITHUB_GRAPHQL_URL when set", async () => {
  let githubQuery = "";
  vi.stubEnv("GITHUB_GRAPHQL_URL", "https://custom.github.com/api/graphql");

  nock("https://custom.github.com", {
    reqheaders: {
      Authorization: `Token ${process.env.GITHUB_TOKEN}`,
    },
  })
    .post("/api/graphql", ({ query }) => {
      githubQuery = query;
      return true;
    })
    .reply(
      200,
      JSON.stringify({
        data: {
          repo__0: {
            commit__a085003: {
              commitUrl:
                "https://custom.github.com/emotion-js/emotion/commit/a085003d4c8ca284c116668d7217fb747802ed85",
              associatedPullRequests: {
                nodes: [
                  {
                    number: 1613,
                    url: "https://custom.github.com/emotion-js/emotion/pull/1613",
                    mergedAt: "2019-11-07T06:43:58Z",
                    author: {
                      login: "Andarist",
                      url: "https://custom.github.com/Andarist",
                    },
                  },
                ],
              },
              author: {
                user: {
                  login: "Andarist",
                  url: "https://custom.github.com/Andarist",
                },
              },
            },
          },
        },
      }),
    );

  const result = await getCommitInfo({
    commit: "a085003",
    repo: "emotion-js/emotion",
  });
  expect(result).toMatchInlineSnapshot(`
      {
        "author": {
          "login": "Andarist",
          "markdownLink": "[@Andarist](https://custom.github.com/Andarist)",
          "url": "https://custom.github.com/Andarist",
        },
        "commit": {
          "markdownLink": "[\`a085003\`](https://custom.github.com/emotion-js/emotion/commit/a085003d4c8ca284c116668d7217fb747802ed85)",
          "sha": "a085003",
          "url": "https://custom.github.com/emotion-js/emotion/commit/a085003d4c8ca284c116668d7217fb747802ed85",
        },
        "pull": {
          "markdownLink": "[#1613](https://custom.github.com/emotion-js/emotion/pull/1613)",
          "number": 1613,
          "url": "https://custom.github.com/emotion-js/emotion/pull/1613",
        },
      }
    `);
  expect(githubQuery).toMatchInlineSnapshot(`
      "query {
        repo__0: repository(
          owner: "emotion-js",
          name: "emotion"
        ) {
          commit__a085003: object(expression: "a085003") {
            ... on Commit {
              ...CommitFragment
            }
          }
        }
      }
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
      }
      "
    `);
});
