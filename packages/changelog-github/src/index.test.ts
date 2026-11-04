import * as getGithubInfo from "@changesets/get-github-info";
import { parseChangesetFile as parse } from "@changesets/parse";
import type { ModCompWithPackage } from "@changesets/types";
import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import changelogFunctions, { INLINE_OVERRIDE_KEYWORDS } from "./index.ts";

vi.mock("@changesets/get-github-info");
const mockedGetGithubInfo = vi.mocked(getGithubInfo);

function mdLink(text: string, url: string) {
  return `[${text}](${url})`;
}

const getReleaseLine = changelogFunctions.getReleaseLine;
const getDependencyReleaseLine = changelogFunctions.getDependencyReleaseLine;

afterEach(() => {
  vi.unstubAllEnvs();
});

type Data = { commit?: string; pull?: number; author?: string; repo?: string };
const defaults = {
  commit: "a085003",
  pull: 1613,
  author: "Andarist",
  repo: "emotionjs/emotion",
} satisfies Data;

const buildUrls = (input: Data) => {
  const data = { ...defaults, ...input };
  return {
    commit: `https://github.com/${data.repo}/commit/${data.commit}`,
    pull: `https://github.com/${data.repo}/pull/${data.pull}`,
    author: `https://github.com/${data.author}`,
  };
};
const buildMdLinks = (input: Data = {}) => {
  const data = { ...defaults, ...input };
  const urls = buildUrls(data);

  return {
    commit: mdLink(`\`${data.commit.slice(0, 7)}\``, urls.commit),
    pull: mdLink(`#${data.pull}`, urls.pull),
    author: mdLink(`@${data.author}`, urls.author),
  };
};

beforeEach(() => {
  mockedGetGithubInfo.getPullRequestInfo.mockImplementation(
    async ({ pull, repo }) => {
      const urls = buildUrls({ pull, repo });
      const mdLinks = buildMdLinks({ pull, repo });

      return {
        commit: {
          sha: data.commit,
          url: urls.commit,
          markdownLink: mdLinks.commit,
        },
        author: {
          login: "Andarist",
          url: urls.author,
          markdownLink: mdLinks.author,
        },
        pull: {
          number: data.pull,
          url: urls.pull,
          markdownLink: mdLinks.pull,
        },
      };
    },
  );

  mockedGetGithubInfo.getCommitInfo.mockImplementation(
    async ({ commit, repo }) => {
      const urls = buildUrls({ commit, repo });
      const mdLinks = buildMdLinks({ commit, repo });

      return {
        commit: {
          sha: data.commit,
          url: urls.commit,
          markdownLink: mdLinks.commit,
        },
        author: {
          login: data.user,
          url: urls.author,
          markdownLink: mdLinks.author,
        },
        pull: {
          number: data.pull,
          url: urls.pull,
          markdownLink: mdLinks.pull,
        },
      };
    },
  );
});

const createChangeset = (content: string, commit: string | undefined) => {
  return [
    {
      ...parse(
        `
---
pkg: "minor"
---

something
${content}
`.trim(),
      ),
      id: "some-id",
      commit,
    },
    "minor",
    { repo: data.repo },
  ] as const;
};

const data = {
  commit: "a085003",
  user: "Andarist",
  pull: 1613,
  repo: "emotion-js/emotion",
};

it("uses GITHUB_REPOSITORY when repo option is absent", async () => {
  vi.stubEnv("GITHUB_REPOSITORY", data.repo);
  const [changeset, releaseType] = createChangeset("", data.commit);

  expect(await getReleaseLine(changeset, releaseType, null)).toEqual(
    `\n\n- [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something\n`,
  );
});

it("uses explicit repo option before GITHUB_REPOSITORY", async () => {
  vi.stubEnv("GITHUB_REPOSITORY", "other/repo");

  expect(await getReleaseLine(...createChangeset("", data.commit))).toEqual(
    `\n\n- [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something\n`,
  );
});

it("uses GITHUB_REPOSITORY for dependency release lines", async () => {
  vi.stubEnv("GITHUB_REPOSITORY", data.repo);

  const changeset = {
    ...parse(
      `---
  pkg: "minor"
  ---

  something
  `,
    ),
    id: "some-id",
    commit: data.commit,
  };

  const dependency: ModCompWithPackage = {
    name: "pkg",
    type: "patch",
    oldVersion: "0.0.1",
    newVersion: "1.0.0",
    changesets: [],
    dir: "/repo/pkg",
    packageJson: {
      name: "pkg",
      version: "0.0.1",
    },
  };

  expect(await getDependencyReleaseLine([changeset], [dependency], null))
    .toMatchInlineSnapshot(`
    "- Updated dependencies [[\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003)]:
      - pkg@1.0.0"
  `);
});

