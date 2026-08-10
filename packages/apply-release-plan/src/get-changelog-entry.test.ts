import { describe, expect, it } from "vitest";
import { generateMarkdownForVersionType } from "./get-changelog-entry.ts";

describe("generateMarkdownForVersionType", () => {
  it("returns undefined when there are empty lines", () => {
    expect(generateMarkdownForVersionType("patch", ["", ""])).toBeUndefined();
  });

  it("returns proper heading based on version type", () => {
    expect.soft(generateMarkdownForVersionType("major", ["- something"]))
      .toMatchInlineSnapshot(`
      "### Major Changes

      - something"
    `);
    expect.soft(generateMarkdownForVersionType("minor", ["- something"]))
      .toMatchInlineSnapshot(`
      "### Minor Changes

      - something"
    `);
    expect.soft(generateMarkdownForVersionType("patch", ["- something"]))
      .toMatchInlineSnapshot(`
      "### Patch Changes

      - something"
    `);
  });

  it("trims surrounding whitespace from release lines", () => {
    expect(generateMarkdownForVersionType("minor", ["\n  - something  \n"]))
      .toMatchInlineSnapshot(`
			"### Minor Changes

			- something"
		`);
  });

  it("keeps preferred spacing between entries clamped between one and two new lines", () => {
    expect(
      generateMarkdownForVersionType("patch", [
        "trimmed",
        "\nleading one",
        "\n\nleading two",
        "\n\n\nleading three",
        "trailing one\n",
        "trailing two\n\n",
        "trailing three\n\n\n",
        "\nmixed one\n",
        "\n\nmixed two\n\n",
        "\n\n\nmixed three\n\n\n",
      ]),
    ).toMatchInlineSnapshot(`
      "### Patch Changes

      trimmed
      leading one

      leading two

      leading three
      trailing one
      trailing two

      trailing three

      mixed one

      mixed two

      mixed three"
    `);
  });
});
