import * as getGithubInfo from "@changesets/get-github-info";
import { parseChangesetFile as parse } from "@changesets/parse";
import type { ModCompWithPackage } from "@changesets/types";
import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import changelogFunctions from "./index.ts";
import { mdLink } from "./utils.ts";

vi.mock("@changesets/get-github-info");
const mockedGetGithubInfo = vi.mocked(getGithubInfo);

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
  repo: "emotion-js/emotion",
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
          sha: defaults.commit,
          url: urls.commit,
          markdownLink: mdLinks.commit,
        },
        author: {
          login: "Andarist",
          url: urls.author,
          markdownLink: mdLinks.author,
        },
        pull: {
          number: defaults.pull,
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
          sha: defaults.commit,
          url: urls.commit,
          markdownLink: mdLinks.commit,
        },
        author: {
          login: defaults.author,
          url: urls.author,
          markdownLink: mdLinks.author,
        },
        pull: {
          number: defaults.pull,
          url: urls.pull,
          markdownLink: mdLinks.pull,
        },
      };
    },
  );
});

const defaultRepo = { repo: defaults.repo };

type Opts = {
  content?: string;
  suffix?: string;
  commit?: string;
  frontmatter?: string;
};
function createChangeset({
  content = "something",
  suffix = "",
  commit = defaults.commit,
  frontmatter = "",
}: Opts = {}) {
  const data = parse(
    `
---
pkg: "minor"
${frontmatter}
---

${content}
${suffix}
`.trim(),
  );

  return {
    ...data,
    id: "some-id",
    commit,
  };
}

describe("GITHUB_REPOSITORY", () => {
  it("uses GITHUB_REPOSITORY when repo option is absent", async () => {
    vi.stubEnv("GITHUB_REPOSITORY", defaults.repo);

    const promise = getReleaseLine(createChangeset(), "minor", null);
    await expect(promise).resolves.toEqual(
      `\n\n- [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something\n`,
    );
  });

  it("uses explicit repo option before GITHUB_REPOSITORY", async () => {
    vi.stubEnv("GITHUB_REPOSITORY", "other/repo");

    const promise = getReleaseLine(createChangeset(), "minor", defaultRepo);
    await expect(promise).resolves.toEqual(
      `\n\n- [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something\n`,
    );
  });

  it("uses GITHUB_REPOSITORY for dependency release lines", async () => {
    vi.stubEnv("GITHUB_REPOSITORY", defaults.repo);

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

    const promise = getDependencyReleaseLine(
      [createChangeset()],
      [dependency],
      null,
    );
    await expect(promise).resolves.toMatchInlineSnapshot(`
      "- Updated dependencies [[\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003)]:
        - pkg@1.0.0"
    `);
  });
});

describe("data overrides", () => {
  it("extracts and uses author override", async () => {
    const promise = getReleaseLine(
      createChangeset({ frontmatter: `_:\n  author: foo` }),
      "minor",
      defaultRepo,
    );
    await expect(promise).resolves.not.toContain(defaults.author);
    await expect(promise).resolves.toContain("Thanks [@foo]");
    await expect(promise).resolves.not.toContain("Thanks [foo]");
  });

  it("extracts and uses commit override", async () => {
    const promise = getReleaseLine(
      createChangeset({ frontmatter: `_:\n  commit: abcdefg` }),
      "minor",
      defaultRepo,
    );
    await expect(promise).resolves.not.toContain(defaults.commit);
    await expect(promise).resolves.toContain("Thanks [@Andarist]");
    await expect(promise).resolves.toContain("/abcdefg");
  });

  it("extracts and uses pr override", async () => {
    const promise = getReleaseLine(
      createChangeset({ frontmatter: `_:\n  pr: 1337` }),
      "minor",
      defaultRepo,
    );
    await expect(promise).resolves.not.toContain(defaults.pull);
    await expect(promise).resolves.toContain("Thanks [@Andarist]");
    await expect(promise).resolves.toContain("#1337");
  });

  it("extracts and uses multiple overrides", async () => {
    const promise = getReleaseLine(
      createChangeset({ frontmatter: `_:\n  author: foo\n  pr: 1337` }),
      "minor",
      defaultRepo,
    );
    await expect(promise).resolves.not.toContain(defaults.author);
    await expect(promise).resolves.not.toContain(defaults.pull);
    await expect(promise).resolves.toContain("Thanks [@foo]");
    await expect(promise).resolves.toContain("[#1337]");
  });
});

