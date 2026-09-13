import type {
  ChangelogFunctions,
  ModCompWithPackage,
  NewChangesetWithCommit,
} from "@changesets/types";
import { describe, expect, it } from "vitest";
import {
  generateMarkdownForVersionType,
  getChangelogEntry,
} from "./get-changelog-entry.ts";

function makeChangeset(id: string, release: string): NewChangesetWithCommit {
  return {
    id,
    summary: `change ${id}`,
    releases: [{ name: release, type: "patch" }],
    commit: `${id}-commit`,
  };
}

function makeRelease(
  name: string,
  dependencies: Record<string, string>,
  changesets: string[],
): ModCompWithPackage {
  return {
    name,
    type: "patch",
    oldVersion: "1.0.0",
    newVersion: "1.0.1",
    changesets,
    dir: `/repo/${name}`,
    packageJson: { name, version: "1.0.0", dependencies },
  };
}

// Returns the changesets a package's "Updated dependencies" line would render.
async function getDependencyChangesets(
  target: string,
  releases: ModCompWithPackage[],
  changesets: NewChangesetWithCommit[],
  config: {
    updateInternalDependents?: "always" | "out-of-range";
    updateInternalDependencies?: "patch" | "minor";
  } = {},
): Promise<NewChangesetWithCommit[]> {
  let recorded: NewChangesetWithCommit[] = [];
  const funcs: ChangelogFunctions = {
    getReleaseLine: async () => "",
    getDependencyReleaseLine: async (cs) => {
      recorded = cs;
      return "";
    },
  };
  await getChangelogEntry(
    "/repo",
    releases.find((r) => r.name === target)!,
    releases,
    changesets,
    funcs,
    null,
    {
      updateInternalDependencies: config.updateInternalDependencies ?? "patch",
      updateInternalDependents:
        config.updateInternalDependents ?? "out-of-range",
      onlyUpdatePeerDependentsWhenOutOfRange: false,
    },
  );
  return recorded;
}

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

describe("getChangelogEntry", () => {
  it("traces a transitive dependency update back to the origin changeset", async () => {
    // a -> b -> c, where only c carries a changeset. a's "Updated dependencies"
    // line should still resolve to c's commit instead of an empty ref.
    const releases = [
      makeRelease("a", { b: "^1.0.0" }, []),
      makeRelease("b", { c: "^1.0.0" }, []),
      makeRelease("c", {}, ["changeset-c"]),
    ];
    const changesets = [makeChangeset("changeset-c", "c")];

    const changesetIds = await getDependencyChangesets(
      "a",
      releases,
      changesets,
    ).then((cs) => cs.map((cs) => cs.id));

    expect(changesetIds).toEqual(["changeset-c"]);
  });

  it("does not over-resolve a dependency that has its own changesets", async () => {
    // a -> b -> c, where b changed directly. a's update of b is attributed to
    // b's changeset; the deeper c update is b's concern, not a's.
    const releases = [
      makeRelease("a", { b: "^1.0.0" }, []),
      makeRelease("b", { c: "^1.0.0" }, ["changeset-b"]),
      makeRelease("c", {}, ["changeset-c"]),
    ];
    const changesets = [
      makeChangeset("changeset-b", "b"),
      makeChangeset("changeset-c", "c"),
    ];

    const changesetIds = await getDependencyChangesets(
      "a",
      releases,
      changesets,
    ).then((cs) => cs.map((cs) => cs.id));

    expect(changesetIds).toEqual(["changeset-b"]);
  });

  it("deduplicates shared origin changesets across siblings", async () => {
    // a depends on b and c, both released purely because of d. Only one commit
    // ref should surface.
    const releases = [
      makeRelease("a", { b: "^1.0.0", c: "^1.0.0" }, []),
      makeRelease("b", { d: "^1.0.0" }, []),
      makeRelease("c", { d: "^1.0.0" }, []),
      makeRelease("d", {}, ["changeset-d"]),
    ];
    const changesets = [makeChangeset("changeset-d", "d")];

    const changesetIds = await getDependencyChangesets(
      "a",
      releases,
      changesets,
    ).then((cs) => cs.map((cs) => cs.id));

    expect(changesetIds).toEqual(["changeset-d"]);
  });

  it("lists an in-range dependency when updateInternalDependents is always", async () => {
    // a -> b. b is a patch bump within a's range, and a only bumps internal
    // deps of at least "minor" type, so under "out-of-range" b is not listed.
    // "always" mirrors assemble-release-plan, which bumps a for every internal
    // dependency update, so b's commit should still surface.
    const releases = [
      makeRelease("a", { b: "^1.0.0" }, []),
      makeRelease("b", {}, ["changeset-b"]),
    ];
    const changesets = [makeChangeset("changeset-b", "b")];

    const changesetIds = await getDependencyChangesets(
      "a",
      releases,
      changesets,
      {
        updateInternalDependents: "always",
        updateInternalDependencies: "minor",
      },
    ).then((cs) => cs.map((cs) => cs.id));

    expect(changesetIds).toEqual(["changeset-b"]);
  });

  it("does not list an in-range dependency when updateInternalDependents is out-of-range", async () => {
    // a -> b. b is a patch bump within a's range, and a only bumps internal
    // deps of at least "minor" type, so under the default "out-of-range"
    // behavior b is not listed and its commit does not surface.
    const releases = [
      makeRelease("a", { b: "^1.0.0" }, []),
      makeRelease("b", {}, ["changeset-b"]),
    ];
    const changesets = [makeChangeset("changeset-b", "b")];

    const changesetIds = await getDependencyChangesets(
      "a",
      releases,
      changesets,
      {
        updateInternalDependents: "out-of-range",
        updateInternalDependencies: "minor",
      },
    ).then((cs) => cs.map((cs) => cs.id));

    expect(changesetIds).toEqual([]);
  });

  it("handles dependency cycles without infinite recursion", async () => {
    const releases = [
      makeRelease("a", { b: "^1.0.0" }, []),
      makeRelease("b", { a: "^1.0.0" }, []),
    ];
    const changesets: NewChangesetWithCommit[] = [];

    const changesetIds = await getDependencyChangesets(
      "a",
      releases,
      changesets,
    ).then((cs) => cs.map((cs) => cs.id));

    expect(changesetIds).toEqual([]);
  });
});
