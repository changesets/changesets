import fs from "node:fs/promises";
import path from "node:path";
import { detect as detectFormatter, format } from "@changesets/format";
import { parseChangesetFile as parse } from "@changesets/parse";
import { testdir } from "@changesets/test-utils";
import { humanId } from "human-id";
import { describe, expect, it, vi } from "vitest";
import { writeChangeset } from "./index.ts";

vi.mock("human-id");
const mockedHumanId = vi.mocked(humanId);

vi.mock(import("@changesets/format"), async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    detect: vi.fn(mod.detect),
    format: vi.fn(mod.format),
  };
});

describe("simple project", () => {
  it("should write a changeset", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    const changesetID = "ascii";
    mockedHumanId.mockReturnValueOnce(changesetID);

    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd,
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
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    const changesetID = "ascii";
    mockedHumanId.mockReturnValueOnce(changesetID);

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
      },
    );

    expect(detectFormatter).not.toHaveBeenCalled();
    expect(format).not.toHaveBeenCalled();
  });

  it("should format if user doesn't opt out", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
        prettier: {},
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    const changesetID = "ascii";
    mockedHumanId.mockReturnValueOnce(changesetID);

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
    );

    const mdPath = path.join(cwd, ".changeset", `${changesetID}.md`);

    expect(detectFormatter).toHaveReturnedWith(Promise.resolve("prettier"));
    expect(format).toHaveBeenCalledWith([mdPath], {
      cwd,
      formatter: "prettier",
    });
  });

  it("should write an empty changeset", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    const changesetID = "ascii";
    mockedHumanId.mockReturnValueOnce(changesetID);

    await writeChangeset(
      {
        summary: "",
        releases: [],
      },
      cwd,
    );

    const mdPath = path.join(cwd, ".changeset", `${changesetID}.md`);
    const mdContent = await fs.readFile(mdPath, "utf8");

    expect(parse(mdContent)).toEqual({
      summary: "",
      releases: [],
    });
  });
});