describe("linkify", () => {
  it("linkifies issue ref followed by a dot", async () => {
    const promise = getReleaseLine(
      createChangeset({ suffix: "this fixes #42." }),
      "minor",
      defaultRepo,
    );
    await expect(promise).resolves.toMatchInlineSnapshot(`
      "

      - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        this fixes [#42](https://github.com/emotion-js/emotion/issues/42)."
    `);
  });

  it("linkifies bare issue references", async () => {
    const promise = getReleaseLine(
      createChangeset({ suffix: "fixes #1234 and #5678" }),
      "minor",
      defaultRepo,
    );
    await expect(promise).resolves.toMatchInlineSnapshot(`
      "

      - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        fixes [#1234](https://github.com/emotion-js/emotion/issues/1234) and [#5678](https://github.com/emotion-js/emotion/issues/5678)"
    `);
  });

  it("does not double-linkify existing markdown links", async () => {
    const promise = getReleaseLine(
      createChangeset({
        suffix:
          "see [#1234](https://github.com/emotion-js/emotion/issues/1234)",
      }),
      "minor",
      defaultRepo,
    );
    await expect(promise).resolves.toMatchInlineSnapshot(`
      "

      - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        see [#1234](https://github.com/emotion-js/emotion/issues/1234)"
    `);
  });

  it("does not linkify issue-like refs inside link text", async () => {
    const promise = getReleaseLine(
      createChangeset({ suffix: "see [fix for #99](https://example.com)" }),
      "minor",
      defaultRepo,
    );
    await expect(promise).resolves.toMatchInlineSnapshot(`
      "

      - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        see [fix for #99](https://example.com)"
    `);
  });

  it("does not linkify when preceded by a word character", async () => {
    const promise = getReleaseLine(
      createChangeset({ suffix: "foo#123" }),
      "minor",
      defaultRepo,
    );
    await expect(promise).resolves.toMatchInlineSnapshot(`
      "

      - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        foo#123"
    `);
  });

  it("does not linkify #0", async () => {
    const promise = getReleaseLine(
      createChangeset({ suffix: "see #0" }),
      "minor",
      defaultRepo,
    );
    await expect(promise).resolves.toMatchInlineSnapshot(`
      "

      - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        see #0"
    `);
  });

  it("linkifies issue ref at the start of a line", async () => {
    const promise = getReleaseLine(
      createChangeset({ suffix: "#42 was fixed" }),
      "minor",
      defaultRepo,
    );
    await expect(promise).resolves.toMatchInlineSnapshot(`
      "

      - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        [#42](https://github.com/emotion-js/emotion/issues/42) was fixed"
    `);
  });

  it("linkifies issue ref after punctuation", async () => {
    const promise = getReleaseLine(
      createChangeset({ suffix: "fixed (#99)" }),
      "minor",
      defaultRepo,
    );
    await expect(promise).resolves.toMatchInlineSnapshot(`
      "

      - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        fixed ([#99](https://github.com/emotion-js/emotion/issues/99))"
    `);
  });

  it("handles mixed linked and bare refs", async () => {
    const promise = getReleaseLine(
      createChangeset({
        suffix:
          "fixes [#1](https://github.com/emotion-js/emotion/issues/1) and #2",
      }),
      "minor",
      defaultRepo,
    );
    await expect(promise).resolves.toMatchInlineSnapshot(`
      "

      - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        fixes [#1](https://github.com/emotion-js/emotion/issues/1) and [#2](https://github.com/emotion-js/emotion/issues/2)"
    `);
  });
});

it("disables thanks if disableThanks is enabled", async () => {
  const promise = getReleaseLine(createChangeset(), "minor", {
    ...defaultRepo,
    disableThanks: true,
  });
  await expect(promise).resolves.toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) - something
    "
  `);
});

describe("template option (compact reproduction)", () => {
  const compactOpts = {
    repo: defaults.repo,
    template: "\n- {summary} {ref}",
  };

  it("renders the compact single-line form with PR ref", async () => {
    const promise = getReleaseLine(
      createChangeset({ content: "fix the thing" }),
      "minor",
      compactOpts,
    );
    await expect(promise).resolves.toBe(
      "\n- fix the thing ([#1613](https://github.com/emotion-js/emotion/pull/1613))\n",
    );
  });

  it("keeps multi-line summaries: first line templated, rest indented", async () => {
    const promise = getReleaseLine(
      createChangeset({ content: "first line", suffix: "second line" }),
      "minor",
      compactOpts,
    );
    await expect(promise).resolves.toBe(
      "\n- first line ([#1613](https://github.com/emotion-js/emotion/pull/1613))\n  second line",
    );
  });

  it("omits attribution because no token references it", async () => {
    const promise = getReleaseLine(
      createChangeset({ content: "fix the thing" }),
      "minor",
      compactOpts,
    );
    await expect(promise).resolves.not.toContain("Thanks");
  });

  it("renders attribution from literal text plus {authors}", async () => {
    const promise = getReleaseLine(
      createChangeset({ content: "fix the thing" }),
      "minor",
      { ...defaultRepo, template: "\n- {summary} Thanks {authors}!" },
    );
    await expect(promise).resolves.toBe(
      "\n- fix the thing Thanks [@Andarist](https://github.com/Andarist)!\n",
    );
  });

  it("renders {authors} without the word Thanks", async () => {
    const promise = getReleaseLine(
      createChangeset({ content: "fix the thing" }),
      "minor",
      { ...defaultRepo, template: "\n- {summary} {authors}" },
    );
    await expect(promise).resolves.toBe(
      "\n- fix the thing [@Andarist](https://github.com/Andarist)\n",
    );
  });

  it("trims a trailing space left by an empty trailing token", async () => {
    const promise = getReleaseLine(
      { ...createChangeset({ content: "fix the thing" }), commit: undefined },
      "minor",
      { ...defaultRepo, template: "\n- {summary} {ref}" },
    );
    await expect(promise).resolves.toBe("\n- fix the thing\n");
  });
});

describe("{summary} token", () => {
  it("{summary} links every bare #n", async () => {
    const promise = getReleaseLine(
      createChangeset({ content: "did a thing (fixes #99) and also #1234" }),
      "minor",
      { ...defaultRepo, template: "\n- {summary}" },
    );
    await expect(promise).resolves.toContain(
      "[#1234](https://github.com/emotion-js/emotion/issues/1234)",
    );
    await expect(promise).resolves.toContain(
      "[#99](https://github.com/emotion-js/emotion/issues/99)",
    );
  });
});

// Locks the template/output examples shown in packages/changelog-github/README.md so
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
    const promise = getReleaseLine(
      createChangeset({ content: "fix the thing" }),
      "minor",
      { ...defaultRepo, template },
    );
    await expect(promise).resolves.toBe(expected);
  });
});
