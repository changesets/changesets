import { outdent } from "outdent";
import { describe, expect, it } from "vitest";
import {
  parseChangesetFile as parse,
  safeParseChangesetFile as safeParse,
} from "./index.ts";

describe("parsing a changeset", () => {
  it("should parse a changeset", () => {
    const changesetMd = outdent`---
    "cool-package": minor
    ---

    Nice simple summary
    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "cool-package", type: "minor" }],
      summary: "Nice simple summary",
    });
  });
  it("should parse major, minor, and patch changes", () => {
    const changesetMd = outdent`---
    "cool-package": minor
    "cool-package2": major
    "cool-package3": patch
    ---

    Nice simple summary
    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [
        { name: "cool-package", type: "minor" },
        { name: "cool-package2", type: "major" },
        { name: "cool-package3", type: "patch" },
      ],
      summary: "Nice simple summary",
    });
  });
  it("should parse a changeset with a scoped package", () => {
    const changesetMd = outdent`---
    "@cool/package": minor
    ---

    Nice simple summary
    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "@cool/package", type: "minor" }],
      summary: "Nice simple summary",
    });
  });
  it("should parse a changeset with multiline summary", () => {
    const expectedSummary = outdent`Let us go then you and I,
    When the evening is spread out against the sky
    Like a patient, etherized upon a table.

    - The Lovesong of J Alfred Prufrock, T. S. Eliot`;

    const changesetMd = outdent`---
    "cool-package": minor
    ---

    Let us go then you and I,
    When the evening is spread out against the sky
    Like a patient, etherized upon a table.

    - The Lovesong of J Alfred Prufrock, T. S. Eliot
    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "cool-package", type: "minor" }],
      summary: expectedSummary,
    });
  });
  it("should parse a changeset with multiple packages and multiline summary", () => {
    const expectedSummary = outdent`Let us go then you and I,
    When the evening is spread out against the sky
    Like a patient, etherized upon a table.

    - The Lovesong of J Alfred Prufrock, T. S. Eliot`;

    const changesetMd = outdent`---
    "cool-package": minor
    "best-package": patch
    ---

    Let us go then you and I,
    When the evening is spread out against the sky
    Like a patient, etherized upon a table.

    - The Lovesong of J Alfred Prufrock, T. S. Eliot
    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [
        { name: "cool-package", type: "minor" },
        { name: "best-package", type: "patch" },
      ],
      summary: expectedSummary,
    });
  });
  it("should be fine if a packageName includes ---", () => {
    const changesetMd = outdent`---
    "cool---package": minor
    ---

    Nice simple summary
    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "cool---package", type: "minor" }],
      summary: "Nice simple summary",
    });
  });
  it("should be fine if the summary body includes ---", () => {
    const expectedSummary = outdent`---
    Nice simple summary---that has this`;

    const changesetMd = outdent`---
    "cool-package": minor
    ---

    ---
    Nice simple summary---that has this

    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "cool-package", type: "minor" }],
      summary: expectedSummary,
    });
  });
  it("should be fine if the summary body is completely empty and there is no trailing whitespace", () => {
    const changesetMd = outdent`---
    "cool-package": minor
    ---`;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "cool-package", type: "minor" }],
      summary: "",
    });
  });
  it("should be fine if there is no summary body and the frontmatter has some trailing whitespace", () => {
    const changesetMd = outdent`---
    "cool-package": minor
    --- `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "cool-package", type: "minor" }],
      summary: "",
    });
  });
  it("should be fine if the changeset is empty", () => {
    const changesetMd = outdent`---
    ---

    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [],
      summary: "",
    });
  });
  it("should be fine if the changeset is empty and without any trailing whitespace", () => {
    const changeset = parse(`---\n---`);
    expect(changeset).toEqual({
      releases: [],
      summary: "",
    });
  });
  it("should be fine if the frontmatter is followed by a whitespace on the same line", () => {
    const changesetMd = outdent`---
    "cool-package": minor
    ---${
      "  " /* this prevents auto-formatters from removing the trailing whitespace */
    }

    Nice simple summary
    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "cool-package", type: "minor" }],
      summary: "Nice simple summary",
    });
  });
  it("should be fine when md contains Windows new lines", () => {
    const changesetMd = outdent`---
    "cool-package": minor
    "best-package": patch
    ---

    Nice simple summary
    `
      .split("\n")
      .join("\r\n");

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [
        { name: "cool-package", type: "minor" },
        { name: "best-package", type: "patch" },
      ],
      summary: "Nice simple summary",
    });
  });

  it("should handle package name unquoted and version quoted", () => {
    const changesetMd = `---
    pkg: "minor"
    ---

    something`;
    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "pkg", type: "minor" }],
      summary: "something",
    });
  });

  it("should throw if the frontmatter is followed by non-whitespace characters on the same line", () => {
    const changesetMd = outdent`---
    "cool-package": minor
    ---  fail

    Nice simple summary
    `;

    expect(() => parse(changesetMd)).toThrowErrorMatchingInlineSnapshot(`
      [Error: could not parse changeset - missing or invalid frontmatter.
      Changesets must start with frontmatter delimited by "---".
      Example:
      ---
      "package-name": patch
      ---

      Your changeset summary here.
      Received content:
      ---
      "cool-package": minor
      ---  fail

      Nice simple summary]
    `);
  });

  it("should throw when frontmatter hasn't a valid yml structure", () => {
    const changesetMd = outdent`---
    : minor
    ---

    Nice simple summary
    `;

    expect(() => parse(changesetMd)).toThrowErrorMatchingInlineSnapshot(`
      [Error: could not parse changeset - invalid package name in frontmatter.
      Expected a non-empty string for package name, but got: ""
      Changeset contents:
      ---
      : minor
      ---

      Nice simple summary]
    `);
  });

  it("should throw when file is completely empty", () => {
    expect(() => parse("")).toThrowErrorMatchingInlineSnapshot(`
      [Error: could not parse changeset - file is empty.
      Changesets must have frontmatter with package names and version types.
      Example:
      ---
      "package-name": patch
      ---

      Your changeset summary here.]
    `);
    expect(() => parse("   ")).toThrowErrorMatchingInlineSnapshot(`
      [Error: could not parse changeset - file is empty.
      Changesets must have frontmatter with package names and version types.
      Example:
      ---
      "package-name": patch
      ---

      Your changeset summary here.]
    `);
    expect(() => parse("\n\n")).toThrowErrorMatchingInlineSnapshot(`
      [Error: could not parse changeset - file is empty.
      Changesets must have frontmatter with package names and version types.
      Example:
      ---
      "package-name": patch
      ---

      Your changeset summary here.]
    `);
  });

  it("should throw when frontmatter is missing", () => {
    const changesetMd = "Just some content without frontmatter";
    expect(() => parse(changesetMd)).toThrowErrorMatchingInlineSnapshot(`
      [Error: could not parse changeset - missing or invalid frontmatter.
      Changesets must start with frontmatter delimited by "---".
      Example:
      ---
      "package-name": patch
      ---

      Your changeset summary here.
      Received content:
      Just some content without frontmatter]
    `);
  });

  it("should throw when version type is invalid", () => {
    const changesetMd = outdent`---
    "cool-package": invalid-type
    ---

    Nice simple summary
    `;

    expect(() => parse(changesetMd)).toThrowErrorMatchingInlineSnapshot(`
      [Error: could not parse changeset - invalid version type "invalid-type" for package "cool-package".
      Valid version types are: major, minor, patch, none
      Changeset contents:
      ---
      "cool-package": invalid-type
      ---

      Nice simple summary]
    `);
  });

  it("should throw with helpful message when package name is empty", () => {
    const changesetMd = outdent`---
    "": minor
    ---

    Nice simple summary
    `;

    expect(() => parse(changesetMd)).toThrowErrorMatchingInlineSnapshot(`
      [Error: could not parse changeset - invalid package name in frontmatter.
      Expected a non-empty string for package name, but got: ""
      Changeset contents:
      ---
      "": minor
      ---

      Nice simple summary]
    `);
  });
});

describe("safeParseChangesetFile", () => {
  const validChangeset = outdent`---
  "cool-package": minor
  ---

  Nice simple summary
  `;

  const invalidPackageName = outdent`---
  "": minor
  ---

  Nice simple summary
  `;

  const invalidReleaseType = outdent`---
  "cool-package": invalid-type
  ---

  Nice simple summary
  `;

  const noFrontmatter = "Just some content without frontmatter";

  it("returns { ok: true, changeset } for a normal changeset", () => {
    const result = safeParse(validChangeset);
    expect(result).toEqual({
      ok: true,
      changeset: {
        releases: [{ name: "cool-package", type: "minor" }],
        summary: "Nice simple summary",
      },
    });
  });

  it("returns { ok: false, error } for an invalid package name", () => {
    const result = safeParse(invalidPackageName);
    expect(result.ok).toBe(false);
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining(
        "could not parse changeset - invalid package name in frontmatter.",
      ),
    });
  });

  it("returns { ok: false, error } for an invalid release type", () => {
    const result = safeParse(invalidReleaseType);
    expect(result.ok).toBe(false);
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining(
        'could not parse changeset - invalid version type "invalid-type" for package "cool-package".',
      ),
    });
  });

  it("returns { ok: false, error } for contents with no parsable frontmatter", () => {
    const result = safeParse(noFrontmatter);
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining(
        "could not parse changeset - missing or invalid frontmatter.",
      ),
    });
  });

  it("never throws for any input string", () => {
    const inputs = [
      "",
      "   ",
      "\n\n",
      validChangeset,
      invalidPackageName,
      invalidReleaseType,
      noFrontmatter,
      "---\n: minor\n---",
      "---\n---",
      "random ---\n garbage : : :",
    ];
    for (const input of inputs) {
      expect(() => safeParse(input)).not.toThrow();
    }
  });

  it("error message equals the message thrown by parseChangesetFile for the same input (R-1.2)", () => {
    const failingInputs = [
      "",
      invalidPackageName,
      invalidReleaseType,
      noFrontmatter,
      "---\n: minor\n---",
    ];
    for (const input of failingInputs) {
      let thrownMessage: string | undefined;
      try {
        parse(input);
      } catch (e) {
        thrownMessage = e instanceof Error ? e.message : String(e);
      }
      expect(thrownMessage).toBeDefined();
      const result = safeParse(input);
      expect(result).toEqual({ ok: false, error: thrownMessage });
    }
  });

  it("deep-equals parseChangesetFile's output for valid inputs", () => {
    const validInputs = [
      validChangeset,
      outdent`---
      "cool-package": minor
      "best-package": patch
      ---

      Multi package summary
      `,
      outdent`---
      "@cool/package": major
      ---

      Scoped
      `,
      "---\n---",
    ];
    for (const input of validInputs) {
      const result = safeParse(input);
      expect(result).toEqual({ ok: true, changeset: parse(input) });
    }
  });
});
