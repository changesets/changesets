import { describe, expect, it } from "vitest";
import {
  renderTemplate,
  buildReleaseLineTokens,
  RELEASE_LINE_TOKENS,
} from "./render-template.ts";

describe("renderTemplate", () => {
  const tokens = {
    summary: "msg",
    ref: "(REF)",
    pull: "(PULL)",
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
      summaryLinked: "linked",
      links: { pull: "[#1](u)", commit: "[`abc`](u)", user: "[@x](u)" },
      users: "[@x](u)",
    });
    expect(t.ref).toBe("([#1](u))");
    expect(t.pull).toBe("[#1](u)");
    expect(t.commit).toBe("[`abc`](u)");
    expect(t.authors).toBe("[@x](u)");
    expect(t.summary).toBe("linked");
  });

  it("ref falls back to commit when there is no PR", () => {
    const t = buildReleaseLineTokens({
      summaryLinked: "msg",
      links: { pull: null, commit: "[`abc`](u)", user: null },
      users: null,
    });
    expect(t.ref).toBe("([`abc`](u))");
    expect(t.pull).toBe("");
    expect(t.authors).toBe("");
  });

  it("ref is empty when there is neither PR nor commit", () => {
    const t = buildReleaseLineTokens({
      summaryLinked: "msg",
      links: { pull: null, commit: null, user: null },
      users: null,
    });
    expect(t.ref).toBe("");
    expect(t.commit).toBe("");
  });

  it("returns exactly the documented RELEASE_LINE_TOKENS keys", () => {
    const keys = Object.keys(
      buildReleaseLineTokens({
        summaryLinked: "m",
        links: { pull: null, commit: null, user: null },
        users: null,
      }),
    ).sort();
    expect(keys).toEqual(RELEASE_LINE_TOKENS.toSorted());
  });
});
