import { outdent } from "outdent";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { FrontMatterSchema, StringWithoutPrefix } from "./frontmatter.ts";

describe("StringWithoutPrefix", () => {
  it("should strip prefix", () => {
    const schema = v.pipe(v.string(), StringWithoutPrefix("@"));
    const { output } = v.safeParse(schema, "@foo");
    expect(output).toStrictEqual("foo");
  });

  it("should not affect string without prefix", () => {
    const schema = v.pipe(v.string(), StringWithoutPrefix("@"));
    const { output } = v.safeParse(schema, "foo");
    expect(output).toStrictEqual("foo");
  });

  it("should handle regex characters correctly", () => {
    const schema = v.pipe(v.string(), StringWithoutPrefix("(te"));
    const { output } = v.safeParse(schema, "(test");
    expect(output).toStrictEqual("st");
  });
});

it("should parse a simple frontmatter correctly", () => {
  const changesetMd = outdent`
    "cool-package": minor
    "cool-package2": major
    "cool-package3": patch
  `;

  const data = parse(changesetMd);
  const { output, issues } = v.safeParse(FrontMatterSchema, data);

  expect(issues).toBeUndefined();
  expect(output).toMatchInlineSnapshot(`
    {
      "cool-package": "minor",
      "cool-package2": "major",
      "cool-package3": "patch",
    }
  `);
});

it("should parse a frontmatter with _ key", () => {
  const changesetMd = outdent`
    _:
      pr: 1337
    "cool-package": minor
  `;

  const data = parse(changesetMd);
  const { output, issues } = v.safeParse(FrontMatterSchema, data);

  expect(issues).toBeUndefined();
  expect(output).toMatchInlineSnapshot(`
    {
      "_": {
        "pr": 1337,
      },
      "cool-package": "minor",
    }
  `);
});

it("should parse a frontmatter with only the _ key", () => {
  const changesetMd = outdent`
    _:
      author: "@someone"
      commit: "#abc123"
  `;

  const data = parse(changesetMd);
  const { output, issues } = v.safeParse(FrontMatterSchema, data);

  expect(issues).toBeUndefined();
  expect(output).toStrictEqual({
    _: { author: "someone", commit: "abc123" },
  });
});

it("should report invalid options in the _ key", () => {
  const changesetMd = outdent`
    _:
      pr: not-a-number
      unknown: true
    "cool-package": minor
  `;

  const data = parse(changesetMd);
  const { issues } = v.safeParse(FrontMatterSchema, data);

  expect(
    issues?.map((issue) => ({
      path: v.getDotPath(issue),
      type: issue.type,
    })),
  ).toStrictEqual([
    { path: "_.pr", type: "number" },
    { path: "_.unknown", type: "strict_object" },
  ]);
});

it("should report invalid packages next to the _ key", () => {
  const changesetMd = outdent`
    _:
      pr: 1337
    "cool-package": invalid-type
    "": minor
  `;

  const data = parse(changesetMd);
  const { issues } = v.safeParse(FrontMatterSchema, data);

  expect(
    issues?.map((issue) => ({
      path: v.getDotPath(issue),
      message: issue.message,
    })),
  ).toStrictEqual([
    { path: "cool-package", message: "Invalid change type" },
    { path: "", message: "Package name can't be empty." },
  ]);
});