describe("data overrides", () => {
  describe("author", () => {
    describe("inline", () => {
      test.each([...INLINE_OVERRIDE_KEYWORDS.author, "author with @"] as const)(
        "extracts and uses `%s`",
        async (type) => {
          const summary = `
some cool changes!
${type.split(" ")[0]}: ${type.includes("with @") ? "@" : ""}foo
`.trim();

          const result = await getReleaseLine(
            ...createChangeset(summary, data.commit),
          );
          expect(result).not.toContain(data.user);
          expect(result).toContain("Thanks [@foo]");
          expect(result).not.toContain("Thanks [foo]");
        },
      );
    });
  });

  describe("commit", () => {
    describe("inline", () => {
      test.each(INLINE_OVERRIDE_KEYWORDS.commit)(
        "extracts and uses `%s`",
        async (keyword) => {
          const summary = `
some cool changes!
${keyword}: abcdefg
`.trim();

          const result = await getReleaseLine(
            ...createChangeset(summary, data.commit),
          );
          expect(result).not.toContain(defaults.commit);
          expect(result).toContain("Thanks [@Andarist]");
          expect(result).toContain("/abcdefg");
        },
      );
    });
  });

  describe("pull request", () => {
    describe("inline", () => {
      test.each([...INLINE_OVERRIDE_KEYWORDS.pull, "pull with #"])(
        "extracts and uses `%s`",
        async (keyword) => {
          const summary = `
some cool changes!
${keyword.split(" ")[0]}: ${keyword.includes("with #") ? "#1337" : "1337"}
`.trim();

          const result = await getReleaseLine(
            ...createChangeset(summary, data.commit),
          );
          expect(result).not.toContain(defaults.pull);
          expect(result).toContain("Thanks [@Andarist]");
          expect(result).toContain("[#1337]");
        },
      );
    });
  });

  it("extracts and uses multiple inline overrides", async () => {
    const summary = `
some cool changes!
user: foo
pr: 1337
`.trim();

    const result = await getReleaseLine(
      ...createChangeset(summary, data.commit),
    );
    expect(result).not.toContain(data.user);
    expect(result).not.toContain(data.pull);
    expect(result).toContain("Thanks [@foo]");
    expect(result).toContain("[#1337]");
  });
});

it("linkifies bare issue references", async () => {
  expect(
    await getReleaseLine(
      ...createChangeset("fixes #1234 and #5678", data.commit),
    ),
  ).toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
      fixes [#1234](https://github.com/emotion-js/emotion/issues/1234) and [#5678](https://github.com/emotion-js/emotion/issues/5678)"
  `);
});

it("does not double-linkify existing markdown links", async () => {
  expect(
    await getReleaseLine(
      ...createChangeset(
        "see [#1234](https://github.com/emotion-js/emotion/issues/1234)",
        data.commit,
      ),
    ),
  ).toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
      see [#1234](https://github.com/emotion-js/emotion/issues/1234)"
  `);
});

