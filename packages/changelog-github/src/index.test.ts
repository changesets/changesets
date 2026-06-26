import { parseChangesetFile as parse } from "@changesets/parse";
import type { ModCompWithPackage } from "@changesets/types";
import { afterEach, describe, expect, it, test, vi } from "vitest";
import changelogFunctions from "./index.ts";

const getReleaseLine = changelogFunctions.getReleaseLine;
const getDependencyReleaseLine = changelogFunctions.getDependencyReleaseLine;

afterEach(() => {
  vi.unstubAllEnvs();
});

vi.mock(
  "@changesets/get-github-info",
  (): typeof import("@changesets/get-github-info") => {
    const data = {
      commit: "a085003",
      author: "Andarist",
      pull: 1613,
      repo: "emotion-js/emotion",
    };
    const urls = {
      commit: `https://github.com/${data.repo}/commit/${data.commit}`,
      pull: `https://github.com/${data.repo}/pull/${data.pull}`,
      author: `https://github.com/${data.author}`,
    };
    const markdownLinks = {
      commit: `[\`${data.commit.slice(0, 7)}\`](${urls.commit})`,
      pull: `[#${data.pull}](${urls.pull})`,
      author: `[@${data.author}](${urls.author})`,
    };
    return {
      /* eslint-disable vitest/no-standalone-expect */
      async getCommitInfo({ commit, repo }) {
        expect(commit).toBe(data.commit);
        expect(repo).toBe(data.repo);
        return {
          commit: {
            sha: data.commit,
            url: urls.commit,
            markdownLink: markdownLinks.commit,
          },
          author: {
            login: data.author,
            url: urls.author,
            markdownLink: markdownLinks.author,
          },
          pull: {
            number: data.pull,
            url: urls.pull,
            markdownLink: markdownLinks.pull,
          },
        };
      },
      async getPullRequestInfo({ pull, repo }) {
        expect(pull).toBe(data.pull);
        expect(repo).toBe(data.repo);
        return {
          commit: {
            sha: data.commit,
            url: urls.commit,
            markdownLink: markdownLinks.commit,
          },
          author: {
            login: data.author,
            url: urls.author,
            markdownLink: markdownLinks.author,
          },
          pull: {
            number: data.pull,
            url: urls.pull,
            markdownLink: markdownLinks.pull,
          },
        };
      },
      /* eslint-enable vitest/no-standalone-expect */
    };
  },
);

const getChangeset = (content: string, commit: string | undefined) => {
  return [
    {
      ...parse(
        `---
  pkg: "minor"
  ---

  something
  ${content}
  `,
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
  const [changeset, releaseType] = getChangeset("", data.commit);

  expect(await getReleaseLine(changeset, releaseType, null)).toEqual(
    `\n\n- [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something\n`,
  );
});

it("uses explicit repo option before GITHUB_REPOSITORY", async () => {
  vi.stubEnv("GITHUB_REPOSITORY", "other/repo");

  expect(await getReleaseLine(...getChangeset("", data.commit))).toEqual(
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

describe.each([data.commit, "wrongcommit", undefined])(
  "with commit from changeset of %s",
  (commitFromChangeset) => {
    describe.each(["pr", "pull request", "pull"])(
      "override pr with %s keyword",
      (keyword) => {
        test.each(["with #", "without #"] as const)("%s", async (kind) => {
          expect(
            await getReleaseLine(
              ...getChangeset(
                `${keyword}: ${kind === "with #" ? "#" : ""}${data.pull}`,
                commitFromChangeset,
              ),
            ),
          ).toEqual(
            `\n\n- [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something\n`,
          );
        });
      },
    );
    test("override commit with commit keyword", async () => {
      expect(
        await getReleaseLine(
          ...getChangeset(`commit: ${data.commit}`, commitFromChangeset),
        ),
      ).toEqual(
        `\n\n- [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something\n`,
      );
    });
  },
);

describe.each(["author", "user"])(
  "override author with %s keyword",
  (keyword) => {
    test.each(["with @", "without @"] as const)("%s", async (kind) => {
      expect(
        await getReleaseLine(
          ...getChangeset(
            `${keyword}: ${kind === "with @" ? "@" : ""}other`,
            data.commit,
          ),
        ),
      ).toEqual(
        `\n\n- [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@other](https://github.com/other)! - something\n`,
      );
    });
  },
);

it("linkifies bare issue references", async () => {
  expect(
    await getReleaseLine(...getChangeset("fixes #1234 and #5678", data.commit)),
  ).toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        fixes [#1234](https://github.com/emotion-js/emotion/issues/1234) and [#5678](https://github.com/emotion-js/emotion/issues/5678)"
  `);
});

it("does not double-linkify existing markdown links", async () => {
  expect(
    await getReleaseLine(
      ...getChangeset(
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
      ...getChangeset("see [fix for #99](https://example.com)", data.commit),
    ),
  ).toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        see [fix for #99](https://example.com)"
  `);
});

it("does not linkify when preceded by a word character", async () => {
  expect(await getReleaseLine(...getChangeset("foo#123", data.commit)))
    .toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        foo#123"
  `);
});

it("does not linkify #0", async () => {
  expect(await getReleaseLine(...getChangeset("see #0", data.commit)))
    .toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        see #0"
  `);
});

it("linkifies issue ref at the start of a line", async () => {
  expect(await getReleaseLine(...getChangeset("#42 was fixed", data.commit)))
    .toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        [#42](https://github.com/emotion-js/emotion/issues/42) was fixed"
  `);
});

it("linkifies issue ref after punctuation", async () => {
  expect(await getReleaseLine(...getChangeset("fixed (#99)", data.commit)))
    .toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        fixed ([#99](https://github.com/emotion-js/emotion/issues/99))"
  `);
});

it("handles mixed linked and bare refs", async () => {
  expect(
    await getReleaseLine(
      ...getChangeset(
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
  expect(await getReleaseLine(...getChangeset("this fixes #42.", data.commit)))
    .toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something
        this fixes [#42](https://github.com/emotion-js/emotion/issues/42)."
  `);
});

it("with multiple authors", async () => {
  expect(
    await getReleaseLine(
      ...getChangeset(
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
  const [changeset, releaseType, options] = getChangeset(
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
