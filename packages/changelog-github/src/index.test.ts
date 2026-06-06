import { parseChangesetFile as parse } from "@changesets/parse";
import { describe, expect, it, test, vi } from "vitest";
import changelogFunctions, {
  renderTemplate,
  buildReleaseLineTokens,
  RELEASE_LINE_TOKENS,
} from "./index.ts";

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

describe("renderTemplate", () => {
  const tokens = {
    summary: "msg",
    ref: "(REF)",
    pr: "(PR)",
    commit: "(COMMIT)",
    authors: "AUTHORS",
  };

  it("substitutes known tokens", () => {
    expect(renderTemplate("- {summary} {ref}", tokens)).toBe("- msg (REF)");
  });

  it("leaves non-token text untouched", () => {
    expect(renderTemplate("- start {summary} end", tokens)).toBe(
      "- start msg end",
    );
  });

  it("throws on an unknown token", () => {
    expect(() => renderTemplate("- {summery}", tokens)).toThrow(
      /Unknown changelog template token "\{summery\}"/,
    );
  });

  it("throws on the removed {thanks} token", () => {
    expect(() => renderTemplate("- {thanks}", tokens)).toThrow(
      /Unknown changelog template token "\{thanks\}"/,
    );
  });
});

describe("buildReleaseLineTokens", () => {
  it("ref prefers PR over commit", () => {
    const t = buildReleaseLineTokens({
      summary: "msg",
      links: { pull: "[#1](u)", commit: "[`abc`](u)", user: "[@x](u)" },
      users: "[@x](u)",
    });
    expect(t.ref).toBe("([#1](u))");
    expect(t.pr).toBe("[#1](u)");
    expect(t.commit).toBe("[`abc`](u)");
    expect(t.authors).toBe("[@x](u)");
    expect(t.summary).toBe("msg");
  });

  it("ref falls back to commit when there is no PR", () => {
    const t = buildReleaseLineTokens({
      summary: "msg",
      links: { pull: null, commit: "[`abc`](u)", user: null },
      users: null,
    });
    expect(t.ref).toBe("([`abc`](u))");
    expect(t.pr).toBe("");
    expect(t.authors).toBe("");
  });

  it("ref is empty when there is neither PR nor commit", () => {
    const t = buildReleaseLineTokens({
      summary: "msg",
      links: { pull: null, commit: null, user: null },
      users: null,
    });
    expect(t.ref).toBe("");
    expect(t.commit).toBe("");
  });

  it("returns exactly the documented RELEASE_LINE_TOKENS keys", () => {
    const keys = Object.keys(
      buildReleaseLineTokens({
        summary: "m",
        links: { pull: null, commit: null, user: null },
        users: null,
      }),
    ).sort();
    expect(keys).toEqual(RELEASE_LINE_TOKENS.toSorted());
  });
});

describe("template option (compact reproduction)", () => {
  const compactOpts = {
    repo: data.repo,
    template: "\n- {summary} {ref}",
    autolinkIssues: "hints",
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

describe("autolinkIssues option", () => {
  const optionsWith = (extra: Record<string, any>) => ({
    repo: data.repo,
    ...extra,
  });

  it('"hints" only links refs inside (fix|fixes|see #n)', async () => {
    const changeset = {
      id: "x",
      summary: "did a thing (fixes #99) and also #1234",
      releases: [{ name: "pkg", type: "minor" as const }],
      commit: data.commit,
    };
    const line = await getReleaseLine(
      changeset,
      "minor",
      optionsWith({ autolinkIssues: "hints" }),
    );
    expect(line).toContain(
      "(fixes [#99](https://github.com/emotion-js/emotion/issues/99))",
    );
    expect(line).toContain("and also #1234");
    expect(line).not.toContain("issues/1234");
  });

  it('"all" (default) still links every bare #n', async () => {
    const changeset = {
      id: "x",
      summary: "did a thing (fixes #99) and also #1234",
      releases: [{ name: "pkg", type: "minor" as const }],
      commit: data.commit,
    };
    const line = await getReleaseLine(changeset, "minor", optionsWith({}));
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
      "\n- {pr} {commit} Thanks {authors}! - {summary}",
      `\n- ${pr} ${commit} Thanks ${author}! - fix the thing\n`,
    ],
    ["\n- {summary} {ref}", `\n- fix the thing (${pr})\n`],
    [
      "\n- {summary} (thanks {authors}!)",
      `\n- fix the thing (thanks ${author}!)\n`,
    ],
    ["\n- {summary} {pr}", `\n- fix the thing ${pr}\n`],
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
