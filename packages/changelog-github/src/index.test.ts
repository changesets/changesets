import { parseChangesetFile as parse } from "@changesets/parse";
import { describe, expect, it, test, vi } from "vitest";
import changelogFunctions, { composeReleaseLine } from "./index.ts";

const getReleaseLine = changelogFunctions.getReleaseLine;

vi.mock(
  "@changesets/get-github-info",
  (): typeof import("@changesets/get-github-info") => {
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
      /* eslint-disable vitest/no-standalone-expect */
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

describe("composeReleaseLine", () => {
  const baseChangeset = {
    id: "x",
    summary: "fix the thing",
    releases: [{ name: "pkg", type: "minor" as const }],
    commit: data.commit,
  };

  it("passes resolved pieces to the callback", async () => {
    const seen: any = {};
    const fn = composeReleaseLine(
      ({ summary, pr, commit, authors, linkRefs, linkHints }) => {
        Object.assign(seen, { summary, pr, commit, authors });
        expect(typeof linkRefs).toBe("function");
        expect(typeof linkHints).toBe("function");
        return `- ${summary}`;
      },
    );
    await fn(baseChangeset, "minor", { repo: data.repo });
    expect(seen.summary).toBe("fix the thing");
    expect(seen.pr).toBe(
      "[#1613](https://github.com/emotion-js/emotion/pull/1613)",
    );
    expect(seen.commit).toBe(
      "[`a085003`](https://github.com/emotion-js/emotion/commit/a085003)",
    );
    expect(seen.authors).toEqual(["[@Andarist](https://github.com/Andarist)"]);
  });

  it("uses \\n\\n separator and appends continuation when a string is returned", async () => {
    const fn = composeReleaseLine(({ summary }) => `- ${summary}`);
    expect(
      await fn({ ...baseChangeset, summary: "first\nsecond" }, "minor", {
        repo: data.repo,
      }),
    ).toBe("\n\n- first\n  second");
  });

  it("lets the callback override the separator (compact)", async () => {
    const fn = composeReleaseLine(({ summary, pr, linkHints }) => ({
      separator: "\n",
      line: `- ${linkHints(summary)} (${pr})`,
    }));
    expect(await fn(baseChangeset, "minor", { repo: data.repo })).toBe(
      "\n- fix the thing ([#1613](https://github.com/emotion-js/emotion/pull/1613))\n",
    );
  });

  it("linkHints only links refs inside (fix|fixes|see #n)", async () => {
    const fn = composeReleaseLine(
      ({ summary, linkHints }) => `- ${linkHints(summary)}`,
    );
    const line = await fn(
      { ...baseChangeset, summary: "did (fixes #99) and also #1234" },
      "minor",
      { repo: data.repo },
    );
    expect(line).toContain(
      "(fixes [#99](https://github.com/emotion-js/emotion/issues/99))",
    );
    expect(line).toContain("and also #1234");
    expect(line).not.toContain("issues/1234");
  });

  it("authors is empty array when there is no author", async () => {
    let captured: string[] | undefined;
    const fn = composeReleaseLine(({ summary, authors }) => {
      captured = authors;
      return `- ${summary}`;
    });
    await fn(
      {
        id: "x",
        summary: "no author",
        releases: baseChangeset.releases,
        commit: undefined,
      },
      "minor",
      { repo: data.repo },
    );
    expect(captured).toEqual([]);
  });

  it("throws when repo is missing", async () => {
    const fn = composeReleaseLine(({ summary }) => `- ${summary}`);
    await expect(fn(baseChangeset, "minor", {} as any)).rejects.toThrow(
      /provide a repo/,
    );
  });

  it("overrides the commit link from a `commit:` hint when a PR is also given", async () => {
    let captured: any;
    const fn = composeReleaseLine((parts) => {
      captured = parts;
      return `- ${parts.summary}`;
    });
    await fn(
      {
        id: "x",
        summary: "pr: #1613\ncommit: deadbeef1234\nfix the thing",
        releases: baseChangeset.releases,
        commit: undefined,
      },
      "minor",
      { repo: data.repo },
    );
    expect(captured.pr).toBe(
      "[#1613](https://github.com/emotion-js/emotion/pull/1613)",
    );
    expect(captured.commit).toBe(
      "[`deadbee`](https://github.com/emotion-js/emotion/commit/deadbeef1234)",
    );
    expect(captured.summary).toBe("fix the thing");
  });
});

describe("getDependencyReleaseLine", () => {
  const fn = changelogFunctions.getDependencyReleaseLine;

  it("throws when repo is missing", async () => {
    await expect(
      fn(
        [{ commit: data.commit } as any],
        [{ name: "pkg-a", type: "patch", newVersion: "1.0.1" } as any],
        {} as any,
      ),
    ).rejects.toThrow(/provide a repo/);
  });

  it("returns an empty string when no dependencies were updated", async () => {
    expect(
      await fn([{ commit: data.commit } as any], [], { repo: data.repo }),
    ).toBe("");
  });

  it("lists updated dependencies under a commit link", async () => {
    expect(
      await fn(
        [{ commit: data.commit } as any],
        [
          { name: "pkg-a", type: "patch", newVersion: "1.0.1" } as any,
          { name: "pkg-b", type: "minor", newVersion: "2.1.0" } as any,
        ],
        { repo: data.repo },
      ),
    ).toBe(
      "- Updated dependencies [[`a085003`](https://github.com/emotion-js/emotion/commit/a085003)]:\n  - pkg-a@1.0.1\n  - pkg-b@2.1.0",
    );
  });

  it("skips changesets without a commit", async () => {
    expect(
      await fn(
        [{ commit: undefined } as any],
        [{ name: "pkg-a", type: "patch", newVersion: "1.0.1" } as any],
        { repo: data.repo },
      ),
    ).toBe("- Updated dependencies []:\n  - pkg-a@1.0.1");
  });
});
