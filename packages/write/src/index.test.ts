import { vi } from "vitest";
import fs from "node:fs/promises";
import path from "path";
import parse from "@changesets/parse";
import writeChangeset from "./index.ts";

import humanId from "human-id";
import { testdir } from "@changesets/test-utils";
import { formatly, resolveFormatter } from "formatly";

vi.mock("human-id");
vi.mock("formatly", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    formatly: vi.fn((...args) => actual.formatly(...args)),
    resolveFormatter: vi.fn((...args) => actual.resolveFormatter(...args)),
  };
});

describe("simple project", () => {
  it("should write a changeset", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    const changesetID = "ascii";
    // @ts-ignore
    humanId.mockReturnValueOnce(changesetID);

    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd
    );

    const mdPath = path.join(cwd, ".changeset", `${changesetID}.md`);
    const mdContent = await fs.readFile(mdPath, "utf8");

    expect(parse(mdContent)).toEqual({
      summary: "This is a summary",
      releases: [{ name: "pkg-a", type: "minor" }],
    });
  });

  it("should not format if user opts out", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    const changesetID = "ascii";
    // @ts-ignore
    humanId.mockReturnValueOnce(changesetID);

    const summary = `This is a summary
~~~html
<style>custom-element::part(thing) {color:blue}</style>
~~~`;

    await writeChangeset(
      {
        summary,
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd,
      {
        format: false,
      }
    );

    expect(resolveFormatter).not.toHaveBeenCalled();
    expect(formatly).not.toHaveBeenCalled();
  });

  it("should format if user doesn't opt out", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
        prettier: {},
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    const changesetID = "ascii";
    // @ts-ignore
    humanId.mockReturnValueOnce(changesetID);

    const summary = `This is a summary
~~~html
<style>custom-element::part(thing) {color:blue}</style>
~~~`;

    await writeChangeset(
      {
        summary,
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd
    );

    const mdPath = path.join(cwd, ".changeset", `${changesetID}.md`);
    expect(resolveFormatter).toReturnWith(Promise.resolve("prettier"));
    expect(formatly).toHaveBeenCalledWith([mdPath], {
      cwd,
      formatter: "prettier",
    });
  });

  it("should write an empty changeset", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    const changesetID = "ascii";
    // @ts-ignore
    humanId.mockReturnValueOnce(changesetID);

    await writeChangeset(
      {
        summary: "",
        releases: [],
      },
      cwd
    );

    const mdPath = path.join(cwd, ".changeset", `${changesetID}.md`);
    const mdContent = await fs.readFile(mdPath, "utf8");

    expect(parse(mdContent)).toEqual({
      summary: "",
      releases: [],
    });
  });
});
