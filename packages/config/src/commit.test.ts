import outdent from "outdent";
import { getAddLine, getVersionLine } from "./commit";
import { NewChangeset, ReleasePlan } from "@changesets/types";

const simpleChangeset: NewChangeset = {
  summary: "This is a summary",
  releases: [{ name: "package-a", type: "minor" }],
  id: "abc123xy"
};

const simpleChangeset2: NewChangeset = {
  summary: "This is another summary",
  releases: [
    { name: "package-a", type: "patch" },
    { name: "package-b", type: "minor" }
  ],
  id: "abc123fh"
};

let simpleReleasePlan: ReleasePlan = {
  changesets: [simpleChangeset],
  releases: [
    {
      name: "package-a",
      type: "minor",
      oldVersion: "1.0.0",
      newVersion: "1.1.0",
      changesets: [simpleChangeset.id]
    }
  ],
  preState: undefined
};

let secondReleasePlan: ReleasePlan = {
  changesets: [simpleChangeset, simpleChangeset2],
  releases: [
    {
      name: "package-a",
      type: "minor",
      oldVersion: "1.0.0",
      newVersion: "1.1.0",
      changesets: [simpleChangeset.id]
    },
    {
      name: "package-b",
      type: "minor",
      oldVersion: "1.0.0",
      newVersion: "1.1.0",
      changesets: [simpleChangeset2.id]
    }
  ],
  preState: undefined
};

describe("commit functions", () => {
  it("should handle a simple changeset", () => {
    const commitStr = getAddLine(
      {
        summary: "test changeset summary commit",
        releases: [
          {
            name: "package-a",
            type: "minor"
          }
        ]
      },
      { skipCI: false }
    );
    expect(commitStr).toEqual(`docs(changeset): test changeset summary commit`);
  });

  it("should handle a simple changeset - skipCI", () => {
    const commitStr = getAddLine(
      {
        summary: "test changeset summary commit",
        releases: [
          {
            name: "package-a",
            type: "minor"
          }
        ]
      },
      { skipCI: true }
    );
    expect(commitStr).toEqual(
      outdent`docs(changeset): test changeset summary commit
    
      [skip ci]

      `
    );
  });

  it("should handle a single simple releaseObject with one released package", () => {
    const commitStr = getVersionLine(simpleReleasePlan, {
      skipCI: false
    });
    expect(commitStr).toEqual(outdent`
      RELEASING: Releasing 1 package(s)

      Releases:
        package-a@1.1.0
    
      `);
  });

  it("should handle a single simple releaseObject with one released package - skipCI", () => {
    const commitStr = getVersionLine(simpleReleasePlan, { skipCI: true });
    expect(commitStr).toEqual(outdent`
      RELEASING: Releasing 1 package(s)

      Releases:
        package-a@1.1.0

      [skip ci]
    
      `);
  });

  it("should handle a multiple releases from one changeset", () => {
    let releasePlan: ReleasePlan = {
      changesets: [simpleChangeset, simpleChangeset2],
      releases: [
        {
          name: "package-a",
          type: "patch",
          oldVersion: "1.0.0",
          newVersion: "1.0.1",
          changesets: [simpleChangeset.id]
        },
        {
          name: "package-b",
          type: "minor",
          oldVersion: "1.0.0",
          newVersion: "1.1.0",
          changesets: [simpleChangeset2.id]
        }
      ],
      preState: undefined
    };
    const commitStr = getVersionLine(releasePlan, { skipCI: true });
    expect(commitStr).toEqual(outdent`
      RELEASING: Releasing 2 package(s)

      Releases:
        package-a@1.0.1
        package-b@1.1.0

      [skip ci]
    
    `);
  });

  it("should handle a merging releases from multiple changesets", () => {
    const commitStr = getVersionLine(secondReleasePlan, { skipCI: true });

    expect(commitStr).toEqual(outdent`
      RELEASING: Releasing 2 package(s)

      Releases:
        package-a@1.1.0
        package-b@1.1.0

      [skip ci]
    
    `);
  });
});