it("does not linkify issue-like refs inside link text", async () => {
  expect(
    await getReleaseLine(
      ...createChangeset("see [fix for #99](https://example.com)", data.commit),
    ),
  ).toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
      see [fix for #99](https://example.com)"
  `);
});

it("does not linkify when preceded by a word character", async () => {
  expect(await getReleaseLine(...createChangeset("foo#123", data.commit)))
    .toMatchInlineSnapshot(`
      "

      - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        foo#123"
    `);
});

it("does not linkify #0", async () => {
  expect(await getReleaseLine(...createChangeset("see #0", data.commit)))
    .toMatchInlineSnapshot(`
      "

      - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        see #0"
    `);
});

it("linkifies issue ref at the start of a line", async () => {
  expect(await getReleaseLine(...createChangeset("#42 was fixed", data.commit)))
    .toMatchInlineSnapshot(`
      "

      - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        [#42](https://github.com/emotion-js/emotion/issues/42) was fixed"
    `);
});

it("linkifies issue ref after punctuation", async () => {
  expect(await getReleaseLine(...createChangeset("fixed (#99)", data.commit)))
    .toMatchInlineSnapshot(`
      "

      - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        fixed ([#99](https://github.com/emotion-js/emotion/issues/99))"
    `);
});

it("handles mixed linked and bare refs", async () => {
  expect(
    await getReleaseLine(
      ...createChangeset(
        "fixes [#1](https://github.com/emotion-js/emotion/issues/1) and #2",
        data.commit,
      ),
    ),
  ).toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
      fixes [#1](https://github.com/emotion-js/emotion/issues/1) and [#2](https://github.com/emotion-js/emotion/issues/2)"
  `);
});

it("linkifies issue ref followed by a dot", async () => {
  expect(
    await getReleaseLine(...createChangeset("this fixes #42.", data.commit)),
  ).toMatchInlineSnapshot(`
      "

      - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        this fixes [#42](https://github.com/emotion-js/emotion/issues/42)."
    `);
});

it("with multiple authors", async () => {
  expect(
    await getReleaseLine(
      ...createChangeset(
        ["author: @Andarist", "author: @mitchellhamilton"].join("\n"),
        data.commit,
      ),
    ),
  ).toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist), [@mitchellhamilton](https://github.com/mitchellhamilton)! - something
    "
  `);
});

it("disables thanks if disableThanks is enabled", async () => {
  const [changeset, releaseType, options] = createChangeset(
    "author: @Andarist",
    data.commit,
  );
  expect(
    await getReleaseLine(changeset, releaseType, {
      ...options,
      disableThanks: true,
    }),
  ).toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) - something
    "
  `);
});

describe("template option (compact reproduction)", () => {
  const compactOpts = {
    repo: data.repo,
    template: "\n- {summary} {ref}",
  };

  it("renders the compact single-line form with PR ref", async () => {
    const changeset = {
      id: "x",
      summary: "fix the thing",
      releases: [{ name: "pkg", type: "minor" as const }],
      commit: data.commit,
    };
    expect(await getReleaseLine(changeset, "minor", compactOpts)).toBe(
      "\n- fix the thing ([#1613](https://github.com/emotion-js/emotion/pull/1613))\n",
    );
  });

  it("keeps multi-line summaries: first line templated, rest indented", async () => {
    const changeset = {
      id: "x",
      summary: "first line\nsecond line",
      releases: [{ name: "pkg", type: "minor" as const }],
      commit: data.commit,
    };
    expect(await getReleaseLine(changeset, "minor", compactOpts)).toBe(
      "\n- first line ([#1613](https://github.com/emotion-js/emotion/pull/1613))\n  second line",
    );
  });

  it("omits attribution because no token references it", async () => {
    const changeset = {
      id: "x",
      summary: "fix the thing",
      releases: [{ name: "pkg", type: "minor" as const }],
      commit: data.commit,
    };
    const line = await getReleaseLine(changeset, "minor", compactOpts);
    expect(line).not.toContain("Thanks");
  });

  it("renders attribution from literal text plus {authors}", async () => {
    const changeset = {
      id: "x",
      summary: "fix the thing",
      releases: [{ name: "pkg", type: "minor" as const }],
      commit: data.commit,
    };
    expect(
      await getReleaseLine(changeset, "minor", {
        repo: data.repo,
        template: "\n- {summary} Thanks {authors}!",
      }),
    ).toBe(
      "\n- fix the thing Thanks [@Andarist](https://github.com/Andarist)!\n",
    );
  });

  it("renders {authors} without the word Thanks", async () => {
    const changeset = {
      id: "x",
      summary: "fix the thing",
      releases: [{ name: "pkg", type: "minor" as const }],
      commit: data.commit,
    };
    expect(
      await getReleaseLine(changeset, "minor", {
        repo: data.repo,
        template: "\n- {summary} {authors}",
      }),
    ).toBe("\n- fix the thing [@Andarist](https://github.com/Andarist)\n");
  });

  it("trims a trailing space left by an empty trailing token", async () => {
    const changeset = {
      id: "x",
      summary: "fix the thing",
      releases: [{ name: "pkg", type: "minor" as const }],
      commit: undefined,
    };
    expect(
      await getReleaseLine(changeset, "minor", {
        repo: data.repo,
        template: "\n- {summary} {ref}",
      }),
    ).toBe("\n- fix the thing\n");
  });
});

describe("{summary} token", () => {
  const changeset = {
    id: "x",
    summary: "did a thing (fixes #99) and also #1234",
    releases: [{ name: "pkg", type: "minor" as const }],
    commit: data.commit,
  };

  it("{summary} links every bare #n", async () => {
    const line = await getReleaseLine(changeset, "minor", {
      repo: data.repo,
      template: "\n- {summary}",
    });
    expect(line).toContain(
      "[#1234](https://github.com/emotion-js/emotion/issues/1234)",
    );
    expect(line).toContain(
      "[#99](https://github.com/emotion-js/emotion/issues/99)",
    );
  });
});

// Locks the template/output examples shown in docs/config-file-options.md so
// they cannot drift. Mock data renders PR #1613, commit a085003, @Andarist.
describe("documented template examples", () => {
  const pr = "[#1613](https://github.com/emotion-js/emotion/pull/1613)";
  const commit =
    "[`a085003`](https://github.com/emotion-js/emotion/commit/a085003)";
  const author = "[@Andarist](https://github.com/Andarist)";

  it.each([
    [
      "\n- {pull} {commit} Thanks {authors}! - {summary}",
      `\n- ${pr} ${commit} Thanks ${author}! - fix the thing\n`,
    ],
    ["\n- {summary} {ref}", `\n- fix the thing (${pr})\n`],
    [
      "\n- {summary} (thanks {authors}!)",
      `\n- fix the thing (thanks ${author}!)\n`,
    ],
    ["\n- {summary} {pull}", `\n- fix the thing ${pr}\n`],
  ])("template %p renders %p", async (template, expected) => {
    const changeset = {
      id: "x",
      summary: "fix the thing",
      releases: [{ name: "pkg", type: "minor" as const }],
      commit: data.commit,
    };
    expect(
      await getReleaseLine(changeset, "minor", { repo: data.repo, template }),
    ).toBe(expected);
  });
});
