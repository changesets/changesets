import { outdent } from "outdent";
import * as v from "valibot";
import { expect, it } from "vitest";
import { parse } from "yaml";
import { FrontMatterSchema } from "./frontmatter.ts";

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
      author: "someone"
      commit: "abc123"
  `;

  const data = parse(changesetMd);
  const { output, issues } = v.safeParse(FrontMatterSchema, data);

  expect(issues).toBeUndefined();
  expect(output).toStrictEqual({
    _: { author: "someone", commit: "abc123" },
  });
});

it("should parse a list correctly", () => {
  const changesetMd = outdent`
    _:
      author:
        - "@foo"
        - "@bar"
  `;

  const data = parse(changesetMd);
  const { output, issues } = v.safeParse(FrontMatterSchema, data);

  expect(issues).toBeUndefined();
  expect(output).toStrictEqual({
    _: { author: ["@foo", "@bar"] },
  });
});

it("should report include extra metadata under _", () => {
  const changesetMd = outdent`
    _:
      pr: 1337
      unknown: true
    "cool-package": minor
  `;

  const data = parse(changesetMd);
  const { success, issues, output } = v.safeParse(FrontMatterSchema, data);

  expect(issues).not.toBeDefined();
  expect.assert(success);

  expect(output!._).toStrictEqual({ pr: 1337, unknown: true });
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
    {
      path: "cool-package",
      message: "Invalid change type (valid ones are major, minor, patch, none)",
    },
    { path: "", message: "Package name can't be empty." },
  ]);
});
