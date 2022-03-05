import outdent from "outdent";
import { getCommitFuncs } from ".";
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

describe("defaultCommitFunctions", () => {
  const [{ getAddMessage, getVersionMessage }, commitOpts] = getCommitFuncs(
    true,
    ""
  );

  it("should handle a simple changeset", async () => {
    const commitStr = await getAddMessage(
      {
        summary: "test changeset summary commit",
        releases: [
          {
            name: "package-a",
            type: "minor"
          }
        ]
      },
      commitOpts
    );
    expect(commitStr).toEqual(`docs(changeset): test changeset summary commit`);
  });

  it("should handle a single simple releaseObject with one released package", async () => {
    const commitStr = await getVersionMessage(simpleReleasePlan, commitOpts);
    expect(commitStr).toEqual(outdent`
      RELEASING: Releasing 1 package(s)

      Releases:
        package-a@1.1.0

      [skip ci]
    
      `);
  });

  it("should handle a multiple releases from one changeset", async () => {
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
    const commitStr = await getVersionMessage(releasePlan, commitOpts);
    expect(commitStr).toEqual(outdent`
      RELEASING: Releasing 2 package(s)

      Releases:
        package-a@1.0.1
        package-b@1.1.0

      [skip ci]
    
    `);
  });

  it("should handle a merging releases from multiple changesets", async () => {
    const commitStr = await getVersionMessage(secondReleasePlan, commitOpts);

    expect(commitStr).toEqual(outdent`
      RELEASING: Releasing 2 package(s)

      Releases:
        package-a@1.1.0
        package-b@1.1.0

      [skip ci]
    
    `);
  });
});
