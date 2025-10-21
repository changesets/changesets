import changelogFunctions from "./index";
import parse from "@changesets/parse";

const getReleaseLine = changelogFunctions.getReleaseLine;

jest.mock(
  "@changesets/get-github-info",
  (): typeof import("@changesets/get-github-info") => {
    // this is duplicated because jest.mock reordering things
    const data = {
      commit: "a085003",
      user: "Andarist",
      pull: 1613,
      repo: "emotion-js/emotion",
    };
    const links = {
      user: `[@${data.user}](https://github.com/${data.user})`,
      pull: `[#${data.pull}](https://github.com/${data.repo}/pull/${data.pull})`,
      commit: `[\`${data.commit}\`](https://github.com/${data.repo}/commit/${data.commit})`,
    };
    return {
      async getInfo({ commit, repo }) {
        expect(commit).toBe(data.commit);
        expect(repo).toBe(data.repo);
        return {
          pull: data.pull,
          user: data.user,
          links,
        };
      },
      async getInfoFromPullRequest({ pull, repo }) {
        expect(pull).toBe(data.pull);
        expect(repo).toBe(data.repo);
        return {
          commit: data.commit,
          user: data.user,
          links,
        };
      },
    };
  }
);

const getChangeset = (
  content: string,
  commit: string | undefined,
  extraOpts?: { disableThanks?: boolean }
) => {
  return [
    {
      ...parse(
        `---
  pkg: "minor"
  ---

  something
  ${content}
  `
      ),
      id: "some-id",
      commit,
    },
    "minor",
    { repo: data.repo, ...extraOpts },
  ] as const;
};

const data = {
  commit: "a085003",
  user: "Andarist",
  pull: 1613,
  repo: "emotion-js/emotion",
};

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
                commitFromChangeset
              )
            )
          ).toEqual(
            `\n\n- [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something\n`
          );
        });
      }
    );
    test("override commit with commit keyword", async () => {
      expect(
        await getReleaseLine(
          ...getChangeset(`commit: ${data.commit}`, commitFromChangeset)
        )
      ).toEqual(
        `\n\n- [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something\n`
      );
    });
  }
);

describe.each(["author", "user"])(
  "override author with %s keyword",
  (keyword) => {
    test.each(["with @", "without @"] as const)("%s", async (kind) => {
      expect(
        await getReleaseLine(
          ...getChangeset(
            `${keyword}: ${kind === "with @" ? "@" : ""}other`,
            data.commit
          )
        )
      ).toEqual(
        `\n\n- [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@other](https://github.com/other)! - something\n`
      );
    });
  }
);

it("with multiple authors", async () => {
  expect(
    await getReleaseLine(
      ...getChangeset(
        ["author: @Andarist", "author: @mitchellhamilton"].join("\n"),
        data.commit
      )
    )
  ).toMatchInlineSnapshot(`
    "

    - [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist), [@mitchellhamilton](https://github.com/mitchellhamilton)! - something
    "
  `);
});

it("disables thanks if disableThanks is enabled", async () => {
  expect(
    await getReleaseLine(
      ...getChangeset("", data.commit, {
        disableThanks: true,
      })
    )
  ).toEqual(
    `\n\n- [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) - something\n`
  );
});
