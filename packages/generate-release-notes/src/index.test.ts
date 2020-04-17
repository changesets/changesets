import {
  ChangelogFunctions,
  ReleasePlan,
  NewChangesetWithCommit
} from "@changesets/types";
import outdent from "outdent";

import generateReleaseNotes from ".";
import { Packages } from "@manypkg/get-packages";

let defaultChangelogFunctions: ChangelogFunctions = {
  getDependencyReleaseLine: a =>
    Promise.resolve(a.map(a => a.summary).join("\n")),
  getReleaseLine: a => Promise.resolve(a.summary)
};

let defaultPackages: Packages = {
  root: {
    packageJson: { name: "", version: "" },
    dir: "/"
  },
  packages: [
    {
      packageJson: { name: "package-a", version: "1.0.0" },
      dir: "/packages/a"
    },
    {
      packageJson: { name: "package-b", version: "1.0.0" },
      dir: "/packages/b"
    }
  ],
  tool: "yarn"
};

const simpleChangeset: NewChangesetWithCommit = {
  summary: "basic summary let us see",
  releases: [{ name: "package-a", type: "minor" }],
  id: "currently-irrelevant.jpg"
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
  preState: undefined,
  globalChangeset: undefined
};

let twoPackageReleasePlan: ReleasePlan = {
  changesets: [simpleChangeset],
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
      changesets: [simpleChangeset.id]
    }
  ],
  preState: undefined,
  globalChangeset: undefined
};

let threeChangeset: NewChangesetWithCommit[] = [
  simpleChangeset,
  {
    summary: "such major drama",
    releases: [{ name: "package-a", type: "major" }],
    id: "slightly-relevant.jpg"
  },
  {
    summary: "just a patch on you",
    releases: [{ name: "package-a", type: "patch" }],
    id: "whatevers.jpg"
  }
];

let allRangeTypeReleasePlan: ReleasePlan = {
  changesets: [simpleChangeset],
  releases: [
    {
      name: "package-a",
      type: "major",
      oldVersion: "1.0.0",
      newVersion: "2.0.0",
      changesets: threeChangeset.map(c => c.id)
    }
  ],
  preState: undefined,
  globalChangeset: undefined
};

describe("generate-release-notes", () => {
  it("should generate basic release notes", async () => {
    let releasePlan = {
      ...simpleReleasePlan,
      globalChangeset: {
        name: "alpha",
        summary: "This is our alpha release!"
      }
    };

    let releaseNotes = await generateReleaseNotes(
      releasePlan,
      [simpleChangeset],
      defaultPackages,
      [defaultChangelogFunctions, undefined]
    );

    expect(releaseNotes).toEqual(outdent`## alpha

    This is our alpha release!
    
    ### package-a@1.1.0
    #### Minor Changes
    
    basic summary let us see
    
    `);
  });
  it("should generate basic release notes for two packages", async () => {
    let releasePlan = {
      ...twoPackageReleasePlan,
      globalChangeset: {
        name: "alpha",
        summary: "This is our alpha release!"
      }
    };

    let releaseNotes = await generateReleaseNotes(
      releasePlan,
      [simpleChangeset],
      defaultPackages,
      [defaultChangelogFunctions, undefined]
    );

    expect(releaseNotes).toEqual(outdent`## alpha

    This is our alpha release!
    
    ### package-a@1.1.0
    #### Minor Changes
    
    basic summary let us see

    ---

    ### package-b@1.1.0
    `);
  });
  it("should be fine if no summary is an empty string", async () => {
    let releasePlan = {
      ...simpleReleasePlan,
      globalChangeset: {
        name: "alpha",
        summary: ""
      }
    };

    let releaseNotes = await generateReleaseNotes(
      releasePlan,
      [simpleChangeset],
      defaultPackages,
      [defaultChangelogFunctions, undefined]
    );

    expect(releaseNotes).toEqual(outdent`## alpha
    
    ### package-a@1.1.0
    #### Minor Changes
    
    basic summary let us see
    
    `);
  });
  it("should be fine FOR GENERATING A SUMMARY if no name is provided", async () => {
    let releasePlan = {
      ...simpleReleasePlan,
      globalChangeset: {
        name: "",
        summary: ""
      }
    };

    let releaseNotes = await generateReleaseNotes(
      releasePlan,
      [simpleChangeset],
      defaultPackages,
      [defaultChangelogFunctions, undefined]
    );

    expect(releaseNotes).toEqual(outdent`### package-a@1.1.0
    #### Minor Changes
    
    basic summary let us see
    
    `);
  });
  it("should generate basic release notes for major minor and patch for a single package", async () => {
    let releasePlan = {
      ...allRangeTypeReleasePlan,
      globalChangeset: {
        name: "alpha",
        summary: "This is our alpha release!"
      }
    };

    let releaseNotes = await generateReleaseNotes(
      releasePlan,
      threeChangeset,
      defaultPackages,
      [defaultChangelogFunctions, undefined]
    );

    expect(releaseNotes).toEqual(outdent`## alpha
  
      This is our alpha release!
      
      ### package-a@2.0.0
      #### Major Changes

      such major drama
      
      #### Minor Changes
      
      basic summary let us see

      #### Patch Changes

      just a patch on you
      
      `);
  });
});
