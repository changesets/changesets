import getDependents from "./";

describe("get dependents", () => {
  it("should return a basic dependency update", () => {
    const map = new Map();
    map.set("cool-package", ["best-package"]);
    map.set("best-package", []);

    const dependents = getDependents(
      {
        id: "of course",
        summary: "some string",
        releases: [{ name: "cool-package", type: "patch" }]
      },
      [
        {
          name: "cool-package",
          config: { name: "cool-package", version: "1.0.0" },
          dir: ""
        },
        {
          name: "best-package",
          config: {
            name: "best-package",
            version: "1.0.0",
            dependencies: {
              "cool-package": "1.0.0"
            }
          },
          dir: ""
        }
      ],
      map
    );
    expect(dependents).toEqual([{ name: "best-package", type: "patch" }]);
  });
  it("should return a peerDep update", () => {
    const map = new Map();
    map.set("cool-package", ["best-package"]);
    map.set("best-package", []);

    const dependents = getDependents(
      {
        id: "of course",
        summary: "some string",
        releases: [{ name: "cool-package", type: "patch" }]
      },
      [
        {
          name: "cool-package",
          config: { name: "cool-package", version: "1.0.0" },
          dir: ""
        },
        {
          name: "best-package",
          config: {
            name: "best-package",
            version: "1.0.0",
            peerDependencies: {
              "cool-package": "1.0.0"
            }
          },
          dir: ""
        }
      ],
      map
    );
    expect(dependents).toEqual([{ name: "best-package", type: "major" }]);
  });
  it("should return an empty array when no dependencies are to be updated", () => {
    const map = new Map();
    map.set("cool-package", ["best-package"]);
    map.set("best-package", []);

    const dependents = getDependents(
      {
        id: "of course",
        summary: "some string",
        releases: [{ name: "cool-package", type: "patch" }]
      },
      [
        {
          name: "cool-package",
          config: { name: "cool-package", version: "1.0.0" },
          dir: ""
        },
        {
          name: "best-package",
          config: {
            name: "best-package",
            version: "1.0.0",
            dependencies: {
              "cool-package": "^1.0.0"
            }
          },
          dir: ""
        }
      ],
      map
    );
    expect(dependents).toEqual([]);
  });
  it("should update multiple dependencies", () => {
    const map = new Map();
    map.set("cool-package", ["best-package", "silly-package"]);
    map.set("best-package", ["silly-package"]);
    map.set("silly-package", []);

    const dependents = getDependents(
      {
        id: "of course",
        summary: "some string",
        releases: [{ name: "cool-package", type: "patch" }]
      },
      [
        {
          name: "cool-package",
          config: { name: "cool-package", version: "1.0.0" },
          dir: ""
        },
        {
          name: "best-package",
          config: {
            name: "best-package",
            version: "1.0.0",
            dependencies: {
              "cool-package": "1.0.0"
            }
          },
          dir: ""
        },
        {
          name: "silly-package",
          config: {
            name: "silly-package",
            version: "1.0.0",
            dependencies: {
              "best-package": "1.0.0",
              "cool-package": "1.0.0"
            }
          },
          dir: ""
        }
      ],
      map
    );
    expect(dependents).toEqual([
      { name: "best-package", type: "patch" },
      { name: "silly-package", type: "patch" }
    ]);
  });
  it("should update a second dependent based on updating a first dependant", () => {
    const map = new Map();
    map.set("cool-package", ["best-package"]);
    map.set("best-package", ["silly-package"]);
    map.set("silly-package", []);

    const dependents = getDependents(
      {
        id: "of course",
        summary: "some string",
        releases: [{ name: "cool-package", type: "patch" }]
      },
      [
        {
          name: "cool-package",
          config: { name: "cool-package", version: "1.0.0" },
          dir: ""
        },
        {
          name: "best-package",
          config: {
            name: "best-package",
            version: "1.0.0",
            dependencies: {
              "cool-package": "1.0.0"
            }
          },
          dir: ""
        },
        {
          name: "silly-package",
          config: {
            name: "silly-package",
            version: "1.0.0",
            dependencies: {
              "best-package": "1.0.0"
            }
          },
          dir: ""
        }
      ],
      map
    );
    expect(dependents).toEqual([
      { name: "best-package", type: "patch" },
      { name: "silly-package", type: "patch" }
    ]);
  });
});
