import changelogFunctions from "./index";
import parse from "@changesets/parse";

const getReleaseLine = changelogFunctions.getReleaseLine;

const data = {
  commit: "a085003",
  user: "Andarist",
  pull: 1613,
  repo: "emotion-js/emotion"
};

jest.mock(
  "@changesets/get-github-info",
  (): typeof import("@changesets/get-github-info") => {
    // this is duplicated because jest.mock reordering things
    const data = {
      commit: "a085003",
      user: "Andarist",
      pull: 1613,
      repo: "emotion-js/emotion"
    };
    const links = {
      user: `[@${data.user}](https://github.com/${data.user})`,
      pull: `[#${data.pull}](https://github.com/${data.repo}/pull/${data.pull})`,
      commit: `[\`${data.commit}\`](https://github.com/${data.repo}/commit/${data.commit})`
    };
    return {
      async getInfo({ commit, repo }) {
        expect(commit).toBe(data.commit);
        expect(repo).toBe(data.repo);
        return {
          pull: data.pull,
          user: data.user,
          links
        };
      },
      async getInfoFromPullRequest({ pull, repo }) {
        expect(pull).toBe(data.pull);
        expect(repo).toBe(data.repo);
        return {
          commit: data.commit,
          user: data.user,
          links
        };
      }
    };
  }
);
const expected = `\n\n- [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@Andarist](https://github.com/Andarist)! - something\n`;

describe.each([data.commit, "wrongcommit", undefined])(
  "with commit from changeset of %s",
  commitFromChangeset => {
    const getChangeset = (content: string) => {
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
          commit: commitFromChangeset
        },
        "minor",
        { repo: data.repo }
      ] as const;
    };

    test.each(["pr", "pull request", "pull"])(
      "override pr with %s keyword",
      async keyword => {
        expect(
          await getReleaseLine(...getChangeset(`${keyword}: ${data.pull}`))
        ).toEqual(expected);
      }
    );
    if (commitFromChangeset === "a085003") {
      test.each(["author", "user"])(
        "override author with %s keyword",
        async keyword => {
          const expected = `\n\n- [#1613](https://github.com/emotion-js/emotion/pull/1613) [\`a085003\`](https://github.com/emotion-js/emotion/commit/a085003) Thanks [@other](https://github.com/other)! - something\n`;

          expect(
            await getReleaseLine(...getChangeset(`${keyword}: other`))
          ).toEqual(expected);
        }
      );
    }
    test("override commit with commit keyword", async () => {
      expect(
        await getReleaseLine(...getChangeset(`commit: ${data.commit}`))
      ).toEqual(expected);
    });
  }
);
