import outdent from "outdent";

import parse from "./";

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
      "could not parse changeset - missing or invalid frontmatter.
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

      Nice simple summary"
    `);
  });

  it("should throw when frontmatter hasn't a valid yml structure", () => {
    const changesetMd = outdent`---
    : minor
    ---

    Nice simple summary
    `;

    expect(() => parse(changesetMd)).toThrowErrorMatchingInlineSnapshot(`
      "could not parse changeset - invalid YAML in frontmatter.
      The frontmatter between the "---" delimiters must be valid YAML.
      YAML error: incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line (2:1)

       1 | 
       2 | : minor
      -----^

      Frontmatter content:

      : minor"
    `);
  });

  it("should throw when file is completely empty", () => {
    expect(() => parse("")).toThrowErrorMatchingInlineSnapshot(`
      "could not parse changeset - file is empty.
      Changesets must have frontmatter with package names and version types.
      Example:
      ---
      "package-name": patch
      ---

      Your changeset summary here."
    `);
    expect(() => parse("   ")).toThrowErrorMatchingInlineSnapshot(`
      "could not parse changeset - file is empty.
      Changesets must have frontmatter with package names and version types.
      Example:
      ---
      "package-name": patch
      ---

      Your changeset summary here."
    `);
    expect(() => parse("\n\n")).toThrowErrorMatchingInlineSnapshot(`
      "could not parse changeset - file is empty.
      Changesets must have frontmatter with package names and version types.
      Example:
      ---
      "package-name": patch
      ---

      Your changeset summary here."
    `);
  });

  it("should throw when frontmatter is missing", () => {
    const changesetMd = "Just some content without frontmatter";
    expect(() => parse(changesetMd)).toThrowErrorMatchingInlineSnapshot(`
      "could not parse changeset - missing or invalid frontmatter.
      Changesets must start with frontmatter delimited by "---".
      Example:
      ---
      "package-name": patch
      ---

      Your changeset summary here.

      Received content:
      Just some content without frontmatter"
    `);
  });

  it("should throw when version type is invalid", () => {
    const changesetMd = outdent`---
    "cool-package": invalid-type
    ---

    Nice simple summary
    `;

    expect(() => parse(changesetMd)).toThrowErrorMatchingInlineSnapshot(`
      "could not parse changeset - invalid version type "invalid-type" for package "cool-package".
      Valid version types are: major, minor, patch, none
      Changeset contents:
      ---
      "cool-package": invalid-type
      ---

      Nice simple summary"
    `);
  });

  it("should throw with helpful message when package name is empty", () => {
    const changesetMd = outdent`---
    "": minor
    ---

    Nice simple summary
    `;

    expect(() => parse(changesetMd)).toThrowErrorMatchingInlineSnapshot(`
      "could not parse changeset - invalid package name in frontmatter.
      Expected a non-empty string for package name, but got: ""
      Make sure your changeset frontmatter follows this format:
      ---
      "package-name": patch
      ---"
    `);
  });
});
